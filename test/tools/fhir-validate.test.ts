/**
 * FHIR R4 Validation Tool Tests
 * 
 * Tests FHIR resource validation against base spec and US Core profiles
 */

describe('FHIR Validation Tool', () => {
  
  // Sample valid FHIR resources
  const VALID_PATIENT = {
    resourceType: 'Patient',
    id: 'example',
    meta: {
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient']
    },
    identifier: [{
      system: 'http://hospital.example.org/mrn',
      value: '12345'
    }],
    name: [{
      use: 'official',
      family: 'Doe',
      given: ['John', 'Q']
    }],
    gender: 'male',
    birthDate: '1970-01-25'
  };

  const VALID_OBSERVATION = {
    resourceType: 'Observation',
    id: 'blood-pressure',
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'vital-signs'
      }]
    }],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '85354-9',
        display: 'Blood pressure panel'
      }]
    },
    subject: {
      reference: 'Patient/example'
    },
    effectiveDateTime: '2024-01-15',
    valueQuantity: {
      value: 120,
      unit: 'mmHg',
      system: 'http://unitsofmeasure.org',
      code: 'mm[Hg]'
    }
  };

  const VALID_CONDITION = {
    resourceType: 'Condition',
    id: 'diabetes',
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: 'active'
      }]
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        code: 'confirmed'
      }]
    },
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-category',
        code: 'problem-list-item'
      }]
    }],
    code: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '44054006',
        display: 'Type 2 diabetes mellitus'
      }]
    },
    subject: {
      reference: 'Patient/example'
    }
  };

  const VALID_MEDICATION_REQUEST = {
    resourceType: 'MedicationRequest',
    id: 'med-request-1',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: '1049502',
        display: 'Metformin 500 MG'
      }]
    },
    subject: {
      reference: 'Patient/example'
    },
    authoredOn: '2024-01-15'
  };

  describe('JSON Parsing', () => {
    test('should reject invalid JSON', () => {
      const result = validateFhir('not valid json');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PARSE-001')).toBe(true);
    });

    test('should accept valid JSON object', () => {
      const result = validateFhir(JSON.stringify(VALID_PATIENT));
      expect(result.errors.find(e => e.code === 'PARSE-001')).toBeUndefined();
    });

    test('should accept resource object directly', () => {
      const result = validateFhir(VALID_PATIENT);
      expect(result.resourceType).toBe('Patient');
    });
  });

  describe('Resource Type Validation', () => {
    test('should require resourceType', () => {
      const result = validateFhir({ id: 'test' } as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'FHIR-001')).toBe(true);
    });

    test('should detect Patient resourceType', () => {
      const result = validateFhir(VALID_PATIENT);
      expect(result.resourceType).toBe('Patient');
    });

    test('should detect Observation resourceType', () => {
      const result = validateFhir(VALID_OBSERVATION);
      expect(result.resourceType).toBe('Observation');
    });

    test('should handle unknown resource types', () => {
      const result = validateFhir({ resourceType: 'CustomResource', id: 'test' });
      expect(result.resourceType).toBe('CustomResource');
    });
  });

  describe('Required Element Validation', () => {
    test('should validate Patient required elements', () => {
      const incomplete = { resourceType: 'Patient' };
      const result = validateFhir(incomplete);
      
      expect(result.errors.some(e => 
        e.code === 'REQ-001' && e.path === 'identifier'
      )).toBe(true);
    });

    test('should validate Observation required elements', () => {
      const incomplete = { resourceType: 'Observation' };
      const result = validateFhir(incomplete);
      
      expect(result.errors.some(e => e.path === 'status')).toBe(true);
      expect(result.errors.some(e => e.path === 'code')).toBe(true);
      expect(result.errors.some(e => e.path === 'subject')).toBe(true);
    });

    test('should validate Condition required elements', () => {
      const incomplete = { resourceType: 'Condition' };
      const result = validateFhir(incomplete);
      
      expect(result.errors.some(e => e.path === 'code')).toBe(true);
      expect(result.errors.some(e => e.path === 'subject')).toBe(true);
    });

    test('should handle choice type elements like medication[x]', () => {
      const medRequest = {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/123' }
        // Missing medication[x]
      };
      const result = validateFhir(medRequest);
      
      expect(result.errors.some(e => e.path?.includes('medication'))).toBe(true);
    });

    test('should accept medicationCodeableConcept as choice type', () => {
      const result = validateFhir(VALID_MEDICATION_REQUEST);
      expect(result.errors.filter(e => e.path?.includes('medication'))).toHaveLength(0);
    });

    test('should detect empty required arrays', () => {
      const patient = { 
        resourceType: 'Patient',
        identifier: [],
        name: []
      };
      const result = validateFhir(patient);
      
      expect(result.errors.some(e => e.code === 'REQ-002')).toBe(true);
    });
  });

  describe('US Core Profile Validation', () => {
    test('should validate against US Core profile when specified', () => {
      const result = validateFhir(VALID_PATIENT, { profile: 'us-core' });
      
      // Should not warn about missing profile since it's declared
      expect(result.warnings.find(w => w.code === 'PROFILE-001')).toBeUndefined();
    });

    test('should warn when US Core profile not declared', () => {
      const patientNoProfile = {
        ...VALID_PATIENT,
        meta: undefined
      };
      const result = validateFhir(patientNoProfile, { profile: 'us-core' });
      
      expect(result.warnings.some(w => w.code === 'PROFILE-001')).toBe(true);
    });

    test('should require additional US Core elements for Patient', () => {
      const minimalPatient = {
        resourceType: 'Patient',
        identifier: [{ value: '123' }],
        name: [{ family: 'Doe' }]
        // Missing gender required by US Core
      };
      const result = validateFhir(minimalPatient, { profile: 'us-core' });
      
      expect(result.errors.some(e => e.path === 'gender')).toBe(true);
    });

    test('should require category for US Core Condition', () => {
      const conditionNoCategory = {
        resourceType: 'Condition',
        code: { coding: [{ code: '123' }] },
        subject: { reference: 'Patient/1' }
        // Missing category required by US Core
      };
      const result = validateFhir(conditionNoCategory, { profile: 'us-core' });
      
      expect(result.errors.some(e => e.path === 'category')).toBe(true);
    });
  });

  describe('Terminology Binding Validation', () => {
    test('should validate LOINC codes for Observation', () => {
      const result = validateFhir(VALID_OBSERVATION, { validateTerminology: true });
      
      // Should not warn since LOINC is used
      const loincWarning = result.warnings.find(w => 
        w.code === 'TERM-001' && w.path?.includes('code')
      );
      expect(loincWarning).toBeUndefined();
    });

    test('should warn for unexpected code system', () => {
      const obsWrongSystem = {
        ...VALID_OBSERVATION,
        code: {
          coding: [{
            system: 'http://custom.org/codes',
            code: '12345'
          }]
        }
      };
      const result = validateFhir(obsWrongSystem, { validateTerminology: true });
      
      expect(result.warnings.some(w => w.code === 'TERM-001')).toBe(true);
    });

    test('should skip terminology validation when disabled', () => {
      const obsWrongSystem = {
        ...VALID_OBSERVATION,
        code: {
          coding: [{
            system: 'http://custom.org/codes',
            code: '12345'
          }]
        }
      };
      const result = validateFhir(obsWrongSystem, { validateTerminology: false });
      
      expect(result.warnings.filter(w => w.code.startsWith('TERM-'))).toHaveLength(0);
    });

    test('should warn when code system is missing', () => {
      const obsNoSystem = {
        ...VALID_OBSERVATION,
        code: {
          coding: [{
            code: '12345',
            display: 'Some code'
          }]
        }
      };
      const result = validateFhir(obsNoSystem, { validateTerminology: true });
      
      expect(result.warnings.some(w => w.code === 'TERM-002')).toBe(true);
    });

    test('should validate SNOMED codes for Condition', () => {
      const result = validateFhir(VALID_CONDITION, { validateTerminology: true });
      
      // Should not warn since SNOMED is used
      expect(result.warnings.filter(w => 
        w.code === 'TERM-001' && w.path?.includes('Condition.code')
      )).toHaveLength(0);
    });

    test('should validate RxNorm codes for MedicationRequest', () => {
      const result = validateFhir(VALID_MEDICATION_REQUEST, { validateTerminology: true });
      
      // Should not warn since RxNorm is used
      expect(result.warnings.filter(w => 
        w.code === 'TERM-001' && w.path?.includes('medication')
      )).toHaveLength(0);
    });
  });

  describe('Reference Validation', () => {
    test('should validate relative reference format', () => {
      const result = validateFhir(VALID_OBSERVATION, { validateReferences: true });
      
      // Patient/example is valid format
      expect(result.errors.filter(e => e.code === 'REF-001')).toHaveLength(0);
    });

    test('should reject invalid reference format', () => {
      const obsInvalidRef = {
        ...VALID_OBSERVATION,
        subject: {
          reference: 'invalid reference format'
        }
      };
      const result = validateFhir(obsInvalidRef, { validateReferences: true });
      
      expect(result.errors.some(e => e.code === 'REF-001')).toBe(true);
    });

    test('should accept absolute URL references', () => {
      const obsAbsoluteRef = {
        ...VALID_OBSERVATION,
        subject: {
          reference: 'https://example.org/fhir/Patient/123'
        }
      };
      const result = validateFhir(obsAbsoluteRef, { validateReferences: true });
      
      expect(result.errors.filter(e => e.code === 'REF-001')).toHaveLength(0);
    });

    test('should accept UUID references', () => {
      const obsUuidRef = {
        ...VALID_OBSERVATION,
        subject: {
          reference: 'urn:uuid:550e8400-e29b-41d4-a716-446655440000'
        }
      };
      const result = validateFhir(obsUuidRef, { validateReferences: true });
      
      expect(result.errors.filter(e => e.code === 'REF-001')).toHaveLength(0);
    });

    test('should accept contained references', () => {
      const obsContainedRef = {
        ...VALID_OBSERVATION,
        contained: [{ resourceType: 'Patient', id: 'patient1' }],
        subject: {
          reference: '#patient1'
        }
      };
      const result = validateFhir(obsContainedRef, { validateReferences: true });
      
      expect(result.errors.filter(e => e.code === 'REF-001')).toHaveLength(0);
    });

    test('should warn about display-only references', () => {
      const obsDisplayOnly = {
        ...VALID_OBSERVATION,
        subject: {
          display: 'John Doe'
          // No reference
        }
      };
      const result = validateFhir(obsDisplayOnly, { validateReferences: true });
      
      // Should be valid but might warn
      expect(result.errors.filter(e => e.path?.includes('subject'))).toHaveLength(0);
    });
  });

  describe('Resource-Specific Validation', () => {
    describe('Patient', () => {
      test('should validate valid patient', () => {
        const result = validateFhir(VALID_PATIENT);
        expect(result.info.some(i => i.code === 'PAT-OK')).toBe(true);
      });

      test('should warn about missing family name', () => {
        const patientNoFamily = {
          ...VALID_PATIENT,
          name: [{ given: ['John'] }]
        };
        const result = validateFhir(patientNoFamily);
        
        expect(result.warnings.some(w => w.code === 'PAT-001')).toBe(true);
      });

      test('should validate birthDate format YYYY-MM-DD', () => {
        const result = validateFhir(VALID_PATIENT);
        expect(result.errors.filter(e => e.code === 'PAT-002')).toHaveLength(0);
      });

      test('should accept partial birthDate YYYY-MM', () => {
        const patientPartialDate = {
          ...VALID_PATIENT,
          birthDate: '1970-01'
        };
        const result = validateFhir(patientPartialDate);
        
        expect(result.errors.filter(e => e.code === 'PAT-002')).toHaveLength(0);
      });

      test('should accept year-only birthDate YYYY', () => {
        const patientYearOnly = {
          ...VALID_PATIENT,
          birthDate: '1970'
        };
        const result = validateFhir(patientYearOnly);
        
        expect(result.errors.filter(e => e.code === 'PAT-002')).toHaveLength(0);
      });

      test('should reject invalid birthDate format', () => {
        const patientBadDate = {
          ...VALID_PATIENT,
          birthDate: '01/25/1970'
        };
        const result = validateFhir(patientBadDate);
        
        expect(result.errors.some(e => e.code === 'PAT-002')).toBe(true);
      });

      test('should validate gender values', () => {
        const validGenders = ['male', 'female', 'other', 'unknown'];
        
        for (const gender of validGenders) {
          const patient = { ...VALID_PATIENT, gender };
          const result = validateFhir(patient);
          expect(result.errors.filter(e => e.code === 'PAT-003')).toHaveLength(0);
        }
      });

      test('should reject invalid gender value', () => {
        const patientBadGender = {
          ...VALID_PATIENT,
          gender: 'M'
        };
        const result = validateFhir(patientBadGender);
        
        expect(result.errors.some(e => e.code === 'PAT-003')).toBe(true);
      });
    });

    describe('Observation', () => {
      test('should validate valid observation', () => {
        const result = validateFhir(VALID_OBSERVATION);
        expect(result.info.some(i => i.code === 'OBS-OK')).toBe(true);
      });

      test('should validate status values', () => {
        const validStatuses = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'];
        
        for (const status of validStatuses) {
          const obs = { ...VALID_OBSERVATION, status };
          const result = validateFhir(obs);
          expect(result.errors.filter(e => e.code === 'OBS-001')).toHaveLength(0);
        }
      });

      test('should reject invalid status value', () => {
        const obsBadStatus = {
          ...VALID_OBSERVATION,
          status: 'complete'
        };
        const result = validateFhir(obsBadStatus);
        
        expect(result.errors.some(e => e.code === 'OBS-001')).toBe(true);
      });

      test('should warn about missing value and dataAbsentReason', () => {
        const obsNoValue = {
          resourceType: 'Observation',
          status: 'final',
          code: { coding: [{ code: '123' }] },
          subject: { reference: 'Patient/1' }
          // No value[x] or dataAbsentReason
        };
        const result = validateFhir(obsNoValue);
        
        expect(result.warnings.some(w => w.code === 'OBS-002')).toBe(true);
      });

      test('should accept observation with dataAbsentReason instead of value', () => {
        const obsDataAbsent = {
          resourceType: 'Observation',
          status: 'final',
          code: { coding: [{ code: '123' }] },
          subject: { reference: 'Patient/1' },
          dataAbsentReason: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason',
              code: 'unknown'
            }]
          }
        };
        const result = validateFhir(obsDataAbsent);
        
        expect(result.warnings.filter(w => w.code === 'OBS-002')).toHaveLength(0);
      });
    });

    describe('Condition', () => {
      test('should validate valid condition', () => {
        const result = validateFhir(VALID_CONDITION);
        expect(result.info.some(i => i.code === 'COND-OK')).toBe(true);
      });

      test('should error when clinicalStatus present with entered-in-error', () => {
        const conditionEnteredInError = {
          resourceType: 'Condition',
          clinicalStatus: {
            coding: [{ code: 'active' }]
          },
          verificationStatus: {
            coding: [{ code: 'entered-in-error' }]
          },
          code: { coding: [{ code: '123' }] },
          subject: { reference: 'Patient/1' }
        };
        const result = validateFhir(conditionEnteredInError);
        
        expect(result.errors.some(e => e.code === 'COND-001')).toBe(true);
      });
    });

    describe('MedicationRequest', () => {
      test('should validate valid medication request', () => {
        const result = validateFhir(VALID_MEDICATION_REQUEST);
        expect(result.info.some(i => i.code === 'MEDREQ-OK')).toBe(true);
      });

      test('should validate intent values', () => {
        const validIntents = ['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'];
        
        for (const intent of validIntents) {
          const medReq = { ...VALID_MEDICATION_REQUEST, intent };
          const result = validateFhir(medReq);
          expect(result.errors.filter(e => e.code === 'MEDREQ-001')).toHaveLength(0);
        }
      });

      test('should reject invalid intent value', () => {
        const medReqBadIntent = {
          ...VALID_MEDICATION_REQUEST,
          intent: 'prescription'
        };
        const result = validateFhir(medReqBadIntent);
        
        expect(result.errors.some(e => e.code === 'MEDREQ-001')).toBe(true);
      });

      test('should validate status values', () => {
        const validStatuses = ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown'];
        
        for (const status of validStatuses) {
          const medReq = { ...VALID_MEDICATION_REQUEST, status };
          const result = validateFhir(medReq);
          expect(result.errors.filter(e => e.code === 'MEDREQ-002')).toHaveLength(0);
        }
      });
    });

    describe('Encounter', () => {
      const VALID_ENCOUNTER = {
        resourceType: 'Encounter',
        id: 'example',
        status: 'finished',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'AMB'
        },
        subject: {
          reference: 'Patient/example'
        }
      };

      test('should validate valid encounter', () => {
        const result = validateFhir(VALID_ENCOUNTER);
        expect(result.info.some(i => i.code === 'ENC-OK')).toBe(true);
      });

      test('should validate status values', () => {
        const validStatuses = ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'];
        
        for (const status of validStatuses) {
          const enc = { ...VALID_ENCOUNTER, status };
          const result = validateFhir(enc);
          expect(result.errors.filter(e => e.code === 'ENC-001')).toHaveLength(0);
        }
      });

      test('should reject invalid status value', () => {
        const encBadStatus = {
          ...VALID_ENCOUNTER,
          status: 'active'
        };
        const result = validateFhir(encBadStatus);
        
        expect(result.errors.some(e => e.code === 'ENC-001')).toBe(true);
      });

      test('should validate class is a Coding object', () => {
        const encBadClass = {
          ...VALID_ENCOUNTER,
          class: 'ambulatory'
        };
        const result = validateFhir(encBadClass);
        
        expect(result.errors.some(e => e.code === 'ENC-002')).toBe(true);
      });
    });
  });

  describe('Bundle Validation', () => {
    const VALID_BUNDLE = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        { resource: VALID_PATIENT },
        { resource: VALID_OBSERVATION }
      ]
    };

    test('should validate collection bundle', () => {
      const result = validateFhir(VALID_BUNDLE);
      expect(result.resourceType).toBe('Bundle');
      expect(result.info.some(i => i.code === 'BUNDLE-OK')).toBe(true);
    });

    test('should validate bundle types', () => {
      const validTypes = ['transaction', 'document', 'collection', 'batch', 'searchset'];
      
      for (const type of validTypes) {
        const bundle = { ...VALID_BUNDLE, type };
        const result = validateFhir(bundle);
        expect(result.errors.filter(e => e.code === 'BUNDLE-001')).toHaveLength(0);
      }
    });

    test('should reject invalid bundle type', () => {
      const badBundle = {
        resourceType: 'Bundle',
        type: 'invalid'
      };
      const result = validateFhir(badBundle);
      
      expect(result.errors.some(e => e.code === 'BUNDLE-001')).toBe(true);
    });

    test('should require request for transaction bundle', () => {
      const transactionBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          { resource: VALID_PATIENT }
          // Missing request
        ]
      };
      const result = validateFhir(transactionBundle);
      
      expect(result.errors.some(e => e.code === 'BUNDLE-002')).toBe(true);
    });

    test('should accept transaction bundle with request', () => {
      const transactionBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [{
          resource: VALID_PATIENT,
          request: {
            method: 'POST',
            url: 'Patient'
          }
        }]
      };
      const result = validateFhir(transactionBundle);
      
      expect(result.errors.filter(e => e.code === 'BUNDLE-002')).toHaveLength(0);
    });

    test('should require Composition first for document bundle', () => {
      const documentBundle = {
        resourceType: 'Bundle',
        type: 'document',
        entry: [
          { resource: VALID_PATIENT }
          // Should be Composition first
        ]
      };
      const result = validateFhir(documentBundle);
      
      expect(result.errors.some(e => e.code === 'BUNDLE-003')).toBe(true);
    });

    test('should validate individual resources in bundle', () => {
      const bundleWithInvalidResource = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [{
          resource: { resourceType: 'Patient' } // Missing required fields
        }]
      };
      const result = validateFhir(bundleWithInvalidResource);
      
      // Should have errors from the invalid Patient
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should prefix error paths with entry index', () => {
      const bundleWithInvalidResource = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [{
          resource: { resourceType: 'Patient' }
        }]
      };
      const result = validateFhir(bundleWithInvalidResource);
      
      expect(result.errors.some(e => e.path?.startsWith('entry[0]'))).toBe(true);
    });

    test('should resolve references within bundle', () => {
      const bundleWithRefs = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          { resource: VALID_PATIENT },
          { resource: VALID_OBSERVATION } // References Patient/example
        ]
      };
      const result = validateFhir(bundleWithRefs, { validateReferences: true });
      
      // Should not warn about unresolvable reference
      expect(result.warnings.filter(w => 
        w.code === 'REF-002' && w.message.includes('Patient/example')
      )).toHaveLength(0);
    });
  });

  describe('Validation Result Structure', () => {
    test('should return valid=true when no errors', () => {
      const result = validateFhir(VALID_PATIENT);
      expect(result.valid).toBe(true);
    });

    test('should return valid=false when errors exist', () => {
      const result = validateFhir({ id: 'test' } as any);
      expect(result.valid).toBe(false);
    });

    test('should include resourceType in result', () => {
      const result = validateFhir(VALID_PATIENT);
      expect(result.resourceType).toBe('Patient');
    });

    test('should include profile URL when US Core validated', () => {
      const result = validateFhir(VALID_PATIENT, { profile: 'us-core' });
      expect(result.profile).toBe('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient');
    });

    test('should separate errors, warnings, and info', () => {
      const result = validateFhir(VALID_PATIENT);
      
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.info)).toBe(true);
    });

    test('should include issue code and message', () => {
      const result = validateFhir({ id: 'test' } as any);
      
      for (const error of result.errors) {
        expect(error.code).toBeDefined();
        expect(error.message).toBeDefined();
        expect(typeof error.code).toBe('string');
        expect(typeof error.message).toBe('string');
      }
    });
  });
});

