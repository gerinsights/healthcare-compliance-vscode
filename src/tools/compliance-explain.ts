import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { AuditService } from '../services/audit';

// Compliance knowledge base
const COMPLIANCE_TOPICS: Record<string, {
  title: string;
  category: string;
  summary: string;
  developer: string;
  clinical: string;
  administrative: string;
  executive: string;
  references: string[];
  relatedTopics: string[];
}> = {
  'minimum-necessary': {
    title: 'Minimum Necessary Standard',
    category: 'HIPAA Privacy',
    summary: 'HIPAA requires covered entities to make reasonable efforts to limit PHI access to the minimum amount necessary to accomplish the intended purpose.',
    developer: `**For Developers:**

The minimum necessary standard means your system must:

1. **Implement Role-Based Access Control (RBAC)**
   - Users should only see PHI relevant to their job function
   - A billing clerk doesn't need to see clinical notes
   - A nurse may need vital signs but not billing info

2. **Design API responses carefully**
   - Don't return entire patient records when only a subset is needed
   - Use field-level filtering in database queries
   - Consider GraphQL or similar for precise data fetching

3. **Log what was accessed, not just who accessed**
   - Audit trails should capture which specific data elements
   - This supports compliance audits

4. **Example Implementation:**
\`\`\`typescript
// BAD: Returns all patient data
async function getPatient(id: string) {
  return db.patients.findById(id);
}

// GOOD: Returns only requested fields based on role
async function getPatient(id: string, role: UserRole, fields: string[]) {
  const allowedFields = getAllowedFields(role);
  const requestedFields = fields.filter(f => allowedFields.includes(f));
  return db.patients.findById(id, { select: requestedFields });
}
\`\`\``,
    clinical: `**For Clinical Staff:**

The minimum necessary standard affects your daily workflow:

1. **Only access patient records you need for treatment**
   - Looking up a neighbor's record is a HIPAA violation
   - Curiosity doesn't justify access

2. **When sharing information:**
   - Share only what's needed for the specific purpose
   - A referral letter doesn't need complete history
   - Insurance verification needs specific data, not everything

3. **Exceptions exist:**
   - Treatment by healthcare providers
   - Patient-requested disclosures
   - Public health reporting
   - Law enforcement with proper documentation`,
    administrative: `**For Administrative/Compliance Staff:**

Implementing minimum necessary requires:

1. **Policy Development:**
   - Define access levels by job category
   - Document what PHI each role needs
   - Establish review processes

2. **Technical Controls:**
   - Configure EHR role templates
   - Enable audit logging
   - Regular access reviews

3. **Training:**
   - Staff must understand the standard
   - Document training completion
   - Periodic refreshers

4. **Monitoring:**
   - Random audit reviews
   - Unusual access pattern detection
   - Investigation procedures`,
    executive: `**Executive Summary:**

The minimum necessary standard (45 CFR 164.502(b)) requires organizations to limit PHI access to what's needed for a specific task. 

**Key Points:**
- Applies to uses, disclosures, and requests
- Requires documented policies and procedures
- Must implement role-based access controls
- Subject to OCR enforcement

**Risk:** Violations can result in civil penalties of $100 to $50,000 per violation, up to $1.5M annually per provision.`,
    references: [
      '45 CFR 164.502(b) - Minimum Necessary',
      '45 CFR 164.514(d) - Implementation Specifications',
      'HHS Guidance on Minimum Necessary'
    ],
    relatedTopics: ['phi', 'access-control', 'audit-logging']
  },

  'baa': {
    title: 'Business Associate Agreement',
    category: 'HIPAA Administrative',
    summary: 'A BAA is a contract required when a covered entity shares PHI with a third party (business associate) who handles it on their behalf.',
    developer: `**For Developers:**

BAAs affect your architecture and vendor choices:

1. **Cloud Providers:**
   - AWS, Azure, GCP all offer HIPAA BAAs
   - Not all services are BAA-eligible
   - AWS: S3, EC2, RDS (yes) | Mechanical Turk (no)
   - Azure: Most services | Some preview features (no)

2. **Third-Party Services:**
   - Analytics (check BAA availability)
   - Error tracking (Sentry offers BAA)
   - Email services (check before use)

3. **Development Considerations:**
\`\`\`
DO:
✓ Use BAA-covered services for PHI
✓ Verify subcontractor BAAs
✓ Document service configurations

DON'T:
✗ Send PHI to non-BAA services
✗ Use personal developer accounts
✗ Store PHI in logs sent to third parties
\`\`\`

4. **Common Mistake:**
   Using analytics tools (Google Analytics, Mixpanel) without BAAs to track user behavior in healthcare apps can expose PHI.`,
    clinical: `**For Clinical Staff:**

BAAs protect you when working with outside services:

1. **What requires a BAA:**
   - Medical billing companies
   - IT service providers with system access
   - Cloud storage providers
   - Telehealth platform vendors
   - Medical transcription services

2. **What doesn't require a BAA:**
   - Janitorial services (no PHI access)
   - Conduit services (post office, phone company)

3. **Red Flags:**
   - Vendor won't sign BAA but wants PHI access
   - New service adoption without compliance review`,
    administrative: `**For Administrative/Compliance Staff:**

BAA Management Requirements:

1. **Required Elements (45 CFR 164.504(e)):**
   - Permitted uses and disclosures
   - Safeguard requirements
   - Subcontractor flow-down
   - Breach notification obligations
   - Termination procedures
   - Return/destruction of PHI

2. **Inventory Management:**
   - Maintain BA list with contracts
   - Track BAA expiration dates
   - Annual review of relationships
   - Document terminated agreements

3. **Due Diligence:**
   - Verify BA security practices
   - Review SOC 2 reports
   - Confirm HIPAA compliance programs
   - Check breach history`,
    executive: `**Executive Summary:**

Business Associate Agreements (45 CFR 164.502(e), 164.504(e)) are mandatory contracts with any entity that creates, receives, maintains, or transmits PHI on your behalf.

**Key Points:**
- Required before sharing PHI with vendors
- Must include specific contractual provisions
- BAs are directly liable under HIPAA since 2013
- Covered entity liable for BA violations if knew of issues

**Risk:** Operating without required BAAs can result in enforcement action regardless of whether a breach occurs.`,
    references: [
      '45 CFR 164.502(e) - Business Associates',
      '45 CFR 164.504(e) - Contract Requirements',
      'HHS Business Associate Guidance',
      '78 FR 5566 - Omnibus Rule (2013)'
    ],
    relatedTopics: ['minimum-necessary', 'breach-notification', 'subcontractors']
  },

  'breach-notification': {
    title: 'Breach Notification Requirements',
    category: 'HIPAA Breach',
    summary: 'HIPAA requires covered entities and business associates to notify affected individuals, HHS, and sometimes media following a breach of unsecured PHI.',
    developer: `**For Developers:**

Breach response requires technical capabilities:

1. **Detection Systems:**
\`\`\`
Build/Enable:
- Intrusion detection systems
- Unusual access pattern alerts
- Data exfiltration monitoring
- Audit log analysis tools
\`\`\`

2. **Forensic Readiness:**
   - Comprehensive logging (who, what, when, how)
   - Log retention (6+ years recommended)
   - Tamper-evident log storage
   - Quick export capabilities

3. **Encryption = Safe Harbor:**
   - If PHI is encrypted per NIST standards
   - AND the key wasn't compromised
   - It's NOT a reportable breach
   - AES-256 for data at rest
   - TLS 1.2+ for data in transit

4. **Breach Investigation Support:**
   - Ability to identify affected records
   - Timeline reconstruction capability
   - Access to determine what was viewed`,
    clinical: `**For Clinical Staff:**

Understanding breach notification:

1. **What is a breach:**
   - Unauthorized acquisition, access, use, or disclosure
   - That compromises security or privacy of PHI
   - Unless low probability of compromise

2. **Report immediately if you notice:**
   - Unauthorized access to records
   - Lost or stolen devices with PHI
   - Misdirected faxes/emails with PHI
   - Improper disposal of records
   - Ransomware or malware

3. **Investigation will assess:**
   - Nature and extent of PHI involved
   - Who accessed it
   - Whether it was actually viewed
   - Mitigation efforts`,
    administrative: `**For Administrative/Compliance Staff:**

Breach Response Timeline:

1. **Discovery (Day 0):**
   - Date breach is known or reasonably should have been known
   - Clock starts for workforce member with responsibility

2. **Investigation (Days 1-30):**
   - Risk assessment using 4 factors
   - Determine if notification required
   - Document findings

3. **Notification (Within 60 days of discovery):**
   - **Individuals:** Written notice to affected parties
   - **HHS:** 
     - <500 affected: Annual log submission
     - ≥500 affected: Within 60 days
   - **Media:** If ≥500 in a state/jurisdiction

4. **Notice Content:**
   - Description of breach
   - Types of information involved
   - Steps individuals should take
   - What entity is doing
   - Contact procedures`,
    executive: `**Executive Summary:**

The Breach Notification Rule (45 CFR 164.400-414) requires notification following unauthorized PHI disclosure.

**Key Points:**
- 60-day notification deadline from discovery
- Tiered notification based on breach size
- Risk assessment determines reportability
- Encryption provides safe harbor

**2023 OCR Statistics:**
- 725 breaches affecting 500+ individuals
- Average notification to OCR: 52 days
- Most common: Hacking (79%)
- Average settlement: $1.5M for large breaches`,
    references: [
      '45 CFR 164.400-414 - Breach Notification Rule',
      'HHS Breach Risk Assessment Tool',
      'OCR Breach Portal',
      'NIST SP 800-111 - Storage Encryption'
    ],
    relatedTopics: ['encryption', 'incident-response', 'risk-assessment']
  },

  'pdpm': {
    title: 'PDPM (Patient-Driven Payment Model)',
    category: 'CMS SNF',
    summary: 'PDPM is the Medicare payment system for SNFs that classifies patients into payment groups based on clinical characteristics rather than volume of services.',
    developer: `**For Developers:**

PDPM affects SNF software systems:

1. **Data Requirements:**
\`\`\`
MDS Items Driving PDPM:
- Section GG: Functional abilities
- Section I: Active diagnoses (ICD-10)
- Section J: Health conditions
- Section K: Swallowing/nutrition
- Section O: Special treatments
\`\`\`

2. **Classification Logic:**
   - Physical Therapy (PT) component
   - Occupational Therapy (OT) component
   - Speech-Language Pathology (SLP) component
   - Nursing component
   - Non-Therapy Ancillary (NTA) component

3. **Calculation Considerations:**
   - Variable per diem adjustments
   - ICD-10 to clinical category mapping
   - Comorbidity scoring

4. **Integration Points:**
   - MDS 3.0 submission
   - Claims generation
   - Case mix index reporting`,
    clinical: `**For Clinical Staff:**

PDPM changes documentation requirements:

1. **What drives payment:**
   - Accurate diagnoses (ICD-10)
   - Functional status at admission
   - Cognitive status
   - Comorbidities
   - NOT therapy minutes

2. **Key Documentation:**
   - Comprehensive admission assessments
   - Section GG functional scores
   - Comorbid conditions
   - SLP swallowing assessment
   - Nursing needs

3. **Common Issues:**
   - Under-coding diagnoses
   - Incomplete GG assessments
   - Missing comorbidities
   - Inaccurate cognitive scores`,
    administrative: `**For Administrative/Compliance Staff:**

PDPM Management:

1. **Case Mix Monitoring:**
   - Track CMI by component
   - Compare to regional averages
   - Identify outliers

2. **Compliance Risks:**
   - Upcoding diagnoses
   - Inflating functional impairment
   - Adding unnecessary comorbidities
   - Manipulating assessment dates

3. **Audit Preparation:**
   - Documentation supports coding
   - Clinical rationale present
   - Inter-rater reliability
   - ADR response process

4. **PDPM Transition Planning:**
   - Staff education
   - Assessment accuracy
   - ICD-10 coding competency`,
    executive: `**Executive Summary:**

PDPM replaced RUG-IV in October 2019, shifting SNF Medicare payment from therapy volume to patient characteristics.

**Key Components:**
- Five case-mix adjusted components
- Variable per diem adjustments
- ICD-10 primary diagnosis drives classification

**Financial Impact:**
- Rewards accurate clinical assessment
- Reduces incentive for therapy volume
- NTA component captures high-cost ancillaries

**Risk:** Inaccurate MDS coding can result in overpayment recovery and False Claims Act liability.`,
    references: [
      'CMS PDPM Webpage',
      'MDS 3.0 RAI Manual',
      'PDPM ICD-10 Mapping',
      '42 CFR 413.337-343'
    ],
    relatedTopics: ['mds-30', 'snf-billing', 'case-mix']
  },

  'hipaa-security-rule': {
    title: 'HIPAA Security Rule',
    category: 'HIPAA Security',
    summary: 'The Security Rule establishes national standards for protecting ePHI through administrative, physical, and technical safeguards.',
    developer: `**For Developers:**

Technical Safeguard Implementation:

1. **Access Control (§164.312(a)):**
\`\`\`typescript
// Required implementation
- Unique user identification
- Emergency access procedure
- Automatic logoff
- Encryption/decryption (addressable)

interface UserAuth {
  uniqueId: string;      // Required
  mfa: boolean;          // Best practice
  sessionTimeout: number; // Required
  encryptionKey?: string; // Addressable
}
\`\`\`

2. **Audit Controls (§164.312(b)):**
   - Log all PHI access
   - Record user, timestamp, action, data
   - Protect logs from tampering
   - Regular review process

3. **Integrity Controls (§164.312(c)):**
   - Hash verification
   - Version control
   - Change tracking

4. **Transmission Security (§164.312(e)):**
   - TLS 1.2+ required
   - Certificate validation
   - VPN for site-to-site`,
    clinical: `**For Clinical Staff:**

Security practices that apply to you:

1. **Workstation Security:**
   - Lock screen when stepping away
   - Don't share passwords
   - Log off when done
   - Report suspicious activity

2. **Device Security:**
   - Encrypt laptops/phones with PHI
   - Don't use personal devices without approval
   - Report lost/stolen devices immediately

3. **Password Requirements:**
   - Unique passwords per system
   - Complex passwords
   - Regular changes (per policy)
   - No sticky notes!`,
    administrative: `**For Administrative/Compliance Staff:**

Security Rule Compliance Program:

1. **Administrative Safeguards:**
   - Security Officer designation
   - Workforce security procedures
   - Information access management
   - Security awareness training
   - Security incident procedures
   - Contingency plan
   - Evaluation

2. **Physical Safeguards:**
   - Facility access controls
   - Workstation use policies
   - Workstation security
   - Device and media controls

3. **Technical Safeguards:**
   - Access controls
   - Audit controls
   - Integrity controls
   - Authentication
   - Transmission security

4. **Documentation:**
   - Policies and procedures
   - Risk analysis
   - Training records
   - Incident reports`,
    executive: `**Executive Summary:**

The HIPAA Security Rule (45 CFR Part 164, Subpart C) establishes the minimum security standards for protecting ePHI.

**Structure:**
- 3 categories of safeguards
- Mix of required and addressable standards
- Risk-based implementation approach

**Key Obligations:**
- Conduct and document risk analysis
- Implement reasonable safeguards
- Train workforce
- Manage business associates
- Regular evaluation

**Enforcement:** OCR audits focus heavily on:
- Risk analysis documentation
- Security awareness training
- Access controls
- Audit logging`,
    references: [
      '45 CFR Part 164, Subpart C',
      'NIST SP 800-66 - HIPAA Security Rule Guide',
      'HHS Security Rule Guidance',
      'OCR Audit Protocol'
    ],
    relatedTopics: ['encryption', 'access-control', 'risk-analysis']
  }
};

