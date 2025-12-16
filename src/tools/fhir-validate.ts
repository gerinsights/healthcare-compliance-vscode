/**
 * FHIR R4 Validation Tool
 * 
 * Validates FHIR R4 resources against base FHIR spec and US Core profiles.
 * Supports common resource types, reference validation, and terminology bindings.
 * 
 * @module fhir-validate
 */

import * as vscode from 'vscode';

// ============================================================================
// FHIR Resource Type Definitions
// ============================================================================

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: unknown;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  type: 'transaction' | 'document' | 'collection' | 'batch' | 'searchset';
  entry?: Array<{
    resource?: FhirResource;
    request?: {
      method: string;
      url: string;
    };
    fullUrl?: string;
  }>;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
  details?: string;
}

export interface FhirValidationResult {
  valid: boolean;
  resourceType: string;
  profile?: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

// ============================================================================
// US Core Profile Definitions
// ============================================================================

/**
 * US Core 5.0.1 profile OIDs and URLs
 */
export const US_CORE_PROFILES: Record<string, string> = {
  Patient: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
  Practitioner: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitioner',
  Organization: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-organization',
  Encounter: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter',
  Condition: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition',
  Observation: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab',
  MedicationRequest: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest',
  AllergyIntolerance: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance',
  Procedure: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure',
  DiagnosticReport: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab',
  Immunization: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization',
  DocumentReference: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference',
  CarePlan: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan',
  Goal: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal',
  Location: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-location',
};

/**
 * Required elements for common FHIR resource types per base spec
 */
export const REQUIRED_ELEMENTS: Record<string, string[]> = {
  Patient: ['identifier', 'name'],
  Practitioner: ['identifier', 'name'],
  Organization: ['identifier', 'name'],
  Encounter: ['status', 'class', 'subject'],
  Condition: ['code', 'subject'],
  Observation: ['status', 'code', 'subject'],
  MedicationRequest: ['status', 'intent', 'medication[x]', 'subject'],
  AllergyIntolerance: ['patient'],
  Procedure: ['status', 'code', 'subject'],
  DiagnosticReport: ['status', 'code', 'subject'],
  Immunization: ['status', 'vaccineCode', 'patient', 'occurrence[x]'],
  DocumentReference: ['status', 'type', 'content'],
  CarePlan: ['status', 'intent', 'subject'],
  Goal: ['lifecycleStatus', 'description', 'subject'],
  Location: ['name'],
  Bundle: ['type'],
  Composition: ['status', 'type', 'subject', 'date', 'author'],
};

/**
 * US Core required elements (in addition to base FHIR)
 */
export const US_CORE_REQUIRED: Record<string, string[]> = {
  Patient: ['identifier', 'name', 'gender'],
  Encounter: ['status', 'class', 'type', 'subject'],
  Condition: ['clinicalStatus', 'verificationStatus', 'category', 'code', 'subject'],
  Observation: ['status', 'category', 'code', 'subject'],
  MedicationRequest: ['status', 'intent', 'medication[x]', 'subject', 'authoredOn'],
  Procedure: ['status', 'code', 'subject', 'performed[x]'],
  DiagnosticReport: ['status', 'category', 'code', 'subject'],
  Immunization: ['status', 'vaccineCode', 'patient', 'occurrence[x]'],
};

// ============================================================================
// Terminology System Definitions
// ============================================================================

export const TERMINOLOGY_SYSTEMS: Record<string, { name: string; url: string }> = {
  SNOMED: { name: 'SNOMED CT', url: 'http://snomed.info/sct' },
  LOINC: { name: 'LOINC', url: 'http://loinc.org' },
  ICD10: { name: 'ICD-10-CM', url: 'http://hl7.org/fhir/sid/icd-10-cm' },
  CPT: { name: 'CPT', url: 'http://www.ama-assn.org/go/cpt' },
  RXNORM: { name: 'RxNorm', url: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  CVX: { name: 'CVX', url: 'http://hl7.org/fhir/sid/cvx' },
  NDC: { name: 'NDC', url: 'http://hl7.org/fhir/sid/ndc' },
};

/**
 * Expected terminology systems by element path
 */
export const TERMINOLOGY_BINDINGS: Record<string, string[]> = {
  'Condition.code': ['SNOMED', 'ICD10'],
  'Observation.code': ['LOINC', 'SNOMED'],
  'Procedure.code': ['CPT', 'SNOMED', 'ICD10'],
  'MedicationRequest.medication': ['RXNORM', 'NDC'],
  'Immunization.vaccineCode': ['CVX'],
  'DiagnosticReport.code': ['LOINC'],
  'AllergyIntolerance.code': ['SNOMED', 'RXNORM'],
};

// ============================================================================
// FHIR Validation Implementation
// ============================================================================

/**
 * Main FHIR validation function
 * 
 * @param resource - FHIR resource JSON string or object
 * @param options - Validation options
 * @returns Validation result with errors, warnings, and info
 */
export function validateFhir(
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

  // Parse JSON if string
  let parsed: FhirResource;
  try {
    parsed = typeof resource === 'string' ? JSON.parse(resource) : resource;
  } catch (e) {
    errors.push({
      severity: 'error',
      code: 'PARSE-001',
      message: 'Invalid JSON: Unable to parse resource',
      details: e instanceof Error ? e.message : 'Unknown parse error',
    });
    return {
      valid: false,
      resourceType: 'Unknown',
      errors,
      warnings,
      info,
    };
  }

  // Validate resourceType exists
  if (!parsed.resourceType) {
    errors.push({
      severity: 'error',
      code: 'FHIR-001',
      message: 'Missing required element: resourceType',
      path: 'resourceType',
    });
    return {
      valid: false,
      resourceType: 'Unknown',
      errors,
      warnings,
      info,
    };
  }

  const resourceType = parsed.resourceType;

  // Handle Bundle separately
  if (resourceType === 'Bundle') {
    return validateBundle(parsed as unknown as FhirBundle, options);
  }

  // Validate against profile
  const profileResult = validateProfile(parsed, resourceType, profile);
  errors.push(...profileResult.errors);
  warnings.push(...profileResult.warnings);
  info.push(...profileResult.info);

  // Validate required elements
  const requiredResult = validateRequiredElements(parsed, resourceType, profile);
  errors.push(...requiredResult.errors);
  warnings.push(...requiredResult.warnings);

  // Validate terminology bindings
  if (validateTerminology) {
    const terminologyResult = validateTerminologyBindings(parsed, resourceType);
    errors.push(...terminologyResult.errors);
    warnings.push(...terminologyResult.warnings);
  }

  // Validate references
  if (validateReferences) {
    const referenceResult = validateReferenceIntegrity(parsed, options.bundle || []);
    errors.push(...referenceResult.errors);
    warnings.push(...referenceResult.warnings);
  }

  // Resource-specific validation
  const specificResult = validateResourceSpecific(parsed, resourceType);
  errors.push(...specificResult.errors);
  warnings.push(...specificResult.warnings);
  info.push(...specificResult.info);

  return {
    valid: errors.length === 0,
    resourceType,
    profile: profile === 'us-core' ? US_CORE_PROFILES[resourceType] : undefined,
    errors,
    warnings,
    info,
  };
}

/**
 * Validate profile conformance
 */
function validateProfile(
  resource: FhirResource,
  resourceType: string,
  profile: 'base' | 'us-core'
): { errors: ValidationIssue[]; warnings: ValidationIssue[]; info: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  if (profile === 'us-core') {
    const expectedProfile = US_CORE_PROFILES[resourceType];
    
    if (expectedProfile) {
      const declaredProfiles = resource.meta?.profile || [];
      
      if (!declaredProfiles.includes(expectedProfile)) {
        warnings.push({
          severity: 'warning',
          code: 'PROFILE-001',
          message: `Resource does not declare US Core profile: ${expectedProfile}`,
          path: 'meta.profile',
          details: 'Consider adding the profile URL to meta.profile for conformance claim',
        });
      } else {
        info.push({
          severity: 'info',
          code: 'PROFILE-OK',
          message: `Resource declares US Core profile: ${expectedProfile}`,
        });
      }
    } else {
      info.push({
        severity: 'info',
        code: 'PROFILE-002',
        message: `No US Core profile defined for ${resourceType}`,
      });
    }
  }

  return { errors, warnings, info };
}

/**
 * Validate required elements per FHIR base spec and profile
 */
function validateRequiredElements(
  resource: FhirResource,
  resourceType: string,
  profile: 'base' | 'us-core'
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Get required elements for this resource type
  let requiredElements = REQUIRED_ELEMENTS[resourceType] || [];
  
  // Add US Core requirements if applicable
  if (profile === 'us-core' && US_CORE_REQUIRED[resourceType]) {
    requiredElements = [...new Set([...requiredElements, ...US_CORE_REQUIRED[resourceType]])];
  }

  for (const element of requiredElements) {
    // Handle choice types like medication[x]
    if (element.includes('[x]')) {
      const baseName = element.replace('[x]', '');
      const hasChoice = Object.keys(resource).some(key => key.startsWith(baseName));
      
      if (!hasChoice) {
        errors.push({
          severity: 'error',
          code: 'REQ-001',
          message: `Missing required element: ${element}`,
          path: element,
          details: `One of ${baseName}CodeableConcept, ${baseName}Reference, etc. is required`,
        });
      }
    } else {
      // Check if element exists and is non-empty
      const value = resource[element];
      if (value === undefined || value === null) {
        errors.push({
          severity: 'error',
          code: 'REQ-001',
          message: `Missing required element: ${element}`,
          path: element,
        });
      } else if (Array.isArray(value) && value.length === 0) {
        errors.push({
          severity: 'error',
          code: 'REQ-002',
          message: `Required element is empty: ${element}`,
          path: element,
        });
      }
    }
  }

  return { errors, warnings };
}

/**
 * Validate terminology bindings for coded elements
 */
function validateTerminologyBindings(
  resource: FhirResource,
  resourceType: string
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Check each terminology binding
  for (const [path, expectedSystems] of Object.entries(TERMINOLOGY_BINDINGS)) {
    const [targetResource, elementPath] = path.split('.');
    
    if (targetResource !== resourceType) continue;

    const element = resource[elementPath] as Record<string, unknown> | undefined;
    if (!element) continue;

    // Check CodeableConcept or Coding
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
            path: `${elementPath}.coding.system`,
            details: `Expected systems: ${expectedSystems.join(', ')}`,
          });
        }
      } else {
        warnings.push({
          severity: 'warning',
          code: 'TERM-002',
          message: `Missing code system for ${elementPath}`,
          path: `${elementPath}.coding.system`,
        });
      }
    }
  }

  return { errors, warnings };
}

