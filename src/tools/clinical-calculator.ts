import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { AuditService } from '../services/audit';

interface CalculatorDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  inputs: CalculatorInput[];
  formula: (inputs: Record<string, number | boolean | string>) => CalculatorResult;
  interpretation: (score: number) => string;
  source: string;
  guidelineDate: string;
  version: string;
}

interface CalculatorInput {
  id: string;
  name: string;
  type: 'number' | 'boolean' | 'select';
  description: string;
  required: boolean;
  options?: Array<{ value: string | number; label: string; points?: number }>;
  min?: number;
  max?: number;
  unit?: string;
}

interface CalculatorResult {
  score: number;
  interpretation: string;
  details: Record<string, number | string>;
}

// Calculator definitions
const CALCULATORS: Record<string, CalculatorDefinition> = {
  'cha2ds2-vasc': {
    id: 'cha2ds2-vasc',
    name: 'CHA₂DS₂-VASc Score',
    category: 'Cardiology',
    description: 'Estimates stroke risk in patients with atrial fibrillation',
    inputs: [
      { id: 'chf', name: 'Congestive Heart Failure', type: 'boolean', description: 'History of CHF or LVEF ≤40%', required: true },
      { id: 'hypertension', name: 'Hypertension', type: 'boolean', description: 'History of hypertension', required: true },
      { id: 'age', name: 'Age', type: 'number', description: 'Patient age in years', required: true, min: 0, max: 120, unit: 'years' },
      { id: 'diabetes', name: 'Diabetes Mellitus', type: 'boolean', description: 'History of diabetes', required: true },
      { id: 'stroke', name: 'Stroke/TIA/Thromboembolism', type: 'boolean', description: 'Prior stroke, TIA, or thromboembolism', required: true },
      { id: 'vascular', name: 'Vascular Disease', type: 'boolean', description: 'Prior MI, PAD, or aortic plaque', required: true },
      { id: 'female', name: 'Female Sex', type: 'boolean', description: 'Female sex', required: true }
    ],
    formula: (inputs) => {
      let score = 0;
      const details: Record<string, number> = {};

      if (inputs.chf) { score += 1; details.chf = 1; }
      if (inputs.hypertension) { score += 1; details.hypertension = 1; }
      
      const age = inputs.age as number;
      if (age >= 75) { score += 2; details.age = 2; }
      else if (age >= 65) { score += 1; details.age = 1; }
      
      if (inputs.diabetes) { score += 1; details.diabetes = 1; }
      if (inputs.stroke) { score += 2; details.stroke = 2; }
      if (inputs.vascular) { score += 1; details.vascular = 1; }
      if (inputs.female) { score += 1; details.female = 1; }

      return {
        score,
        interpretation: CALCULATORS['cha2ds2-vasc'].interpretation(score),
        details
      };
    },
    interpretation: (score) => {
      if (score === 0) return 'Low risk. Annual stroke risk ~0.2%. Anticoagulation may not be needed.';
      if (score === 1) return 'Low-moderate risk. Annual stroke risk ~0.6%. Consider anticoagulation based on individual factors.';
      if (score === 2) return 'Moderate risk. Annual stroke risk ~2.2%. Anticoagulation recommended.';
      if (score === 3) return 'Moderate-high risk. Annual stroke risk ~3.2%. Anticoagulation recommended.';
      if (score === 4) return 'High risk. Annual stroke risk ~4.8%. Anticoagulation strongly recommended.';
      if (score === 5) return 'High risk. Annual stroke risk ~7.2%. Anticoagulation strongly recommended.';
      return `Very high risk. Annual stroke risk >9%. Anticoagulation strongly recommended.`;
    },
    source: 'ACC/AHA/HRS 2023 Atrial Fibrillation Guidelines',
    guidelineDate: '2023-11-01',
    version: '2023.1'
  },

  'curb-65': {
    id: 'curb-65',
    name: 'CURB-65 Score',
    category: 'Pulmonology',
    description: 'Estimates mortality risk in community-acquired pneumonia',
    inputs: [
      { id: 'confusion', name: 'Confusion', type: 'boolean', description: 'New onset mental confusion', required: true },
      { id: 'bun', name: 'BUN >19 mg/dL (>7 mmol/L)', type: 'boolean', description: 'Blood urea nitrogen elevated', required: true },
      { id: 'rr', name: 'Respiratory Rate ≥30', type: 'boolean', description: 'Respiratory rate ≥30 breaths/min', required: true },
      { id: 'sbp_low', name: 'SBP <90 or DBP ≤60', type: 'boolean', description: 'Low blood pressure', required: true },
      { id: 'age_65', name: 'Age ≥65', type: 'boolean', description: 'Age 65 years or older', required: true }
    ],
    formula: (inputs) => {
      let score = 0;
      const details: Record<string, number> = {};

      if (inputs.confusion) { score += 1; details.confusion = 1; }
      if (inputs.bun) { score += 1; details.bun = 1; }
      if (inputs.rr) { score += 1; details.rr = 1; }
      if (inputs.sbp_low) { score += 1; details.sbp_low = 1; }
      if (inputs.age_65) { score += 1; details.age_65 = 1; }

      return {
        score,
        interpretation: CALCULATORS['curb-65'].interpretation(score),
        details
      };
    },
    interpretation: (score) => {
      if (score <= 1) return 'Low risk (0.6-2.7% mortality). Consider outpatient treatment.';
      if (score === 2) return 'Moderate risk (6.8% mortality). Consider short inpatient hospitalization or closely supervised outpatient treatment.';
      if (score >= 3) return 'High risk (14-27.8% mortality). Hospitalize, consider ICU admission if score 4-5.';
      return '';
    },
    source: 'IDSA/ATS Community-Acquired Pneumonia Guidelines 2019',
    guidelineDate: '2019-10-01',
    version: '2019.1'
  },

  'gfr-ckd-epi': {
    id: 'gfr-ckd-epi',
    name: 'GFR (CKD-EPI 2021)',
    category: 'Nephrology',
    description: 'Estimates glomerular filtration rate using race-free 2021 equation',
    inputs: [
      { id: 'creatinine', name: 'Serum Creatinine', type: 'number', description: 'Serum creatinine in mg/dL', required: true, min: 0.1, max: 20, unit: 'mg/dL' },
      { id: 'age', name: 'Age', type: 'number', description: 'Patient age in years', required: true, min: 18, max: 120, unit: 'years' },
      { id: 'female', name: 'Female Sex', type: 'boolean', description: 'Female sex', required: true }
    ],
    formula: (inputs) => {
      const cr = inputs.creatinine as number;
      const age = inputs.age as number;
      const female = inputs.female as boolean;

      // CKD-EPI 2021 race-free equation
      let kappa = female ? 0.7 : 0.9;
      let alpha = female ? -0.241 : -0.302;
      let multiplier = female ? 1.012 : 1.0;

      let gfr = 142 * Math.pow(Math.min(cr / kappa, 1), alpha) *
                Math.pow(Math.max(cr / kappa, 1), -1.200) *
                Math.pow(0.9938, age) * multiplier;

      gfr = Math.round(gfr * 10) / 10;

      return {
        score: gfr,
        interpretation: CALCULATORS['gfr-ckd-epi'].interpretation(gfr),
        details: { gfr, creatinine: cr, age }
      };
    },
    interpretation: (gfr) => {
      if (gfr >= 90) return 'G1: Normal or high (≥90). No CKD if no other markers of kidney damage.';
      if (gfr >= 60) return 'G2: Mildly decreased (60-89). CKD if other markers present.';
      if (gfr >= 45) return 'G3a: Mildly to moderately decreased (45-59). CKD Stage 3a.';
      if (gfr >= 30) return 'G3b: Moderately to severely decreased (30-44). CKD Stage 3b.';
      if (gfr >= 15) return 'G4: Severely decreased (15-29). CKD Stage 4. Prepare for RRT.';
      return 'G5: Kidney failure (<15). CKD Stage 5. RRT indicated.';
    },
    source: 'KDIGO 2024 Clinical Practice Guideline for CKD',
    guidelineDate: '2024-01-01',
    version: '2024.1'
  },

  'qsofa': {
    id: 'qsofa',
    name: 'qSOFA Score',
    category: 'Emergency/Critical Care',
    description: 'Quick bedside assessment for suspected sepsis outside ICU',
    inputs: [
      { id: 'rr_high', name: 'Respiratory Rate ≥22', type: 'boolean', description: 'Respiratory rate ≥22 breaths/min', required: true },
      { id: 'altered_mentation', name: 'Altered Mentation', type: 'boolean', description: 'Any change in mental status/GCS <15', required: true },
      { id: 'sbp_low', name: 'SBP ≤100 mmHg', type: 'boolean', description: 'Systolic BP ≤100 mmHg', required: true }
    ],
    formula: (inputs) => {
      let score = 0;
      const details: Record<string, number> = {};

      if (inputs.rr_high) { score += 1; details.rr = 1; }
      if (inputs.altered_mentation) { score += 1; details.mentation = 1; }
      if (inputs.sbp_low) { score += 1; details.sbp = 1; }

      return {
        score,
        interpretation: CALCULATORS['qsofa'].interpretation(score),
        details
      };
    },
    interpretation: (score) => {
      if (score < 2) return 'qSOFA <2: Lower risk but does not rule out sepsis. Use clinical judgment.';
      return 'qSOFA ≥2: Higher risk of poor outcome. Further investigate for sepsis and organ dysfunction.';
    },
    source: 'Sepsis-3 Consensus Definitions (JAMA 2016)',
    guidelineDate: '2016-02-23',
    version: '2016.1'
  },

  'beers-criteria': {
    id: 'beers-criteria',
    name: 'AGS Beers Criteria Check',
    category: 'Geriatrics',
    description: 'Identifies potentially inappropriate medications in older adults',
    inputs: [
      { id: 'age', name: 'Age', type: 'number', description: 'Patient age in years', required: true, min: 65, max: 120, unit: 'years' },
      { id: 'medications', name: 'Medications (comma-separated)', type: 'select', description: 'List of current medications', required: true }
    ],
    formula: (inputs) => {
      // This is a simplified version - full implementation would check against complete Beers list
      const medications = String(inputs.medications).toLowerCase().split(',').map(m => m.trim());
      
      const beersMedications: Record<string, string> = {
        'amitriptyline': 'Strong anticholinergic, sedating. Avoid.',
        'diphenhydramine': 'Highly anticholinergic. Avoid for chronic use.',
        'diazepam': 'Long-acting benzodiazepine. Avoid.',
        'chlordiazepoxide': 'Long-acting benzodiazepine. Avoid.',
        'meperidine': 'Neurotoxic metabolite. Avoid.',
        'indomethacin': 'Higher GI bleeding risk. Avoid.',
        'ketorolac': 'Higher GI bleeding risk. Avoid.',
        'metoclopramide': 'Extrapyramidal effects. Avoid >12 weeks.',
        'eszopiclone': 'Minimal efficacy, high adverse effects in elderly.',
        'zolpidem': 'Minimal efficacy, high adverse effects in elderly.'
      };

      const flagged: string[] = [];
      const details: Record<string, string> = {};

      for (const med of medications) {
        for (const [beersMed, reason] of Object.entries(beersMedications)) {
          if (med.includes(beersMed)) {
            flagged.push(beersMed);
            details[beersMed] = reason;
          }
        }
      }

      return {
        score: flagged.length,
        interpretation: flagged.length === 0 
          ? 'No potentially inappropriate medications identified from provided list.'
          : `${flagged.length} potentially inappropriate medication(s) identified.`,
        details
      };
    },
    interpretation: (score) => {
      if (score === 0) return 'No PIMs identified. Continue monitoring.';
      return `${score} PIM(s) identified. Review for deprescribing opportunities.`;
    },
    source: 'American Geriatrics Society 2023 Updated Beers Criteria',
    guidelineDate: '2023-01-01',
    version: '2023.1'
  },

  'nihss': {
    id: 'nihss',
    name: 'NIH Stroke Scale',
    category: 'Neurology',
    description: 'Quantifies stroke severity',
    inputs: [
      { id: 'loc', name: '1a. Level of Consciousness', type: 'select', description: 'Responsiveness', required: true, options: [
        { value: 0, label: 'Alert', points: 0 },
        { value: 1, label: 'Not alert but arousable', points: 1 },
        { value: 2, label: 'Not alert, requires repeated stimulation', points: 2 },
        { value: 3, label: 'Unresponsive', points: 3 }
      ]},
      { id: 'loc_questions', name: '1b. LOC Questions', type: 'select', description: 'Month and age', required: true, options: [
        { value: 0, label: 'Both correct', points: 0 },
        { value: 1, label: 'One correct', points: 1 },
        { value: 2, label: 'Neither correct', points: 2 }
      ]},
      { id: 'loc_commands', name: '1c. LOC Commands', type: 'select', description: 'Open/close eyes, grip hand', required: true, options: [
        { value: 0, label: 'Both correct', points: 0 },
        { value: 1, label: 'One correct', points: 1 },
        { value: 2, label: 'Neither correct', points: 2 }
      ]},
      { id: 'gaze', name: '2. Best Gaze', type: 'select', description: 'Horizontal eye movement', required: true, options: [
        { value: 0, label: 'Normal', points: 0 },
        { value: 1, label: 'Partial gaze palsy', points: 1 },
        { value: 2, label: 'Forced deviation', points: 2 }
      ]},
      { id: 'visual', name: '3. Visual', type: 'select', description: 'Visual fields', required: true, options: [
        { value: 0, label: 'No visual loss', points: 0 },
        { value: 1, label: 'Partial hemianopia', points: 1 },
        { value: 2, label: 'Complete hemianopia', points: 2 },
        { value: 3, label: 'Bilateral hemianopia', points: 3 }
      ]},
      { id: 'facial', name: '4. Facial Palsy', type: 'select', description: 'Facial movement', required: true, options: [
        { value: 0, label: 'Normal', points: 0 },
        { value: 1, label: 'Minor paralysis', points: 1 },
        { value: 2, label: 'Partial paralysis', points: 2 },
        { value: 3, label: 'Complete paralysis', points: 3 }
      ]},
      { id: 'motor_arm_left', name: '5a. Motor Arm - Left', type: 'select', description: 'Left arm motor', required: true, options: [
        { value: 0, label: 'No drift', points: 0 },
        { value: 1, label: 'Drift', points: 1 },
        { value: 2, label: 'Some effort against gravity', points: 2 },
        { value: 3, label: 'No effort against gravity', points: 3 },
        { value: 4, label: 'No movement', points: 4 }
      ]},
      { id: 'motor_arm_right', name: '5b. Motor Arm - Right', type: 'select', description: 'Right arm motor', required: true, options: [
        { value: 0, label: 'No drift', points: 0 },
        { value: 1, label: 'Drift', points: 1 },
        { value: 2, label: 'Some effort against gravity', points: 2 },
        { value: 3, label: 'No effort against gravity', points: 3 },
        { value: 4, label: 'No movement', points: 4 }
      ]}
      // Additional items would continue...
    ],
    formula: (inputs) => {
      let score = 0;
      const details: Record<string, number> = {};

      for (const [key, value] of Object.entries(inputs)) {
        const numValue = typeof value === 'number' ? value : parseInt(String(value), 10);
        if (!isNaN(numValue)) {
          score += numValue;
          details[key] = numValue;
        }
      }

      return {
        score,
        interpretation: CALCULATORS['nihss'].interpretation(score),
        details
      };
    },
    interpretation: (score) => {
      if (score === 0) return 'No stroke symptoms.';
      if (score <= 4) return 'Minor stroke.';
      if (score <= 15) return 'Moderate stroke.';
      if (score <= 20) return 'Moderate to severe stroke.';
      return 'Severe stroke.';
    },
    source: 'AHA/ASA Stroke Guidelines',
    guidelineDate: '2022-01-01',
    version: '2022.1'
  }
};

