import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { AuditService } from '../services/audit';

interface HipaaValidationResult {
  compliant: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  findings: HipaaFinding[];
  recommendations: string[];
  applicableRules: string[];
}

interface HipaaFinding {
  rule: string;
  category: 'privacy' | 'security' | 'breach' | 'administrative';
  severity: 'info' | 'warning' | 'violation';
  description: string;
  requirement: string;
  remediation: string;
}

// Rule info structure
interface RuleInfo {
  citation: string;
  description: string;
}

// HIPAA Rule reference data
const HIPAA_RULES: Record<string, Record<string, RuleInfo>> = {
  privacy: {
    minimumNecessary: {
      citation: '45 CFR 164.502(b)',
      description: 'Covered entities must make reasonable efforts to use, disclose, and request only the minimum necessary PHI to accomplish the intended purpose.'
    },
    notice: {
      citation: '45 CFR 164.520',
      description: 'Must provide notice of privacy practices describing how PHI may be used and disclosed.'
    },
    patientRights: {
      citation: '45 CFR 164.524-528',
      description: 'Individuals have rights to access, amend, and receive accounting of disclosures of their PHI.'
    },
    authorization: {
      citation: '45 CFR 164.508',
      description: 'Most uses and disclosures of PHI require written authorization from the individual.'
    },
    deidentification: {
      citation: '45 CFR 164.514',
      description: 'PHI can be de-identified through Safe Harbor (removing 18 identifiers) or Expert Determination methods.'
    }
  },
  security: {
    accessControl: {
      citation: '45 CFR 164.312(a)(1)',
      description: 'Implement technical policies and procedures for electronic information systems that maintain ePHI.'
    },
    auditControls: {
      citation: '45 CFR 164.312(b)',
      description: 'Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems containing ePHI.'
    },
    integrity: {
      citation: '45 CFR 164.312(c)(1)',
      description: 'Implement policies and procedures to protect ePHI from improper alteration or destruction.'
    },
    transmission: {
      citation: '45 CFR 164.312(e)(1)',
      description: 'Implement technical security measures to guard against unauthorized access to ePHI being transmitted over electronic communications networks.'
    },
    encryption: {
      citation: '45 CFR 164.312(a)(2)(iv) & (e)(2)(ii)',
      description: 'Implement mechanism to encrypt ePHI when appropriate (addressable requirement).'
    }
  },
  breach: {
    notification: {
      citation: '45 CFR 164.400-414',
      description: 'Covered entities must notify affected individuals, HHS, and in some cases media following a breach of unsecured PHI.'
    },
    riskAssessment: {
      citation: '45 CFR 164.402',
      description: 'Must assess probability that PHI has been compromised based on nature, who accessed it, whether it was actually viewed, and extent of mitigation.'
    }
  },
  administrative: {
    baa: {
      citation: '45 CFR 164.502(e) & 164.504(e)',
      description: 'Must have Business Associate Agreements with any entity that creates, receives, maintains, or transmits PHI on behalf of covered entity.'
    },
    riskAnalysis: {
      citation: '45 CFR 164.308(a)(1)(ii)(A)',
      description: 'Conduct accurate and thorough assessment of potential risks and vulnerabilities to ePHI.'
    },
    training: {
      citation: '45 CFR 164.308(a)(5)',
      description: 'Implement security awareness and training program for all members of workforce.'
    },
    policies: {
      citation: '45 CFR 164.316',
      description: 'Implement reasonable and appropriate policies and procedures to comply with Security Rule.'
    }
  }
};

// Common controls and their HIPAA mappings
const SECURITY_CONTROLS = {
  encryption_at_rest: {
    rules: ['security.encryption', 'security.integrity'],
    effectiveness: 'high'
  },
  encryption_in_transit: {
    rules: ['security.transmission', 'security.encryption'],
    effectiveness: 'high'
  },
  access_logging: {
    rules: ['security.auditControls'],
    effectiveness: 'high'
  },
  audit_trail: {
    rules: ['security.auditControls', 'privacy.patientRights'],
    effectiveness: 'high'
  },
  role_based_access: {
    rules: ['security.accessControl', 'privacy.minimumNecessary'],
    effectiveness: 'high'
  },
  mfa: {
    rules: ['security.accessControl'],
    effectiveness: 'high'
  },
  data_masking: {
    rules: ['privacy.minimumNecessary', 'privacy.deidentification'],
    effectiveness: 'medium'
  },
  backup_encryption: {
    rules: ['security.encryption', 'security.integrity'],
    effectiveness: 'medium'
  },
  session_timeout: {
    rules: ['security.accessControl'],
    effectiveness: 'medium'
  },
  password_policy: {
    rules: ['security.accessControl'],
    effectiveness: 'medium'
  }
};

