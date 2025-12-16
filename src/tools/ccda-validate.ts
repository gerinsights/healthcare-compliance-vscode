import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { AuditService } from '../services/audit';

interface CcdaValidationResult {
  valid: boolean;
  documentType: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

interface ValidationIssue {
  code: string;
  message: string;
  section?: string;
  xpath?: string;
}

// Required sections by document type
const REQUIRED_SECTIONS: Record<string, string[]> = {
  ccd: [
    'Problems',
    'Medications',
    'Allergies',
    'Procedures',
    'Results',
    'Social History',
    'Vital Signs'
  ],
  'discharge-summary': [
    'Hospital Course',
    'Discharge Diagnosis',
    'Discharge Medications',
    'Discharge Instructions'
  ],
  'progress-note': [
    'Subjective',
    'Objective',
    'Assessment',
    'Plan'
  ],
  referral: [
    'Reason for Referral',
    'Assessment',
    'Plan of Treatment'
  ],
  'care-plan': [
    'Goals',
    'Interventions',
    'Health Concerns'
  ]
};

// Template IDs for common document types
const TEMPLATE_IDS = {
  ccd: '2.16.840.1.113883.10.20.22.1.2',
  'discharge-summary': '2.16.840.1.113883.10.20.22.1.8',
  'progress-note': '2.16.840.1.113883.10.20.22.1.9',
  referral: '2.16.840.1.113883.10.20.22.1.14',
  'care-plan': '2.16.840.1.113883.10.20.22.1.15'
};

// Section template IDs
const SECTION_TEMPLATE_IDS: Record<string, { oid: string; name: string }> = {
  '2.16.840.1.113883.10.20.22.2.6.1': { oid: '2.16.840.1.113883.10.20.22.2.6.1', name: 'Allergies' },
  '2.16.840.1.113883.10.20.22.2.1.1': { oid: '2.16.840.1.113883.10.20.22.2.1.1', name: 'Medications' },
  '2.16.840.1.113883.10.20.22.2.5.1': { oid: '2.16.840.1.113883.10.20.22.2.5.1', name: 'Problems' },
  '2.16.840.1.113883.10.20.22.2.7.1': { oid: '2.16.840.1.113883.10.20.22.2.7.1', name: 'Procedures' },
  '2.16.840.1.113883.10.20.22.2.3.1': { oid: '2.16.840.1.113883.10.20.22.2.3.1', name: 'Results' },
  '2.16.840.1.113883.10.20.22.2.17': { oid: '2.16.840.1.113883.10.20.22.2.17', name: 'Social History' },
  '2.16.840.1.113883.10.20.22.2.4.1': { oid: '2.16.840.1.113883.10.20.22.2.4.1', name: 'Vital Signs' }
};

export async function handleCcdaValidate(
  args: Record<string, unknown>,
  auditService: AuditService
): Promise<TextContent[]> {
  const document = args.document as string;
  const documentType = (args.documentType as string) || 'ccd';
  const validateCodeSystems = (args.validateCodeSystems as boolean) ?? false;

  if (!document) {
    return [{
      type: 'text',
      text: 'Error: Document content is required for C-CDA validation.'
    }];
  }

  try {
    const result = await validateCcda(document, documentType, validateCodeSystems);

    auditService.log('ccda_validation_completed', {
      valid: result.valid,
      documentType: result.documentType,
      errorCount: result.errors.length,
      warningCount: result.warnings.length
    });

    return [{ type: 'text', text: formatCcdaResults(result) }];
  } catch (error) {
    auditService.error('ccda_validation_error', {
      error: error instanceof Error ? error.message : String(error)
    });

    return [{
      type: 'text',
      text: `Error validating C-CDA document: ${error instanceof Error ? error.message : 'Unknown error'}`
    }];
  }
}

export async function validateCcda(
  document: string,
  documentType: string,
  validateCodeSystems: boolean
): Promise<CcdaValidationResult> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  // Basic XML structure check
  if (!document.includes('<?xml') && !document.includes('<ClinicalDocument')) {
    errors.push({
      code: 'XML-001',
      message: 'Document does not appear to be valid XML or C-CDA structure'
    });
    return { valid: false, documentType, errors, warnings, info };
  }

