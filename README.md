# Healthcare Compliance VS Code Extension

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/VS%20Code-1.96%2B-blue.svg" alt="VS Code Version">
  <img src="https://img.shields.io/badge/MCP-Native-green.svg" alt="MCP Native">
</p>

A VS Code extension that provides an AI-powered healthcare compliance agent for developers building healthcare applications. Integrates with GitHub Copilot Chat to provide real-time PHI detection, HIPAA validation, clinical calculators, and regulatory guidance.

## 🎯 Why This Extension?

Healthcare software development requires constant vigilance against PHI exposure, HIPAA violations, and regulatory missteps. This extension acts as your compliance co-pilot:

- **Catch PHI before it ships** - Detects SSNs, MRNs, patient names, and 15+ other PHI types in your code
- **HIPAA-aware code reviews** - Validates data handling against 45 CFR 164.xxx requirements
- **Evidence-based clinical tools** - 40+ calculators with automatic formula updates
- **Regulatory intelligence** - NPI/NDC lookups, LCD coverage checks, state law tracking

## ✨ Features

### 10 MCP Tools

| Tool | Description | API Required |
|------|-------------|--------------|
| `detect_phi` | Scan code for PHI (SSN, MRN, DOB, patient names, etc.) | ❌ |
| `validate_hipaa` | Validate against HIPAA Privacy/Security Rules | ❌ |
| `lookup_npi` | Provider lookup from NPPES registry | ❌ Free |
| `lookup_ndc` | FDA drug lookup with inactive/recall warnings | ❌ Free |
| `check_lcd` | Medicare Local Coverage Determination lookup | ⚡ Optional |
| `check_state_law` | State healthcare privacy & telehealth laws | ⚡ Optional |
| `calculate_clinical` | 40+ evidence-based clinical calculators | ❌ |
| `validate_ccda` | C-CDA R2.1 document structure validation | ❌ |
| `validate_mds` | MDS 3.0 SNF assessment validation | ❌ |
| `explain_compliance` | HIPAA, HITECH, CMS regulation explanations | ❌ |

### PHI Detection

Detects 18 HIPAA identifier types with context-aware confidence scoring:

- **Direct Identifiers**: SSN, MRN, Medicare ID, health plan numbers
- **Contact Info**: Phone, fax, email, addresses with ZIP codes
- **Dates**: Birth dates, admission dates, death dates
- **Online Identifiers**: IP addresses, URLs, device identifiers
- **Biometric/Photo**: References to biometric data or photographs
- **Account Numbers**: Financial account numbers, certificate/license numbers

Each finding includes:
- Confidence score (0-100%)
- HIPAA identifier category
- Line number and context
- Recommended remediation

### Clinical Calculators

40+ evidence-based calculators with **automatic weekly formula updates**:

| Category | Calculators |
|----------|-------------|
| **Cardiology** | CHA₂DS₂-VASc, HAS-BLED, HEART Score, Wells DVT/PE, Framingham |
| **Pulmonology** | CURB-65, A-a Gradient, PaO₂/FiO₂, BODE Index |
| **Nephrology** | GFR (CKD-EPI 2021), Cockcroft-Gault, FENa |
| **Neurology** | NIHSS, Hunt & Hess, Glasgow Coma Scale |
| **Geriatrics** | Beers Criteria, Morse Fall Scale, Braden Scale, Katz ADL |
| **Sepsis** | qSOFA, SOFA, SIRS Criteria |
| **Emergency** | PERC Rule, Canadian C-Spine, NEXUS Criteria |
| **SNF/LTC** | PDPM case-mix classification |

### Graceful Degradation

The extension provides full functionality without any API keys:

| Configuration | Capability |
|--------------|------------|
| **No API keys** | 8/10 tools fully functional; LCD and state law tools return curated static data |
| **+ CMS API key** | Live Medicare LCD lookups with current coverage determinations |
| **+ OpenStates key** | Real-time state legislation tracking and alerts |

## 📦 Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`)
3. Search for "Healthcare Compliance"
4. Click **Install**

### From VSIX

```bash
code --install-extension healthcare-compliance-0.1.0.vsix
```

### Build from Source

```bash
git clone https://github.com/gerinsights/healthcare-compliance-vscode.git
cd healthcare-compliance-vscode
npm install
npm run compile
npm run package
```

## 🚀 Quick Start

### 1. Use the Agent in Copilot Chat

Open Copilot Chat and type `@healthcare-compliance`:

```
@healthcare-compliance Scan this file for PHI

@healthcare-compliance Is storing patient DOB in localStorage HIPAA compliant?

@healthcare-compliance Calculate CHA2DS2-VASc for 72yo female with HTN, diabetes, and prior stroke

@healthcare-compliance What are the required sections for a CCD document?

@healthcare-compliance Explain the HIPAA minimum necessary rule
```

### 2. Use Commands

Access via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| `Healthcare Compliance: Scan Current File for PHI` | Scan active editor for PHI |
| `Healthcare Compliance: Scan Workspace for PHI` | Scan all files in workspace |
| `Healthcare Compliance: Validate Current File` | Validate CCDA/FHIR documents |
| `Healthcare Compliance: Show Clinical Calculators` | List available calculators |
| `Healthcare Compliance: Check Formula Updates` | Check for calculator updates |

### 3. Configure API Keys (Optional)

For enhanced LCD and state law lookups:

1. Open Settings (`Cmd+,` / `Ctrl+,`)
2. Search for "Healthcare Compliance"
3. Enter API keys in the designated fields

Or use commands:
- `Healthcare Compliance: Register for CMS API Key`
- `Healthcare Compliance: Register for OpenStates API Key`

## 🔧 Configuration

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `healthcareCompliance.apiKeys.cms` | CMS data.cms.gov API key | `""` |
| `healthcareCompliance.apiKeys.openStates` | OpenStates API key | `""` |
| `healthcareCompliance.phi.enableRealTimeScanning` | Scan files on save | `false` |
| `healthcareCompliance.phi.excludePatterns` | Glob patterns to exclude | `["**/node_modules/**"]` |
| `healthcareCompliance.audit.enabled` | Enable audit logging | `true` |
| `healthcareCompliance.audit.retentionDays` | Audit log retention | `90` |

### API Key Registration

#### CMS data.cms.gov (Free)

1. Visit [data.cms.gov](https://data.cms.gov)
2. Create a free account
3. Generate API key in your profile
4. Add to VS Code settings

#### OpenStates (Free tier: 1,000 requests/month)

1. Visit [openstates.org](https://openstates.org)
2. Create free account
3. Generate API key
4. Add to VS Code settings

## 🏥 Use Cases

### For Healthcare App Developers

- Pre-commit PHI scanning in CI/CD pipelines
- HIPAA compliance validation during code review
- Clinical calculator integration for EHR systems
- C-CDA/FHIR document validation

### For Healthcare IT Teams

- Audit trail generation for compliance reporting
- State law compliance tracking for telehealth
- Medicare coverage verification workflows
- SNF/LTC MDS 3.0 validation

### For Clinical Informaticists

- Evidence-based calculator verification
- Clinical document standard compliance
- Medical coding guidance (ICD-10, CPT, HCPCS)

## 📋 Compliance Coverage

### HIPAA Rules

- **Privacy Rule** (45 CFR 164.500-534): PHI use/disclosure, minimum necessary, patient rights
- **Security Rule** (45 CFR 164.302-318): Administrative, physical, technical safeguards
- **Breach Notification** (45 CFR 164.400-414): Notification requirements and risk assessment

### Other Regulations

- **HITECH Act**: Breach notification, EHR incentives
- **42 CFR Part 2**: Substance use disorder records
- **State Laws**: CCPA (CA), SHIELD Act (NY), TDPSA (TX), and 47 other states

### Standards

- **C-CDA R2.1**: Consolidated CDA implementation guide
- **FHIR R4**: US Core profiles
- **MDS 3.0**: Minimum Data Set for SNF

## ⚠️ Disclaimers

> **Not Legal Advice**: This extension provides educational guidance on healthcare regulations. It does not constitute legal advice. Consult qualified legal counsel for compliance decisions.

> **Clinical Decision Support**: Clinical calculators are provided as decision support tools only. They do not replace professional clinical judgment. Always verify calculations and consult current clinical guidelines.

> **No PHI Guarantee**: While the PHI detection tool uses comprehensive pattern matching, it cannot guarantee detection of all PHI. Always implement defense-in-depth strategies.

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/gerinsights/healthcare-compliance-vscode.git
cd healthcare-compliance-vscode
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## 📄 License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

This software contains proprietary algorithms that may be covered by pending or issued patents. See [NOTICE](NOTICE) for patent and trademark information.

## 🔗 Links

- [GitHub Repository](https://github.com/gerinsights/healthcare-compliance-vscode)
- [Issue Tracker](https://github.com/gerinsights/healthcare-compliance-vscode/issues)
- [Changelog](CHANGELOG.md)

---

<p align="center">
  <strong>Built with ❤️ for healthcare developers by <a href="https://github.com/gerinsights">GerInsights</a></strong>
</p>