export async function handleComplianceExplain(
  args: Record<string, unknown>,
  auditService: AuditService
): Promise<TextContent[]> {
  const topic = args.topic as string;
  const context = (args.context as string) || 'developer';
  const depth = (args.depth as string) || 'detailed';

  if (!topic) {
    return [{ type: 'text', text: formatTopicList() }];
  }

  // Normalize topic key
  const topicKey = topic.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  // Try exact match first, then fuzzy match
  let topicData = COMPLIANCE_TOPICS[topicKey];
  
  if (!topicData) {
    // Try partial match
    const matchKey = Object.keys(COMPLIANCE_TOPICS).find(key => 
      key.includes(topicKey) || topicKey.includes(key) ||
      COMPLIANCE_TOPICS[key].title.toLowerCase().includes(topic.toLowerCase())
    );
    
    if (matchKey) {
      topicData = COMPLIANCE_TOPICS[matchKey];
    }
  }

  if (!topicData) {
    auditService.log('compliance_explain_not_found', { topic });
    return [{
      type: 'text',
      text: `Topic "${topic}" not found in compliance knowledge base.\n\n${formatTopicList()}`
    }];
  }

  auditService.log('compliance_explain', { topic: topicKey, context, depth });

  return [{ type: 'text', text: formatComplianceExplanation(topicData, context, depth) }];
}