// Test helper that mirrors the actual validation logic

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
  details?: string;
}

interface FhirValidationResult {
  valid: boolean;
  resourceType: string;
  profile?: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: { profile?: string[] };
  [key: string]: unknown;
}

const US_CORE_PROFILES: Record<string, string> = {
  Patient: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
  Observation: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab',
  Condition: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition',
  MedicationRequest: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest',
  Encounter: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter',
};

const REQUIRED_ELEMENTS: Record<string, string[]> = {
  Patient: ['identifier', 'name'],
  Observation: ['status', 'code', 'subject'],
  Condition: ['code', 'subject'],
  MedicationRequest: ['status', 'intent', 'medication[x]', 'subject'],
  Encounter: ['status', 'class', 'subject'],
  Bundle: ['type'],
};

const US_CORE_REQUIRED: Record<string, string[]> = {
  Patient: ['identifier', 'name', 'gender'],
  Observation: ['status', 'category', 'code', 'subject'],
  Condition: ['clinicalStatus', 'verificationStatus', 'category', 'code', 'subject'],
  Encounter: ['status', 'class', 'type', 'subject'],
};

const TERMINOLOGY_SYSTEMS: Record<string, { name: string; url: string }> = {
  SNOMED: { name: 'SNOMED CT', url: 'http://snomed.info/sct' },
  LOINC: { name: 'LOINC', url: 'http://loinc.org' },
  ICD10: { name: 'ICD-10-CM', url: 'http://hl7.org/fhir/sid/icd-10-cm' },
  RXNORM: { name: 'RxNorm', url: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
};

const TERMINOLOGY_BINDINGS: Record<string, string[]> = {
  'Condition.code': ['SNOMED', 'ICD10'],
  'Observation.code': ['LOINC', 'SNOMED'],
  'MedicationRequest.medication': ['RXNORM'],
};

function validateFhir(
  resource: string | FhirResource,
  options: {
    profile?: 'base' | 'us-core';
    validateTerminology?: boolean;
    validateReferences?: boolean;
    bundle?: FhirResource[];
  } = {}
): FhirValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];
  
  const profile = options.profile ?? 'base';
  const validateTerminology = options.validateTerminology ?? true;
  const validateReferences = options.validateReferences ?? true;

  let parsed: FhirResource;
  try {
    parsed = typeof resource === 'string' ? JSON.parse(resource) : resource;
  } catch (e) {
    errors.push({
      severity: 'error',
      code: 'PARSE-001',
      message: 'Invalid JSON',
      details: e instanceof Error ? e.message : 'Unknown'
    });
    return { valid: false, resourceType: 'Unknown', errors, warnings, info };
  }

  if (!parsed.resourceType) {
    errors.push({
      severity: 'error',
      code: 'FHIR-001',
      message: 'Missing resourceType',
      path: 'resourceType'
    });
    return { valid: false, resourceType: 'Unknown', errors, warnings, info };
  }

  const resourceType = parsed.resourceType;

  // Handle Bundle
  if (resourceType === 'Bundle') {
    return validateBundle(parsed as any, options);
  }

  // Profile validation
  if (profile === 'us-core') {
    const expectedProfile = US_CORE_PROFILES[resourceType];
    if (expectedProfile) {
      const declaredProfiles = parsed.meta?.profile || [];
      if (!declaredProfiles.includes(expectedProfile)) {
        warnings.push({
          severity: 'warning',
          code: 'PROFILE-001',
          message: `Resource does not declare US Core profile`,
          path: 'meta.profile'
        });
      }
    }
  }

  // Required elements
  let requiredElements = REQUIRED_ELEMENTS[resourceType] || [];
  if (profile === 'us-core' && US_CORE_REQUIRED[resourceType]) {
    requiredElements = [...new Set([...requiredElements, ...US_CORE_REQUIRED[resourceType]])];
  }

  for (const element of requiredElements) {
    if (element.includes('[x]')) {
      const baseName = element.replace('[x]', '');
      const hasChoice = Object.keys(parsed).some(key => key.startsWith(baseName));
      if (!hasChoice) {
        errors.push({
          severity: 'error',
          code: 'REQ-001',
          message: `Missing required element: ${element}`,
          path: element
        });
      }
    } else {
      const value = parsed[element];
      if (value === undefined || value === null) {
        errors.push({
          severity: 'error',
          code: 'REQ-001',
          message: `Missing required element: ${element}`,
          path: element
        });
      } else if (Array.isArray(value) && value.length === 0) {
        errors.push({
          severity: 'error',
          code: 'REQ-002',
          message: `Required element is empty: ${element}`,
          path: element
        });
      }
    }
  }

  // Terminology validation
  if (validateTerminology) {
    for (const [path, expectedSystems] of Object.entries(TERMINOLOGY_BINDINGS)) {
      const [targetResource, elementPath] = path.split('.');
      if (targetResource !== resourceType) continue;
      
      const element = parsed[elementPath] as Record<string, unknown> | undefined;
      if (!element) continue;
      
      const codings = extractCodings(element);
      for (const coding of codings) {
        if (coding.system) {
          const matchesExpected = expectedSystems.some(sys => {
            const systemInfo = TERMINOLOGY_SYSTEMS[sys];
            return systemInfo && coding.system?.includes(systemInfo.url);
          });
          if (!matchesExpected) {
            warnings.push({
              severity: 'warning',
              code: 'TERM-001',
              message: `Unexpected code system for ${elementPath}: ${coding.system}`,
              path: `${elementPath}.coding.system`
            });
          }
        } else {
          warnings.push({
            severity: 'warning',
            code: 'TERM-002',
            message: `Missing code system for ${elementPath}`,
            path: `${elementPath}.coding.system`
          });
        }
      }
    }
  }

  // Reference validation
  if (validateReferences) {
    const references = findReferences(parsed);
    for (const ref of references) {
      if (ref.reference && !isValidReferenceFormat(ref.reference)) {
        errors.push({
          severity: 'error',
          code: 'REF-001',
          message: `Invalid reference format: ${ref.reference}`,
          path: ref.path
        });
      }
    }
  }

  // Resource-specific validation
  switch (resourceType) {
    case 'Patient':
      validatePatient(parsed, errors, warnings, info);
      break;
    case 'Observation':
      validateObservation(parsed, errors, warnings, info);
      break;
    case 'Condition':
      validateCondition(parsed, errors, warnings, info);
      break;
    case 'MedicationRequest':
      validateMedicationRequest(parsed, errors, warnings, info);
      break;
    case 'Encounter':
      validateEncounter(parsed, errors, warnings, info);
      break;
  }

  return {
    valid: errors.length === 0,
    resourceType,
    profile: profile === 'us-core' ? US_CORE_PROFILES[resourceType] : undefined,
    errors,
    warnings,
    info
  };
}

