import * as vscode from 'vscode';
import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { AuditService } from '../services/audit';

// PHI Pattern definitions with confidence levels
type ContextType = 'code' | 'filename' | 'data' | 'comment' | 'general';

interface PhiPattern {
  id: string;
  name: string;
  pattern: RegExp;
  category: 'direct' | 'quasi' | 'indirect';
  hipaaIdentifier: string;
  baseConfidence: number;
  contextModifiers?: Partial<Record<ContextType, number>>;
}

const PHI_PATTERNS: PhiPattern[] = [
  // Direct Identifiers (High Confidence)
  {
    id: 'ssn',
    name: 'Social Security Number',
    pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    category: 'direct',
    hipaaIdentifier: 'Social Security number',
    baseConfidence: 95,
    contextModifiers: { code: -30, filename: +5 }
  },
  {
    id: 'mrn',
    name: 'Medical Record Number',
    pattern: /\b(?:MRN|mrn|Medical Record|medical_record)[:\s#]*\d{5,12}\b/gi,
    category: 'direct',
    hipaaIdentifier: 'Medical record numbers',
    baseConfidence: 90
  },
  {
    id: 'medicare_id',
    name: 'Medicare Beneficiary Identifier',
    pattern: /\b[1-9][A-Za-z][A-Za-z0-9]\d[A-Za-z][A-Za-z0-9]\d[A-Za-z]{2}\d{2}\b/g,
    category: 'direct',
    hipaaIdentifier: 'Health plan beneficiary numbers',
    baseConfidence: 92
  },
  {
    id: 'health_plan_id',
    name: 'Health Plan ID',
    pattern: /\b(?:member_?id|subscriber_?id|policy_?(?:number|num|no)|group_?(?:number|num|no))[:\s]*[A-Z0-9]{6,20}\b/gi,
    category: 'direct',
    hipaaIdentifier: 'Health plan beneficiary numbers',
    baseConfidence: 75
  },
  
  // Names (Context-dependent)
  {
    id: 'patient_name_explicit',
    name: 'Explicit Patient Name',
    pattern: /\b(?:patient[_\s]?name|resident[_\s]?name|client[_\s]?name)[:\s]*["']?([A-Z][a-z]+ [A-Z][a-z]+)["']?/gi,
    category: 'direct',
    hipaaIdentifier: 'Names',
    baseConfidence: 88
  },
  {
    id: 'person_name',
    name: 'Person Name (Generic)',
    pattern: /\b(?:name)[:\s]*["']([A-Z][a-z]+ [A-Z][a-z]+)["']/g,
    category: 'quasi',
    hipaaIdentifier: 'Names',
    baseConfidence: 60,
    contextModifiers: { data: +20, code: -20 }
  },

  // Contact Information
  {
    id: 'phone',
    name: 'Phone Number',
    pattern: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    category: 'direct',
    hipaaIdentifier: 'Telephone numbers',
    baseConfidence: 65,
    contextModifiers: { code: -30, data: +20 }
  },
  {
    id: 'email',
    name: 'Email Address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    category: 'direct',
    hipaaIdentifier: 'Email addresses',
    baseConfidence: 60,
    contextModifiers: { code: -40, data: +25 }
  },

  // Dates
  {
    id: 'dob_explicit',
    name: 'Date of Birth (Explicit)',
    pattern: /\b(?:dob|date[_\s]?of[_\s]?birth|birth[_\s]?date)[:\s]*["']?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}["']?/gi,
    category: 'direct',
    hipaaIdentifier: 'Dates (except year)',
    baseConfidence: 92
  },
  {
    id: 'date_service',
    name: 'Date of Service',
    pattern: /\b(?:dos|date[_\s]?of[_\s]?service|service[_\s]?date|admission[_\s]?date|discharge[_\s]?date)[:\s]*["']?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}["']?/gi,
    category: 'quasi',
    hipaaIdentifier: 'Dates (except year)',
    baseConfidence: 70
  },

  // Addresses
  {
    id: 'street_address',
    name: 'Street Address',
    pattern: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Circle|Cir)\b/gi,
    category: 'direct',
    hipaaIdentifier: 'Geographic data',
    baseConfidence: 75,
    contextModifiers: { code: -35 }
  },
  {
    id: 'zip_code',
    name: 'ZIP Code',
    pattern: /\b(?:zip|postal)[_\s]?(?:code)?[:\s]*\d{5}(?:-\d{4})?\b/gi,
    category: 'direct',
    hipaaIdentifier: 'Geographic data (ZIP codes)',
    baseConfidence: 55,
    contextModifiers: { data: +20 }
  },

  // Account Numbers
  {
    id: 'account_number',
    name: 'Account Number',
    pattern: /\b(?:account[_\s]?(?:number|num|no|#)|acct[_\s]?(?:number|num|no|#))[:\s]*[A-Z0-9]{6,20}\b/gi,
    category: 'direct',
    hipaaIdentifier: 'Account numbers',
    baseConfidence: 70
  },

  // Device Identifiers
  {
    id: 'device_id',
    name: 'Device Identifier',
    pattern: /\b(?:device[_\s]?(?:id|identifier|serial)|serial[_\s]?(?:number|num|no))[:\s]*[A-Z0-9\-]{8,30}\b/gi,
    category: 'direct',
    hipaaIdentifier: 'Device identifiers and serial numbers',
    baseConfidence: 65
  },

  // Biometric
  {
    id: 'fingerprint',
    name: 'Fingerprint Data',
    pattern: /\b(?:fingerprint|biometric)[_\s]?(?:data|hash|id)[:\s]*[A-Za-z0-9+\/=]{20,}/gi,
    category: 'direct',
    hipaaIdentifier: 'Biometric identifiers',
    baseConfidence: 85
  },

  // URLs and IPs
  {
    id: 'ip_address',
    name: 'IP Address',
    pattern: /\b(?:patient[_\s]?ip|client[_\s]?ip|user[_\s]?ip)[:\s]*(?:\d{1,3}\.){3}\d{1,3}\b/gi,
    category: 'direct',
    hipaaIdentifier: 'IP addresses',
    baseConfidence: 80
  },

  // Vehicle/License
  {
    id: 'license_plate',
    name: 'License Plate',
    pattern: /\b(?:license[_\s]?plate|vehicle[_\s]?(?:plate|tag))[:\s]*[A-Z0-9]{5,8}\b/gi,
    category: 'direct',
    hipaaIdentifier: 'Vehicle identifiers',
    baseConfidence: 75
  },

  // Photo indicators
  {
    id: 'photo_reference',
    name: 'Photo Reference',
    pattern: /\b(?:patient[_\s]?photo|resident[_\s]?photo|client[_\s]?photo|face[_\s]?image)[_\s]*[:=]/gi,
    category: 'direct',
    hipaaIdentifier: 'Full-face photographs',
    baseConfidence: 82
  },

  // Diagnosis/Clinical (Quasi-identifiers)
  {
    id: 'diagnosis_code',
    name: 'Diagnosis with Context',
    pattern: /\b(?:diagnosis|dx)[:\s]*["']?[A-Z]\d{2}(?:\.\d{1,4})?["']?/gi,
    category: 'quasi',
    hipaaIdentifier: 'Medical information',
    baseConfidence: 40,
    contextModifiers: { data: +30 }
  }
];

// Common false positive patterns to exclude
const FALSE_POSITIVE_PATTERNS = [
  /test@example\.com/gi,
  /user@domain\.com/gi,
  /john\.doe@/gi,
  /jane\.doe@/gi,
  /123-45-6789/g, // Common example SSN
  /000-00-0000/g,
  /111-11-1111/g,
  /555-555-5555/g, // Common example phone
  /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b/g,
  /placeholder|example|sample|test|dummy|mock|fake/gi
];

export interface PhiFinding {
  type: string;
  match: string;
  confidence: number;
  category: 'direct' | 'quasi' | 'indirect';
  hipaaIdentifier: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
}

export interface PhiDetectionResult {
  findings: PhiFinding[];
  scannedLength: number;
  context: string;
  strictMode: boolean;
}

export async function handlePhiDetect(
  args: Record<string, unknown>,
  config: vscode.WorkspaceConfiguration,
  auditService: AuditService
): Promise<TextContent[]> {
  const content = args.content as string;
  const context = (args.context as string) || 'general';
  const strictMode = (args.strictMode as boolean) ?? config.get<boolean>('phi.strictMode') ?? false;

  if (!content) {
    return [{
      type: 'text',
      text: 'Error: Content is required for PHI detection.'
    }];
  }

  const result = await detectPhi(content, context as 'code' | 'filename' | 'comment' | 'data' | 'general', strictMode);

  auditService.log('phi_detection_completed', {
    findingsCount: result.findings.length,
    contentLength: content.length,
    context,
    strictMode
  });

  if (result.findings.length === 0) {
    return [{
      type: 'text',
      text: '✅ **No PHI Detected**\n\nNo potential Protected Health Information was found in the provided content.'
    }];
  }

  return [{ type: 'text', text: formatPhiResults(result) }];
}

export async function detectPhi(
  content: string,
  context: 'code' | 'filename' | 'comment' | 'data' | 'general',
  strictMode: boolean
): Promise<PhiDetectionResult> {
  const findings: PhiFinding[] = [];

  // Check each pattern
  for (const pattern of PHI_PATTERNS) {
    // Reset regex state
    pattern.pattern.lastIndex = 0;
    
    let match: RegExpExecArray | null;
    while ((match = pattern.pattern.exec(content)) !== null) {
      const matchedText = match[0];
      
      // Skip false positives
      if (isFalsePositive(matchedText, content, match.index)) {
        continue;
      }

      // Calculate confidence with context modifiers
      let confidence = pattern.baseConfidence;
      
      if (pattern.contextModifiers) {
        const modifier = pattern.contextModifiers[context as ContextType];
        if (modifier !== undefined) {
          confidence += modifier;
        }
      }

      // Strict mode increases confidence for borderline cases
      if (strictMode && confidence < 70) {
        confidence += 15;
      }

      // Skip low confidence findings unless in strict mode
      if (!strictMode && confidence < 50) {
        continue;
      }

      // Clamp confidence to 0-100
      confidence = Math.max(0, Math.min(100, confidence));

      findings.push({
        type: pattern.name,
        match: matchedText,
        confidence,
        category: pattern.category,
        hipaaIdentifier: pattern.hipaaIdentifier,
        explanation: getExplanation(pattern, confidence),
        startIndex: match.index,
        endIndex: match.index + matchedText.length
      });
    }
  }

  // Sort by confidence (highest first)
  findings.sort((a, b) => b.confidence - a.confidence);

  // Remove overlapping findings (keep higher confidence)
  const deduplicated = deduplicateFindings(findings);

  return {
    findings: deduplicated,
    scannedLength: content.length,
    context,
    strictMode
  };
}

function isFalsePositive(match: string, content: string, index: number): boolean {
  // Check against known false positive patterns
  for (const fpPattern of FALSE_POSITIVE_PATTERNS) {
    fpPattern.lastIndex = 0;
    if (fpPattern.test(match)) {
      return true;
    }
  }

  // Check surrounding context for test/example indicators
  const contextStart = Math.max(0, index - 50);
  const contextEnd = Math.min(content.length, index + match.length + 50);
  const surroundingContext = content.slice(contextStart, contextEnd).toLowerCase();

  if (/\b(?:test|example|sample|dummy|mock|fake|placeholder)\b/.test(surroundingContext)) {
    return true;
  }

  return false;
}

function getExplanation(pattern: PhiPattern, confidence: number): string {
  const confidenceLevel = confidence >= 80 ? 'High' : confidence >= 60 ? 'Medium' : 'Low';
  
  return `${confidenceLevel} confidence match for ${pattern.hipaaIdentifier}. ` +
    `This is a ${pattern.category} identifier under HIPAA Safe Harbor de-identification.`;
}

function deduplicateFindings(findings: PhiFinding[]): PhiFinding[] {
  const result: PhiFinding[] = [];
  
  for (const finding of findings) {
    const overlapping = result.find(
      f => !(finding.endIndex <= f.startIndex || finding.startIndex >= f.endIndex)
    );
    
    if (!overlapping) {
      result.push(finding);
    }
    // If overlapping exists, we keep the existing one (which has higher confidence due to sorting)
  }
  
  return result;
}

function formatPhiResults(result: PhiDetectionResult): string {
  const highConfidence = result.findings.filter(f => f.confidence >= 80);
  const mediumConfidence = result.findings.filter(f => f.confidence >= 60 && f.confidence < 80);
  const lowConfidence = result.findings.filter(f => f.confidence < 60);

  let output = `## ⚠️ PHI Detection Results\n\n`;
  output += `**Findings:** ${result.findings.length} potential PHI element(s) detected\n`;
  output += `**Context:** ${result.context}\n`;
  output += `**Strict Mode:** ${result.strictMode ? 'Enabled' : 'Disabled'}\n\n`;

  output += `### Summary\n`;
  output += `- 🔴 High confidence (≥80%): ${highConfidence.length}\n`;
  output += `- 🟡 Medium confidence (60-79%): ${mediumConfidence.length}\n`;
  output += `- 🟢 Low confidence (<60%): ${lowConfidence.length}\n\n`;

  if (highConfidence.length > 0) {
    output += `### 🔴 High Confidence Findings\n\n`;
    output += highConfidence.map(formatFinding).join('\n');
  }

  if (mediumConfidence.length > 0) {
    output += `\n### 🟡 Medium Confidence Findings\n\n`;
    output += mediumConfidence.map(formatFinding).join('\n');
  }

  if (lowConfidence.length > 0) {
    output += `\n### 🟢 Low Confidence Findings\n\n`;
    output += lowConfidence.map(formatFinding).join('\n');
  }

  output += `\n---\n`;
  output += `**HIPAA Safe Harbor De-identification:** The 18 identifiers that must be removed or obscured:\n`;
  output += `Names, Geographic data, Dates, Phone numbers, Fax numbers, Email addresses, SSN, MRN, `;
  output += `Health plan beneficiary numbers, Account numbers, Certificate/license numbers, `;
  output += `Vehicle identifiers, Device identifiers, URLs, IP addresses, Biometric identifiers, `;
  output += `Full-face photos, Any other unique identifying number.\n`;

  return output;
}

function formatFinding(finding: PhiFinding): string {
  const masked = maskSensitiveValue(finding.match);
  return `- **${finding.type}** (${finding.confidence}%)\n` +
    `  - Match: \`${masked}\`\n` +
    `  - Category: ${finding.category}\n` +
    `  - HIPAA: ${finding.hipaaIdentifier}\n` +
    `  - ${finding.explanation}\n`;
}

function maskSensitiveValue(value: string): string {
  if (value.length <= 4) return '****';
  return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
}
