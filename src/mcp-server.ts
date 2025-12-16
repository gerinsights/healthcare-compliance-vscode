import * as vscode from 'vscode';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  Tool,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { AuditService } from './services/audit';
import { CacheService } from './services/cache';

// Import tool handlers
import { handleNpiLookup } from './tools/npi-lookup';
import { handleNdcLookup } from './tools/ndc-lookup';
import { handlePhiDetect } from './tools/phi-detect';
import { handleHipaaValidate } from './tools/hipaa-validate';
import { handleCcdaValidate } from './tools/ccda-validate';
import { handleMdsValidate } from './tools/mds-validate';
import { handleLcdLookup } from './tools/lcd-lookup';
import { handleStateLawLookup } from './tools/state-law-lookup';
import { handleClinicalCalculator } from './tools/clinical-calculator';
import { handleComplianceExplain } from './tools/compliance-explain';

// MCP Tool definitions with schemas
const MCP_TOOLS: Tool[] = [
  {
    name: 'npi_lookup',
    description: 'Look up provider information from the NPPES NPI Registry. No API key required. Returns provider name, credentials, specialty, address, and taxonomy codes.',
    inputSchema: {
      type: 'object',
      properties: {
        npi: { type: 'string', description: 'The 10-digit NPI number to look up' },
        name: { type: 'string', description: 'Provider name to search (alternative to NPI)' },
        state: { type: 'string', description: 'Two-letter state code to filter results' },
        specialty: { type: 'string', description: 'Specialty/taxonomy to filter results' }
      }
    }
  },
  {
    name: 'ndc_lookup',
    description: 'Look up drug information from the FDA NDC Directory. No API key required. Returns drug name, manufacturer, dosage form, route, package info.',
    inputSchema: {
      type: 'object',
      properties: {
        ndc: { type: 'string', description: 'The NDC code (various formats accepted: 4-4-2, 5-3-2, 5-4-1, 5-4-2, or plain)' },
        drugName: { type: 'string', description: 'Drug name to search (alternative to NDC)' },
        manufacturer: { type: 'string', description: 'Manufacturer name to filter results' }
      }
    }
  },
  {
    name: 'phi_detect',
    description: 'Scan text, code, or file names for potential Protected Health Information (PHI) under HIPAA. Detects SSNs, MRNs, names, dates, addresses, phone numbers, emails, and other identifiers.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The text content to scan for PHI' },
        context: { 
          type: 'string', 
          enum: ['code', 'filename', 'comment', 'data', 'general'],
          description: 'Context type affects detection sensitivity and patterns'
        },
        strictMode: { type: 'boolean', description: 'Enable strict mode for higher sensitivity (more false positives)' }
      },
      required: ['content']
    }
  },
  {
    name: 'hipaa_validate',
    description: 'Validate data handling practices against HIPAA Privacy, Security, and Breach Notification rules. Checks encryption, access controls, audit logging, BAA requirements.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: { type: 'string', description: 'Description of the data handling scenario to validate' },
        dataElements: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'List of data elements being processed (e.g., "patient_name", "ssn", "diagnosis")'
        },
        controls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Security controls in place (e.g., "encryption_at_rest", "access_logging")'
        }
      },
      required: ['scenario']
    }
  },
  {
    name: 'ccda_validate',
    description: 'Validate C-CDA (Consolidated Clinical Document Architecture) documents for structural correctness and required elements per HL7 standards.',
    inputSchema: {
      type: 'object',
      properties: {
        document: { type: 'string', description: 'C-CDA XML document content or file path' },
        documentType: {
          type: 'string',
          enum: ['ccd', 'discharge-summary', 'progress-note', 'referral', 'care-plan', 'other'],
          description: 'Type of C-CDA document for type-specific validation'
        },
        validateCodeSystems: { type: 'boolean', description: 'Also validate OIDs and code system references' }
      },
      required: ['document']
    }
  },
  {
    name: 'mds_validate',
    description: 'Validate MDS 3.0 (Minimum Data Set) assessments for skilled nursing facilities per CMS requirements. Checks section completeness, skip patterns, and coding consistency.',
    inputSchema: {
      type: 'object',
      properties: {
        assessmentData: { 
          type: 'object', 
          description: 'MDS assessment data as key-value pairs (e.g., {"A0310A": "01", "J1800": "1"})'
        },
        assessmentType: {
          type: 'string',
          enum: ['admission', 'quarterly', 'annual', 'significant-change', 'discharge', 'entry-tracking'],
          description: 'Type of MDS assessment'
        },
        targetDate: { type: 'string', description: 'Assessment reference date (ARD) in YYYY-MM-DD format' }
      },
      required: ['assessmentData', 'assessmentType']
    }
  },
  {
    name: 'lcd_lookup',
    description: 'Look up Local Coverage Determinations (LCDs) and National Coverage Determinations (NCDs) from CMS. Optional CMS API key enhances results.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (procedure, diagnosis, or keyword)' },
        cptCode: { type: 'string', description: 'CPT code to look up coverage for' },
        icd10Code: { type: 'string', description: 'ICD-10 code to look up coverage for' },
        macJurisdiction: { type: 'string', description: 'MAC jurisdiction (e.g., "JJ", "JM") to filter results' },
        includeNcd: { type: 'boolean', description: 'Also search National Coverage Determinations' }
      }
    }
  },
  {
    name: 'state_law_lookup',
    description: 'Look up state healthcare laws, regulations, and bill status. Requires OpenStates API key for full functionality (free tier: 1000 requests/month).',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Two-letter state code (e.g., "CA", "NY")' },
        topic: { 
          type: 'string',
          enum: ['telehealth', 'privacy', 'licensing', 'medicaid', 'prescribing', 'mental-health', 'general'],
          description: 'Healthcare topic to search'
        },
        query: { type: 'string', description: 'Free-text search query for bills/laws' },
        session: { type: 'string', description: 'Legislative session (e.g., "2024")' },
        status: {
          type: 'string',
          enum: ['introduced', 'passed', 'enacted', 'vetoed', 'pending'],
          description: 'Bill status filter'
        }
      },
      required: ['state']
    }
  },
  {
    name: 'clinical_calculator',
    description: 'Run evidence-based clinical calculators with auto-updating formulas from professional society guidelines. 40+ calculators including CHA2DS2-VASc, CURB-65, GFR, qSOFA, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        calculator: { 
          type: 'string', 
          description: 'Calculator ID (e.g., "cha2ds2-vasc", "curb-65", "gfr-ckd-epi", "qsofa")'
        },
        inputs: {
          type: 'object',
          description: 'Calculator-specific input values as key-value pairs'
        },
        showFormula: { type: 'boolean', description: 'Include formula details and citations in response' }
      },
      required: ['calculator', 'inputs']
    }
  },
  {
    name: 'compliance_explain',
    description: 'Get plain-language explanations of healthcare compliance concepts, regulations, and requirements. Covers HIPAA, HITECH, CMS CoPs, Stark Law, Anti-Kickback Statute, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Compliance topic to explain (e.g., "minimum necessary", "BAA requirements", "PDPM calculation")' },
        context: {
          type: 'string',
          enum: ['developer', 'clinical', 'administrative', 'executive'],
          description: 'Audience context for tailored explanation'
        },
        depth: {
          type: 'string',
          enum: ['summary', 'detailed', 'comprehensive'],
          description: 'Level of detail in explanation'
        }
      },
      required: ['topic']
    }
  }
];

