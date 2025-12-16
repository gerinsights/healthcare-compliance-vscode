import * as vscode from 'vscode';
import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { CacheService, CacheTTL } from '../services/cache';
import { AuditService } from '../services/audit';

interface StateLawResult {
  id: string;
  title: string;
  state: string;
  topic: string;
  status: string;
  session: string;
  summary: string;
  lastAction: string;
  lastActionDate: string;
  url: string;
}

// State healthcare resources (fallback when no API key)
const STATE_RESOURCES: Record<string, { 
  legislatureUrl: string; 
  healthDeptUrl: string;
  insuranceDeptUrl: string;
}> = {
  CA: {
    legislatureUrl: 'https://leginfo.legislature.ca.gov/',
    healthDeptUrl: 'https://www.cdph.ca.gov/',
    insuranceDeptUrl: 'https://www.insurance.ca.gov/'
  },
  NY: {
    legislatureUrl: 'https://nyassembly.gov/',
    healthDeptUrl: 'https://www.health.ny.gov/',
    insuranceDeptUrl: 'https://www.dfs.ny.gov/'
  },
  TX: {
    legislatureUrl: 'https://capitol.texas.gov/',
    healthDeptUrl: 'https://www.dshs.texas.gov/',
    insuranceDeptUrl: 'https://www.tdi.texas.gov/'
  },
  FL: {
    legislatureUrl: 'https://www.flsenate.gov/',
    healthDeptUrl: 'https://www.floridahealth.gov/',
    insuranceDeptUrl: 'https://www.myfloridacfo.com/'
  },
  IL: {
    legislatureUrl: 'https://www.ilga.gov/',
    healthDeptUrl: 'https://dph.illinois.gov/',
    insuranceDeptUrl: 'https://insurance.illinois.gov/'
  }
  // Add more states as needed
};

// Topic keywords for searching
const TOPIC_KEYWORDS: Record<string, string[]> = {
  telehealth: ['telehealth', 'telemedicine', 'remote patient', 'virtual care', 'digital health'],
  privacy: ['health privacy', 'medical records', 'patient information', 'data breach', 'HIPAA'],
  licensing: ['medical license', 'nursing license', 'healthcare provider', 'scope of practice', 'interstate compact'],
  medicaid: ['medicaid', 'medical assistance', 'managed care', 'medicaid expansion'],
  prescribing: ['prescription', 'controlled substance', 'PDMP', 'opioid', 'prescribing authority'],
  'mental-health': ['mental health', 'behavioral health', 'psychiatric', 'substance abuse', 'parity']
};