export async function handleClinicalCalculator(
  args: Record<string, unknown>,
  auditService: AuditService
): Promise<TextContent[]> {
  const calculatorId = args.calculator as string;
  const inputs = args.inputs as Record<string, unknown>;
  const showFormula = (args.showFormula as boolean) ?? false;

  if (!calculatorId) {
    return [{ type: 'text', text: formatCalculatorList() }];
  }

  const calculator = CALCULATORS[calculatorId.toLowerCase()];
  
  if (!calculator) {
    return [{
      type: 'text',
      text: `Calculator "${calculatorId}" not found.\n\n${formatCalculatorList()}`
    }];
  }

  if (!inputs || Object.keys(inputs).length === 0) {
    return [{ type: 'text', text: formatCalculatorHelp(calculator) }];
  }

  try {
    // Validate required inputs
    const missingInputs = calculator.inputs
      .filter(i => i.required && !(i.id in inputs))
      .map(i => i.name);

    if (missingInputs.length > 0) {
      return [{
        type: 'text',
        text: `Missing required inputs: ${missingInputs.join(', ')}\n\n${formatCalculatorHelp(calculator)}`
      }];
    }

    // Run calculation
    const result = calculator.formula(inputs as Record<string, number | boolean | string>);

    auditService.log('calculator_executed', {
      calculator: calculatorId,
      score: result.score
    });

    return [{ type: 'text', text: formatCalculatorResult(calculator, result, showFormula) }];
  } catch (error) {
    return [{
      type: 'text',
      text: `Error calculating ${calculator.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
    }];
  }
}

function formatCalculatorList(): string {
  let output = `## Available Clinical Calculators\n\n`;

  const categories = [...new Set(Object.values(CALCULATORS).map(c => c.category))];
  
  for (const category of categories) {
    output += `### ${category}\n\n`;
    const calcs = Object.values(CALCULATORS).filter(c => c.category === category);
    for (const calc of calcs) {
      output += `- **\`${calc.id}\`**: ${calc.name} - ${calc.description}\n`;
    }
    output += '\n';
  }

  output += `---\n`;
  output += `Use \`clinical_calculator\` with \`calculator: "<id>"\` to get input requirements.\n`;
  output += `Run \`Healthcare Compliance: Show Calculator List\` for detailed information.`;

  return output;
}

function formatCalculatorHelp(calc: CalculatorDefinition): string {
  let output = `## ${calc.name}\n\n`;
  output += `**Category:** ${calc.category}\n`;
  output += `**Description:** ${calc.description}\n`;
  output += `**Source:** ${calc.source}\n`;
  output += `**Version:** ${calc.version} (${calc.guidelineDate})\n\n`;

  output += `### Required Inputs\n\n`;
  
  for (const input of calc.inputs) {
    output += `- **${input.id}** (${input.type})${input.required ? ' *required*' : ''}\n`;
    output += `  - ${input.name}: ${input.description}`;
    if (input.unit) output += ` [${input.unit}]`;
    if (input.min !== undefined || input.max !== undefined) {
      output += ` (Range: ${input.min ?? ''}–${input.max ?? ''})`;
    }
    output += '\n';
    
    if (input.options) {
      for (const opt of input.options) {
        output += `    - \`${opt.value}\`: ${opt.label}\n`;
      }
    }
  }

  output += `\n### Example Usage\n\n`;
  output += '```json\n';
  output += `{\n  "calculator": "${calc.id}",\n  "inputs": {\n`;
  const exampleInputs = calc.inputs
    .filter(i => i.required)
    .map(i => {
      if (i.type === 'boolean') return `    "${i.id}": true`;
      if (i.type === 'number') return `    "${i.id}": ${i.min ?? 0}`;
      return `    "${i.id}": "${i.options?.[0]?.value ?? ''}"`;
    })
    .join(',\n');
  output += exampleInputs + '\n  }\n}\n```';

  return output;
}

function formatCalculatorResult(
  calc: CalculatorDefinition,
  result: CalculatorResult,
  showFormula: boolean
): string {
  let output = `## ${calc.name} Result\n\n`;
  output += `### Score: ${result.score}\n\n`;
  output += `**Interpretation:** ${result.interpretation}\n\n`;

  if (Object.keys(result.details).length > 0) {
    output += `### Scoring Details\n\n`;
    for (const [key, value] of Object.entries(result.details)) {
      output += `- ${key}: ${value}\n`;
    }
    output += '\n';
  }

  if (showFormula) {
    output += `### Source Information\n\n`;
    output += `- **Guideline:** ${calc.source}\n`;
    output += `- **Date:** ${calc.guidelineDate}\n`;
    output += `- **Formula Version:** ${calc.version}\n`;
  }

  output += `\n---\n`;
  output += `*Clinical calculators are decision-support tools. Always use clinical judgment.*`;

  return output;
}