/**
 * Extract coding elements from CodeableConcept or Coding
 */
function extractCodings(element: Record<string, unknown>): Array<{ system?: string; code?: string }> {
  if (Array.isArray(element.coding)) {
    return element.coding as Array<{ system?: string; code?: string }>;
  }
  if (element.system !== undefined || element.code !== undefined) {
    return [element as { system?: string; code?: string }];
  }
  return [];
}

/**
 * Validate reference integrity within bundle or standalone
 */
function validateReferenceIntegrity(
  resource: FhirResource,
  bundle: FhirResource[]
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Find all reference elements
  const references = findReferences(resource);

  for (const ref of references) {
    if (ref.reference) {
      // Check reference format
      if (!isValidReferenceFormat(ref.reference)) {
        errors.push({
          severity: 'error',
          code: 'REF-001',
          message: `Invalid reference format: ${ref.reference}`,
          path: ref.path,
        });
        continue;
      }

      // Check if reference can be resolved in bundle
      if (bundle.length > 0 && !canResolveReference(ref.reference, bundle)) {
        warnings.push({
          severity: 'warning',
          code: 'REF-002',
          message: `Reference cannot be resolved in bundle: ${ref.reference}`,
          path: ref.path,
          details: 'Ensure referenced resource exists in the bundle or external system',
        });
      }
    } else if (!ref.display) {
      warnings.push({
        severity: 'warning',
        code: 'REF-003',
        message: 'Reference missing both reference and display',
        path: ref.path,
      });
    }
  }

  return { errors, warnings };
}