export async function handleStateLawLookup(
  args: Record<string, unknown>,
  config: vscode.WorkspaceConfiguration,
  cacheService: CacheService,
  auditService: AuditService
): Promise<TextContent[]> {
  const state = args.state as string;
  const topic = args.topic as string | undefined;
  const query = args.query as string | undefined;
  const session = args.session as string | undefined;
  const status = args.status as string | undefined;

  if (!state) {
    return [{
      type: 'text',
      text: 'Error: State code is required for state law lookup.'
    }];
  }

  // Validate state code
  if (!/^[A-Z]{2}$/.test(state.toUpperCase())) {
    return [{
      type: 'text',
      text: 'Error: Invalid state code. Please use two-letter abbreviation (e.g., "CA", "NY").'
    }];
  }

  const stateUpper = state.toUpperCase();
  const openStatesKey = config.get<string>('apiKeys.openStates');

  // Build cache key
  const cacheKey = `statelaw_${stateUpper}_${topic || ''}_${query || ''}_${session || ''}_${status || ''}`;

  // Check cache
  const cached = await cacheService.get<StateLawResult[]>(cacheKey);
  if (cached) {
    auditService.log('state_law_lookup_cache_hit', { state: stateUpper, topic });
    return [{ type: 'text', text: formatStateLawResults(stateUpper, cached, !!openStatesKey) }];
  }

  // If we have an API key, try OpenStates
  if (openStatesKey) {
    try {
      const results = await searchOpenStates(stateUpper, topic, query, session, status, openStatesKey);
      
      await cacheService.set(cacheKey, results, CacheTTL.STATE_LAW);
      auditService.log('state_law_api_success', { state: stateUpper, topic, resultCount: results.length });
      return [{ type: 'text', text: formatStateLawResults(stateUpper, results, true) }];
    } catch (error) {
      auditService.warn('state_law_api_error', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Fall through to fallback
    }
  }

  // Fallback: provide resource links
  auditService.log('state_law_fallback', { state: stateUpper, topic, hasApiKey: !!openStatesKey });
  return [{ type: 'text', text: formatStateLawFallback(stateUpper, topic, query) }];
}

async function searchOpenStates(
  state: string,
  topic: string | undefined,
  query: string | undefined,
  session: string | undefined,
  status: string | undefined,
  apiKey: string
): Promise<StateLawResult[]> {
  // Build search query
  let searchQuery = query || '';
  
  if (topic && TOPIC_KEYWORDS[topic]) {
    const keywords = TOPIC_KEYWORDS[topic];
    if (searchQuery) {
      searchQuery = `${searchQuery} ${keywords[0]}`;
    } else {
      searchQuery = keywords.join(' OR ');
    }
  }

  // OpenStates GraphQL API
  const graphqlQuery = `
    query {
      bills(
        first: 20
        jurisdiction: "${state.toLowerCase()}"
        ${searchQuery ? `searchQuery: "${searchQuery}"` : ''}
        ${session ? `session: "${session}"` : ''}
      ) {
        edges {
          node {
            id
            identifier
            title
            session {
              identifier
            }
            classification
            subject
            abstracts {
              abstract
            }
            actions {
              description
              date
            }
            sources {
              url
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://v3.openstates.org/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({ query: graphqlQuery })
  });

  if (!response.ok) {
    throw new Error(`OpenStates API returned ${response.status}`);
  }

  const data = await response.json() as {
    data: {
      bills: {
        edges: Array<{
          node: {
            id: string;
            identifier: string;
            title: string;
            session: { identifier: string };
            classification: string[];
            subject: string[];
            abstracts: Array<{ abstract: string }>;
            actions: Array<{ description: string; date: string }>;
            sources: Array<{ url: string }>;
          };
        }>;
      };
    };
  };

  return data.data.bills.edges.map(edge => {
    const bill = edge.node;
    const lastAction = bill.actions?.[0];
    
    return {
      id: bill.identifier,
      title: bill.title,
      state,
      topic: bill.subject?.[0] || 'General',
      status: bill.classification?.[0] || 'Unknown',
      session: bill.session?.identifier || '',
      summary: bill.abstracts?.[0]?.abstract || 'No summary available',
      lastAction: lastAction?.description || 'No actions recorded',
      lastActionDate: lastAction?.date || '',
      url: bill.sources?.[0]?.url || ''
    };
  });
}

function formatStateLawResults(
  state: string,
  results: StateLawResult[],
  hasApiKey: boolean
): string {
  let output = `## ${state} Healthcare Legislation\n\n`;
  output += `**Results:** ${results.length} bills found\n`;
  output += `**Data Source:** ${hasApiKey ? 'OpenStates API' : 'Cached Data'}\n\n`;

  if (results.length === 0) {
    output += `No bills found matching the search criteria.\n\n`;
    output += `### Try different search terms or check:\n`;
    output += `- [OpenStates ${state}](https://openstates.org/${state.toLowerCase()}/)\n`;
    return output;
  }

  for (const bill of results) {
    output += `### ${bill.id}: ${bill.title}\n\n`;
    output += `- **Session:** ${bill.session}\n`;
    output += `- **Status:** ${bill.status}\n`;
    output += `- **Topic:** ${bill.topic}\n`;
    output += `- **Last Action:** ${bill.lastAction}`;
    if (bill.lastActionDate) {
      output += ` (${bill.lastActionDate})`;
    }
    output += '\n';
    
    if (bill.summary && bill.summary !== 'No summary available') {
      output += `- **Summary:** ${bill.summary.substring(0, 300)}${bill.summary.length > 300 ? '...' : ''}\n`;
    }
    
    if (bill.url) {
      output += `- **Full Text:** [View Bill](${bill.url})\n`;
    }
    output += '\n';
  }

  output += `---\n`;
  output += `*Data from OpenStates.org - Updated periodically during legislative sessions*`;

  return output;
}

function formatStateLawFallback(
  state: string,
  topic: string | undefined,
  query: string | undefined
): string {
  const resources = STATE_RESOURCES[state];

  let output = `## ${state} Healthcare Legislation\n\n`;
  output += `⚠️ **API Key Required for Bill Search**\n\n`;
  output += `To search current legislation, register for a free OpenStates API key.\n`;
  output += `Run \`Healthcare Compliance: Register OpenStates API Key\` to get started.\n\n`;

  output += `### State Resources\n\n`;

  if (resources) {
    output += `**${state} Legislature:** [Official Website](${resources.legislatureUrl})\n`;
    output += `**Health Department:** [Official Website](${resources.healthDeptUrl})\n`;
    output += `**Insurance Dept:** [Official Website](${resources.insuranceDeptUrl})\n\n`;
  } else {
    output += `- [OpenStates ${state}](https://openstates.org/${state.toLowerCase()}/)\n`;
    output += `- [National Conference of State Legislatures](https://www.ncsl.org/)\n\n`;
  }

  if (topic) {
    output += `### ${formatTopic(topic)} Resources\n\n`;
    output += getTopicResources(state, topic);
  }

  output += `### Search Tips\n\n`;
  output += `1. **OpenStates Website:** [Search ${state} Bills](https://openstates.org/${state.toLowerCase()}/bills/)\n`;
  output += `2. **NCSL Health Topics:** [Healthcare Legislation Database](https://www.ncsl.org/health)\n`;
  output += `3. **State Health Notes:** [Kaiser Family Foundation](https://www.kff.org/state-category/state-health-data/)\n`;

  return output;
}

function formatTopic(topic: string): string {
  const topicNames: Record<string, string> = {
    telehealth: 'Telehealth',
    privacy: 'Health Privacy',
    licensing: 'Professional Licensing',
    medicaid: 'Medicaid',
    prescribing: 'Prescribing & Controlled Substances',
    'mental-health': 'Mental Health'
  };
  return topicNames[topic] || topic;
}

function getTopicResources(state: string, topic: string): string {
  const resources: Record<string, string> = {
    telehealth: `- [CCHP State Telehealth Laws](https://www.cchpca.org/state-telehealth-laws-and-reimbursement-policies/)
- [ATA State Policy Resource Center](https://www.americantelemed.org/)
- [NCSL Telehealth Overview](https://www.ncsl.org/health/telehealth-policy-trends-and-considerations)\n\n`,
    
    privacy: `- [NCSL Health Privacy Laws](https://www.ncsl.org/technology-and-communication/state-laws-related-to-digital-privacy)
- [HHS Health Information Privacy](https://www.hhs.gov/hipaa/for-professionals/)\n\n`,
    
    licensing: `- [Interstate Medical Licensure Compact](https://www.imlcc.org/)
- [Nurse Licensure Compact](https://www.ncsbn.org/nurse-licensure-compact.htm)
- [FSMB State Medical Board Directory](https://www.fsmb.org/contact-a-state-medical-board/)\n\n`,
    
    medicaid: `- [KFF State Medicaid Fact Sheets](https://www.kff.org/interactive/medicaid-state-fact-sheets/)
- [Medicaid.gov State Profiles](https://www.medicaid.gov/state-overviews/)\n\n`,
    
    prescribing: `- [PDMP TTAC State Profiles](https://www.pdmpassist.org/)
- [CDC Opioid Prescribing Guidelines](https://www.cdc.gov/opioids/healthcare-professionals/prescribing/)
- [DEA Diversion Control Division](https://www.deadiversion.usdoj.gov/)\n\n`,
    
    'mental-health': `- [NCSL Mental Health Topics](https://www.ncsl.org/health/mental-health)
- [SAMHSA State Resources](https://www.samhsa.gov/find-treatment)
- [Kennedy Forum Parity Portal](https://www.paritytrack.org/)\n\n`
  };

  return resources[topic] || '';
}
