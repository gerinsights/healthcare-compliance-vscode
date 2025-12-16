# Changelog

All notable changes to the Healthcare Compliance VS Code Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- FHIR R4 validation tool
- Real-time PHI scanning on file save
- VS Code Marketplace publication
- CI/CD pipeline with automated testing

## [0.1.0] - 2025-12-15

### Added

#### MCP Tools
- **PHI Detection** (`detect_phi`)
  - 18 HIPAA identifier patterns
  - Context-aware confidence scoring
  - Support for code, filename, data, and comment contexts
  - False positive reduction for common patterns

- **HIPAA Validation** (`validate_hipaa`)
  - Privacy Rule (45 CFR 164.500-534) validation
  - Security Rule (45 CFR 164.302-318) validation
  - Breach Notification (45 CFR 164.400-414) guidance
  - Risk level assessment (low/medium/high/critical)

- **NPI Lookup** (`lookup_npi`)
  - NPPES registry integration (free, no key required)
  - Provider information retrieval
  - Taxonomy and address details

- **NDC Lookup** (`lookup_ndc`)
  - FDA NDC Directory integration (free, no key required)
  - Drug information with inactive/recall warnings
  - Package and labeler details

- **LCD Lookup** (`check_lcd`)
  - Medicare Local Coverage Determination lookup
  - Optional CMS API key for live data
  - Graceful fallback to curated static data

- **State Law Lookup** (`check_state_law`)
  - State healthcare privacy laws
  - Telehealth regulations by state
  - Optional OpenStates API for live legislative tracking

- **Clinical Calculator** (`calculate_clinical`)
  - 40+ evidence-based calculators
  - Weekly automatic formula updates
  - Categories: Cardiology, Pulmonology, Nephrology, Neurology, Geriatrics, Sepsis, Emergency, SNF/LTC
  - Guideline citations and interpretation guidance

- **C-CDA Validation** (`validate_ccda`)
  - C-CDA R2.1 structure validation
  - Required section verification
  - Template ID validation by document type

- **MDS Validation** (`validate_mds`)
  - MDS 3.0 assessment validation
  - Section completeness checks
  - PDPM classification support

- **Compliance Explain** (`explain_compliance`)
  - HIPAA regulation explanations
  - HITECH Act guidance
  - CMS regulation summaries
  - State law overviews

#### VS Code Integration
- Agent definition for Copilot Chat (`@healthcare-compliance`)
- Command palette integration
- Settings UI for API key configuration
- Audit logging service
- Formula update checker with background weekly checks
- Secure API key storage via VS Code SecretStorage

#### Commands
- `Healthcare Compliance: Scan Current File for PHI`
- `Healthcare Compliance: Scan Workspace for PHI`
- `Healthcare Compliance: Validate Current File`
- `Healthcare Compliance: Show Clinical Calculators`
- `Healthcare Compliance: Check Formula Updates`
- `Healthcare Compliance: Register for CMS API Key`
- `Healthcare Compliance: Register for OpenStates API Key`
- `Healthcare Compliance: Clear Cache`
- `Healthcare Compliance: View Audit Log`

### Technical
- TypeScript implementation with strict mode
- Native VS Code MCP hosting
- Graceful degradation without API keys
- Caching service for API responses
- Comprehensive error handling

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | 2025-12-15 | Initial release with 10 MCP tools |

---

## Upgrade Notes

### Upgrading to 0.1.0

This is the initial release. No upgrade steps required.

---

## Deprecation Notices

None at this time.

---

## Security Advisories

None at this time.

---

[Unreleased]: https://github.com/gerinsights/healthcare-compliance-vscode/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gerinsights/healthcare-compliance-vscode/releases/tag/v0.1.0