// Tool handler dispatch
type ToolContext = {
  config: vscode.WorkspaceConfiguration;
  auditService: AuditService;
  cacheService: CacheService;
  secretStorage: vscode.SecretStorage;
};

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<TextContent[]> {
  const { config, auditService, cacheService, secretStorage } = context;

  // Log tool invocation
  auditService.log('mcp_tool_called', { tool: name, args: sanitizeArgsForLog(args) });

  try {
    switch (name) {
      case 'npi_lookup':
        return await handleNpiLookup(args, cacheService, auditService);
      case 'ndc_lookup':
        return await handleNdcLookup(args, cacheService, auditService);
      case 'phi_detect':
        return await handlePhiDetect(args, config, auditService);
      case 'hipaa_validate':
        return await handleHipaaValidate(args, auditService);
      case 'ccda_validate':
        return await handleCcdaValidate(args, auditService);
      case 'mds_validate':
        return await handleMdsValidate(args, auditService);
      case 'lcd_lookup':
        return await handleLcdLookup(args, config, cacheService, auditService);
      case 'state_law_lookup':
        return await handleStateLawLookup(args, config, cacheService, auditService);
      case 'clinical_calculator':
        return await handleClinicalCalculator(args, auditService);
      case 'compliance_explain':
        return await handleComplianceExplain(args, auditService);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    auditService.log('mcp_tool_error', { tool: name, error: errorMessage });
    throw error;
  }
}

// Sanitize arguments for logging (remove potentially sensitive data)
function sanitizeArgsForLog(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (key === 'content' && typeof value === 'string' && value.length > 100) {
      sanitized[key] = `[${value.length} chars]`;
    } else if (key === 'document' && typeof value === 'string' && value.length > 100) {
      sanitized[key] = `[${value.length} chars]`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Start the MCP server
export function startMcpServer(
  context: vscode.ExtensionContext,
  auditService: AuditService,
  cacheService: CacheService
): void {
  // Create MCP server for VS Code's built-in MCP support
  const config = vscode.workspace.getConfiguration('healthcareCompliance');
  
  // Register as VS Code MCP server participant
  // VS Code will handle the transport when the agent is invoked
  
  const toolContext: ToolContext = {
    config,
    auditService,
    cacheService,
    secretStorage: context.secrets
  };

  // Register the MCP tools as VS Code commands that can be called by agents
  for (const tool of MCP_TOOLS) {
    const commandId = `healthcareCompliance.mcp.${tool.name}`;
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, async (args: Record<string, unknown>) => {
        try {
          const result = await handleToolCall(tool.name, args, toolContext);
          return result;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Healthcare Compliance: ${errorMsg}`);
          throw error;
        }
      })
    );
  }

  // Also expose tool list for discovery
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.mcp.listTools', () => {
      return MCP_TOOLS;
    })
  );

  auditService.log('mcp_server_started', { toolCount: MCP_TOOLS.length });
}

// Export for testing
export { MCP_TOOLS, handleToolCall };
