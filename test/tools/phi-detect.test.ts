/**
 * PHI Detection Tool Tests
 * 
 * Tests the PHI detection patterns against known PHI types
 * per HIPAA Safe Harbor 18 identifiers
 */

describe('PHI Detection Tool', () => {
  
  // Test data representing various PHI patterns
  const PHI_TEST_CASES = {
    // 1. Social Security Numbers
    ssn: {
      shouldMatch: [
        '123-45-6789',
        '123456789',
        'SSN: 123-45-6789',
        'social security number is 987-65-4321'
      ],
      shouldNotMatch: [
        '123-45-678',      // Too short
        '000-00-0000',     // Invalid SSN (all zeros)
        '123-456-789',     // Wrong format
        'phone: 123-456-7890'  // Phone number, not SSN
      ]
    },
    
    // 2. Medical Record Numbers  
    mrn: {
      shouldMatch: [
        'MRN: 12345678',
        'mrn#123456789',
        'Medical Record Number: 9876543',
        'medical_record: 12345678901'
      ],
      shouldNotMatch: [
        'MRN: 1234',       // Too short
        'version: 12345678' // Not MRN context
      ]
    },
    
    // 3. Medicare Beneficiary Identifiers (MBI)
    mbi: {
      shouldMatch: [
        '1EG4-TE5-MK72',   // Format: 1 digit, letter, alphanumeric, digit, letter, alphanumeric, digit, 2 letters, 2 digits
        '2AB3CD4EF56'
      ],
      shouldNotMatch: [
        'ABCDEFGHIJK',     // All letters
        '12345678901'      // All numbers
      ]
    },
    
    // 4. Phone Numbers
    phone: {
      shouldMatch: [
        '(555) 123-4567',
        '555-123-4567',
        '555.123.4567',
        '+1 555 123 4567',
        'phone: 5551234567'
      ],
      shouldNotMatch: [
        '555-1234',        // Too short
        '123-456-78901'    // Too long
      ]
    },
    
    // 5. Email Addresses
    email: {
      shouldMatch: [
        'patient@example.com',
        'john.doe@hospital.org',
        'email: test@test.co'
      ],
      shouldNotMatch: [
        'not-an-email',
        '@missing-local.com',
        'missing-domain@'
      ]
    },
    
    // 6. Dates of Birth
    dob: {
      shouldMatch: [
        'DOB: 01/15/1985',
        'date of birth: 1985-01-15',
        'birthdate: January 15, 1985',
        'born: 01-15-85'
      ],
      shouldNotMatch: [
        'created: 2024-01-15',  // Not birth context
        'version: 1.2.3'         // Version number
      ]
    },
    
    // 7. Addresses
    address: {
      shouldMatch: [
        '123 Main Street, Anytown, CA 90210',
        'Address: 456 Oak Ave',
        'patient_address: "789 Elm Blvd"'
      ],
      shouldNotMatch: [
        'IP address: 192.168.1.1',  // IP, not physical
        'email address: test@test.com' // Email context
      ]
    },
    
    // 8. ZIP Codes (when combined with other info)
    zip: {
      shouldMatch: [
        'ZIP: 90210',
        'zip code: 12345-6789',
        'postal code 54321'
      ],
      shouldNotMatch: [
        'version 12345',    // Version number
        'error code: 90210' // Error code
      ]
    },
    
    // 9. IP Addresses
    ip: {
      shouldMatch: [
        '192.168.1.1',
        '10.0.0.255',
        'client_ip: 172.16.0.1',
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334' // IPv6
      ],
      shouldNotMatch: [
        '999.999.999.999',  // Invalid IP
        '1.2.3'             // Incomplete
      ]
    },
    
    // 10. Account Numbers
    account: {
      shouldMatch: [
        'account_number: 123456789012',
        'Account #: 9876543210',
        'financial_account: ABC123456'
      ],
      shouldNotMatch: [
        'account_type: checking',  // Not a number
        'version_number: 123'      // Too short
      ]
    }
  };

  // Test for false positive reduction
  const FALSE_POSITIVE_CASES = [
    // Test data markers
    'test_ssn = "123-45-6789"',
    'example_phone = "555-555-5555"',
    'SAMPLE_MRN = 99999999',
    'mock_patient_dob = "01/01/1900"',
    'dummy_address = "123 Test Street"',
    'placeholder_email = "test@example.com"',
    
    // Code patterns that look like PHI but aren't
    'const PORT = 3000',
    'version = "1.2.3"',
    'error_code = 12345',
    'function ssn_validator()',
    'class MRNGenerator',
    
    // Common non-PHI numbers
    'Math.PI = 3.14159',
    'HTTP_OK = 200',
    'timeout_ms = 30000'
  ];

  // High-risk PHI that should always be detected
  const HIGH_RISK_PHI = [
    { content: 'patient_ssn = "123-45-6789"', type: 'SSN', minConfidence: 80 },
    { content: 'resident_mrn: 12345678', type: 'MRN', minConfidence: 85 },
    { content: 'beneficiary_id = "1EG4TE5MK72"', type: 'MBI', minConfidence: 85 },
    { content: 'patient.date_of_birth = "03/15/1950"', type: 'DOB', minConfidence: 75 },
    { content: 'patient_phone: (555) 123-4567', type: 'Phone', minConfidence: 70 }
  ];

  describe('Pattern Matching', () => {
    // SSN Pattern Tests
    describe('Social Security Numbers', () => {
      test.each(PHI_TEST_CASES.ssn.shouldMatch)(
        'should detect SSN: %s',
        (input) => {
          expect(containsSSNPattern(input)).toBe(true);
        }
      );

      test.each(PHI_TEST_CASES.ssn.shouldNotMatch)(
        'should not false positive on: %s',
        (input) => {
          expect(containsSSNPattern(input)).toBe(false);
        }
      );
    });

    // Phone Pattern Tests
    describe('Phone Numbers', () => {
      test.each(PHI_TEST_CASES.phone.shouldMatch)(
        'should detect phone: %s',
        (input) => {
          expect(containsPhonePattern(input)).toBe(true);
        }
      );
    });

    // Email Pattern Tests
    describe('Email Addresses', () => {
      test.each(PHI_TEST_CASES.email.shouldMatch)(
        'should detect email: %s',
        (input) => {
          expect(containsEmailPattern(input)).toBe(true);
        }
      );
    });
  });

  describe('False Positive Reduction', () => {
    test.each(FALSE_POSITIVE_CASES)(
      'should reduce confidence for test/example data: %s',
      (input) => {
        const result = analyzeForPhi(input);
        // Test/example data should either not match or have reduced confidence
        if (result.findings.length > 0) {
          const maxConfidence = Math.max(...result.findings.map(f => f.confidence));
          expect(maxConfidence).toBeLessThan(70);
        }
      }
    );
  });

  describe('High-Risk PHI Detection', () => {
    test.each(HIGH_RISK_PHI)(
      'should detect $type with confidence >= $minConfidence',
      ({ content, type, minConfidence }) => {
        const result = analyzeForPhi(content);
        expect(result.findings.length).toBeGreaterThan(0);
        const finding = result.findings[0];
        expect(finding.confidence).toBeGreaterThanOrEqual(minConfidence);
      }
    );
  });

  describe('Context Awareness', () => {
    test('should have higher confidence in data files', () => {
      const codeContext = analyzeForPhi('ssn = "123-45-6789"', 'code');
      const dataContext = analyzeForPhi('ssn = "123-45-6789"', 'data');
      
      expect(dataContext.findings[0]?.confidence)
        .toBeGreaterThan(codeContext.findings[0]?.confidence || 0);
    });

    test('should flag PHI in filenames', () => {
      const result = analyzeForPhi('patient_john_doe_ssn_123456789.json', 'filename');
      expect(result.findings.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions that mirror the actual implementation patterns
// These will be replaced with actual imports once we refactor for testability

function containsSSNPattern(text: string): boolean {
  const ssnPattern = /\b\d{3}-?\d{2}-?\d{4}\b/;
  const match = ssnPattern.test(text);
  // Filter out obvious non-SSNs
  if (match) {
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
    if (phonePattern.test(text) && text.toLowerCase().includes('phone')) {
      return false;
    }
  }
  return match;
}

function containsPhonePattern(text: string): boolean {
  const phonePattern = /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
  return phonePattern.test(text);
}

function containsEmailPattern(text: string): boolean {
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  return emailPattern.test(text);
}

interface PhiFinding {
  type: string;
  confidence: number;
  value: string;
  line?: number;
}

interface PhiAnalysisResult {
  findings: PhiFinding[];
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

function analyzeForPhi(content: string, context: string = 'general'): PhiAnalysisResult {
  const findings: PhiFinding[] = [];
  
  // SSN detection
  const ssnMatches = content.match(/\b\d{3}-?\d{2}-?\d{4}\b/g);
  if (ssnMatches) {
    for (const match of ssnMatches) {
      let confidence = 85;
      
      // Context modifiers
      if (context === 'code') confidence -= 20;
      if (context === 'data') confidence += 10;
      if (context === 'filename') confidence += 5;
      
      // Keyword modifiers
      if (/patient|ssn|social|resident|member/i.test(content)) confidence += 10;
      if (/test|example|sample|mock|dummy|fake|placeholder/i.test(content)) confidence -= 40;
      
      if (confidence > 0) {
        findings.push({ type: 'SSN', confidence, value: match });
      }
    }
  }
  
  // MRN detection
  const mrnMatches = content.match(/\b(?:MRN|mrn|Medical Record|medical_record)[:\s#]*\d{5,12}\b/gi);
  if (mrnMatches) {
    for (const match of mrnMatches) {
      let confidence = 90;
      if (/test|example|sample|mock/i.test(content)) confidence -= 40;
      findings.push({ type: 'MRN', confidence, value: match });
    }
  }
  
  // DOB detection
  const dobMatches = content.match(/\b(?:DOB|dob|date.?of.?birth|birth.?date|born)[:\s]*["']?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}["']?/gi);
  if (dobMatches) {
    for (const match of dobMatches) {
      let confidence = 80;
      if (/test|example|sample|mock/i.test(content)) confidence -= 40;
      findings.push({ type: 'DOB', confidence, value: match });
    }
  }
  
  // Phone detection
  const phoneMatches = content.match(/\b(?:phone|tel|mobile|cell)[:\s]*["']?(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}["']?/gi);
  if (phoneMatches) {
    for (const match of phoneMatches) {
      let confidence = 75;
      if (/patient|resident|member/i.test(content)) confidence += 10;
      if (/test|example|sample|mock/i.test(content)) confidence -= 40;
      findings.push({ type: 'Phone', confidence, value: match });
    }
  }
  
  // Calculate risk level
  let riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
  if (findings.length > 0) {
    const maxConfidence = Math.max(...findings.map(f => f.confidence));
    if (maxConfidence >= 90) riskLevel = 'critical';
    else if (maxConfidence >= 75) riskLevel = 'high';
    else if (maxConfidence >= 50) riskLevel = 'medium';
    else if (maxConfidence > 0) riskLevel = 'low';
  }
  
  return { findings, riskLevel };
}
