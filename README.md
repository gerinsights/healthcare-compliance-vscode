# Healthcare Compliance VS Code Extension

Healthcare compliance agent with MCP tools for PHI detection, HIPAA validation, CMS/NPI/NDC lookups, clinical calculators, and CCDA/FHIR validation.

## Features

### 10 MCP Tools

| Tool | Description | API Key Required |
|------|-------------|------------------|
| `detect_phi` | Scan code for PHI (SSN, MRN, DOB, patient names) | No |
| `validate_hipaa` | Check code against HIPAA §164.xxx rules | No |
| `lookup_npi` | Provider lookup by NPI number | No (free API) |
| `lookup_ndc` | Drug lookup, inactive warnings, equivalents | No (free API) |
| `check_lcd` | Medicare LCD coverage validation | Optional (CMS) |
| `check_state_law` | State healthcare privacy laws | Optional (OpenStates) |
| `calculate_clinical` | 40+ evidence-based calculators | No |
| `validate_ccda` | C-CDA R2.1 document validation | No |
| `validate_fhir` | FHIR R4 US Core validation | No |
| `calculate_pdpm` | PDPM case-mix calculations | No |

### Graceful Degradation

The extension works without any API keys. Optional keys unlock additional features:

- **Without keys**: 8/10 tools fully functional, LCD and state law tools return cached/static data
- **With CMS key**: Live LCD lookups with current coverage data
- **With OpenStates key**: Live state law tracking with legislative updates

### Clinical Calculators

40+ evidence-based calculators with automatic weekly formula updates:

- **Cardiology**: CHA₂DS₂-VASc, HAS-BLED, HEART Score, Wells DVT/PE
- **Pulmonology**: CURB-65, A-a Gradient, PaO₂/FiO₂ Ratio
- **Nephrology**: GFR (CKD-EPI 2021), Cockcroft-Gault
- **Geriatrics**: Beers Criteria, Morse Fall Scale, Braden Scale
- **Emergency**: PERC Rule, Canadian C-Spine

## Installation

1. Install from VS Code Marketplace
2. (Optional) Configure API keys in Settings > Healthcare Compliance

## API Key Registration

### CMS data.cms.gov (Optional)

1. Run command: `Healthcare Compliance: Register for CMS API Key`
2. Click "Open Registration Page"
3. Complete free registration
4. Paste key into settings

### OpenStates (Optional)

1. Run command: `Healthcare Compliance: Register for OpenStates API Key`
2. Create free account at openstates.org
3. Generate API key in profile
4. Paste key into settings

## Usage

### Agent Mode

Use `@healthcare-compliance` in Copilot Chat:

```
@healthcare-compliance Check this code for PHI and HIPAA compliance
@healthcare-compliance Calculate CHA2DS2-VASc score for 75yo with HTN and diabetes
@healthcare-compliance Validate this FHIR Patient resource
```

### Commands

- `Healthcare Compliance: Scan Current File for PHI`
- `Healthcare Compliance: Scan Workspace for PHI`
- `Healthcare Compliance: Validate Current File (CCDA/FHIR)`
- `Healthcare Compliance: Show Available Clinical Calculators`
- `Healthcare Compliance: Check for Calculator Formula Updates`

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
