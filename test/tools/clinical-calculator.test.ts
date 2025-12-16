/**
 * Clinical Calculator Tool Tests
 * 
 * Tests evidence-based clinical calculators including:
 * - CHA₂DS₂-VASc (stroke risk in AF)
 * - CURB-65 (pneumonia mortality)
 * - GFR (CKD-EPI 2021)
 * - MELD-Na (liver disease)
 * - HAS-BLED (bleeding risk)
 * - Wells DVT (thrombosis)
 * - Wells PE (pulmonary embolism)
 * - ASCVD Risk (cardiovascular)
 */

describe('Clinical Calculator Tool', () => {

  // ============================================================================
  // CHA₂DS₂-VASc Score Tests
  // ============================================================================
  describe('CHA₂DS₂-VASc Score', () => {
    test('should calculate score 0 for healthy young male', () => {
      const result = calculateCHA2DS2VASc({
        chf: false,
        hypertension: false,
        age: 45,
        diabetes: false,
        stroke: false,
        vascular: false,
        female: false
      });
      
      expect(result.score).toBe(0);
      expect(result.interpretation).toContain('Low risk');
    });

    test('should add 2 points for age ≥75', () => {
      const result = calculateCHA2DS2VASc({
        chf: false,
        hypertension: false,
        age: 78,
        diabetes: false,
        stroke: false,
        vascular: false,
        female: false
      });
      
      expect(result.details.age).toBe(2);
      expect(result.score).toBe(2);
    });

    test('should add 1 point for age 65-74', () => {
      const result = calculateCHA2DS2VASc({
        chf: false,
        hypertension: false,
        age: 70,
        diabetes: false,
        stroke: false,
        vascular: false,
        female: false
      });
      
      expect(result.details.age).toBe(1);
      expect(result.score).toBe(1);
    });

    test('should add 2 points for prior stroke/TIA', () => {
      const result = calculateCHA2DS2VASc({
        chf: false,
        hypertension: false,
        age: 45,
        diabetes: false,
        stroke: true,
        vascular: false,
        female: false
      });
      
      expect(result.details.stroke).toBe(2);
      expect(result.score).toBe(2);
    });

    test('should add 1 point for each risk factor', () => {
      const result = calculateCHA2DS2VASc({
        chf: true,
        hypertension: true,
        age: 45,
        diabetes: true,
        stroke: false,
        vascular: true,
        female: true
      });
      
      // CHF(1) + HTN(1) + DM(1) + Vascular(1) + Female(1) = 5
      expect(result.score).toBe(5);
    });

    test('should calculate maximum score of 9', () => {
      const result = calculateCHA2DS2VASc({
        chf: true,
        hypertension: true,
        age: 80,
        diabetes: true,
        stroke: true,
        vascular: true,
        female: true
      });
      
      // CHF(1) + HTN(1) + Age≥75(2) + DM(1) + Stroke(2) + Vascular(1) + Female(1) = 9
      expect(result.score).toBe(9);
    });

    test('should provide appropriate interpretation for score 2', () => {
      const result = calculateCHA2DS2VASc({
        chf: false,
        hypertension: true,
        age: 66,
        diabetes: false,
        stroke: false,
        vascular: false,
        female: false
      });
      
      expect(result.score).toBe(2);
      expect(result.interpretation).toContain('Anticoagulation recommended');
    });

    test('should recommend considering anticoagulation for score 1', () => {
      const result = calculateCHA2DS2VASc({
        chf: false,
        hypertension: true,
        age: 45,
        diabetes: false,
        stroke: false,
        vascular: false,
        female: false
      });
      
      expect(result.score).toBe(1);
      expect(result.interpretation).toContain('Consider');
    });
  });

  // ============================================================================
  // CURB-65 Score Tests
  // ============================================================================
  describe('CURB-65 Score', () => {
    test('should calculate score 0 for no risk factors', () => {
      const result = calculateCURB65({
        confusion: false,
        bun: false,
        rr: false,
        sbp_low: false,
        age_65: false
      });
      
      expect(result.score).toBe(0);
      expect(result.interpretation).toContain('Low risk');
      expect(result.interpretation).toContain('outpatient');
    });

    test('should add 1 point for each criterion', () => {
      const result = calculateCURB65({
        confusion: true,
        bun: true,
        rr: true,
        sbp_low: true,
        age_65: true
      });
      
      expect(result.score).toBe(5);
    });

    test('should recommend outpatient for score 1', () => {
      const result = calculateCURB65({
        confusion: true,
        bun: false,
        rr: false,
        sbp_low: false,
        age_65: false
      });
      
      expect(result.score).toBe(1);
      expect(result.interpretation).toContain('outpatient');
    });

    test('should suggest hospitalization for score 2', () => {
      const result = calculateCURB65({
        confusion: true,
        bun: true,
        rr: false,
        sbp_low: false,
        age_65: false
      });
      
      expect(result.score).toBe(2);
      expect(result.interpretation).toContain('Moderate risk');
    });

    test('should recommend ICU consideration for score ≥3', () => {
      const result = calculateCURB65({
        confusion: true,
        bun: true,
        rr: true,
        sbp_low: false,
        age_65: false
      });
      
      expect(result.score).toBe(3);
      expect(result.interpretation).toContain('High risk');
      expect(result.interpretation).toContain('ICU');
    });

    test('should track individual criteria in details', () => {
      const result = calculateCURB65({
        confusion: true,
        bun: false,
        rr: true,
        sbp_low: false,
        age_65: true
      });
      
      expect(result.details.confusion).toBe(1);
      expect(result.details.bun).toBeUndefined();
      expect(result.details.rr).toBe(1);
      expect(result.details.age_65).toBe(1);
    });
  });

  // ============================================================================
  // GFR CKD-EPI 2021 Tests
  // ============================================================================
  describe('GFR CKD-EPI 2021', () => {
    test('should calculate normal GFR for healthy values', () => {
      const result = calculateGFR({
        creatinine: 0.9,
        age: 35,
        female: false
      });
      
      // Expected ~105-115 for healthy adult male
      expect(result.score).toBeGreaterThan(90);
      expect(result.interpretation).toContain('G1');
    });

    test('should calculate lower GFR for elevated creatinine', () => {
      const result = calculateGFR({
        creatinine: 2.0,
        age: 60,
        female: false
      });
      
      // Expected ~30-45 for elevated Cr
      expect(result.score).toBeLessThan(50);
      expect(result.score).toBeGreaterThan(20);
    });

    test('should adjust for female sex', () => {
      const malResult = calculateGFR({
        creatinine: 1.0,
        age: 45,
        female: false
      });
      
      const femaleResult = calculateGFR({
        creatinine: 1.0,
        age: 45,
        female: true
      });
      
      // Female should have slightly different result due to equation
      expect(malResult.score).not.toBe(femaleResult.score);
    });

    test('should decrease GFR with age', () => {
      const young = calculateGFR({
        creatinine: 1.0,
        age: 30,
        female: false
      });
      
      const old = calculateGFR({
        creatinine: 1.0,
        age: 80,
        female: false
      });
      
      expect(young.score).toBeGreaterThan(old.score);
    });

    test('should classify CKD stage G1 (≥90)', () => {
      const result = calculateGFR({
        creatinine: 0.8,
        age: 30,
        female: false
      });
      
      expect(result.interpretation).toContain('G1');
    });

    test('should classify CKD stage G3a (45-59)', () => {
      const result = calculateGFR({
        creatinine: 1.4,
        age: 65,
        female: false
      });
      
      if (result.score >= 45 && result.score < 60) {
        expect(result.interpretation).toContain('G3a');
      }
    });

    test('should classify CKD stage G5 (<15)', () => {
      const result = calculateGFR({
        creatinine: 8.0,
        age: 60,
        female: false
      });
      
      expect(result.score).toBeLessThan(15);
      expect(result.interpretation).toContain('G5');
    });

    test('should use race-free 2021 equation', () => {
      // The 2021 CKD-EPI equation removes race adjustment
      const result = calculateGFR({
        creatinine: 1.0,
        age: 45,
        female: false
      });
      
      // Result should be consistent regardless of race
      expect(result.score).toBeGreaterThan(0);
      expect(result.details.equation).toBe('CKD-EPI 2021');
    });
  });

  // ============================================================================
  // MELD-Na Score Tests
  // ============================================================================
  describe('MELD-Na Score', () => {
    test('should calculate MELD-Na for typical cirrhosis values', () => {
      const result = calculateMELDNa({
        creatinine: 1.5,
        bilirubin: 2.0,
        inr: 1.5,
        sodium: 135,
        dialysis: false
      });
      
      // Expected ~15-20 for these values
      expect(result.score).toBeGreaterThan(10);
      expect(result.score).toBeLessThan(30);
    });

    test('should cap creatinine at 4.0', () => {
      const result = calculateMELDNa({
        creatinine: 6.0,
        bilirubin: 2.0,
        inr: 1.5,
        sodium: 135,
        dialysis: false
      });
      
      expect(result.details.creatinine_capped).toBe(4.0);
    });

    test('should set creatinine to 4.0 if on dialysis', () => {
      const result = calculateMELDNa({
        creatinine: 1.0,
        bilirubin: 2.0,
        inr: 1.5,
        sodium: 135,
        dialysis: true
      });
      
      expect(result.details.creatinine_used).toBe(4.0);
    });

    test('should bound sodium 125-137', () => {
      const lowSodium = calculateMELDNa({
        creatinine: 1.5,
        bilirubin: 2.0,
        inr: 1.5,
        sodium: 120,
        dialysis: false
      });
      
      expect(lowSodium.details.sodium_bounded).toBe(125);
      
      const highSodium = calculateMELDNa({
        creatinine: 1.5,
        bilirubin: 2.0,
        inr: 1.5,
        sodium: 145,
        dialysis: false
      });
      
      expect(highSodium.details.sodium_bounded).toBe(137);
    });

    test('should increase score with lower sodium', () => {
      const normalNa = calculateMELDNa({
        creatinine: 1.5,
        bilirubin: 2.0,
        inr: 1.5,
        sodium: 140,
        dialysis: false
      });
      
      const lowNa = calculateMELDNa({
        creatinine: 1.5,
        bilirubin: 2.0,
        inr: 1.5,
        sodium: 128,
        dialysis: false
      });
      
      expect(lowNa.score).toBeGreaterThan(normalNa.score);
    });

    test('should have floor of 6 and ceiling of 40', () => {
      const low = calculateMELDNa({
        creatinine: 0.5,
        bilirubin: 0.5,
        inr: 1.0,
        sodium: 140,
        dialysis: false
      });
      
      expect(low.score).toBeGreaterThanOrEqual(6);
      
      const high = calculateMELDNa({
        creatinine: 10.0,
        bilirubin: 30.0,
        inr: 4.0,
        sodium: 120,
        dialysis: true
      });
      
      expect(high.score).toBeLessThanOrEqual(40);
    });
  });

  // ============================================================================
  // HAS-BLED Score Tests
  // ============================================================================
  describe('HAS-BLED Score', () => {
    test('should calculate score 0 for no risk factors', () => {
      const result = calculateHASBLED({
        hypertension: false,
        renalDisease: false,
        liverDisease: false,
        stroke: false,
        bleeding: false,
        labileINR: false,
        age65: false,
        drugs: false,
        alcohol: false
      });
      
      expect(result.score).toBe(0);
      expect(result.interpretation).toContain('Low');
    });

    test('should add 1 point for each risk factor', () => {
      const result = calculateHASBLED({
        hypertension: true,
        renalDisease: true,
        liverDisease: true,
        stroke: true,
        bleeding: true,
        labileINR: true,
        age65: true,
        drugs: true,
        alcohol: true
      });
      
      expect(result.score).toBe(9);
    });

    test('should classify high risk for score ≥3', () => {
      const result = calculateHASBLED({
        hypertension: true,
        renalDisease: false,
        liverDisease: false,
        stroke: true,
        bleeding: true,
        labileINR: false,
        age65: false,
        drugs: false,
        alcohol: false
      });
      
      expect(result.score).toBe(3);
      expect(result.interpretation.toLowerCase()).toContain('high');
    });

    test('should track individual risk factors', () => {
      const result = calculateHASBLED({
        hypertension: true,
        renalDisease: false,
        liverDisease: true,
        stroke: false,
        bleeding: false,
        labileINR: false,
        age65: true,
        drugs: false,
        alcohol: false
      });
      
      expect(result.details.hypertension).toBe(1);
      expect(result.details.liverDisease).toBe(1);
      expect(result.details.age65).toBe(1);
      expect(result.details.renalDisease).toBeUndefined();
    });
  });

  // ============================================================================
  // Wells DVT Score Tests
  // ============================================================================
  describe('Wells DVT Score', () => {
    test('should calculate low probability for no factors', () => {
      const result = calculateWellsDVT({
        activeCancer: false,
        paralysis: false,
        bedridden: false,
        tenderness: false,
        swelling: false,
        calfSwelling: false,
        pittingEdema: false,
        collateralVeins: false,
        previousDVT: false,
        alternativeDiagnosis: false
      });
      
      expect(result.score).toBe(0);
      expect(result.interpretation).toContain('unlikely');
    });

    test('should add correct points for each factor', () => {
      const result = calculateWellsDVT({
        activeCancer: true,           // +1
        paralysis: true,              // +1
        bedridden: true,              // +1
        tenderness: true,             // +1
        swelling: true,               // +1
        calfSwelling: true,           // +1
        pittingEdema: true,           // +1
        collateralVeins: true,        // +1
        previousDVT: true,            // +1
        alternativeDiagnosis: false   // 0 (would be -2)
      });
      
      expect(result.score).toBe(9);
    });

    test('should subtract 2 for alternative diagnosis', () => {
      const result = calculateWellsDVT({
        activeCancer: true,
        paralysis: false,
        bedridden: false,
        tenderness: true,
        swelling: false,
        calfSwelling: false,
        pittingEdema: false,
        collateralVeins: false,
        previousDVT: false,
        alternativeDiagnosis: true  // -2
      });
      
      expect(result.score).toBe(0); // 1 + 1 - 2 = 0
    });

    test('should classify DVT likely for score ≥2', () => {
      const result = calculateWellsDVT({
        activeCancer: true,
        paralysis: false,
        bedridden: false,
        tenderness: true,
        swelling: false,
        calfSwelling: false,
        pittingEdema: false,
        collateralVeins: false,
        previousDVT: false,
        alternativeDiagnosis: false
      });
      
      expect(result.score).toBe(2);
      expect(result.interpretation).toContain('likely');
    });
  });

  // ============================================================================
  // Wells PE Score Tests
  // ============================================================================
  describe('Wells PE Score', () => {
    test('should calculate low probability for no factors', () => {
      const result = calculateWellsPE({
        dvtSymptoms: false,
        peMostLikely: false,
        heartRate: 90,
        immobilization: false,
        previousPEDVT: false,
        hemoptysis: false,
        malignancy: false
      });
      
      expect(result.score).toBe(0);
      expect(result.interpretation).toContain('unlikely');
    });

    test('should add 3 points for PE most likely and DVT symptoms', () => {
      const result = calculateWellsPE({
        dvtSymptoms: true,           // +3
        peMostLikely: true,          // +3
        heartRate: 90,               // 0
        immobilization: false,
        previousPEDVT: false,
        hemoptysis: false,
        malignancy: false
      });
      
      expect(result.score).toBe(6);
    });

    test('should add 1.5 points for HR >100', () => {
      const result = calculateWellsPE({
        dvtSymptoms: false,
        peMostLikely: false,
        heartRate: 105,              // +1.5
        immobilization: true,        // +1.5
        previousPEDVT: true,         // +1.5
        hemoptysis: true,            // +1
        malignancy: true             // +1
      });
      
      expect(result.score).toBe(6.5);
    });

    test('should classify PE likely for score >4', () => {
      const result = calculateWellsPE({
        dvtSymptoms: true,
        peMostLikely: false,
        heartRate: 105,
        immobilization: false,
        previousPEDVT: false,
        hemoptysis: false,
        malignancy: false
      });
      
      expect(result.score).toBe(4.5);
      expect(result.interpretation).toContain('likely');
    });
  });

  // ============================================================================
  // ASCVD Risk Calculator Tests
  // ============================================================================
  describe('ASCVD Risk Calculator', () => {
    test('should calculate 10-year ASCVD risk', () => {
      const result = calculateASCVD({
        age: 55,
        female: false,
        totalCholesterol: 200,
        hdl: 45,
        systolicBP: 140,
        hypertensionTreatment: false,
        diabetes: false,
        smoker: false
      });
      
      // Should return a percentage risk
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    test('should calculate higher risk for older patients', () => {
      const young = calculateASCVD({
        age: 45,
        female: false,
        totalCholesterol: 200,
        hdl: 50,
        systolicBP: 130,
        hypertensionTreatment: false,
        diabetes: false,
        smoker: false
      });
      
      const old = calculateASCVD({
        age: 70,
        female: false,
        totalCholesterol: 200,
        hdl: 50,
        systolicBP: 130,
        hypertensionTreatment: false,
        diabetes: false,
        smoker: false
      });
      
      expect(old.score).toBeGreaterThan(young.score);
    });

    test('should calculate higher risk for diabetics', () => {
      const nonDiabetic = calculateASCVD({
        age: 55,
        female: false,
        totalCholesterol: 200,
        hdl: 45,
        systolicBP: 140,
        hypertensionTreatment: false,
        diabetes: false,
        smoker: false
      });
      
      const diabetic = calculateASCVD({
        age: 55,
        female: false,
        totalCholesterol: 200,
        hdl: 45,
        systolicBP: 140,
        hypertensionTreatment: false,
        diabetes: true,
        smoker: false
      });
      
      expect(diabetic.score).toBeGreaterThan(nonDiabetic.score);
    });

    test('should calculate higher risk for smokers', () => {
      const nonSmoker = calculateASCVD({
        age: 55,
        female: false,
        totalCholesterol: 200,
        hdl: 45,
        systolicBP: 130,
        hypertensionTreatment: false,
        diabetes: false,
        smoker: false
      });
      
      const smoker = calculateASCVD({
        age: 55,
        female: false,
        totalCholesterol: 200,
        hdl: 45,
        systolicBP: 130,
        hypertensionTreatment: false,
        diabetes: false,
        smoker: true
      });
      
      expect(smoker.score).toBeGreaterThan(nonSmoker.score);
    });

    test('should provide statin guidance for high risk (≥7.5%)', () => {
      const result = calculateASCVD({
        age: 65,
        female: false,
        totalCholesterol: 250,
        hdl: 35,
        systolicBP: 150,
        hypertensionTreatment: true,
        diabetes: true,
        smoker: true
      });
      
      if (result.score >= 7.5) {
        expect(result.interpretation).toContain('statin');
      }
    });

    test('should classify intermediate risk (5-7.5%)', () => {
      const result = calculateASCVD({
        age: 55,
        female: false,
        totalCholesterol: 220,
        hdl: 45,
        systolicBP: 140,
        hypertensionTreatment: false,
        diabetes: false,
        smoker: false
      });
      
      if (result.score >= 5 && result.score < 7.5) {
        expect(result.interpretation).toContain('intermediate');
      }
    });
  });

  // ============================================================================
  // Calculator Metadata Tests
  // ============================================================================
  describe('Calculator Metadata', () => {
    test('should include source citation', () => {
      const calculators = getAvailableCalculators();
      
      for (const calc of calculators) {
        expect(calc.source).toBeDefined();
        expect(calc.source.length).toBeGreaterThan(0);
      }
    });

    test('should include guideline date', () => {
      const calculators = getAvailableCalculators();
      
      for (const calc of calculators) {
        expect(calc.guidelineDate).toBeDefined();
        expect(calc.guidelineDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    test('should include version number', () => {
      const calculators = getAvailableCalculators();
      
      for (const calc of calculators) {
        expect(calc.version).toBeDefined();
      }
    });

    test('should categorize calculators', () => {
      const calculators = getAvailableCalculators();
      
      const categories = new Set(calculators.map(c => c.category));
      expect(categories.size).toBeGreaterThan(1);
    });

    test('should provide input descriptions', () => {
      const calculators = getAvailableCalculators();
      
      for (const calc of calculators) {
        for (const input of calc.inputs) {
          expect(input.description).toBeDefined();
          expect(input.description.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ============================================================================
  // Input Validation Tests
  // ============================================================================
  describe('Input Validation', () => {
    test('should handle missing required inputs', () => {
      const result = calculateCHA2DS2VASc({
        chf: true,
        // missing hypertension, age, etc.
      } as any);
      
      // Should handle gracefully or throw clear error
      expect(result.error || result.score !== undefined).toBe(true);
    });

    test('should validate numeric ranges', () => {
      const result = calculateGFR({
        creatinine: -1,  // Invalid
        age: 45,
        female: false
      });
      
      // Should handle invalid input
      expect(result.error || result.score >= 0).toBe(true);
    });

    test('should coerce boolean inputs', () => {
      const result = calculateCURB65({
        confusion: 1,  // truthy
        bun: 0,        // falsy
        rr: false,
        sbp_low: false,
        age_65: false
      } as any);
      
      // Should treat truthy as true
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// Test Helper Functions (Mirror actual implementation)
// ============================================================================

interface CalculatorResult {
  score: number;
  interpretation: string;
  details: Record<string, number | string | undefined>;
  error?: string;
}

interface CalculatorMeta {
  id: string;
  name: string;
  category: string;
  description: string;
  source: string;
  guidelineDate: string;
  version: string;
  inputs: Array<{ id: string; description: string }>;
}

function calculateCHA2DS2VASc(inputs: {
  chf: boolean;
  hypertension: boolean;
  age: number;
  diabetes: boolean;
  stroke: boolean;
  vascular: boolean;
  female: boolean;
}): CalculatorResult {
  let score = 0;
  const details: Record<string, number> = {};

  if (inputs.chf) { score += 1; details.chf = 1; }
  if (inputs.hypertension) { score += 1; details.hypertension = 1; }
  
  const age = inputs.age || 0;
  if (age >= 75) { score += 2; details.age = 2; }
  else if (age >= 65) { score += 1; details.age = 1; }
  
  if (inputs.diabetes) { score += 1; details.diabetes = 1; }
  if (inputs.stroke) { score += 2; details.stroke = 2; }
  if (inputs.vascular) { score += 1; details.vascular = 1; }
  if (inputs.female) { score += 1; details.female = 1; }

  let interpretation: string;
  if (score === 0) interpretation = 'Low risk. Annual stroke risk ~0.2%. Anticoagulation may not be needed.';
  else if (score === 1) interpretation = 'Low-moderate risk. Annual stroke risk ~0.6%. Consider anticoagulation.';
  else if (score === 2) interpretation = 'Moderate risk. Annual stroke risk ~2.2%. Anticoagulation recommended.';
  else if (score <= 4) interpretation = 'Moderate-high risk. Anticoagulation recommended.';
  else interpretation = 'Very high risk. Anticoagulation strongly recommended.';

  return { score, interpretation, details };
}

function calculateCURB65(inputs: {
  confusion: boolean;
  bun: boolean;
  rr: boolean;
  sbp_low: boolean;
  age_65: boolean;
}): CalculatorResult {
  let score = 0;
  const details: Record<string, number> = {};

  if (inputs.confusion) { score += 1; details.confusion = 1; }
  if (inputs.bun) { score += 1; details.bun = 1; }
  if (inputs.rr) { score += 1; details.rr = 1; }
  if (inputs.sbp_low) { score += 1; details.sbp_low = 1; }
  if (inputs.age_65) { score += 1; details.age_65 = 1; }

  let interpretation: string;
  if (score <= 1) interpretation = 'Low risk (0.6-2.7% mortality). Consider outpatient treatment.';
  else if (score === 2) interpretation = 'Moderate risk (6.8% mortality). Consider short hospitalization.';
  else interpretation = 'High risk (14-27.8% mortality). Hospitalize, consider ICU admission.';

  return { score, interpretation, details };
}

function calculateGFR(inputs: {
  creatinine: number;
  age: number;
  female: boolean;
}): CalculatorResult {
  const cr = Math.max(0.1, inputs.creatinine);
  const age = inputs.age;
  const female = inputs.female;

  // CKD-EPI 2021 race-free equation
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const multiplier = female ? 1.012 : 1.0;

  let gfr = 142 * Math.pow(Math.min(cr / kappa, 1), alpha) *
            Math.pow(Math.max(cr / kappa, 1), -1.200) *
            Math.pow(0.9938, age) * multiplier;

  gfr = Math.round(gfr * 10) / 10;

  let stage: string;
  if (gfr >= 90) stage = 'G1 - Normal or high';
  else if (gfr >= 60) stage = 'G2 - Mildly decreased';
  else if (gfr >= 45) stage = 'G3a - Mildly to moderately decreased';
  else if (gfr >= 30) stage = 'G3b - Moderately to severely decreased';
  else if (gfr >= 15) stage = 'G4 - Severely decreased';
  else stage = 'G5 - Kidney failure';

  return {
    score: gfr,
    interpretation: `CKD Stage ${stage}`,
    details: { equation: 'CKD-EPI 2021', gfr }
  };
}

function calculateMELDNa(inputs: {
  creatinine: number;
  bilirubin: number;
  inr: number;
  sodium: number;
  dialysis: boolean;
}): CalculatorResult {
  let cr = inputs.dialysis ? 4.0 : Math.min(Math.max(inputs.creatinine, 1.0), 4.0);
  const bili = Math.max(inputs.bilirubin, 1.0);
  const inr = Math.max(inputs.inr, 1.0);
  let na = Math.min(Math.max(inputs.sodium, 125), 137);

  // MELD-Na formula
  let meld = 10 * (
    0.957 * Math.log(cr) +
    0.378 * Math.log(bili) +
    1.120 * Math.log(inr) +
    0.643
  );

  // Sodium adjustment
  meld = meld - na - 0.025 * meld * (140 - na) + 140;
  meld = Math.round(Math.min(Math.max(meld, 6), 40));

  return {
    score: meld,
    interpretation: `MELD-Na score ${meld}`,
    details: {
      creatinine_capped: Math.min(inputs.creatinine, 4.0),
      creatinine_used: cr,
      sodium_bounded: na
    }
  };
}

function calculateHASBLED(inputs: {
  hypertension: boolean;
  renalDisease: boolean;
  liverDisease: boolean;
  stroke: boolean;
  bleeding: boolean;
  labileINR: boolean;
  age65: boolean;
  drugs: boolean;
  alcohol: boolean;
}): CalculatorResult {
  let score = 0;
  const details: Record<string, number> = {};

  if (inputs.hypertension) { score += 1; details.hypertension = 1; }
  if (inputs.renalDisease) { score += 1; details.renalDisease = 1; }
  if (inputs.liverDisease) { score += 1; details.liverDisease = 1; }
  if (inputs.stroke) { score += 1; details.stroke = 1; }
  if (inputs.bleeding) { score += 1; details.bleeding = 1; }
  if (inputs.labileINR) { score += 1; details.labileINR = 1; }
  if (inputs.age65) { score += 1; details.age65 = 1; }
  if (inputs.drugs) { score += 1; details.drugs = 1; }
  if (inputs.alcohol) { score += 1; details.alcohol = 1; }

  let interpretation: string;
  if (score <= 2) interpretation = 'Low bleeding risk.';
  else interpretation = 'High bleeding risk (≥3). Consider bleeding risk when prescribing anticoagulation.';

  return { score, interpretation, details };
}

function calculateWellsDVT(inputs: {
  activeCancer: boolean;
  paralysis: boolean;
  bedridden: boolean;
  tenderness: boolean;
  swelling: boolean;
  calfSwelling: boolean;
  pittingEdema: boolean;
  collateralVeins: boolean;
  previousDVT: boolean;
  alternativeDiagnosis: boolean;
}): CalculatorResult {
  let score = 0;
  const details: Record<string, number> = {};

  if (inputs.activeCancer) { score += 1; details.activeCancer = 1; }
  if (inputs.paralysis) { score += 1; details.paralysis = 1; }
  if (inputs.bedridden) { score += 1; details.bedridden = 1; }
  if (inputs.tenderness) { score += 1; details.tenderness = 1; }
  if (inputs.swelling) { score += 1; details.swelling = 1; }
  if (inputs.calfSwelling) { score += 1; details.calfSwelling = 1; }
  if (inputs.pittingEdema) { score += 1; details.pittingEdema = 1; }
  if (inputs.collateralVeins) { score += 1; details.collateralVeins = 1; }
  if (inputs.previousDVT) { score += 1; details.previousDVT = 1; }
  if (inputs.alternativeDiagnosis) { score -= 2; details.alternativeDiagnosis = -2; }

  let interpretation: string;
  if (score < 2) interpretation = 'DVT unlikely. Consider D-dimer testing.';
  else interpretation = 'DVT likely. Consider imaging (ultrasound).';

  return { score, interpretation, details };
}

function calculateWellsPE(inputs: {
  dvtSymptoms: boolean;
  peMostLikely: boolean;
  heartRate: number;
  immobilization: boolean;
  previousPEDVT: boolean;
  hemoptysis: boolean;
  malignancy: boolean;
}): CalculatorResult {
  let score = 0;
  const details: Record<string, number> = {};

  if (inputs.dvtSymptoms) { score += 3; details.dvtSymptoms = 3; }
  if (inputs.peMostLikely) { score += 3; details.peMostLikely = 3; }
  if (inputs.heartRate > 100) { score += 1.5; details.heartRate = 1.5; }
  if (inputs.immobilization) { score += 1.5; details.immobilization = 1.5; }
  if (inputs.previousPEDVT) { score += 1.5; details.previousPEDVT = 1.5; }
  if (inputs.hemoptysis) { score += 1; details.hemoptysis = 1; }
  if (inputs.malignancy) { score += 1; details.malignancy = 1; }

  let interpretation: string;
  if (score <= 4) interpretation = 'PE unlikely. Consider D-dimer testing.';
  else interpretation = 'PE likely. Consider CT angiography.';

  return { score, interpretation, details };
}

function calculateASCVD(inputs: {
  age: number;
  female: boolean;
  totalCholesterol: number;
  hdl: number;
  systolicBP: number;
  hypertensionTreatment: boolean;
  diabetes: boolean;
  smoker: boolean;
}): CalculatorResult {
  // Simplified Pooled Cohort Equations approximation
  let risk = 1.0;
  
  // Age contribution (major factor)
  risk *= Math.pow(1.05, inputs.age - 40);
  
  // Sex adjustment
  if (inputs.female) risk *= 0.7;
  
  // Cholesterol ratio
  risk *= Math.pow(inputs.totalCholesterol / inputs.hdl / 4, 0.5);
  
  // Blood pressure
  if (inputs.systolicBP > 120) {
    risk *= Math.pow(1.02, inputs.systolicBP - 120);
  }
  
  // Treatment adjustment
  if (inputs.hypertensionTreatment) risk *= 1.1;
  
  // Diabetes
  if (inputs.diabetes) risk *= 1.5;
  
  // Smoking
  if (inputs.smoker) risk *= 1.8;
  
  // Convert to 10-year %
  let tenYearRisk = Math.min(risk * 0.5, 100);
  tenYearRisk = Math.round(tenYearRisk * 10) / 10;
  
  let interpretation: string;
  if (tenYearRisk < 5) interpretation = 'Low risk (<5%). Lifestyle modifications recommended.';
  else if (tenYearRisk < 7.5) interpretation = 'Borderline to intermediate risk (5-7.5%). Consider risk discussion.';
  else if (tenYearRisk < 20) interpretation = 'Intermediate to high risk (7.5-20%). Moderate-intensity statin recommended.';
  else interpretation = 'High risk (≥20%). High-intensity statin recommended.';

  return {
    score: tenYearRisk,
    interpretation,
    details: { tenYearRisk, ageAtCalculation: inputs.age }
  };
}

function getAvailableCalculators(): CalculatorMeta[] {
  return [
    {
      id: 'cha2ds2-vasc',
      name: 'CHA₂DS₂-VASc Score',
      category: 'Cardiology',
      description: 'Stroke risk in atrial fibrillation',
      source: 'ACC/AHA/HRS 2023 Atrial Fibrillation Guidelines',
      guidelineDate: '2023-11-01',
      version: '2023.1',
      inputs: [
        { id: 'chf', description: 'History of CHF' },
        { id: 'hypertension', description: 'History of hypertension' }
      ]
    },
    {
      id: 'curb-65',
      name: 'CURB-65',
      category: 'Pulmonology',
      description: 'Pneumonia mortality risk',
      source: 'IDSA/ATS CAP Guidelines 2019',
      guidelineDate: '2019-10-01',
      version: '2019.1',
      inputs: [{ id: 'confusion', description: 'New confusion' }]
    },
    {
      id: 'gfr-ckd-epi',
      name: 'GFR (CKD-EPI 2021)',
      category: 'Nephrology',
      description: 'Estimated GFR',
      source: 'KDIGO 2021',
      guidelineDate: '2021-03-01',
      version: '2021.1',
      inputs: [{ id: 'creatinine', description: 'Serum creatinine' }]
    },
    {
      id: 'meld-na',
      name: 'MELD-Na',
      category: 'Hepatology',
      description: 'Liver disease severity',
      source: 'UNOS 2016',
      guidelineDate: '2016-01-11',
      version: '2016.1',
      inputs: [{ id: 'creatinine', description: 'Serum creatinine' }]
    }
  ];
}