  // Check for ClinicalDocument root
  if (!document.includes('<ClinicalDocument')) {
    errors.push({
      code: 'CCDA-001',
      message: 'Missing ClinicalDocument root element',
      xpath: '/'
    });
  }

  // Check for HL7 namespace
  if (!document.includes('urn:hl7-org:v3')) {
    errors.push({
      code: 'CCDA-002',
      message: 'Missing HL7 v3 namespace declaration',
      xpath: '/ClinicalDocument'
    });
  }

  // Check for template ID
  const expectedTemplateId = TEMPLATE_IDS[documentType as keyof typeof TEMPLATE_IDS];
  if (expectedTemplateId && !document.includes(expectedTemplateId)) {
    warnings.push({
      code: 'CCDA-003',
      message: `Document may not be a valid ${documentType}. Expected template ID ${expectedTemplateId} not found.`,
      xpath: '/ClinicalDocument/templateId'
    });
  }

  // Check required header elements
  const headerElements = [
    { name: 'realmCode', required: true },
    { name: 'typeId', required: true },
    { name: 'id', required: true },
    { name: 'code', required: true },
    { name: 'title', required: false },
    { name: 'effectiveTime', required: true },
    { name: 'confidentialityCode', required: true },
    { name: 'recordTarget', required: true },
    { name: 'author', required: true },
    { name: 'custodian', required: true }
  ];

  for (const element of headerElements) {
    const hasElement = document.includes(`<${element.name}`) || document.includes(`<${element.name}>`);
    if (!hasElement) {
      if (element.required) {
        errors.push({
          code: `HDR-${element.name.toUpperCase()}`,
          message: `Missing required header element: ${element.name}`,
          section: 'Header',
          xpath: `/ClinicalDocument/${element.name}`
        });
      } else {
        warnings.push({
          code: `HDR-${element.name.toUpperCase()}`,
          message: `Missing recommended header element: ${element.name}`,
          section: 'Header'
        });
      }
    }
  }

  // Check patient information
  if (document.includes('<recordTarget')) {
    if (!document.includes('<patientRole')) {
      errors.push({
        code: 'PAT-001',
        message: 'recordTarget missing patientRole element',
        section: 'Patient',
        xpath: '/ClinicalDocument/recordTarget/patientRole'
      });
    }
    
    if (!document.includes('<patient')) {
      errors.push({
        code: 'PAT-002',
        message: 'Missing patient element within patientRole',
        section: 'Patient'
      });
    } else {
      // Check for required patient sub-elements
      if (!document.includes('<name') && !/<given|family/i.test(document)) {
        warnings.push({
          code: 'PAT-003',
          message: 'Patient name element may be missing or incomplete',
          section: 'Patient'
        });
      }
    }
  }

  // Check for structuredBody
  if (!document.includes('<structuredBody')) {
    if (document.includes('<nonXMLBody')) {
      info.push({
        code: 'BODY-001',
        message: 'Document uses nonXMLBody instead of structuredBody'
      });
    } else {
      errors.push({
        code: 'BODY-002',
        message: 'Missing document body (structuredBody or nonXMLBody)',
        xpath: '/ClinicalDocument/component'
      });
    }
  }

  // Check required sections for document type
  const requiredSections = REQUIRED_SECTIONS[documentType] || [];
  const foundSections = new Set<string>();

  // Look for common section indicators
  for (const [oid, sectionInfo] of Object.entries(SECTION_TEMPLATE_IDS)) {
    if (document.includes(oid)) {
      foundSections.add(sectionInfo.name);
    }
  }

  // Also check for section by title
  for (const section of requiredSections) {
    const sectionPattern = new RegExp(`<title[^>]*>\\s*${section}`, 'i');
    if (sectionPattern.test(document)) {
      foundSections.add(section);
    }
  }