/**
 * Find all reference elements in a resource
 */
function findReferences(
  obj: unknown,
  path: string = ''
): Array<{ reference?: string; display?: string; path: string }> {
  const refs: Array<{ reference?: string; display?: string; path: string }> = [];

  if (!obj || typeof obj !== 'object') return refs;

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      refs.push(...findReferences(item, `${path}[${index}]`));
    });
  } else {
    const record = obj as Record<string, unknown>;
    
    // Check if this is a Reference type
    if ('reference' in record || 'display' in record) {
      refs.push({
        reference: record.reference as string | undefined,
        display: record.display as string | undefined,
        path,
      });
    }

    // Recurse into nested objects
    for (const [key, value] of Object.entries(record)) {
      if (key !== 'reference' && key !== 'display' && typeof value === 'object' && value !== null) {
        refs.push(...findReferences(value, path ? `${path}.${key}` : key));
      }
    }
  }

  return refs;
}

/**
 * Check if reference format is valid
 */
function isValidReferenceFormat(reference: string): boolean {
  // Valid formats:
  // - ResourceType/id (relative)
  // - http(s)://... (absolute)
  // - urn:uuid:... (UUID)
  // - #id (contained)
  return (
    /^[A-Z][a-zA-Z]+\/[^\s/]+$/.test(reference) ||
    /^https?:\/\//.test(reference) ||
    /^urn:(uuid|oid):/.test(reference) ||
    /^#.+$/.test(reference)
  );
}

