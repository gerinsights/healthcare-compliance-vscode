import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { CacheService, CacheTTL } from '../services/cache';
import { AuditService } from '../services/audit';

const NPPES_API_URL = 'https://npiregistry.cms.hhs.gov/api/';

interface NppesResult {
  result_count: number;
  results: NppesProvider[];
}

interface NppesProvider {
  number: string;
  enumeration_type: string;
  basic: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    credential?: string;
    enumeration_date: string;
    last_updated: string;
    status: string;
    name_prefix?: string;
    name_suffix?: string;
    gender?: string;
  };
  addresses: Array<{
    address_purpose: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postal_code: string;
    telephone_number?: string;
    fax_number?: string;
  }>;
  taxonomies: Array<{
    code: string;
    desc: string;
    primary: boolean;
    state?: string;
    license?: string;
  }>;
  identifiers?: Array<{
    identifier: string;
    code: string;
    desc: string;
    state?: string;
    issuer?: string;
  }>;
}

export async function handleNpiLookup(
  args: Record<string, unknown>,
  cacheService: CacheService,
  auditService: AuditService
): Promise<TextContent[]> {
  const npi = args.npi as string | undefined;
  const name = args.name as string | undefined;
  const state = args.state as string | undefined;
  const specialty = args.specialty as string | undefined;

  if (!npi && !name) {
    return [{
      type: 'text',
      text: 'Error: Either NPI number or provider name is required for lookup.'
    }];
  }

  // Check cache for NPI lookup
  if (npi) {
    const cacheKey = `npi_${npi}`;
    const cached = await cacheService.get<NppesProvider>(cacheKey);
    if (cached) {
      auditService.log('npi_lookup_cache_hit', { npi });
      return [{ type: 'text', text: formatProviderResult(cached) }];
    }
  }

  try {
    // Build query parameters
    const params = new URLSearchParams({ version: '2.1' });
    
    if (npi) {
      // Validate NPI format
      if (!/^\d{10}$/.test(npi)) {
        return [{
          type: 'text',
          text: 'Error: Invalid NPI format. NPI must be exactly 10 digits.'
        }];
      }
      params.append('number', npi);
    }
    
    if (name) {
      // Try to split into first/last name
      const nameParts = name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        params.append('first_name', nameParts[0]);
        params.append('last_name', nameParts.slice(1).join(' '));
      } else {
        // Could be organization or single name
        params.append('organization_name', name);
      }
    }
    
    if (state) {
      params.append('state', state.toUpperCase());
    }
    
    if (specialty) {
      params.append('taxonomy_description', specialty);
    }

    const response = await fetch(`${NPPES_API_URL}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`NPPES API returned ${response.status}`);
    }

    const data = await response.json() as NppesResult;
    
    if (data.result_count === 0) {
      auditService.log('npi_lookup_no_results', { npi, name, state });
      return [{
        type: 'text',
        text: 'No providers found matching the search criteria.'
      }];
    }

    // Cache single NPI lookups
    if (npi && data.results.length === 1) {
      await cacheService.set(`npi_${npi}`, data.results[0], CacheTTL.NPI_LOOKUP);
    }

    auditService.log('npi_lookup_success', { 
      npi, 
      name, 
      resultCount: data.result_count 
    });

    // Format results
    if (data.results.length === 1) {
      return [{ type: 'text', text: formatProviderResult(data.results[0]) }];
    }

    // Multiple results
    const summary = data.results.slice(0, 10).map(formatProviderSummary).join('\n\n');
    const footer = data.result_count > 10 
      ? `\n\n*Showing first 10 of ${data.result_count} results. Refine your search for more specific results.*`
      : '';

    return [{
      type: 'text',
      text: `## NPI Search Results (${data.result_count} found)\n\n${summary}${footer}`
    }];

  } catch (error) {
    auditService.error('npi_lookup_error', { 
      npi, 
      name, 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    return [{
      type: 'text',
      text: `Error querying NPPES registry: ${error instanceof Error ? error.message : 'Unknown error'}`
    }];
  }
}

function formatProviderResult(provider: NppesProvider): string {
  const isOrg = provider.enumeration_type === 'NPI-2';
  const name = isOrg 
    ? provider.basic.organization_name 
    : `${provider.basic.name_prefix || ''} ${provider.basic.first_name} ${provider.basic.last_name}${provider.basic.credential ? `, ${provider.basic.credential}` : ''}`.trim();

  const primaryTaxonomy = provider.taxonomies.find(t => t.primary) || provider.taxonomies[0];
  const practiceAddress = provider.addresses.find(a => a.address_purpose === 'LOCATION') || provider.addresses[0];

  let result = `## Provider Information\n\n`;
  result += `**NPI:** ${provider.number}\n`;
  result += `**Name:** ${name}\n`;
  result += `**Type:** ${isOrg ? 'Organization (Type 2)' : 'Individual (Type 1)'}\n`;
  
  if (provider.basic.gender) {
    result += `**Gender:** ${provider.basic.gender === 'M' ? 'Male' : 'Female'}\n`;
  }
  
  result += `**Status:** ${provider.basic.status}\n`;
  result += `**Enumeration Date:** ${provider.basic.enumeration_date}\n`;
  result += `**Last Updated:** ${provider.basic.last_updated}\n\n`;

  if (primaryTaxonomy) {
    result += `### Primary Taxonomy\n`;
    result += `- **Code:** ${primaryTaxonomy.code}\n`;
    result += `- **Description:** ${primaryTaxonomy.desc}\n`;
    if (primaryTaxonomy.license) {
      result += `- **License:** ${primaryTaxonomy.license} (${primaryTaxonomy.state})\n`;
    }
    result += '\n';
  }

  if (provider.taxonomies.length > 1) {
    result += `### Other Taxonomies\n`;
    provider.taxonomies
      .filter(t => !t.primary)
      .forEach(t => {
        result += `- ${t.code}: ${t.desc}\n`;
      });
    result += '\n';
  }

  if (practiceAddress) {
    result += `### Practice Address\n`;
    result += `${practiceAddress.address_1}\n`;
    if (practiceAddress.address_2) {
      result += `${practiceAddress.address_2}\n`;
    }
    result += `${practiceAddress.city}, ${practiceAddress.state} ${practiceAddress.postal_code}\n`;
    if (practiceAddress.telephone_number) {
      result += `Phone: ${practiceAddress.telephone_number}\n`;
    }
  }

  if (provider.identifiers && provider.identifiers.length > 0) {
    result += `\n### Other Identifiers\n`;
    provider.identifiers.forEach(id => {
      result += `- ${id.desc}: ${id.identifier}`;
      if (id.state) result += ` (${id.state})`;
      result += '\n';
    });
  }

  return result;
}

function formatProviderSummary(provider: NppesProvider): string {
  const isOrg = provider.enumeration_type === 'NPI-2';
  const name = isOrg 
    ? provider.basic.organization_name 
    : `${provider.basic.first_name} ${provider.basic.last_name}${provider.basic.credential ? `, ${provider.basic.credential}` : ''}`;

  const primaryTaxonomy = provider.taxonomies.find(t => t.primary) || provider.taxonomies[0];
  const address = provider.addresses.find(a => a.address_purpose === 'LOCATION') || provider.addresses[0];

  let summary = `**${provider.number}** - ${name}`;
  if (primaryTaxonomy) {
    summary += `\n  Specialty: ${primaryTaxonomy.desc}`;
  }
  if (address) {
    summary += `\n  Location: ${address.city}, ${address.state}`;
  }

  return summary;
}
