import * as vscode from 'vscode';
import { AuditService } from '../services/audit';
import { detectPhi, PhiDetectionResult } from '../tools/phi-detect';

export function registerPhiCommands(
  context: vscode.ExtensionContext,
  auditService: AuditService
): void {
  // Scan current file for PHI
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.scanFilePhi', async () => {
      await scanCurrentFile(auditService);
    })
  );

  // Scan selection for PHI
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.scanSelectionPhi', async () => {
      await scanSelection(auditService);
    })
  );

  // Register document change listener for real-time PHI detection (if enabled)
  const config = vscode.workspace.getConfiguration('healthcareCompliance.phi');
  if (config.get<boolean>('realtimeScanning')) {
    registerRealtimePhiScanning(context, auditService);
  }

  // Listen for config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('healthcareCompliance.phi.realtimeScanning')) {
        // Would need to restart extension for this to take effect
        vscode.window.showInformationMessage(
          'Real-time PHI scanning setting changed. Restart VS Code to apply.'
        );
      }
    })
  );
}

async function scanCurrentFile(auditService: AuditService): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active file to scan');
    return;
  }

  const document = editor.document;
  const content = document.getText();
  const config = vscode.workspace.getConfiguration('healthcareCompliance.phi');
  const strictMode = config.get<boolean>('strictMode') ?? false;

  // Determine context from file type
  const context = getContextFromLanguage(document.languageId);

  const progress = vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Scanning for PHI...',
      cancellable: false
    },
    async () => {
      const result = await detectPhi(content, context, strictMode);
      return result;
    }
  );

  const result = await progress;
  auditService.log('phi_scan_file', {
    fileName: document.fileName,
    findingsCount: result.findings.length
  });

  if (result.findings.length === 0) {
    vscode.window.showInformationMessage('✅ No PHI detected in this file');
    return;
  }

  // Show findings with diagnostics
  showPhiDiagnostics(document, result);
  showPhiFindingsSummary(result);
}

async function scanSelection(auditService: AuditService): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  const content = editor.document.getText(selection);
  const config = vscode.workspace.getConfiguration('healthcareCompliance.phi');
  const strictMode = config.get<boolean>('strictMode') ?? false;
  const context = getContextFromLanguage(editor.document.languageId);

  const result = await detectPhi(content, context, strictMode);
  
  auditService.log('phi_scan_selection', {
    findingsCount: result.findings.length
  });

  if (result.findings.length === 0) {
    vscode.window.showInformationMessage('✅ No PHI detected in selection');
    return;
  }

  // Show findings in quick pick
  const items = result.findings.map((f) => ({
    label: `$(warning) ${f.type}`,
    description: f.match.substring(0, 30) + (f.match.length > 30 ? '...' : ''),
    detail: `${f.confidence}% confidence - ${f.explanation}`
  }));

  await vscode.window.showQuickPick(items, {
    title: `PHI Findings (${result.findings.length})`,
    placeHolder: 'Review detected PHI patterns'
  });
}

function getContextFromLanguage(languageId: string): 'code' | 'data' | 'comment' | 'general' {
  switch (languageId) {
    case 'json':
    case 'jsonc':
    case 'csv':
    case 'xml':
      return 'data';
    case 'markdown':
    case 'plaintext':
      return 'general';
    default:
      return 'code';
  }
}

// Diagnostic collection for PHI findings
let phiDiagnosticCollection: vscode.DiagnosticCollection | undefined;

function showPhiDiagnostics(
  document: vscode.TextDocument,
  result: PhiDetectionResult
): void {
  if (!phiDiagnosticCollection) {
    phiDiagnosticCollection = vscode.languages.createDiagnosticCollection('phi');
  }

  const diagnostics: vscode.Diagnostic[] = [];

  for (const finding of result.findings) {
    // Find the position of the match in the document
    const text = document.getText();
    const index = text.indexOf(finding.match);
    
    if (index >= 0) {
      const startPos = document.positionAt(index);
      const endPos = document.positionAt(index + finding.match.length);
      const range = new vscode.Range(startPos, endPos);

      const severity = finding.confidence >= 80 
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

      const diagnostic = new vscode.Diagnostic(
        range,
        `Potential PHI (${finding.type}): ${finding.explanation}`,
        severity
      );
      diagnostic.source = 'Healthcare Compliance';
      diagnostic.code = finding.type;
      diagnostics.push(diagnostic);
    }
  }

  phiDiagnosticCollection.set(document.uri, diagnostics);
}

function showPhiFindingsSummary(result: PhiDetectionResult): void {
  const highConfidence = result.findings.filter((f) => f.confidence >= 80);
  const mediumConfidence = result.findings.filter((f) => f.confidence >= 50 && f.confidence < 80);
  const lowConfidence = result.findings.filter((f) => f.confidence < 50);

  let message = `⚠️ PHI Detected: ${result.findings.length} potential finding(s)`;
  
  if (highConfidence.length > 0) {
    message += `\n  🔴 High confidence: ${highConfidence.length}`;
  }
  if (mediumConfidence.length > 0) {
    message += `\n  🟡 Medium confidence: ${mediumConfidence.length}`;
  }
  if (lowConfidence.length > 0) {
    message += `\n  🟢 Low confidence: ${lowConfidence.length}`;
  }

  vscode.window.showWarningMessage(
    message,
    'View in Problems Panel'
  ).then((choice) => {
    if (choice === 'View in Problems Panel') {
      vscode.commands.executeCommand('workbench.actions.view.problems');
    }
  });
}

function registerRealtimePhiScanning(
  context: vscode.ExtensionContext,
  auditService: AuditService
): void {
  // Debounced scanning on text change
  let scanTimeout: NodeJS.Timeout | undefined;

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (scanTimeout) {
        clearTimeout(scanTimeout);
      }

      // Only scan certain file types
      const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'json', 'yaml', 'xml'];
      if (!supportedLanguages.includes(e.document.languageId)) {
        return;
      }

      scanTimeout = setTimeout(async () => {
        const config = vscode.workspace.getConfiguration('healthcareCompliance.phi');
        const strictMode = config.get<boolean>('strictMode') ?? false;
        const context = getContextFromLanguage(e.document.languageId);

        const result = await detectPhi(e.document.getText(), context, strictMode);
        
        if (result.findings.length > 0) {
          showPhiDiagnostics(e.document, result);
        } else {
          phiDiagnosticCollection?.delete(e.document.uri);
        }
      }, 1000); // 1 second debounce
    })
  );
}
