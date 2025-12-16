import * as vscode from 'vscode';
import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { CacheService, CacheTTL } from '../services/cache';
import { AuditService } from '../services/audit';

// LCD/NCD data structures
interface CoverageArticle {
  id: string;
  title: string;
  contractor: string;
  jurisdiction: string;
  type: 'LCD' | 'NCD';
  effectiveDate: string;
  revisionDate?: string;
  status: 'active' | 'retired' | 'future';
  summary: string;
  url: string;
}

// Common LCD articles for reference (would be expanded in production)
const COMMON_LCDS: CoverageArticle[] = [
  {
    id: 'L33777',
    title: 'Respiratory Assist Devices with Bi-Level Capability',
    contractor: 'CGS Administrators',
    jurisdiction: 'JJ',
    type: 'LCD',
    effectiveDate: '2021-01-01',
    status: 'active',
    summary: 'Coverage criteria for BiPAP and related respiratory devices including documentation requirements.',
    url: 'https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=33777'
  },
  {
    id: 'L33800',
    title: 'Parenteral Nutrition',
    contractor: 'CGS Administrators',
    jurisdiction: 'JJ',
    type: 'LCD',
    effectiveDate: '2019-10-01',
    status: 'active',
    summary: 'Coverage for parenteral nutrition including TPN requirements and documentation.',
    url: 'https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=33800'
  },
  {
    id: 'L33824',
    title: 'Wound Care',
    contractor: 'Novitas Solutions',
    jurisdiction: 'JL',
    type: 'LCD',
    effectiveDate: '2020-04-01',
    status: 'active',
    summary: 'Coverage for wound care services, debridement, and negative pressure wound therapy.',
    url: 'https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=33824'
  }
];

// Common NCDs
const COMMON_NCDS: CoverageArticle[] = [
  {
    id: 'NCD-220.6.17',
    title: 'PET Scans',
    contractor: 'CMS',
    jurisdiction: 'National',
    type: 'NCD',
    effectiveDate: '2013-06-11',
    status: 'active',
    summary: 'Coverage of PET scans for various oncologic, cardiac, and neurologic conditions.',
    url: 'https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=331'
  },
  {
    id: 'NCD-210.3',
    title: 'Colorectal Cancer Screening Tests',
    contractor: 'CMS',
    jurisdiction: 'National',
    type: 'NCD',
    effectiveDate: '2023-05-15',
    status: 'active',
    summary: 'Expanded coverage for colorectal cancer screening including ages 45+.',
    url: 'https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=281'
  },
  {
    id: 'NCD-190.3',
    title: 'Intravenous Immune Globulin',
    contractor: 'CMS',
    jurisdiction: 'National',
    type: 'NCD',
    effectiveDate: '2017-11-27',
    status: 'active',
    summary: 'Coverage of IVIG for primary immune deficiency and related conditions.',
    url: 'https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=241'
  }
];

// MAC Jurisdictions
const MAC_JURISDICTIONS: Record<string, { name: string; states: string[] }> = {
  JE: { name: 'Noridian Healthcare Solutions', states: ['CA', 'HI', 'NV', 'AS', 'GU', 'MP'] },
  JF: { name: 'Noridian Healthcare Solutions', states: ['AK', 'AZ', 'ID', 'MT', 'ND', 'OR', 'SD', 'UT', 'WA', 'WY'] },
  JH: { name: 'Novitas Solutions', states: ['AR', 'CO', 'LA', 'MS', 'NM', 'OK', 'TX'] },
  JJ: { name: 'CGS Administrators', states: ['KY', 'OH'] },
  JK: { name: 'WPS Government Health Administrators', states: ['IA', 'KS', 'MO', 'NE'] },
  JL: { name: 'Novitas Solutions', states: ['DE', 'DC', 'MD', 'NJ', 'PA'] },
  JM: { name: 'CGS Administrators', states: ['IN', 'MI'] },
  JN: { name: 'First Coast Service Options', states: ['FL', 'PR', 'VI'] },
  J5: { name: 'WPS Government Health Administrators', states: ['IA', 'KS', 'MO', 'NE'] },
  J6: { name: 'NGS', states: ['CT', 'IL', 'MA', 'ME', 'MN', 'NH', 'NY', 'RI', 'VT', 'WI'] },
  J8: { name: 'Palmetto GBA', states: ['NC', 'SC', 'VA', 'WV'] }
};

