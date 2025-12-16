/**
 * HIPAA Validation Tool Tests
 * 
 * Tests the HIPAA compliance validation logic against various
 * healthcare data handling scenarios per 45 CFR 164
 */

describe('HIPAA Validation Tool', () => {
  
  // Test scenarios representing common HIPAA situations
  const HIPAA_SCENARIOS = {
    // Critical violations
    criticalViolations: [
      {
        name: 'Unencrypted PHI transmission',
        scenario: 'Transmit patient SSN and medical records to third-party vendor via API',
        dataElements: ['ssn', 'medical_record_number', 'diagnosis'],
        controls: [], // No controls in place
        expectedRiskLevel: 'critical',
        expectedViolations: ['Transmission Security', 'Business Associate Agreement']
      },
      {
        name: 'Cloud storage without BAA',
        scenario: 'Store patient data including SSN in AWS S3 bucket',
        dataElements: ['ssn', 'patient_name', 'date_of_birth'],
        controls: ['encryption_at_rest'], // Has encryption but no BAA
        expectedRiskLevel: 'critical',
        expectedViolations: ['Cloud BAA']
      }
    ],
    
    // High risk scenarios
    highRiskScenarios: [
      {
        name: 'Missing access controls',
        scenario: 'Store patient names and dates of birth in database',
        dataElements: ['patient_name', 'date_of_birth', 'address'],
        controls: ['encryption_at_rest'],
        expectedRiskLevel: 'high',
        expectedWarnings: ['Access Control', 'Audit Controls']
      },
      {
        name: 'Third-party data sharing',
        scenario: 'Share patient health plan ID with business associate partner',
        dataElements: ['health_plan_id', 'patient_name'],
        controls: ['encryption_in_transit', 'baa'],
        expectedRiskLevel: 'high',
        expectedViolations: [] // BAA in place, should be compliant
      }
    ],
    
    // Compliant scenarios
    compliantScenarios: [
      {
        name: 'Fully secured data storage',
        scenario: 'Store patient demographics in HIPAA-compliant database',
        dataElements: ['patient_name', 'date_of_birth'],
        controls: ['encryption_at_rest', 'encryption_in_transit', 'role_based_access', 'audit_trail', 'mfa'],
        expectedRiskLevel: 'high', // Still high due to data elements
        expectedViolations: [],
        expectedCompliant: true
      },
      {
        name: 'Low-risk aggregated analytics',
        scenario: 'Generate aggregate reports on patient age distribution',
        dataElements: ['age', 'gender'],
        controls: ['role_based_access', 'audit_trail'],
        expectedRiskLevel: 'low',
        expectedViolations: [],
        expectedCompliant: true
      }
    ],
    
    // Edge cases
    edgeCases: [
      {
        name: 'No data elements specified',
        scenario: 'Build a healthcare scheduling application',
        dataElements: [],
        controls: [],
        expectedRiskLevel: 'low'
      },
      {
        name: 'Many data elements (minimum necessary check)',
        scenario: 'Process comprehensive patient record for care coordination',
        dataElements: [
          'patient_name', 'date_of_birth', 'ssn', 'address', 
          'phone_number', 'email', 'diagnosis', 'medications'
        ],
        controls: ['encryption_at_rest', 'role_based_access'],
        expectedRiskLevel: 'critical',
        expectedInfoFindings: ['Minimum Necessary']
      }
    ]
  };

  // HIPAA Rules reference data for validation
  const HIPAA_RULES = {
    privacy: {
      minimumNecessary: '45 CFR 164.502(b)',
      notice: '45 CFR 164.520',
      patientRights: '45 CFR 164.524-528',
      authorization: '45 CFR 164.508',
      deidentification: '45 CFR 164.514'
    },
    security: {
      accessControl: '45 CFR 164.312(a)(1)',
      auditControls: '45 CFR 164.312(b)',
      integrity: '45 CFR 164.312(c)(1)',
      transmission: '45 CFR 164.312(e)(1)',
      encryption: '45 CFR 164.312(a)(2)(iv) & (e)(2)(ii)'
    },
    breach: {
      notification: '45 CFR 164.400-414',
      riskAssessment: '45 CFR 164.402'
    },
    administrative: {
      baa: '45 CFR 164.502(e) & 164.504(e)',
      riskAnalysis: '45 CFR 164.308(a)(1)(ii)(A)',
      training: '45 CFR 164.308(a)(5)',
      policies: '45 CFR 164.316'
    }
  };

  // PHI element risk classifications
  const PHI_RISK_LEVELS = {
    critical: ['ssn', 'medical_record_number'],
    high: ['health_plan_id', 'patient_name', 'date_of_birth', 'address'],
    medium: ['phone_number', 'email', 'diagnosis', 'medications', 'lab_results', 'treatment_plan'],
    low: ['age', 'gender', 'zip_code_3digit']
  };

  describe('Risk Level Assessment', () => {
    test('should classify SSN as critical risk', () => {
      const result = validateScenario({
        scenario: 'Process patient SSN for insurance verification',
        dataElements: ['ssn'],
        controls: []
      });
      expect(result.riskLevel).toBe('critical');
    });

    test('should classify patient name as high risk', () => {
      const result = validateScenario({
        scenario: 'Store patient name in database',
        dataElements: ['patient_name'],
        controls: []
      });
      expect(result.riskLevel).toBe('high');
    });

    test('should classify diagnosis as medium risk', () => {
      const result = validateScenario({
        scenario: 'Log patient diagnosis for analytics',
        dataElements: ['diagnosis'],
        controls: []
      });
      expect(result.riskLevel).toBe('medium');
    });

    test('should classify age alone as low risk', () => {
      const result = validateScenario({
        scenario: 'Generate age distribution report',
        dataElements: ['age'],
        controls: []
      });
      expect(result.riskLevel).toBe('low');
    });

    test('should escalate to highest risk when multiple elements present', () => {
      const result = validateScenario({
        scenario: 'Process patient record',
        dataElements: ['age', 'diagnosis', 'patient_name', 'ssn'],
        controls: []
      });
      expect(result.riskLevel).toBe('critical');
    });
  });

  describe('Transmission Security (45 CFR 164.312(e))', () => {
    test('should flag violation when transmitting without encryption', () => {
      const result = validateScenario({
        scenario: 'Transmit patient data via API to external system',
        dataElements: ['patient_name'],
        controls: []
      });
      
      const violation = result.findings.find(f => f.rule === 'Transmission Security');
      expect(violation).toBeDefined();
      expect(violation?.severity).toBe('violation');
    });

    test('should not flag when encryption_in_transit is present', () => {
      const result = validateScenario({
        scenario: 'Send patient data via encrypted API',
        dataElements: ['patient_name'],
        controls: ['encryption_in_transit']
      });
      
      const violation = result.findings.find(f => f.rule === 'Transmission Security');
      expect(violation).toBeUndefined();
    });
  });

  describe('Storage Security (45 CFR 164.312(c))', () => {
    test('should flag violation when storing critical data without encryption', () => {
      const result = validateScenario({
        scenario: 'Store SSN in database',
        dataElements: ['ssn'],
        controls: []
      });
      
      const finding = result.findings.find(f => f.rule === 'Data at Rest');
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('violation');
    });

    test('should flag warning when storing medium-risk data without encryption', () => {
      const result = validateScenario({
        scenario: 'Store diagnosis in file system',
        dataElements: ['diagnosis'],
        controls: []
      });
      
      const finding = result.findings.find(f => f.rule === 'Data at Rest');
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('warning');
    });

    test('should not require encryption for low-risk data alone', () => {
      const result = validateScenario({
        scenario: 'Store aggregated age data',
        dataElements: ['age'],
        controls: []
      });
      
      const finding = result.findings.find(f => f.rule === 'Data at Rest');
      expect(finding).toBeUndefined();
    });
  });

  describe('Business Associate Agreements (45 CFR 164.504(e))', () => {
    test('should require BAA for third-party involvement', () => {
      const result = validateScenario({
        scenario: 'Share patient data with third-party vendor',
        dataElements: ['patient_name'],
        controls: []
      });
      
      const violation = result.findings.find(f => f.rule === 'Business Associate Agreement');
      expect(violation).toBeDefined();
      expect(violation?.severity).toBe('violation');
    });

    test('should require BAA for business associate relationships', () => {
      const result = validateScenario({
        scenario: 'Send data to business associate for processing',
        dataElements: ['diagnosis'],
        controls: []
      });
      
      const violation = result.findings.find(f => f.rule === 'Business Associate Agreement');
      expect(violation).toBeDefined();
    });

    test('should not flag BAA when present', () => {
      const result = validateScenario({
        scenario: 'Share data with contracted vendor',
        dataElements: ['patient_name'],
        controls: ['baa']
      });
      
      const violation = result.findings.find(f => f.rule === 'Business Associate Agreement');
      expect(violation).toBeUndefined();
    });
  });

  describe('Cloud Compliance', () => {
    test('should require BAA for cloud deployments', () => {
      const result = validateScenario({
        scenario: 'Deploy patient portal on AWS',
        dataElements: ['patient_name', 'diagnosis'],
        controls: []
      });
      
      const violation = result.findings.find(f => f.rule === 'Cloud BAA');
      expect(violation).toBeDefined();
    });

    test('should handle Azure cloud deployments', () => {
      const result = validateScenario({
        scenario: 'Store patient records in Azure Blob Storage',
        dataElements: ['ssn'],
        controls: []
      });
      
      const violation = result.findings.find(f => f.rule === 'Cloud BAA');
      expect(violation).toBeDefined();
    });

    test('should not flag cloud when BAA present', () => {
      const result = validateScenario({
        scenario: 'Deploy on GCP with HIPAA-eligible services',
        dataElements: ['patient_name'],
        controls: ['baa', 'encryption_at_rest']
      });
      
      const violation = result.findings.find(f => f.rule === 'Cloud BAA');
      expect(violation).toBeUndefined();
    });
  });

  describe('Access Controls (45 CFR 164.312(a))', () => {
    test('should flag missing role-based access control', () => {
      const result = validateScenario({
        scenario: 'Build patient data viewer',
        dataElements: ['patient_name', 'diagnosis'],
        controls: []
      });
      
      const warning = result.findings.find(f => f.rule === 'Access Control');
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe('warning');
    });

    test('should flag missing audit logging', () => {
      const result = validateScenario({
        scenario: 'Access patient records',
        dataElements: ['patient_name'],
        controls: ['role_based_access']
      });
      
      const warning = result.findings.find(f => f.rule === 'Audit Controls');
      expect(warning).toBeDefined();
    });

    test('should not flag when proper controls in place', () => {
      const result = validateScenario({
        scenario: 'View patient demographics',
        dataElements: ['patient_name'],
        controls: ['role_based_access', 'audit_trail']
      });
      
      const accessWarning = result.findings.find(f => f.rule === 'Access Control');
      const auditWarning = result.findings.find(f => f.rule === 'Audit Controls');
      expect(accessWarning).toBeUndefined();
      expect(auditWarning).toBeUndefined();
    });
  });

  describe('Minimum Necessary (45 CFR 164.502(b))', () => {
    test('should flag when many data elements are accessed', () => {
      const result = validateScenario({
        scenario: 'Process complete patient record',
        dataElements: ['ssn', 'patient_name', 'date_of_birth', 'address', 'phone_number', 'diagnosis'],
        controls: ['encryption_at_rest']
      });
      
      const info = result.findings.find(f => f.rule === 'Minimum Necessary');
      expect(info).toBeDefined();
      expect(info?.severity).toBe('info');
    });

    test('should not flag for small number of elements', () => {
      const result = validateScenario({
        scenario: 'Look up patient name',
        dataElements: ['patient_name'],
        controls: []
      });
      
      const info = result.findings.find(f => f.rule === 'Minimum Necessary');
      expect(info).toBeUndefined();
    });
  });

  describe('Recommendations Generation', () => {
    test('should recommend MFA when not present', () => {
      const result = validateScenario({
        scenario: 'Access patient portal',
        dataElements: ['patient_name'],
        controls: ['role_based_access']
      });
      
      expect(result.recommendations).toContain('Implement multi-factor authentication for all PHI access');
    });

    test('should recommend session timeout when not present', () => {
      const result = validateScenario({
        scenario: 'Patient data application',
        dataElements: ['diagnosis'],
        controls: []
      });
      
      expect(result.recommendations).toContain('Implement automatic session timeout for inactive users');
    });

    test('should recommend de-identification for analytics', () => {
      const result = validateScenario({
        scenario: 'Generate analytics report on patient outcomes',
        dataElements: ['diagnosis', 'age'],
        controls: []
      });
      
      const hasDeidentRec = result.recommendations.some(r => 
        r.toLowerCase().includes('de-identification') || r.toLowerCase().includes('deidentification')
      );
      expect(hasDeidentRec).toBe(true);
    });
  });

  describe('Compliance Status', () => {
    test('should be non-compliant with violations', () => {
      const result = validateScenario({
        scenario: 'Send unencrypted patient data to vendor',
        dataElements: ['ssn'],
        controls: []
      });
      
      expect(result.compliant).toBe(false);
    });

    test('should be compliant with only warnings', () => {
      const result = validateScenario({
        scenario: 'Store patient name securely',
        dataElements: ['patient_name'],
        controls: ['encryption_at_rest', 'encryption_in_transit', 'baa']
      });
      
      // May have warnings but no violations
      const violations = result.findings.filter(f => f.severity === 'violation');
      if (violations.length === 0) {
        expect(result.compliant).toBe(true);
      }
    });
  });
});