  for (const section of requiredSections) {
    if (!foundSections.has(section)) {
      // Check for similar named sections
      const similarFound = Array.from(foundSections).find(
        s => s.toLowerCase().includes(section.toLowerCase()) ||
             section.toLowerCase().includes(s.toLowerCase())
      );

      if (similarFound) {
        info.push({
          code: `SEC-${section.toUpperCase().replace(/\s+/g, '')}`,
          message: `Expected section "${section}" may be present as "${similarFound}"`,
          section
        });
      } else {
        warnings.push({
          code: `SEC-${section.toUpperCase().replace(/\s+/g, '')}`,
          message: `Recommended section "${section}" not found for ${documentType}`,
          section
        });
      }
    }
  }

  // Code system validation
  if (validateCodeSystems) {
    const codeSystems = [
      { oid: '2.16.840.1.113883.6.96', name: 'SNOMED CT' },
      { oid: '2.16.840.1.113883.6.1', name: 'LOINC' },
      { oid: '2.16.840.1.113883.6.88', name: 'RxNorm' },
      { oid: '2.16.840.1.113883.6.90', name: 'ICD-10-CM' },
      { oid: '2.16.840.1.113883.6.12', name: 'CPT-4' }
    ];

    for (const cs of codeSystems) {
      if (document.includes(cs.oid)) {
        info.push({
          code: `CS-${cs.name.replace(/[\s-]/g, '')}`,
          message: `${cs.name} code system (${cs.oid}) is referenced`
        });
      }
    }

    // Check for nullFlavor usage
    const nullFlavorCount = (document.match(/nullFlavor=/g) || []).length;
    if (nullFlavorCount > 10) {
      warnings.push({
        code: 'CS-NULLFLAVOR',
        message: `High usage of nullFlavor (${nullFlavorCount} instances). Consider providing actual values where possible.`
      });
    }
  }

  // Check for common issues
  if (document.includes('NullPointerException') || document.includes('ERROR')) {
    errors.push({
      code: 'GEN-001',
      message: 'Document appears to contain error messages rather than clinical content'
    });
  }

  const valid = errors.length === 0;

  return {
    valid,
    documentType,
    errors,
    warnings,
    info
  };
}

function formatCcdaResults(result: CcdaValidationResult): string {
  const statusIcon = result.valid ? '✅' : '❌';
  const statusText = result.valid ? 'Valid' : 'Invalid';

  let output = `## ${statusIcon} C-CDA Validation: ${statusText}\n\n`;
  output += `**Document Type:** ${result.documentType}\n`;
  output += `**Errors:** ${result.errors.length}\n`;
  output += `**Warnings:** ${result.warnings.length}\n`;
  output += `**Info:** ${result.info.length}\n\n`;

  if (result.errors.length > 0) {
    output += `### ❌ Errors\n\n`;
    for (const error of result.errors) {
      output += `- **[${error.code}]** ${error.message}`;
      if (error.section) output += ` (Section: ${error.section})`;
      if (error.xpath) output += `\n  - XPath: \`${error.xpath}\``;
      output += '\n';
    }
    output += '\n';
  }

  if (result.warnings.length > 0) {
    output += `### ⚠️ Warnings\n\n`;
    for (const warning of result.warnings) {
      output += `- **[${warning.code}]** ${warning.message}`;
      if (warning.section) output += ` (Section: ${warning.section})`;
      output += '\n';
    }
    output += '\n';
  }

  if (result.info.length > 0) {
    output += `### ℹ️ Information\n\n`;
    for (const info of result.info) {
      output += `- **[${info.code}]** ${info.message}\n`;
    }
    output += '\n';
  }

  if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
    output += `### ✅ Document Structure Valid\n\n`;
    output += `The document passes basic C-CDA structural validation.\n\n`;
  }

  output += `---\n`;
  output += `*This validation checks basic C-CDA structure and required elements. `;
  output += `For full conformance testing, use the ONC C-CDA Scorecard or HL7 validation tools.*`;

  return output;
}
