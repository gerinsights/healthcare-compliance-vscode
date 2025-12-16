import * as vscode from 'vscode';
import { registerApiKeyCommands } from './commands/api-key-registration';
import { registerPhiCommands } from './commands/phi-commands';
import { registerValidationCommands } from './commands/validation-commands';
import { FormulaUpdateChecker } from './services/formula-update-checker';
import { AuditService } from './services/audit';
import { CacheService } from './services/cache';
import { startMcpServer } from './mcp-server';

let formulaUpdateChecker: FormulaUpdateChecker | undefined;
let auditService: AuditService | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Healthcare Compliance extension activating...');

  // Initialize services
  auditService = new AuditService();
  const cacheService = new CacheService(context);
  formulaUpdateChecker = new FormulaUpdateChecker(context, auditService);

  // Store services in context for access by tools
  context.subscriptions.push(
    { dispose: () => auditService?.dispose() },
    { dispose: () => formulaUpdateChecker?.dispose() }
  );

  // Register commands
  registerApiKeyCommands(context, auditService);
  registerPhiCommands(context, auditService);
  registerValidationCommands(context, auditService);

  // Register formula update command
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.checkFormulaUpdates', async () => {
      await formulaUpdateChecker?.checkForUpdates(false);
    })
  );

  // Register show audit log command
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.showAuditLog', () => {
      auditService?.show();
    })
  );

  // Register show calculator list command
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.showCalculatorList', () => {
      showCalculatorList(context);
    })
  );

  // Initialize background formula update checker
  await formulaUpdateChecker.initialize();

  // Start MCP server for agent integration
  startMcpServer(context, auditService, cacheService);

  // Show welcome message on first install
  const hasShownWelcome = context.globalState.get<boolean>('hasShownWelcome');
  if (!hasShownWelcome) {
    showWelcomeMessage(context);
    await context.globalState.update('hasShownWelcome', true);
  }

  // Check API key status and show gentle reminder if not configured
  checkApiKeyStatusOnStartup(context);

  auditService.log('extension_activated', { version: '0.1.0' });
  console.log('Healthcare Compliance extension activated');
}

export function deactivate(): void {
  console.log('Healthcare Compliance extension deactivating...');
  auditService?.log('extension_deactivated', {});
}

async function showWelcomeMessage(context: vscode.ExtensionContext): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    'Healthcare Compliance extension installed! Most features work without API keys.',
    'Configure API Keys',
    'View Documentation',
    'Dismiss'
  );

  if (choice === 'Configure API Keys') {
    vscode.commands.executeCommand('healthcareCompliance.showApiKeyStatus');
  } else if (choice === 'View Documentation') {
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/gerinsights/healthcare-compliance-vscode#readme'));
  }
}

function checkApiKeyStatusOnStartup(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('healthcareCompliance.apiKeys');
  const cmsKey = config.get<string>('cms');
  const openStatesKey = config.get<string>('openStates');

  // Only show reminder once per week if keys are not configured
  const lastReminder = context.globalState.get<number>('lastApiKeyReminder') || 0;
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  if (!cmsKey && !openStatesKey && Date.now() - lastReminder > oneWeekMs) {
    // Don't show on startup - too intrusive. Just update status bar if needed.
    context.globalState.update('lastApiKeyReminder', Date.now());
  }
}

function showCalculatorList(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    'calculatorList',
    'Clinical Calculators',
    vscode.ViewColumn.One,
    { enableScripts: false }
  );

  panel.webview.html = getCalculatorListHtml();
}

function getCalculatorListHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: var(--vscode-font-family); 
      padding: 20px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h1 { color: var(--vscode-textLink-foreground); }
    h2 { 
      color: var(--vscode-textPreformat-foreground);
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
      margin-top: 24px;
    }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { 
      border: 1px solid var(--vscode-panel-border); 
      padding: 8px; 
      text-align: left; 
    }
    th { background: var(--vscode-editor-selectionBackground); }
    .badge { 
      display: inline-block;
      padding: 2px 8px; 
      border-radius: 4px; 
      font-size: 11px;
      margin-left: 8px;
    }
    .open { background: #4CAF50; color: white; }
    .cited { background: #2196F3; color: white; }
    code { 
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <h1>🧮 Clinical Calculators</h1>
  <p>40+ evidence-based calculators with automatic weekly formula updates from professional society guidelines.</p>

  <h2>Cardiology</h2>
  <table>
    <tr><th>Calculator</th><th>Use Case</th><th>Guideline</th></tr>
    <tr><td><code>cha2ds2-vasc</code> <span class="badge open">Open Formula</span></td><td>AFib stroke risk</td><td>ACC/AHA 2023</td></tr>
    <tr><td><code>has-bled</code> <span class="badge open">Open Formula</span></td><td>Bleeding risk on anticoagulation</td><td>ESC 2020</td></tr>
    <tr><td><code>heart-score</code> <span class="badge cited">Cited</span></td><td>Chest pain risk stratification</td><td>Six et al. 2008</td></tr>
    <tr><td><code>wells-dvt</code> <span class="badge cited">Cited</span></td><td>DVT probability</td><td>Wells et al. 2003</td></tr>
    <tr><td><code>wells-pe</code> <span class="badge cited">Cited</span></td><td>PE probability</td><td>Wells et al. 2000</td></tr>
    <tr><td><code>timi-stemi</code> <span class="badge open">Open Formula</span></td><td>STEMI mortality risk</td><td>ACC/AHA</td></tr>
    <tr><td><code>timi-nstemi</code> <span class="badge open">Open Formula</span></td><td>NSTEMI/UA risk</td><td>ACC/AHA</td></tr>
    <tr><td><code>ascvd-risk</code> <span class="badge open">Open Formula</span></td><td>10-year ASCVD risk</td><td>ACC/AHA 2019</td></tr>
  </table>

  <h2>Pulmonology</h2>
  <table>
    <tr><th>Calculator</th><th>Use Case</th><th>Guideline</th></tr>
    <tr><td><code>curb-65</code> <span class="badge open">Open Formula</span></td><td>Pneumonia severity</td><td>IDSA/ATS 2019</td></tr>
    <tr><td><code>psi-port</code> <span class="badge cited">Cited</span></td><td>Pneumonia Severity Index</td><td>Fine et al. 1997</td></tr>
    <tr><td><code>a-a-gradient</code> <span class="badge open">Open Formula</span></td><td>Alveolar-arterial gradient</td><td>Physiology</td></tr>
    <tr><td><code>pao2-fio2</code> <span class="badge open">Open Formula</span></td><td>P/F ratio for ARDS</td><td>Berlin Definition</td></tr>
    <tr><td><code>perc-rule</code> <span class="badge cited">Cited</span></td><td>PE rule-out</td><td>Kline et al. 2004</td></tr>
  </table>

  <h2>Nephrology</h2>
  <table>
    <tr><th>Calculator</th><th>Use Case</th><th>Guideline</th></tr>
    <tr><td><code>gfr-ckd-epi</code> <span class="badge open">Open Formula</span></td><td>GFR (race-free 2021)</td><td>KDIGO 2024</td></tr>
    <tr><td><code>gfr-mdrd</code> <span class="badge open">Open Formula</span></td><td>GFR (legacy)</td><td>KDIGO</td></tr>
    <tr><td><code>gfr-cockcroft-gault</code> <span class="badge open">Open Formula</span></td><td>CrCl for drug dosing</td><td>Cockcroft 1976</td></tr>
    <tr><td><code>fena</code> <span class="badge open">Open Formula</span></td><td>Fractional excretion of sodium</td><td>Nephrology</td></tr>
    <tr><td><code>feurea</code> <span class="badge open">Open Formula</span></td><td>Fractional excretion of urea</td><td>Nephrology</td></tr>
  </table>

  <h2>Neurology</h2>
  <table>
    <tr><th>Calculator</th><th>Use Case</th><th>Guideline</th></tr>
    <tr><td><code>nihss</code> <span class="badge open">Open Formula</span></td><td>Stroke severity</td><td>AHA/ASA</td></tr>
    <tr><td><code>gcs</code> <span class="badge open">Open Formula</span></td><td>Glasgow Coma Scale</td><td>Teasdale 1974</td></tr>
    <tr><td><code>canadian-c-spine</code> <span class="badge cited">Cited</span></td><td>C-spine imaging decision</td><td>Stiell et al. 2001</td></tr>
  </table>

  <h2>Geriatrics / Long-Term Care</h2>
  <table>
    <tr><th>Calculator</th><th>Use Case</th><th>Guideline</th></tr>
    <tr><td><code>beers-criteria</code> <span class="badge open">Open Formula</span></td><td>Potentially inappropriate medications</td><td>AGS 2023</td></tr>
    <tr><td><code>morse-fall-scale</code> <span class="badge cited">Cited</span></td><td>Fall risk assessment</td><td>Morse 1989</td></tr>
    <tr><td><code>braden-scale</code> <span class="badge cited">Cited</span></td><td>Pressure ulcer risk</td><td>Bergstrom 1987</td></tr>
    <tr><td><code>katz-adl</code> <span class="badge open">Open Formula</span></td><td>Activities of daily living</td><td>Katz 1963</td></tr>
    <tr><td><code>lawton-iadl</code> <span class="badge open">Open Formula</span></td><td>Instrumental ADLs</td><td>Lawton 1969</td></tr>
  </table>

  <h2>Emergency Medicine</h2>
  <table>
    <tr><th>Calculator</th><th>Use Case</th><th>Guideline</th></tr>
    <tr><td><code>qsofa</code> <span class="badge open">Open Formula</span></td><td>Quick sepsis assessment</td><td>Sepsis-3 2016</td></tr>
    <tr><td><code>sofa</code> <span class="badge open">Open Formula</span></td><td>Sequential organ failure</td><td>Sepsis-3 2016</td></tr>
    <tr><td><code>sirs</code> <span class="badge open">Open Formula</span></td><td>Systemic inflammatory response</td><td>ACCP/SCCM 1992</td></tr>
  </table>

  <p style="margin-top: 30px; color: var(--vscode-descriptionForeground);">
    <strong>Legend:</strong> 
    <span class="badge open">Open Formula</span> = Published by professional society
    <span class="badge cited">Cited</span> = Original research with citation
  </p>
  <p style="color: var(--vscode-descriptionForeground);">
    Formulas are automatically verified weekly against source guidelines.
    Run <code>Healthcare Compliance: Check for Calculator Formula Updates</code> for manual check.
  </p>
</body>
</html>`;
}