/**
 * Check if reference can be resolved in bundle
 */
function canResolveReference(reference: string, bundle: FhirResource[]): boolean {
  // Handle relative references
  const match = reference.match(/^([A-Z][a-zA-Z]+)\/(.+)$/);
  if (match) {
    const [, resourceType, id] = match;
    return bundle.some(r => r.resourceType === resourceType && r.id === id);
  }

  // Handle contained references
  if (reference.startsWith('#')) {
    // This would need the container resource to check contained array
    return true; // Assume valid for now
  }

  // External references - assume valid
  return true;
}

/**
 * Resource-specific validation rules
 */
function validateResourceSpecific(
  resource: FhirResource,
  resourceType: string
): { errors: ValidationIssue[]; warnings: ValidationIssue[]; info: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  switch (resourceType) {
    case 'Patient':
      validatePatient(resource, errors, warnings, info);
      break;
    case 'Observation':
      validateObservation(resource, errors, warnings, info);
      break;
    case 'Condition':
      validateCondition(resource, errors, warnings, info);
      break;
    case 'MedicationRequest':
      validateMedicationRequest(resource, errors, warnings, info);
      break;
    case 'Encounter':
      validateEncounter(resource, errors, warnings, info);
      break;
  }

  return { errors, warnings, info };
}

/**
 * Patient-specific validation
 */
function validatePatient(
  resource: FhirResource,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void {
  const patient = resource as Record<string, unknown>;

  // Check for name structure
  if (Array.isArray(patient.name) && patient.name.length > 0) {
    const name = patient.name[0] as Record<string, unknown>;
    if (!name.family && !name.text) {
      warnings.push({
        severity: 'warning',
        code: 'PAT-001',
        message: 'Patient name missing family name or text',
        path: 'name[0].family',
      });
    }
  }

  // Check birthDate format
  if (patient.birthDate && typeof patient.birthDate === 'string') {
    if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(patient.birthDate)) {
      errors.push({
        severity: 'error',
        code: 'PAT-002',
        message: 'Invalid birthDate format',
        path: 'birthDate',
        details: 'Expected YYYY, YYYY-MM, or YYYY-MM-DD format',
      });
    }
  }

  // Check gender value
  if (patient.gender && !['male', 'female', 'other', 'unknown'].includes(patient.gender as string)) {
    errors.push({
      severity: 'error',
      code: 'PAT-003',
      message: `Invalid gender value: ${patient.gender}`,
      path: 'gender',
      details: 'Must be one of: male, female, other, unknown',
    });
  }

  info.push({
    severity: 'info',
    code: 'PAT-OK',
    message: 'Patient resource validation complete',
  });
}

/**
 * Observation-specific validation
 */
