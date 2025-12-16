import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { AuditService } from '../services/audit';

interface MdsValidationResult {
  valid: boolean;
  assessmentType: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

interface ValidationIssue {
  code: string;
  message: string;
  section?: string;
  item?: string;
}

// MDS 3.0 Section definitions
const MDS_SECTIONS = {
  A: { name: 'Identification Information', required: true },
  B: { name: 'Hearing, Speech, and Vision', required: true },
  C: { name: 'Cognitive Patterns', required: true },
  D: { name: 'Mood', required: true },
  E: { name: 'Behavior', required: true },
  F: { name: 'Preferences for Customary Routine and Activities', required: false },
  G: { name: 'Functional Status', required: true },
  GG: { name: 'Functional Abilities and Goals', required: true },
  H: { name: 'Bladder and Bowel', required: true },
  I: { name: 'Active Diagnoses', required: true },
  J: { name: 'Health Conditions', required: true },
  K: { name: 'Swallowing/Nutritional Status', required: true },
  L: { name: 'Oral/Dental Status', required: false },
  M: { name: 'Skin Conditions', required: true },
  N: { name: 'Medications', required: true },
  O: { name: 'Special Treatments, Procedures, and Programs', required: true },
  P: { name: 'Restraints', required: false },
  Q: { name: 'Participation in Assessment and Goal Setting', required: false },
  V: { name: 'Care Area Assessment (CAA) Summary', required: false },
  X: { name: 'Correction Request', required: false },
  Z: { name: 'Assessment Administration', required: true }
};

// Key items and their validation rules
const MDS_ITEMS: Record<string, { 
  section: string; 
  description: string; 
  values?: string[];
  required?: boolean;
  skipPattern?: { item: string; values: string[] };
}> = {
  // Section A - Identification
  'A0310A': {
    section: 'A',
    description: 'Federal OBRA Reason for Assessment',
    values: ['01', '02', '03', '04', '05', '06', '10', '99'],
    required: true
  },
  'A0310B': {
    section: 'A',
    description: 'PPS Assessment',
    values: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '99'],
    required: true
  },
  'A2300': {
    section: 'A',
    description: 'Assessment Reference Date (ARD)',
    required: true
  },

  // Section B - Hearing, Speech, Vision
  'B0100': {
    section: 'B',
    description: 'Comatose',
    values: ['0', '1'],
    required: true
  },

  // Section C - Cognitive Patterns  
  'C0100': {
    section: 'C',
    description: 'Should Brief Interview for Mental Status be Conducted',
    values: ['0', '1'],
    skipPattern: { item: 'B0100', values: ['1'] }
  },
  'C0200': {
    section: 'C',
    description: 'Repetition of Three Words',
    values: ['0', '1', '2', '3'],
    skipPattern: { item: 'C0100', values: ['0'] }
  },
  'C0500': {
    section: 'C',
    description: 'BIMS Summary Score',
    skipPattern: { item: 'C0100', values: ['0'] }
  },

  // Section D - Mood
  'D0100': {
    section: 'D',
    description: 'Should Resident Mood Interview be Conducted',
    values: ['0', '1', '9']
  },
  'D0300': {
    section: 'D',
    description: 'PHQ-9 Total Severity Score',
    skipPattern: { item: 'D0100', values: ['0', '9'] }
  },

  // Section G - Functional Status
  'G0110A': {
    section: 'G',
    description: 'ADL Self-Performance - Bed Mobility',
    values: ['0', '1', '2', '3', '4', '7', '8']
  },
  'G0110B': {
    section: 'G',
    description: 'ADL Self-Performance - Transfer',
    values: ['0', '1', '2', '3', '4', '7', '8']
  },
  'G0110H': {
    section: 'G',
    description: 'ADL Self-Performance - Eating',
    values: ['0', '1', '2', '3', '4', '7', '8']
  },
  'G0110I': {
    section: 'G',
    description: 'ADL Self-Performance - Toilet Use',
    values: ['0', '1', '2', '3', '4', '7', '8']
  },

  // Section GG - Functional Abilities
  'GG0130A1': {
    section: 'GG',
    description: 'Self-Care - Eating (Admission)',
    values: ['06', '05', '04', '03', '02', '01', '07', '09', '10', '88', '^']
  },
  'GG0170C1': {
    section: 'GG',
    description: 'Mobility - Lying to Sitting (Admission)',
    values: ['06', '05', '04', '03', '02', '01', '07', '09', '10', '88', '^']
  },

  // Section H - Bladder and Bowel
  'H0100': {
    section: 'H',
    description: 'Appliances',
    values: ['0', '1']
  },

  // Section I - Active Diagnoses
  'I0020B': {
    section: 'I',
    description: 'Diabetes Mellitus',
    values: ['0', '1']
  },
  'I2900': {
    section: 'I',
    description: 'Other ICD-10 Codes'
  },