function extractCodings(element: Record<string, unknown>): Array<{ system?: string; code?: string }> {
  if (Array.isArray(element.coding)) {
    return element.coding as Array<{ system?: string; code?: string }>;
  }
  if (element.system !== undefined || element.code !== undefined) {
    return [element as { system?: string; code?: string }];
  }
  return [];
}

function findReferences(obj: unknown, path: string = ''): Array<{ reference?: string; display?: string; path: string }> {
  const refs: Array<{ reference?: string; display?: string; path: string }> = [];
  if (!obj || typeof obj !== 'object') return refs;

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      refs.push(...findReferences(item, `${path}[${index}]`));
    });
  } else {
    const record = obj as Record<string, unknown>;
    if ('reference' in record || 'display' in record) {
      refs.push({
        reference: record.reference as string | undefined,
        display: record.display as string | undefined,
        path
      });
    }
    for (const [key, value] of Object.entries(record)) {
      if (key !== 'reference' && key !== 'display' && typeof value === 'object' && value !== null) {
        refs.push(...findReferences(value, path ? `${path}.${key}` : key));
      }
    }
  }
  return refs;
}

function isValidReferenceFormat(reference: string): boolean {
  return (
    /^[A-Z][a-zA-Z]+\/[^\s/]+$/.test(reference) ||
    /^https?:\/\//.test(reference) ||
    /^urn:(uuid|oid):/.test(reference) ||
    /^#.+$/.test(reference)
  );
}