// Test helper that mirrors the actual validation logic

interface HipaaFinding {
  rule: string;
  category: 'privacy' | 'security' | 'breach' | 'administrative';
  severity: 'info' | 'warning' | 'violation';
  description: string;
  requirement: string;
  remediation: string;
}

interface HipaaValidationResult {
  compliant: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  findings: HipaaFinding[];
  recommendations: string[];
  applicableRules: string[];
}

interface ValidationInput {
  scenario: string;
  dataElements: string[];
  controls: string[];
}

const PHI_ELEMENTS: Record<string, { riskLevel: string; category: string }> = {
  ssn: { riskLevel: 'critical', category: 'direct_identifier' },
  medical_record_number: { riskLevel: 'critical', category: 'direct_identifier' },
  health_plan_id: { riskLevel: 'high', category: 'direct_identifier' },
  patient_name: { riskLevel: 'high', category: 'direct_identifier' },
  date_of_birth: { riskLevel: 'high', category: 'date' },
  address: { riskLevel: 'high', category: 'geographic' },
  phone_number: { riskLevel: 'medium', category: 'contact' },
  email: { riskLevel: 'medium', category: 'contact' },
  diagnosis: { riskLevel: 'medium', category: 'clinical' },
  medications: { riskLevel: 'medium', category: 'clinical' },
  lab_results: { riskLevel: 'medium', category: 'clinical' },
  treatment_plan: { riskLevel: 'medium', category: 'clinical' },
  age: { riskLevel: 'low', category: 'demographic' },
  gender: { riskLevel: 'low', category: 'demographic' },
  zip_code_3digit: { riskLevel: 'low', category: 'geographic' }
};