function formatTopicList(): string {
  let output = `## Healthcare Compliance Topics\n\n`;

  const categories = [...new Set(Object.values(COMPLIANCE_TOPICS).map(t => t.category))];
  
  for (const category of categories) {
    output += `### ${category}\n\n`;
    const topics = Object.entries(COMPLIANCE_TOPICS)
      .filter(([_, t]) => t.category === category);
    
    for (const [key, topic] of topics) {
      output += `- **${topic.title}** (\`${key}\`)\n`;
      output += `  ${topic.summary.substring(0, 100)}...\n`;
    }
    output += '\n';
  }

  output += `---\n`;
  output += `Use \`compliance_explain\` with \`topic: "<topic>"\` for detailed explanation.\n`;
  output += `Available contexts: \`developer\`, \`clinical\`, \`administrative\`, \`executive\``;

  return output;
}

function formatComplianceExplanation(
  topic: typeof COMPLIANCE_TOPICS[string],
  context: string,
  depth: string
): string {
  let output = `## ${topic.title}\n\n`;
  output += `**Category:** ${topic.category}\n\n`;
  output += `**Summary:** ${topic.summary}\n\n`;

  // Add context-specific content
  const contextContent = topic[context as keyof typeof topic];
  if (typeof contextContent === 'string') {
    output += contextContent + '\n\n';
  } else {
    // Default to developer context
    output += topic.developer + '\n\n';
  }

  if (depth === 'comprehensive' || depth === 'detailed') {
    output += `### References\n\n`;
    for (const ref of topic.references) {
      output += `- ${ref}\n`;
    }
    output += '\n';
  }

  if (topic.relatedTopics.length > 0) {
    output += `### Related Topics\n\n`;
    output += topic.relatedTopics.map(t => `\`${t}\``).join(', ');
    output += '\n';
  }

  output += `\n---\n`;
  output += `*This is educational content. Consult qualified legal/compliance professionals for specific guidance.*`;

  return output;
}