  // Section J - Health Conditions
  'J1100': {
    section: 'J',
    description: 'Shortness of Breath',
    values: ['0', '1']
  },
  'J1550A': {
    section: 'J',
    description: 'Problem Conditions - Fever',
    values: ['0', '1']
  },
  'J1800': {
    section: 'J',
    description: 'Any Falls Since Admission or Prior Assessment',
    values: ['0', '1']
  },

  // Section M - Skin Conditions
  'M0100': {
    section: 'M',
    description: 'Determination of Pressure Ulcer/Injury Risk',
    values: ['0', '1']
  },
  'M0300': {
    section: 'M',
    description: 'Current Number of Unhealed Pressure Ulcers/Injuries'
  },

  // Section N - Medications
  'N0410A': {
    section: 'N',
    description: 'Antipsychotic (7 days)',
    values: ['0', '1']
  },
  'N0410B': {
    section: 'N',
    description: 'Antianxiety (7 days)',
    values: ['0', '1']
  },
  'N0410D': {
    section: 'N',
    description: 'Hypnotic (7 days)',
    values: ['0', '1']
  },

  // Section O - Treatments
  'O0100E2': {
    section: 'O',
    description: 'Oxygen Therapy',
    values: ['0', '1']
  },
  'O0100H2': {
    section: 'O',
    description: 'IV Medications (7 days)',
    values: ['0', '1']
  }
};

// Assessment type required sections mapping
const ASSESSMENT_REQUIRED_ITEMS: Record<string, string[]> = {
  admission: ['A0310A', 'A2300', 'B0100', 'G0110A', 'G0110B', 'GG0130A1', 'GG0170C1'],
  quarterly: ['A0310A', 'A2300', 'B0100', 'G0110A', 'G0110B'],
  annual: ['A0310A', 'A2300', 'B0100', 'G0110A', 'G0110B', 'GG0130A1', 'GG0170C1'],
  'significant-change': ['A0310A', 'A2300', 'B0100', 'G0110A', 'G0110B', 'GG0130A1', 'GG0170C1'],
  discharge: ['A0310A', 'A2300', 'GG0130A1', 'GG0170C1'],
  'entry-tracking': ['A0310A', 'A2300']
};

export async function handleMdsValidate(
  args: Record<string, unknown>,
  auditService: AuditService
): Promise<TextContent[]> {
  const assessmentData = args.assessmentData as Record<string, string>;
  const assessmentType = args.assessmentType as string;
  const targetDate = args.targetDate as string | undefined;

  if (!assessmentData || typeof assessmentData !== 'object') {
    return [{
      type: 'text',
      text: 'Error: Assessment data object is required for MDS validation.'
    }];
  }

  if (!assessmentType) {
    return [{
      type: 'text',
      text: 'Error: Assessment type is required (admission, quarterly, annual, significant-change, discharge, entry-tracking).'
    }];
  }

  try {
    const result = await validateMds(assessmentData, assessmentType as keyof typeof ASSESSMENT_REQUIRED_ITEMS, targetDate);

    auditService.log('mds_validation_completed', {
      valid: result.valid,
      assessmentType: result.assessmentType,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      itemCount: Object.keys(assessmentData).length
    });

    return [{ type: 'text', text: formatMdsResults(result) }];
  } catch (error) {
    auditService.error('mds_validation_error', {
      error: error instanceof Error ? error.message : String(error)
    });

    return [{
      type: 'text',
      text: `Error validating MDS assessment: ${error instanceof Error ? error.message : 'Unknown error'}`
    }];
  }
}