function validateBundle(bundle: any, options: any): FhirValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  const validTypes = ['transaction', 'document', 'collection', 'batch', 'searchset', 'history', 'message'];
  if (!validTypes.includes(bundle.type)) {
    errors.push({
      severity: 'error',
      code: 'BUNDLE-001',
      message: `Invalid bundle type: ${bundle.type}`,
      path: 'type'
    });
  }

  const bundleResources = (bundle.entry || []).filter((e: any) => e.resource).map((e: any) => e.resource);

  if (bundle.entry) {
    bundle.entry.forEach((entry: any, index: number) => {
      const path = `entry[${index}]`;

      if ((bundle.type === 'transaction' || bundle.type === 'batch') && !entry.request) {
        errors.push({
          severity: 'error',
          code: 'BUNDLE-002',
          message: 'Entry missing request element',
          path: `${path}.request`
        });
      }

      if (bundle.type === 'document' && index === 0) {
        if (!entry.resource || entry.resource.resourceType !== 'Composition') {
          errors.push({
            severity: 'error',
            code: 'BUNDLE-003',
            message: 'Document bundle must start with Composition',
            path: `${path}.resource`
          });
        }
      }

      if (entry.resource) {
        const resourceResult = validateFhir(entry.resource, { ...options, bundle: bundleResources });
        resourceResult.errors.forEach(e => {
          errors.push({ ...e, path: e.path ? `${path}.resource.${e.path}` : `${path}.resource` });
        });
        resourceResult.warnings.forEach(w => {
          warnings.push({ ...w, path: w.path ? `${path}.resource.${w.path}` : `${path}.resource` });
        });
        resourceResult.info.forEach(i => {
          info.push({ ...i, path: i.path ? `${path}.resource.${i.path}` : `${path}.resource` });
        });
      }
    });
  }

  info.push({
    severity: 'info',
    code: 'BUNDLE-OK',
    message: `Bundle contains ${bundle.entry?.length || 0} entries`
  });

  return { valid: errors.length === 0, resourceType: 'Bundle', errors, warnings, info };
}