// PHI data elements and their risk levels
const PHI_ELEMENTS = {
  // High risk
  ssn: { riskLevel: 'critical', category: 'direct_identifier' },
  medical_record_number: { riskLevel: 'critical', category: 'direct_identifier' },
  health_plan_id: { riskLevel: 'high', category: 'direct_identifier' },
  
  // Medium-high risk
  patient_name: { riskLevel: 'high', category: 'direct_identifier' },
  date_of_birth: { riskLevel: 'high', category: 'date' },
  address: { riskLevel: 'high', category: 'geographic' },
  phone_number: { riskLevel: 'medium', category: 'contact' },
  email: { riskLevel: 'medium', category: 'contact' },
  
  // Clinical data
  diagnosis: { riskLevel: 'medium', category: 'clinical' },
  medications: { riskLevel: 'medium', category: 'clinical' },
  lab_results: { riskLevel: 'medium', category: 'clinical' },
  treatment_plan: { riskLevel: 'medium', category: 'clinical' },
  
  // Low risk (but still PHI)
  age: { riskLevel: 'low', category: 'demographic' },
  gender: { riskLevel: 'low', category: 'demographic' },
  zip_code_3digit: { riskLevel: 'low', category: 'geographic' }
};

export async function handleHipaaValidate(
  args: Record<string, unknown>,
  auditService: AuditService
): Promise<TextContent[]> {
  const scenario = args.scenario as string;
  const dataElements = (args.dataElements as string[]) || [];
  const controls = (args.controls as string[]) || [];

  if (!scenario) {
    return [{
      type: 'text',
      text: 'Error: Scenario description is required for HIPAA validation.'
    }];
  }

  const result = validateHipaaCompliance(scenario, dataElements, controls);

  auditService.log('hipaa_validation_completed', {
    compliant: result.compliant,
    riskLevel: result.riskLevel,
    findingsCount: result.findings.length
  });

  return [{ type: 'text', text: formatHipaaResults(result) }];
}

function validateHipaaCompliance(
  scenario: string,
  dataElements: string[],
  controls: string[]
): HipaaValidationResult {
  const findings: HipaaFinding[] = [];
  const recommendations: string[] = [];
  const applicableRules = new Set<string>();

  // Analyze scenario for keywords
  const scenarioLower = scenario.toLowerCase();
  const isTransmission = /transmit|send|transfer|share|exchange|api|integration/i.test(scenario);
  const isStorage = /store|save|persist|database|file|log/i.test(scenario);
  const isThirdParty = /third.?party|vendor|partner|contractor|business.?associate|ba\b/i.test(scenario);
  const isCloud = /cloud|aws|azure|gcp|saas/i.test(scenario);
  const isAnalytics = /analytic|report|aggregate|research|study/i.test(scenario);

  // Determine risk level based on data elements
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  
  for (const element of dataElements) {
    const elementKey = element.toLowerCase().replace(/\s+/g, '_');
    const elementInfo = PHI_ELEMENTS[elementKey as keyof typeof PHI_ELEMENTS];
    
    if (elementInfo) {
      if (elementInfo.riskLevel === 'critical') riskLevel = 'critical';
      else if (elementInfo.riskLevel === 'high' && riskLevel !== 'critical') riskLevel = 'high';
      else if (elementInfo.riskLevel === 'medium' && riskLevel === 'low') riskLevel = 'medium';
    }
  }

  // Check for BAA requirement
  if (isThirdParty) {
    applicableRules.add('administrative.baa');
    if (!controls.includes('baa')) {
      findings.push({
        rule: 'Business Associate Agreement',
        category: 'administrative',
        severity: 'violation',
        description: 'Third-party involvement detected without BAA confirmation.',
        requirement: HIPAA_RULES.administrative.baa.description,
        remediation: 'Execute a Business Associate Agreement (BAA) with the third party before sharing any PHI.'
      });
    }
  }

  // Check transmission security
  if (isTransmission) {
    applicableRules.add('security.transmission');
    applicableRules.add('security.encryption');
    
    if (!controls.includes('encryption_in_transit')) {
      findings.push({
        rule: 'Transmission Security',
        category: 'security',
        severity: 'violation',
        description: 'Data transmission without confirmed encryption.',
        requirement: HIPAA_RULES.security.transmission.description,
        remediation: 'Implement TLS 1.2+ for all data transmission. Use end-to-end encryption for sensitive data.'
      });
    }
  }

  // Check storage security
  if (isStorage) {
    applicableRules.add('security.integrity');
    
    if (!controls.includes('encryption_at_rest') && riskLevel !== 'low') {
      findings.push({
        rule: 'Data at Rest',
        category: 'security',
        severity: riskLevel === 'critical' ? 'violation' : 'warning',
        description: 'Storing PHI without confirmed encryption at rest.',
        requirement: HIPAA_RULES.security.encryption.description,
        remediation: 'Implement AES-256 encryption for stored PHI. Use encrypted database fields or full-disk encryption.'
      });
    }
  }

  // Check access controls
  if (dataElements.length > 0) {
    applicableRules.add('security.accessControl');
    applicableRules.add('privacy.minimumNecessary');
    
    if (!controls.includes('role_based_access')) {
      findings.push({
        rule: 'Access Control',
        category: 'security',
        severity: 'warning',
        description: 'No role-based access control confirmed.',
        requirement: HIPAA_RULES.security.accessControl.description,
        remediation: 'Implement role-based access control (RBAC) to limit PHI access to authorized personnel only.'
      });
    }

    if (!controls.includes('access_logging') && !controls.includes('audit_trail')) {
      findings.push({
        rule: 'Audit Controls',
        category: 'security',
        severity: 'warning',
        description: 'No audit logging confirmed for PHI access.',
        requirement: HIPAA_RULES.security.auditControls.description,
        remediation: 'Implement comprehensive audit logging for all PHI access, including who, what, when, and why.'
      });
    }
  }

  // Check minimum necessary
  if (dataElements.length > 5) {
    findings.push({
      rule: 'Minimum Necessary',
      category: 'privacy',
      severity: 'info',
      description: `Processing ${dataElements.length} data elements. Review if all are necessary.`,
      requirement: HIPAA_RULES.privacy.minimumNecessary.description,
      remediation: 'Document justification for each data element collected. Consider if subset would suffice.'
    });
  }

  // Cloud-specific checks
  if (isCloud) {
    if (!controls.includes('baa')) {
      findings.push({
        rule: 'Cloud BAA',
        category: 'administrative',
        severity: 'violation',
        description: 'Cloud deployment requires BAA with cloud provider.',
        requirement: 'Cloud providers handling PHI are Business Associates and require BAAs.',
        remediation: 'Obtain BAA from cloud provider (AWS, Azure, GCP all offer HIPAA BAAs for eligible services).'
      });
    }
    
    recommendations.push('Ensure using HIPAA-eligible cloud services only');
    recommendations.push('Verify cloud provider BAA covers all services in use');
  }

  // Analytics considerations
  if (isAnalytics) {
    applicableRules.add('privacy.deidentification');
    
    recommendations.push('Consider de-identification for analytics if individual identification not needed');
    recommendations.push('If using aggregate data, ensure cell sizes >10 to prevent re-identification');
  }

  // Generate recommendations
  if (!controls.includes('mfa')) {
    recommendations.push('Implement multi-factor authentication for all PHI access');
  }
  
  if (!controls.includes('session_timeout')) {
    recommendations.push('Implement automatic session timeout for inactive users');
  }

  // Determine overall compliance
  const violations = findings.filter(f => f.severity === 'violation');
  const compliant = violations.length === 0;

  return {
    compliant,
    riskLevel,
    findings,
    recommendations,
    applicableRules: Array.from(applicableRules)
  };
}