export async function validateMds(
  assessmentData: Record<string, string>,
  assessmentType: keyof typeof ASSESSMENT_REQUIRED_ITEMS,
  targetDate?: string
): Promise<MdsValidationResult> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  // Normalize item keys (uppercase, no spaces)
  const normalizedData: Record<string, string> = {};
  for (const [key, value] of Object.entries(assessmentData)) {
    normalizedData[key.toUpperCase().replace(/\s+/g, '')] = value;
  }

  // Check required items for assessment type
  const requiredItems = ASSESSMENT_REQUIRED_ITEMS[assessmentType] || [];
  for (const itemId of requiredItems) {
    if (!(itemId in normalizedData)) {
      const itemDef = MDS_ITEMS[itemId];
      errors.push({
        code: `REQ-${itemId}`,
        message: `Required item ${itemId} (${itemDef?.description || 'Unknown'}) is missing`,
        section: itemDef?.section,
        item: itemId
      });
    }
  }

  // Validate each provided item
  for (const [itemId, value] of Object.entries(normalizedData)) {
    const itemDef = MDS_ITEMS[itemId];

    if (!itemDef) {
      // Unknown item - check if it follows MDS naming convention
      if (/^[A-Z]{1,2}\d{4}[A-Z]?\d?$/.test(itemId)) {
        info.push({
          code: `UNK-${itemId}`,
          message: `Item ${itemId} not in validation database`,
          item: itemId
        });
      }
      continue;
    }

    // Check valid values
    if (itemDef.values && !itemDef.values.includes(value)) {
      errors.push({
        code: `VAL-${itemId}`,
        message: `Invalid value "${value}" for ${itemId} (${itemDef.description}). Valid values: ${itemDef.values.join(', ')}`,
        section: itemDef.section,
        item: itemId
      });
    }

    // Check skip patterns
    if (itemDef.skipPattern) {
      const skipItem = itemDef.skipPattern.item;
      const skipValues = itemDef.skipPattern.values;
      const skipItemValue = normalizedData[skipItem];

      if (skipItemValue && skipValues.includes(skipItemValue)) {
        if (value && value !== '' && value !== '-' && value !== '^') {
          warnings.push({
            code: `SKIP-${itemId}`,
            message: `Item ${itemId} should be skipped when ${skipItem} = ${skipItemValue}`,
            section: itemDef.section,
            item: itemId
          });
        }
      }
    }
  }

  // Validate date format if provided
  if (targetDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      errors.push({
        code: 'DATE-001',
        message: `Invalid ARD date format: ${targetDate}. Expected YYYY-MM-DD.`,
        section: 'A',
        item: 'A2300'
      });
    } else {
      const date = new Date(targetDate);
      const now = new Date();
      if (date > now) {
        warnings.push({
          code: 'DATE-002',
          message: 'ARD date is in the future',
          section: 'A',
          item: 'A2300'
        });
      }
    }
  }

  // Check for common data quality issues
  
  // BIMS consistency
  if (normalizedData['C0100'] === '1') {
    const bimsItems = ['C0200', 'C0300', 'C0400', 'C0500'];
    const hasBimsData = bimsItems.some(item => normalizedData[item]);
    if (!hasBimsData) {
      warnings.push({
        code: 'BIMS-001',
        message: 'C0100 indicates BIMS should be conducted, but no BIMS data found',
        section: 'C'
      });
    }
  }

  // PHQ-9 consistency
  if (normalizedData['D0100'] === '1') {
    if (!normalizedData['D0300']) {
      warnings.push({
        code: 'PHQ9-001',
        message: 'D0100 indicates mood interview should be conducted, but PHQ-9 score (D0300) not found',
        section: 'D'
      });
    }
  }

  // Fall follow-up
  if (normalizedData['J1800'] === '1') {
    if (!normalizedData['J1900A'] && !normalizedData['J1900B'] && !normalizedData['J1900C']) {
      warnings.push({
        code: 'FALL-001',
        message: 'J1800 indicates falls occurred, but fall detail items (J1900) not found',
        section: 'J'
      });
    }
  }

  // Pressure ulcer follow-up
  if (normalizedData['M0100'] === '1') {
    if (!normalizedData['M0300A'] && !normalizedData['M0300B']) {
      warnings.push({
        code: 'SKIN-001',
        message: 'M0100 indicates pressure ulcer risk assessment performed, but M0300 data not found',
        section: 'M'
      });
    }
  }

  // Section coverage info
  const sectionsCovered = new Set<string>();
  for (const itemId of Object.keys(normalizedData)) {
    const section = itemId.match(/^([A-Z]{1,2})/)?.[1];
    if (section) sectionsCovered.add(section);
  }

  for (const [sectionId, sectionDef] of Object.entries(MDS_SECTIONS)) {
    if (sectionDef.required && !sectionsCovered.has(sectionId)) {
      warnings.push({
        code: `SEC-${sectionId}`,
        message: `No items found from required section ${sectionId} (${sectionDef.name})`,
        section: sectionId
      });
    }
  }

  info.push({
    code: 'COVERAGE',
    message: `Sections with data: ${Array.from(sectionsCovered).sort().join(', ')}`
  });

  info.push({
    code: 'ITEMS',
    message: `Total items provided: ${Object.keys(normalizedData).length}`
  });

  const valid = errors.length === 0;

  return {
    valid,
    assessmentType,
    errors,
    warnings,
    info
  };
}

function formatMdsResults(result: MdsValidationResult): string {
  const statusIcon = result.valid ? '✅' : '❌';
  const statusText = result.valid ? 'Valid' : 'Invalid';

  let output = `## ${statusIcon} MDS 3.0 Validation: ${statusText}\n\n`;
  output += `**Assessment Type:** ${result.assessmentType}\n`;
  output += `**Errors:** ${result.errors.length}\n`;
  output += `**Warnings:** ${result.warnings.length}\n\n`;

  if (result.errors.length > 0) {
    output += `### ❌ Errors\n\n`;
    for (const error of result.errors) {
      output += `- **[${error.code}]** ${error.message}`;
      if (error.section) output += ` (Section ${error.section})`;
      output += '\n';
    }
    output += '\n';
  }

  if (result.warnings.length > 0) {
    output += `### ⚠️ Warnings\n\n`;
    for (const warning of result.warnings) {
      output += `- **[${warning.code}]** ${warning.message}`;
      if (warning.section) output += ` (Section ${warning.section})`;
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

  output += `---\n`;
  output += `*MDS 3.0 validation based on CMS RAI Manual v1.18.11. `;
  output += `For complete validation, submit through CMS CASPER system.*`;

  return output;
}