function validateObservation(
  resource: FhirResource,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void {
  const observation = resource as Record<string, unknown>;

  // Check status value
  const validStatuses = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'];
  if (observation.status && !validStatuses.includes(observation.status as string)) {
    errors.push({
      severity: 'error',
      code: 'OBS-001',
      message: `Invalid status value: ${observation.status}`,
      path: 'status',
      details: `Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  // Check for value element
  const hasValue = Object.keys(observation).some(k => k.startsWith('value'));
  if (!hasValue && !observation.dataAbsentReason) {
    warnings.push({
      severity: 'warning',
      code: 'OBS-002',
      message: 'Observation has no value and no dataAbsentReason',
      path: 'value[x]',
    });
  }

  info.push({
    severity: 'info',
    code: 'OBS-OK',
    message: 'Observation resource validation complete',
  });
}

/**
 * Condition-specific validation
 */
function validateCondition(
  resource: FhirResource,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void {
  const condition = resource as Record<string, unknown>;

  // Check clinicalStatus vs verificationStatus consistency
  const clinicalStatus = condition.clinicalStatus as Record<string, unknown> | undefined;
  const verificationStatus = condition.verificationStatus as Record<string, unknown> | undefined;

  if (verificationStatus) {
    const verificationCodings = extractCodings(verificationStatus);
    const isEnteredInError = verificationCodings.some(c => c.code === 'entered-in-error');
    
    if (isEnteredInError && clinicalStatus) {
      errors.push({
        severity: 'error',
        code: 'COND-001',
        message: 'clinicalStatus SHALL NOT be present when verificationStatus is entered-in-error',
        path: 'clinicalStatus',
      });
    }
  }

  info.push({
    severity: 'info',
    code: 'COND-OK',
    message: 'Condition resource validation complete',
  });
}

/**
 * MedicationRequest-specific validation
 */
function validateMedicationRequest(
  resource: FhirResource,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void {
  const medRequest = resource as Record<string, unknown>;

  // Check intent value
  const validIntents = ['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'];
  if (medRequest.intent && !validIntents.includes(medRequest.intent as string)) {
    errors.push({
      severity: 'error',
      code: 'MEDREQ-001',
      message: `Invalid intent value: ${medRequest.intent}`,
      path: 'intent',
      details: `Must be one of: ${validIntents.join(', ')}`,
    });
  }

  // Check status value
  const validStatuses = ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown'];
  if (medRequest.status && !validStatuses.includes(medRequest.status as string)) {
    errors.push({
      severity: 'error',
      code: 'MEDREQ-002',
      message: `Invalid status value: ${medRequest.status}`,
      path: 'status',
      details: `Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  info.push({
    severity: 'info',
    code: 'MEDREQ-OK',
    message: 'MedicationRequest resource validation complete',
  });
}

/**
 * Encounter-specific validation
 */
function validateEncounter(
  resource: FhirResource,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void {
  const encounter = resource as Record<string, unknown>;

  // Check status value
  const validStatuses = ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'];
  if (encounter.status && !validStatuses.includes(encounter.status as string)) {
    errors.push({
      severity: 'error',
      code: 'ENC-001',
      message: `Invalid status value: ${encounter.status}`,
      path: 'status',
      details: `Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  // Check class is a Coding
  if (encounter.class && typeof encounter.class !== 'object') {
    errors.push({
      severity: 'error',
      code: 'ENC-002',
      message: 'Encounter.class must be a Coding object',
      path: 'class',
    });
  }

  info.push({
    severity: 'info',
    code: 'ENC-OK',
    message: 'Encounter resource validation complete',
  });
}

// ============================================================================
// Bundle Validation
// ============================================================================

/**
 * Validate FHIR Bundle
 */
function validateBundle(
  bundle: FhirBundle,
  options: {
    profile?: 'base' | 'us-core';
    validateTerminology?: boolean;
    validateReferences?: boolean;
  }
): FhirValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  // Validate bundle type
  const validTypes = ['transaction', 'document', 'collection', 'batch', 'searchset', 'history', 'message'];
  if (!validTypes.includes(bundle.type)) {
    errors.push({
      severity: 'error',
      code: 'BUNDLE-001',
      message: `Invalid bundle type: ${bundle.type}`,
      path: 'type',
      details: `Must be one of: ${validTypes.join(', ')}`,
    });
  }

  // Extract all resources for reference validation
  const bundleResources = (bundle.entry || [])
    .filter(e => e.resource)
    .map(e => e.resource!);

  // Validate each entry
  if (bundle.entry) {
    bundle.entry.forEach((entry, index) => {
      const path = `entry[${index}]`;

      // Transaction/batch bundles require request
      if ((bundle.type === 'transaction' || bundle.type === 'batch') && !entry.request) {
        errors.push({
          severity: 'error',
          code: 'BUNDLE-002',
          message: `Entry missing request element`,
          path: `${path}.request`,
          details: `Transaction and batch bundles require request element`,
        });
      }

      // Document bundles: first entry should be Composition
      if (bundle.type === 'document' && index === 0) {
        if (!entry.resource || entry.resource.resourceType !== 'Composition') {
          errors.push({
            severity: 'error',
            code: 'BUNDLE-003',
            message: 'Document bundle must start with Composition resource',
            path: `${path}.resource`,
          });
        }
      }

      // Validate individual resource
      if (entry.resource) {
        const resourceResult = validateFhir(entry.resource, {
          ...options,
          bundle: bundleResources,
        });

        // Prefix paths with entry index
        resourceResult.errors.forEach(e => {
          errors.push({
            ...e,
            path: e.path ? `${path}.resource.${e.path}` : `${path}.resource`,
          });
        });
        resourceResult.warnings.forEach(w => {
          warnings.push({
            ...w,
            path: w.path ? `${path}.resource.${w.path}` : `${path}.resource`,
          });
        });
        resourceResult.info.forEach(i => {
          info.push({
            ...i,
            path: i.path ? `${path}.resource.${i.path}` : `${path}.resource`,
          });
        });
      }
    });
  }

  info.push({
    severity: 'info',
    code: 'BUNDLE-OK',
    message: `Bundle contains ${bundle.entry?.length || 0} entries`,
  });

  return {
    valid: errors.length === 0,
    resourceType: 'Bundle',
    profile: options.profile === 'us-core' ? 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-bundle' : undefined,
    errors,
    warnings,
    info,
  };
}

// ============================================================================
// MCP Tool Registration
// ============================================================================

export interface FhirValidateToolArgs {
  resource: string;
  profile?: 'base' | 'us-core';
  validateTerminology?: boolean;
  validateReferences?: boolean;
}

/**
 * FHIR validation tool for MCP server
 */
export const fhirValidateTool = {
  name: 'fhir_validate',
  description: `Validates FHIR R4 resources against base FHIR specification and US Core profiles.
  
Supports:
- Common resource types: Patient, Encounter, Observation, Condition, MedicationRequest, etc.
- US Core 5.0.1 profile validation
- Terminology binding validation (SNOMED, LOINC, RxNorm, ICD-10)
- Reference integrity checking
- Bundle validation (transaction, document, collection)

Returns validation result with:
- errors: Issues that must be fixed for conformance
- warnings: Issues that may indicate problems
- info: Informational messages about the validation`,

  parameters: {
    type: 'object',
    properties: {
      resource: {
        type: 'string',
        description: 'FHIR resource JSON to validate',
      },
      profile: {
        type: 'string',
        enum: ['base', 'us-core'],
        description: 'Profile to validate against (default: base)',
      },
      validateTerminology: {
        type: 'boolean',
        description: 'Check terminology bindings (default: true)',
      },
      validateReferences: {
        type: 'boolean',
        description: 'Validate reference integrity (default: true)',
      },
    },
    required: ['resource'],
  },

  handler: async (args: FhirValidateToolArgs): Promise<string> => {
    try {
      const result = validateFhir(args.resource, {
        profile: args.profile,
        validateTerminology: args.validateTerminology,
        validateReferences: args.validateReferences,
      });

      const output = [
        `## FHIR Validation Result`,
        ``,
        `**Resource Type:** ${result.resourceType}`,
        result.profile ? `**Profile:** ${result.profile}` : null,
        `**Valid:** ${result.valid ? '✅ Yes' : '❌ No'}`,
        ``,
      ].filter(Boolean).join('\n');

      const sections: string[] = [output];

      if (result.errors.length > 0) {
        sections.push(`### ❌ Errors (${result.errors.length})\n`);
        result.errors.forEach((e, i) => {
          sections.push(`${i + 1}. **[${e.code}]** ${e.message}`);
          if (e.path) sections.push(`   - Path: \`${e.path}\``);
          if (e.details) sections.push(`   - ${e.details}`);
        });
        sections.push('');
      }

      if (result.warnings.length > 0) {
        sections.push(`### ⚠️ Warnings (${result.warnings.length})\n`);
        result.warnings.forEach((w, i) => {
          sections.push(`${i + 1}. **[${w.code}]** ${w.message}`);
          if (w.path) sections.push(`   - Path: \`${w.path}\``);
          if (w.details) sections.push(`   - ${w.details}`);
        });
        sections.push('');
      }

      if (result.info.length > 0) {
        sections.push(`### ℹ️ Info (${result.info.length})\n`);
        result.info.forEach((inf, i) => {
          sections.push(`${i + 1}. **[${inf.code}]** ${inf.message}`);
        });
      }

      return sections.join('\n');
    } catch (error) {
      return `## FHIR Validation Error\n\nFailed to validate resource: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
};
