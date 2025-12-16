# Sprint Backlog - Production Enhancements

This document tracks features and improvements identified in the codebase as requiring production-level implementation.

## Sprint Priority Legend
- 🔴 **P0** - Critical for production release
- 🟠 **P1** - High priority, needed soon after MVP
- 🟡 **P2** - Medium priority, enhances functionality
- 🟢 **P3** - Nice to have, future consideration

---

## ✅ Completed Items

### Unit Test Suite - Phase 1 ✅
**Priority:** 🔴 P0 | **Status:** COMPLETED | **Date:** 2025-12-15

**Completed:**
- [x] Jest test framework setup with TypeScript support
- [x] VS Code API mocks for testing
- [x] PHI detection tests (38 tests) - SSN, MRN, MBI, DOB, Phone, Email
- [x] HIPAA validation tests (26 tests) - All major CFR sections covered
- [x] False positive reduction tests
- [x] Context awareness tests (code, data, filename)

**Test Results:** 64/64 passing (100%)

---

## 📋 Backlog Items

### 1. Formula Update Checker - Live Guideline API Integration
**File:** [src/services/formula-update-checker.ts](src/services/formula-update-checker.ts#L145-L170)
**Priority:** 🟠 P1
**Type:** Feature Enhancement
**Effort:** Large (2-3 sprints)

**Current State:**
```typescript
// In production, this would check actual guideline publication APIs
// For now, returns embedded version data
```

**Production Requirements:**
- [ ] Integrate with professional society APIs/feeds:
  - ACC/AHA for cardiology guidelines
  - IDSA/ATS for infectious disease
  - AGS for geriatrics (Beers Criteria)
  - KDIGO for nephrology
- [ ] Parse publication dates from guideline PDFs/websites
- [ ] Implement version comparison logic
- [ ] Add notification system for critical formula changes
- [ ] Handle API rate limiting and failures gracefully

**Acceptance Criteria:**
- System detects guideline updates within 1 week of publication
- Users notified of critical formula changes
- Fallback to cached versions when APIs unavailable

---

### 2. CMS Medicare Coverage Database API Integration
**File:** [src/tools/lcd-lookup.ts](src/tools/lcd-lookup.ts#L212-L218)
**Priority:** 🟠 P1
**Type:** Feature Enhancement
**Effort:** Medium (1 sprint)

**Current State:**
```typescript
// In a production implementation, this would call the actual CMS Medicare Coverage Database API
// Since this is a placeholder, return empty to fall back to local search
```

**Production Requirements:**
- [ ] Implement actual CMS MCD API integration at `https://data.cms.gov/data-api/v1/dataset/medicare-coverage-database`
- [ ] Handle pagination for large result sets
- [ ] Parse and normalize LCD/NCD response data
- [ ] Implement proper error handling for API failures
- [ ] Add caching layer for frequently accessed determinations
- [ ] Support advanced search filters (CPT, ICD-10, contractor, jurisdiction)

**Acceptance Criteria:**
- Real-time LCD/NCD lookups return accurate CMS data
- Results match CMS MCD website within 24 hours
- Graceful degradation to static data on API failure

---

### 3. Expand LCD/NCD Reference Database
**File:** [src/tools/lcd-lookup.ts](src/tools/lcd-lookup.ts#L20)
**Priority:** 🟡 P2
**Type:** Data Enhancement
**Effort:** Medium (1 sprint)

**Current State:**
```typescript
// Common LCD articles for reference (would be expanded in production)
const COMMON_LCDS: CoverageArticle[] = [
  // ~10 common LCDs currently
];
```

**Production Requirements:**
- [ ] Expand to include 100+ most commonly referenced LCDs
- [ ] Add all active NCDs (national coverage determinations)
- [ ] Include MAC-specific contractor information
- [ ] Add historical versions for retired LCDs
- [ ] Implement data update pipeline for monthly CMS refreshes
- [ ] Add coverage criteria summaries in machine-readable format

**Acceptance Criteria:**
- Database covers 90%+ of DME, therapy, and diagnostic LCD queries
- Monthly automated updates from CMS sources
- Historical version tracking for audit purposes

---

### 4. Beers Criteria - Full Medication Database
**File:** [src/tools/clinical-calculator.ts](src/tools/clinical-calculator.ts#L214)
**Priority:** 🟠 P1
**Type:** Feature Enhancement
**Effort:** Medium (1 sprint)

**Current State:**
```typescript
// This is a simplified version - full implementation would check against complete Beers list
const beersMedications: Record<string, string> = {
  // ~10 medications currently
};
```

**Production Requirements:**
- [ ] Implement complete 2023 AGS Beers Criteria medication list (150+ medications)
- [ ] Add drug-disease interaction checks
- [ ] Add drug-drug interaction checks for geriatric patients
- [ ] Include severity ratings (avoid, use with caution, conditional)
- [ ] Add organ-function dosing adjustments
- [ ] Include alternative medication suggestions
- [ ] Add STOPP/START criteria integration (European guidelines)

**Acceptance Criteria:**
- Full 2023 Beers list with all categories
- Drug-disease and drug-drug interactions flagged
- Evidence quality ratings included
- Updates tracked when AGS publishes revisions

---

### 5. State Resources Database Expansion
**File:** [src/tools/state-law-lookup.ts](src/tools/state-law-lookup.ts#L50)
**Priority:** 🟡 P2
**Type:** Data Enhancement
**Effort:** Small (0.5 sprint)

**Current State:**
```typescript
// Add more states as needed
```

**Production Requirements:**
- [ ] Add all 50 states + DC + territories
- [ ] Include state medical board URLs
- [ ] Add pharmacy board URLs
- [ ] Include Medicaid agency contact information
- [ ] Add state-specific telehealth policy summaries
- [ ] Include interstate compact membership status (IMLC, NLC, PT Compact)

**Acceptance Criteria:**
- Complete coverage for all US jurisdictions
- Verified URLs with automated link checking
- Quarterly review for URL/policy updates

---

### 6. Additional Clinical Calculators
**File:** [src/tools/clinical-calculator.ts](src/tools/clinical-calculator.ts)
**Priority:** 🟡 P2
**Type:** Feature Enhancement
**Effort:** Medium (1-2 sprints)

**Current State:** 6 calculators implemented

**Production Requirements - Add calculators for:**
- [ ] **Cardiology:** TIMI, GRACE, Duke Treadmill Score, Framingham 10-year risk
- [ ] **Pulmonology:** BODE Index, mMRC Dyspnea Scale, CAT Score
- [ ] **Nephrology:** MDRD, Fractional Excretion of Sodium (FENa)
- [ ] **Hepatology:** MELD-Na, Child-Pugh Score
- [ ] **Neurology:** Hunt & Hess, Fisher Grade, ABCD2 Score
- [ ] **Oncology:** Karnofsky Performance Status, ECOG
- [ ] **Obstetrics:** Bishop Score, Apgar Score
- [ ] **Pediatrics:** Pediatric GCS, PEWS
- [ ] **Geriatrics:** Katz ADL, Lawton IADL, Mini-Cog
- [ ] **Pain Management:** Opioid Conversion Calculator

**Acceptance Criteria:**
- 40+ calculators covering major specialties
- All formulas validated against reference implementations
- Guideline citations and last-updated dates included

---

### 7. FHIR R4 Validation Tool
**File:** [src/tools/](src/tools/) (new file needed)
**Priority:** 🟠 P1
**Type:** New Feature
**Effort:** Large (2 sprints)

**Current State:** Listed in README but not implemented

**Production Requirements:**
- [ ] Create `src/tools/fhir-validate.ts`
- [ ] Implement US Core profile validation
- [ ] Support common resource types: Patient, Encounter, Observation, Condition, Medication
- [ ] Validate reference integrity
- [ ] Check terminology bindings (SNOMED CT, LOINC, RxNorm)
- [ ] Support FHIR bundles (transaction, document)
- [ ] Add HL7 FHIR validator integration option

**Acceptance Criteria:**
- Validates against US Core 5.0.1 profiles
- Catches common FHIR implementation errors
- Clear remediation guidance for each issue

---

### 8. Real-time PHI Scanning on Save
**File:** [src/extension.ts](src/extension.ts)
**Priority:** 🟡 P2
**Type:** Feature Enhancement
**Effort:** Small (0.5 sprint)

**Current State:** Setting exists but feature not implemented

**Production Requirements:**
- [ ] Implement `workspace.onDidSaveTextDocument` handler
- [ ] Check `healthcareCompliance.phi.enableRealTimeScanning` setting
- [ ] Run PHI detection on saved files
- [ ] Show inline diagnostics/problems for detected PHI
- [ ] Respect `excludePatterns` configuration
- [ ] Add performance optimization for large files (debouncing, file size limits)

**Acceptance Criteria:**
- PHI detection runs within 500ms of file save
- Results appear in VS Code Problems panel
- No performance impact on normal development workflow

---

### 9. OpenStates API Full Integration
**File:** [src/tools/state-law-lookup.ts](src/tools/state-law-lookup.ts)
**Priority:** 🟡 P2
**Type:** Feature Enhancement
**Effort:** Medium (1 sprint)

**Current State:** Basic structure exists, API integration partial

**Production Requirements:**
- [ ] Implement full OpenStates GraphQL API integration
- [ ] Support bill search by keyword, subject, status
- [ ] Include legislator information for bills
- [ ] Add bill version/amendment tracking
- [ ] Implement legislative calendar integration
- [ ] Add email alerts for tracked bills (if user provides email)
- [ ] Handle API rate limiting (1000 requests/month free tier)

**Acceptance Criteria:**
- Real-time bill tracking for healthcare legislation
- Results match OpenStates website
- Clear messaging when approaching rate limits

---

### 10. Unit Test Suite
**File:** New `test/` directory
**Priority:** 🔴 P0
**Type:** Quality/Testing
**Effort:** Large (2 sprints)
**Status:** 🟡 IN PROGRESS (Phase 1 Complete)

**Current State:** Jest framework set up, 64 tests passing

**Production Requirements:**
- [x] Create test framework setup (Jest or Mocha)
- [x] PHI detection tests with known patterns
- [ ] Clinical calculator validation tests
- [ ] API mock tests for NPI/NDC lookups
- [x] HIPAA validation rule tests
- [ ] C-CDA validation tests with sample documents
- [ ] MDS 3.0 validation tests
- [ ] Integration tests for MCP tool registry
- [ ] CI/CD pipeline integration

**Acceptance Criteria:**
- 80%+ code coverage
- All calculator formulas validated against reference values
- CI runs tests on every PR

---

### 11. Audit Log Persistence and Export
**File:** [src/services/audit.ts](src/services/audit.ts)
**Priority:** 🟡 P2
**Type:** Feature Enhancement
**Effort:** Small (0.5 sprint)

**Current State:** Logs to VS Code output channel only

**Production Requirements:**
- [ ] Persist audit logs to file system
- [ ] Implement log rotation based on `retentionDays` setting
- [ ] Add export to CSV/JSON format
- [ ] Include timestamp, action, user context, results summary
- [ ] Never log actual PHI - only detection counts
- [ ] Add log viewer command with filtering

**Acceptance Criteria:**
- Audit logs persisted for configured retention period
- Export format suitable for compliance reporting
- Zero PHI in audit logs

---

### 12. VS Code Marketplace Publication
**File:** Package configuration
**Priority:** 🔴 P0
**Type:** Release
**Effort:** Small (0.5 sprint)

**Production Requirements:**
- [ ] Create publisher account on VS Code Marketplace
- [ ] Add extension icon and gallery banner
- [ ] Create demo GIF/video for marketplace listing
- [ ] Write marketplace description with feature highlights
- [ ] Configure automated publishing from CI/CD
- [ ] Set up version management workflow

**Acceptance Criteria:**
- Extension published and discoverable on marketplace
- Clear installation and getting started documentation
- Automated release pipeline operational

---

## 📊 Sprint Planning Summary

| Priority | Items | Estimated Effort | Status |
|----------|-------|------------------|--------|
| 🔴 P0 | 2 | 2.5 sprints | 1 in progress |
| 🟠 P1 | 4 | 6 sprints | Not started |
| 🟡 P2 | 5 | 4 sprints | Not started |
| 🟢 P3 | 1 | 1 sprint | Not started |
| **Total** | **12** | **~13.5 sprints** | |

## 🗓️ Sprint Progress

### Completed Sprints
| Sprint | Date | Focus | Tests Added |
|--------|------|-------|-------------|
| 1 | 2025-12-15 | Jest setup + PHI tests | 37 |
| 2 | 2025-12-15 | Fix failing PHI tests | +1 (38 total) |
| 3 | 2025-12-15 | HIPAA validation tests | +26 (64 total) |

### Upcoming Sprints
**Sprint 4:** C-CDA validation tests
**Sprint 5:** FHIR validation tool implementation (P1)
**Sprint 6:** Clinical calculator tests
**Sprint 7:** Marketplace preparation (P0)

---

*Last Updated: 2025-12-15*
*Created from codebase TODO analysis*
