import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { CacheService, CacheTTL } from '../services/cache';
import { AuditService } from '../services/audit';

const FDA_NDC_API_URL = 'https://api.fda.gov/drug/ndc.json';

interface FdaNdcResponse {
  meta: {
    results: {
      total: number;
    };
  };
  results: FdaNdcProduct[];
}

interface FdaNdcProduct {
  product_ndc: string;
  generic_name: string;
  brand_name?: string;
  labeler_name: string;
  dosage_form: string;
  route: string[];
  marketing_start_date: string;
  marketing_end_date?: string;
  listing_expiration_date?: string;
  product_type: string;
  marketing_category: string;
  active_ingredients: Array<{
    name: string;
    strength: string;
  }>;
  packaging: Array<{
    package_ndc: string;
    description: string;
  }>;
  pharm_class?: string[];
  dea_schedule?: string;
  application_number?: string;
}

export async function handleNdcLookup(
  args: Record<string, unknown>,
  cacheService: CacheService,
  auditService: AuditService
): Promise<TextContent[]> {
  const ndc = args.ndc as string | undefined;
  const drugName = args.drugName as string | undefined;
  const manufacturer = args.manufacturer as string | undefined;

  if (!ndc && !drugName) {
    return [{
      type: 'text',
      text: 'Error: Either NDC code or drug name is required for lookup.'
    }];
  }

  // Check cache for NDC lookup
  if (ndc) {
    const normalizedNdc = normalizeNdc(ndc);
    const cacheKey = `ndc_${normalizedNdc}`;
    const cached = await cacheService.get<FdaNdcProduct>(cacheKey);
    if (cached) {
      auditService.log('ndc_lookup_cache_hit', { ndc: normalizedNdc });
      return [{ type: 'text', text: formatDrugResult(cached) }];
    }
  }

  try {
    // Build search query
    let searchQuery = '';
    
    if (ndc) {
      const normalizedNdc = normalizeNdc(ndc);
      searchQuery = `product_ndc:"${normalizedNdc}" OR packaging.package_ndc:"${normalizedNdc}"`;
    } else {
      const terms: string[] = [];
      
      if (drugName) {
        terms.push(`(generic_name:"${drugName}" OR brand_name:"${drugName}")`);
      }
      
      if (manufacturer) {
        terms.push(`labeler_name:"${manufacturer}"`);
      }
      
      searchQuery = terms.join(' AND ');
    }

    const url = `${FDA_NDC_API_URL}?search=${encodeURIComponent(searchQuery)}&limit=10`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return [{
          type: 'text',
          text: 'No drugs found matching the search criteria.'
        }];
      }
      throw new Error(`FDA API returned ${response.status}`);
    }

    const data = await response.json() as FdaNdcResponse;
    
    if (data.meta.results.total === 0) {
      auditService.log('ndc_lookup_no_results', { ndc, drugName, manufacturer });
      return [{
        type: 'text',
        text: 'No drugs found matching the search criteria.'
      }];
    }

    // Cache single NDC lookups
    if (ndc && data.results.length === 1) {
      await cacheService.set(`ndc_${normalizeNdc(ndc)}`, data.results[0], CacheTTL.NDC_LOOKUP);
    }

    auditService.log('ndc_lookup_success', { 
      ndc, 
      drugName, 
      resultCount: data.meta.results.total 
    });

    // Format results
    if (data.results.length === 1) {
      return [{ type: 'text', text: formatDrugResult(data.results[0]) }];
    }

    // Multiple results
    const summary = data.results.map(formatDrugSummary).join('\n\n');
    const footer = data.meta.results.total > 10 
      ? `\n\n*Showing first 10 of ${data.meta.results.total} results. Refine your search for more specific results.*`
      : '';

    return [{
      type: 'text',
      text: `## NDC Search Results (${data.meta.results.total} found)\n\n${summary}${footer}`
    }];

  } catch (error) {
    auditService.error('ndc_lookup_error', { 
      ndc, 
      drugName, 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    return [{
      type: 'text',
      text: `Error querying FDA NDC Directory: ${error instanceof Error ? error.message : 'Unknown error'}`
    }];
  }
}

/**
 * Normalize NDC to 10-digit format (5-4-1 or 5-4-2)
 * Handles various input formats: 4-4-2, 5-3-2, 5-4-1, 5-4-2, plain
 */
function normalizeNdc(ndc: string): string {
  // Remove non-numeric characters except hyphens
  const cleaned = ndc.replace(/[^0-9-]/g, '');
  
  // If already has hyphens, validate format
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    if (parts.length === 3) {
      // Normalize to 5-4-2 format
      return `${parts[0].padStart(5, '0')}-${parts[1].padStart(4, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return cleaned;
  }
  
  // Plain format - try to parse based on length
  const digits = cleaned.replace(/-/g, '');
  if (digits.length === 10) {
    // Assume 5-4-1 format
    return `${digits.slice(0, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
  } else if (digits.length === 11) {
    // Assume 5-4-2 format
    return `${digits.slice(0, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  
  return cleaned;
}

function formatDrugResult(drug: FdaNdcProduct): string {
  let result = `## Drug Information\n\n`;
  
  result += `**NDC:** ${drug.product_ndc}\n`;
  
  if (drug.brand_name) {
    result += `**Brand Name:** ${drug.brand_name}\n`;
  }
  
  result += `**Generic Name:** ${drug.generic_name}\n`;
  result += `**Manufacturer:** ${drug.labeler_name}\n`;
  result += `**Dosage Form:** ${drug.dosage_form}\n`;
  result += `**Route:** ${drug.route.join(', ')}\n`;
  result += `**Product Type:** ${drug.product_type}\n`;
  result += `**Marketing Category:** ${drug.marketing_category}\n`;
  
  if (drug.dea_schedule) {
    result += `**DEA Schedule:** ${drug.dea_schedule}\n`;
  }
  
  if (drug.application_number) {
    result += `**Application Number:** ${drug.application_number}\n`;
  }
  
  result += `**Marketing Start:** ${formatDate(drug.marketing_start_date)}\n`;
  
  if (drug.marketing_end_date) {
    result += `**Marketing End:** ${formatDate(drug.marketing_end_date)}\n`;
  }

  if (drug.active_ingredients && drug.active_ingredients.length > 0) {
    result += `\n### Active Ingredients\n`;
    drug.active_ingredients.forEach(ing => {
      result += `- ${ing.name}: ${ing.strength}\n`;
    });
  }

  if (drug.packaging && drug.packaging.length > 0) {
    result += `\n### Packaging\n`;
    drug.packaging.forEach(pkg => {
      result += `- **${pkg.package_ndc}**: ${pkg.description}\n`;
    });
  }

  if (drug.pharm_class && drug.pharm_class.length > 0) {
    result += `\n### Pharmacological Classes\n`;
    drug.pharm_class.forEach(cls => {
      result += `- ${cls}\n`;
    });
  }

  return result;
}

function formatDrugSummary(drug: FdaNdcProduct): string {
  const name = drug.brand_name 
    ? `${drug.brand_name} (${drug.generic_name})`
    : drug.generic_name;

  let summary = `**${drug.product_ndc}** - ${name}`;
  summary += `\n  Manufacturer: ${drug.labeler_name}`;
  summary += `\n  Form: ${drug.dosage_form}, ${drug.route.join('/')}`;
  
  if (drug.dea_schedule) {
    summary += ` [Schedule ${drug.dea_schedule}]`;
  }

  return summary;
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6)}`;
}