function validatePatient(resource: FhirResource, errors: ValidationIssue[], warnings: ValidationIssue[], info: ValidationIssue[]): void {
  const patient = resource as Record<string, unknown>;

  if (Array.isArray(patient.name) && patient.name.length > 0) {
    const name = patient.name[0] as Record<string, unknown>;
    if (!name.family && !name.text) {
      warnings.push({ severity: 'warning', code: 'PAT-001', message: 'Patient name missing family name or text', path: 'name[0].family' });
    }
  }

  if (patient.birthDate && typeof patient.birthDate === 'string') {
    if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(patient.birthDate)) {
      errors.push({ severity: 'error', code: 'PAT-002', message: 'Invalid birthDate format', path: 'birthDate' });
    }
  }

  if (patient.gender && !['male', 'female', 'other', 'unknown'].includes(patient.gender as string)) {
    errors.push({ severity: 'error', code: 'PAT-003', message: `Invalid gender value: ${patient.gender}`, path: 'gender' });
  }

  info.push({ severity: 'info', code: 'PAT-OK', message: 'Patient resource validation complete' });
}

function validateObservation(resource: FhirResource, errors: ValidationIssue[], warnings: ValidationIssue[], info: ValidationIssue[]): void {
  const observation = resource as Record<string, unknown>;

  const validStatuses = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'];
  if (observation.status && !validStatuses.includes(observation.status as string)) {
    errors.push({ severity: 'error', code: 'OBS-001', message: `Invalid status value: ${observation.status}`, path: 'status' });
  }

  const hasValue = Object.keys(observation).some(k => k.startsWith('value'));
  if (!hasValue && !observation.dataAbsentReason) {
    warnings.push({ severity: 'warning', code: 'OBS-002', message: 'Observation has no value and no dataAbsentReason', path: 'value[x]' });
  }

  info.push({ severity: 'info', code: 'OBS-OK', message: 'Observation resource validation complete' });
}