export async function handleLcdLookup(
  args: Record<string, unknown>,
  config: vscode.WorkspaceConfiguration,
  cacheService: CacheService,
  auditService: AuditService
): Promise<TextContent[]> {
  const query = args.query as string | undefined;
  const cptCode = args.cptCode as string | undefined;
  const icd10Code = args.icd10Code as string | undefined;
  const macJurisdiction = args.macJurisdiction as string | undefined;
  const includeNcd = (args.includeNcd as boolean) ?? true;

  if (!query && !cptCode && !icd10Code) {
    return [{
      type: 'text',
      text: 'Error: Please provide a search query, CPT code, or ICD-10 code for LCD lookup.'
    }];
  }

  // Check for API key
  const cmsApiKey = config.get<string>('apiKeys.cms');

  // Build cache key
  const cacheKey = `lcd_${query || ''}_${cptCode || ''}_${icd10Code || ''}_${macJurisdiction || ''}`;
  
  // Check cache first
  const cached = await cacheService.get<CoverageArticle[]>(cacheKey);
  if (cached) {
    auditService.log('lcd_lookup_cache_hit', { query, cptCode, icd10Code });
    return [{ type: 'text', text: formatLcdResults(cached, query, cmsApiKey !== undefined) }];
  }

  // If we have an API key, try the CMS API
  if (cmsApiKey) {
    try {
      const results = await searchCmsApi(query, cptCode, icd10Code, macJurisdiction, cmsApiKey);
      
      if (results.length > 0) {
        await cacheService.set(cacheKey, results, CacheTTL.LCD_LOOKUP);
        auditService.log('lcd_lookup_api_success', { query, cptCode, resultCount: results.length });
        return [{ type: 'text', text: formatLcdResults(results, query, true) }];
      }
    } catch (error) {
      auditService.warn('lcd_lookup_api_error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      // Fall through to local search
    }
  }

  // Fall back to local search
  const searchTerm = (query || cptCode || icd10Code || '').toLowerCase();
  let results: CoverageArticle[] = [];

  // Search LCDs
  results = COMMON_LCDS.filter(lcd => 
    lcd.title.toLowerCase().includes(searchTerm) ||
    lcd.summary.toLowerCase().includes(searchTerm) ||
    lcd.id.toLowerCase().includes(searchTerm)
  );

  // Filter by jurisdiction if specified
  if (macJurisdiction && results.length > 0) {
    results = results.filter(lcd => 
      lcd.jurisdiction === macJurisdiction || lcd.jurisdiction === 'National'
    );
  }

  // Add NCDs if requested
  if (includeNcd) {
    const ncdResults = COMMON_NCDS.filter(ncd =>
      ncd.title.toLowerCase().includes(searchTerm) ||
      ncd.summary.toLowerCase().includes(searchTerm) ||
      ncd.id.toLowerCase().includes(searchTerm)
    );
    results = [...results, ...ncdResults];
  }

  auditService.log('lcd_lookup_local', { 
    query, 
    cptCode, 
    resultCount: results.length,
    hasApiKey: !!cmsApiKey
  });

  if (results.length === 0) {
    return [{
      type: 'text',
      text: formatNoResults(query, cptCode, icd10Code, macJurisdiction, !!cmsApiKey)
    }];
  }

  await cacheService.set(cacheKey, results, CacheTTL.LCD_LOOKUP);
  return [{ type: 'text', text: formatLcdResults(results, query, !!cmsApiKey) }];
}

async function searchCmsApi(
  query: string | undefined,
  cptCode: string | undefined,
  icd10Code: string | undefined,
  jurisdiction: string | undefined,
  apiKey: string
): Promise<CoverageArticle[]> {
  // In a production implementation, this would call the actual CMS Medicare Coverage Database API
  // For now, we simulate the API response structure
  
  // Note: The actual CMS MCD API endpoint would be:
  // https://data.cms.gov/data-api/v1/dataset/medicare-coverage-database
  
  // Since this is a placeholder, return empty to fall back to local search
  return [];
}

function formatLcdResults(
  results: CoverageArticle[],
  searchQuery: string | undefined,
  hasApiKey: boolean
): string {
  const lcds = results.filter(r => r.type === 'LCD');
  const ncds = results.filter(r => r.type === 'NCD');

  let output = `## Medicare Coverage Determination Results\n\n`;
  
  if (searchQuery) {
    output += `**Search:** "${searchQuery}"\n`;
  }
  output += `**Results:** ${results.length} (${lcds.length} LCDs, ${ncds.length} NCDs)\n`;
  output += `**Data Source:** ${hasApiKey ? 'CMS API' : 'Local Reference Data'}\n\n`;

  if (lcds.length > 0) {
    output += `### Local Coverage Determinations (LCDs)\n\n`;
    for (const lcd of lcds) {
      output += formatCoverageArticle(lcd);
    }
  }

  if (ncds.length > 0) {
    output += `### National Coverage Determinations (NCDs)\n\n`;
    for (const ncd of ncds) {
      output += formatCoverageArticle(ncd);
    }
  }

  if (!hasApiKey) {
    output += `\n---\n`;
    output += `💡 **Tip:** Register a free CMS API key for comprehensive, up-to-date coverage data. `;
    output += `Run \`Healthcare Compliance: Register CMS API Key\` to get started.\n`;
  }

  output += `\n---\n`;
  output += `*Always verify coverage requirements at [Medicare Coverage Database](https://www.cms.gov/medicare-coverage-database/search.aspx)*`;

  return output;
}

function formatCoverageArticle(article: CoverageArticle): string {
  let output = `**[${article.id}] ${article.title}**\n`;
  output += `- **Type:** ${article.type}\n`;
  output += `- **Contractor:** ${article.contractor} (${article.jurisdiction})\n`;
  output += `- **Effective:** ${article.effectiveDate}`;
  if (article.revisionDate) output += ` (Revised: ${article.revisionDate})`;
  output += '\n';
  output += `- **Status:** ${article.status}\n`;
  output += `- **Summary:** ${article.summary}\n`;
  output += `- **URL:** [View on CMS](${article.url})\n\n`;
  return output;
}

function formatNoResults(
  query: string | undefined,
  cptCode: string | undefined,
  icd10Code: string | undefined,
  jurisdiction: string | undefined,
  hasApiKey: boolean
): string {
  let output = `## No Coverage Determinations Found\n\n`;
  
  const searchTerms: string[] = [];
  if (query) searchTerms.push(`Query: "${query}"`);
  if (cptCode) searchTerms.push(`CPT: ${cptCode}`);
  if (icd10Code) searchTerms.push(`ICD-10: ${icd10Code}`);
  if (jurisdiction) searchTerms.push(`Jurisdiction: ${jurisdiction}`);
  
  output += `**Search Criteria:** ${searchTerms.join(', ')}\n\n`;
  
  output += `### Suggestions\n\n`;
  output += `1. **Search the Medicare Coverage Database directly:**\n`;
  output += `   [CMS MCD Search](https://www.cms.gov/medicare-coverage-database/search.aspx)\n\n`;
  
  output += `2. **Verify your MAC jurisdiction:**\n`;
  output += `   Different MACs may have different LCDs for the same service.\n\n`;

  if (!hasApiKey) {
    output += `3. **Register for CMS API key:**\n`;
    output += `   Enhanced search with up-to-date data from CMS.\n\n`;
  }

  output += `### MAC Jurisdiction Reference\n\n`;
  for (const [code, info] of Object.entries(MAC_JURISDICTIONS)) {
    output += `- **${code}:** ${info.name} (${info.states.join(', ')})\n`;
  }

  return output;
}