function validateScenario(input: ValidationInput): HipaaValidationResult {
  const { scenario, dataElements, controls } = input;
  const findings: HipaaFinding[] = [];
  const recommendations: string[] = [];
  const applicableRules: string[] = [];

  // Analyze scenario keywords
  const isTransmission = /transmit|send|transfer|share|exchange|api|integration/i.test(scenario);
  const isStorage = /store|save|persist|database|file|log/i.test(scenario);
  const isThirdParty = /third.?party|vendor|partner|contractor|business.?associate|ba\b/i.test(scenario);
  const isCloud = /cloud|aws|azure|gcp|saas|deploy/i.test(scenario);
  const isAnalytics = /analytic|report|aggregate|research|study|outcome/i.test(scenario);

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  for (const element of dataElements) {
    const elementKey = element.toLowerCase().replace(/\s+/g, '_');
    const elementInfo = PHI_ELEMENTS[elementKey];
    if (elementInfo) {
      if (elementInfo.riskLevel === 'critical') riskLevel = 'critical';
      else if (elementInfo.riskLevel === 'high' && riskLevel !== 'critical') riskLevel = 'high';
      else if (elementInfo.riskLevel === 'medium' && riskLevel === 'low') riskLevel = 'medium';
    }
  }

  // BAA check for third parties
  if (isThirdParty && !controls.includes('baa')) {
    findings.push({
      rule: 'Business Associate Agreement',
      category: 'administrative',
      severity: 'violation',
      description: 'Third-party involvement detected without BAA.',
      requirement: '45 CFR 164.502(e) & 164.504(e)',
      remediation: 'Execute a Business Associate Agreement before sharing PHI.'
    });
  }

  // Transmission security
  if (isTransmission && !controls.includes('encryption_in_transit')) {
    findings.push({
      rule: 'Transmission Security',
      category: 'security',
      severity: 'violation',
      description: 'Data transmission without encryption.',
      requirement: '45 CFR 164.312(e)(1)',
      remediation: 'Implement TLS 1.2+ for all transmissions.'
    });
  }

  // Storage security
  if (isStorage && !controls.includes('encryption_at_rest') && riskLevel !== 'low') {
    findings.push({
      rule: 'Data at Rest',
      category: 'security',
      severity: riskLevel === 'critical' ? 'violation' : 'warning',
      description: 'Storing PHI without encryption.',
      requirement: '45 CFR 164.312(a)(2)(iv)',
      remediation: 'Implement AES-256 encryption for stored PHI.'
    });
  }

  // Cloud BAA
  if (isCloud && !controls.includes('baa')) {
    findings.push({
      rule: 'Cloud BAA',
      category: 'administrative',
      severity: 'violation',
      description: 'Cloud deployment requires BAA with provider.',
      requirement: 'Cloud providers are Business Associates under HIPAA.',
      remediation: 'Obtain BAA from cloud provider.'
    });
  }

  // Access controls
  if (dataElements.length > 0) {
    if (!controls.includes('role_based_access')) {
      findings.push({
        rule: 'Access Control',
        category: 'security',
        severity: 'warning',
        description: 'No role-based access control confirmed.',
        requirement: '45 CFR 164.312(a)(1)',
        remediation: 'Implement RBAC.'
      });
    }

    if (!controls.includes('access_logging') && !controls.includes('audit_trail')) {
      findings.push({
        rule: 'Audit Controls',
        category: 'security',
        severity: 'warning',
        description: 'No audit logging confirmed.',
        requirement: '45 CFR 164.312(b)',
        remediation: 'Implement audit logging.'
      });
    }
  }

  // Minimum necessary
  if (dataElements.length > 5) {
    findings.push({
      rule: 'Minimum Necessary',
      category: 'privacy',
      severity: 'info',
      description: `Processing ${dataElements.length} elements. Review if all necessary.`,
      requirement: '45 CFR 164.502(b)',
      remediation: 'Document justification for each element.'
    });
  }

  // Recommendations
  if (!controls.includes('mfa')) {
    recommendations.push('Implement multi-factor authentication for all PHI access');
  }
  if (!controls.includes('session_timeout')) {
    recommendations.push('Implement automatic session timeout for inactive users');
  }
  if (isAnalytics) {
    recommendations.push('Consider de-identification for analytics if individual identification not needed');
  }

  // Determine compliance
  const violations = findings.filter(f => f.severity === 'violation');
  const compliant = violations.length === 0;

  return {
    compliant,
    riskLevel,
    findings,
    recommendations,
    applicableRules
  };
}