function formatHipaaResults(result: HipaaValidationResult): string {
  const statusIcon = result.compliant ? '✅' : '❌';
  const statusText = result.compliant ? 'Potentially Compliant' : 'Compliance Issues Detected';
  
  const riskColors = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴'
  };

  let output = `## ${statusIcon} HIPAA Validation: ${statusText}\n\n`;
  output += `**Risk Level:** ${riskColors[result.riskLevel]} ${result.riskLevel.toUpperCase()}\n\n`;

  // Applicable rules
  if (result.applicableRules.length > 0) {
    output += `### Applicable HIPAA Rules\n`;
    for (const ruleKey of result.applicableRules) {
      const [category, rule] = ruleKey.split('.');
      const ruleInfo = HIPAA_RULES[category]?.[rule];
      if (ruleInfo) {
        output += `- **${ruleInfo.citation}**: ${rule.replace(/([A-Z])/g, ' $1').trim()}\n`;
      }
    }
    output += '\n';
  }

  // Findings
  if (result.findings.length > 0) {
    const violations = result.findings.filter(f => f.severity === 'violation');
    const warnings = result.findings.filter(f => f.severity === 'warning');
    const info = result.findings.filter(f => f.severity === 'info');

    if (violations.length > 0) {
      output += `### ❌ Violations (${violations.length})\n\n`;
      violations.forEach(f => {
        output += `**${f.rule}** (${f.category})\n`;
        output += `- ${f.description}\n`;
        output += `- *Requirement:* ${f.requirement}\n`;
        output += `- *Remediation:* ${f.remediation}\n\n`;
      });
    }

    if (warnings.length > 0) {
      output += `### ⚠️ Warnings (${warnings.length})\n\n`;
      warnings.forEach(f => {
        output += `**${f.rule}** (${f.category})\n`;
        output += `- ${f.description}\n`;
        output += `- *Remediation:* ${f.remediation}\n\n`;
      });
    }

    if (info.length > 0) {
      output += `### ℹ️ Information (${info.length})\n\n`;
      info.forEach(f => {
        output += `**${f.rule}**: ${f.description}\n`;
        output += `- ${f.remediation}\n\n`;
      });
    }
  } else {
    output += `### ✅ No Issues Detected\n\n`;
    output += `Based on the described scenario and controls, no obvious compliance issues were identified.\n\n`;
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    output += `### 💡 Recommendations\n\n`;
    result.recommendations.forEach(r => {
      output += `- ${r}\n`;
    });
    output += '\n';
  }

  // Disclaimer
  output += `---\n`;
  output += `*This is an automated assessment based on provided information. `;
  output += `A comprehensive HIPAA compliance evaluation requires formal risk analysis, `;
  output += `policy review, and may require consultation with qualified compliance professionals.*`;

  return output;
}