function validateCondition(resource: FhirResource, errors: ValidationIssue[], warnings: ValidationIssue[], info: ValidationIssue[]): void {
  const condition = resource as Record<string, unknown>;
  const verificationStatus = condition.verificationStatus as Record<string, unknown> | undefined;

  if (verificationStatus) {
    const verificationCodings = extractCodings(verificationStatus);
    const isEnteredInError = verificationCodings.some(c => c.code === 'entered-in-error');
    if (isEnteredInError && condition.clinicalStatus) {
      errors.push({ severity: 'error', code: 'COND-001', message: 'clinicalStatus SHALL NOT be present when verificationStatus is entered-in-error', path: 'clinicalStatus' });
    }
  }

  info.push({ severity: 'info', code: 'COND-OK', message: 'Condition resource validation complete' });
}

function validateMedicationRequest(resource: FhirResource, errors: ValidationIssue[], warnings: ValidationIssue[], info: ValidationIssue[]): void {
  const medRequest = resource as Record<string, unknown>;

  const validIntents = ['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'];
  if (medRequest.intent && !validIntents.includes(medRequest.intent as string)) {
    errors.push({ severity: 'error', code: 'MEDREQ-001', message: `Invalid intent value: ${medRequest.intent}`, path: 'intent' });
  }

  const validStatuses = ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown'];
  if (medRequest.status && !validStatuses.includes(medRequest.status as string)) {
    errors.push({ severity: 'error', code: 'MEDREQ-002', message: `Invalid status value: ${medRequest.status}`, path: 'status' });
  }

  info.push({ severity: 'info', code: 'MEDREQ-OK', message: 'MedicationRequest resource validation complete' });
}

function validateEncounter(resource: FhirResource, errors: ValidationIssue[], warnings: ValidationIssue[], info: ValidationIssue[]): void {
  const encounter = resource as Record<string, unknown>;

  const validStatuses = ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'];
  if (encounter.status && !validStatuses.includes(encounter.status as string)) {
    errors.push({ severity: 'error', code: 'ENC-001', message: `Invalid status value: ${encounter.status}`, path: 'status' });
  }

  if (encounter.class && typeof encounter.class !== 'object') {
    errors.push({ severity: 'error', code: 'ENC-002', message: 'Encounter.class must be a Coding object', path: 'class' });
  }

  info.push({ severity: 'info', code: 'ENC-OK', message: 'Encounter resource validation complete' });
}
