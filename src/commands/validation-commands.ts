import * as vscode from 'vscode';
import { AuditService } from '../services/audit';

export function registerValidationCommands(
  context: vscode.ExtensionContext,
  auditService: AuditService
): void {
  // Validate C-CDA document
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.validateCcda', async () => {
      await validateCcdaDocument(auditService);
    })
  );

  // Validate MDS assessment
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.validateMds', async () => {
      await validateMdsAssessment(auditService);
    })
  );
}

async function validateCcdaDocument(auditService: AuditService): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showWarningMessage('No active document to validate');
    return;
  }

  const document = editor.document;
  
  // Check if it's an XML file
  if (document.languageId !== 'xml' && document.languageId !== 'ccda') {
    const proceed = await vscode.window.showWarningMessage(
      'This file may not be a C-CDA document. Validate anyway?',
      'Validate',
      'Cancel'
    );
    if (proceed !== 'Validate') {
      return;
    }
  }

  const content = document.getText();

  // Quick check for C-CDA markers
  if (!content.includes('ClinicalDocument') || !content.includes('urn:hl7-org:v3')) {
    vscode.window.showErrorMessage(
      'This does not appear to be a valid C-CDA document. Expected HL7 ClinicalDocument structure.'
    );
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Validating C-CDA document...',
      cancellable: false
    },
    async (progress) => {
      try {
        // Import validator dynamically
        const { validateCcda } = await import('../tools/ccda-validate');
        
        progress.report({ message: 'Checking document structure...' });
        const result = await validateCcda(content, 'ccd', true);
        
        auditService.log('ccda_validation', {
          fileName: document.fileName,
          valid: result.valid,
          errorCount: result.errors?.length ?? 0,
          warningCount: result.warnings?.length ?? 0
        });

        showValidationResults('C-CDA Validation', result);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

async function validateMdsAssessment(auditService: AuditService): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showWarningMessage('No active document to validate');
    return;
  }

  const document = editor.document;
  
  // Check if it's a JSON file
  if (document.languageId !== 'json' && document.languageId !== 'jsonc') {
    vscode.window.showWarningMessage(
      'MDS validation expects a JSON file with assessment data'
    );
    return;
  }

  let assessmentData: Record<string, string>;
  try {
    assessmentData = JSON.parse(document.getText());
  } catch {
    vscode.window.showErrorMessage('Invalid JSON in document');
    return;
  }

  // Ask for assessment type
  const assessmentType = await vscode.window.showQuickPick(
    [
      { label: 'Admission', value: 'admission' },
      { label: 'Quarterly', value: 'quarterly' },
      { label: 'Annual', value: 'annual' },
      { label: 'Significant Change', value: 'significant-change' },
      { label: 'Discharge', value: 'discharge' },
      { label: 'Entry Tracking', value: 'entry-tracking' }
    ],
    {
      title: 'MDS Assessment Type',
      placeHolder: 'Select the assessment type'
    }
  );

  if (!assessmentType) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Validating MDS assessment...',
      cancellable: false
    },
    async (progress) => {
      try {
        const { validateMds } = await import('../tools/mds-validate');
        
        progress.report({ message: 'Checking assessment data...' });
        const result = await validateMds(
          assessmentData,
          assessmentType.value as 'admission' | 'quarterly' | 'annual' | 'significant-change' | 'discharge' | 'entry-tracking'
        );
        
        auditService.log('mds_validation', {
          fileName: document.fileName,
          assessmentType: assessmentType.value,
          valid: result.valid,
          errorCount: result.errors?.length ?? 0
        });

        showValidationResults('MDS 3.0 Validation', result);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

interface ValidationResult {
  valid: boolean;
  errors?: Array<{ code: string; message: string; section?: string }>;
  warnings?: Array<{ code: string; message: string; section?: string }>;
  info?: Array<{ code: string; message: string }>;
}

function showValidationResults(title: string, result: ValidationResult): void {
  const panel = vscode.window.createWebviewPanel(
    'validationResults',
    title,
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  panel.webview.html = getValidationResultsHtml(title, result);
}

function getValidationResultsHtml(title: string, result: ValidationResult): string {
  const statusIcon = result.valid ? '✅' : '❌';
  const statusText = result.valid ? 'Valid' : 'Invalid';
  const statusColor = result.valid ? '#4CAF50' : '#f44336';

  const errorHtml = (result.errors ?? [])
    .map(
      (e) => `
        <div class="item error">
          <span class="icon">❌</span>
          <div class="content">
            <div class="code">${e.code}</div>
            <div class="message">${e.message}</div>
            ${e.section ? `<div class="section">Section: ${e.section}</div>` : ''}
          </div>
        </div>
      `
    )
    .join('');

  const warningHtml = (result.warnings ?? [])
    .map(
      (w) => `
        <div class="item warning">
          <span class="icon">⚠️</span>
          <div class="content">
            <div class="code">${w.code}</div>
            <div class="message">${w.message}</div>
            ${w.section ? `<div class="section">Section: ${w.section}</div>` : ''}
          </div>
        </div>
      `
    )
    .join('');

  const infoHtml = (result.info ?? [])
    .map(
      (i) => `
        <div class="item info">
          <span class="icon">ℹ️</span>
          <div class="content">
            <div class="code">${i.code}</div>
            <div class="message">${i.message}</div>
          </div>
        </div>
      `
    )
    .join('');

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
    h1 { 
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .status {
      font-size: 24px;
      font-weight: bold;
      color: ${statusColor};
    }
    .summary {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 12px;
      border-radius: 8px;
      margin: 16px 0;
    }
    .summary-item {
      display: inline-block;
      margin-right: 24px;
    }
    h2 {
      color: var(--vscode-textPreformat-foreground);
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
      margin-top: 24px;
    }
    .item {
      display: flex;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      margin: 8px 0;
    }
    .item.error {
      border-left: 3px solid #f44336;
    }
    .item.warning {
      border-left: 3px solid #ff9800;
    }
    .item.info {
      border-left: 3px solid #2196F3;
    }
    .icon {
      font-size: 18px;
    }
    .code {
      font-family: var(--vscode-editor-font-family);
      font-weight: bold;
      color: var(--vscode-textLink-foreground);
    }
    .message {
      margin: 4px 0;
    }
    .section {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .empty {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>${title} <span class="status">${statusIcon} ${statusText}</span></h1>
  
  <div class="summary">
    <span class="summary-item">❌ Errors: ${(result.errors ?? []).length}</span>
    <span class="summary-item">⚠️ Warnings: ${(result.warnings ?? []).length}</span>
    <span class="summary-item">ℹ️ Info: ${(result.info ?? []).length}</span>
  </div>

  ${
    (result.errors ?? []).length > 0
      ? `<h2>Errors</h2>${errorHtml}`
      : ''
  }
  
  ${
    (result.warnings ?? []).length > 0
      ? `<h2>Warnings</h2>${warningHtml}`
      : ''
  }
  
  ${
    (result.info ?? []).length > 0
      ? `<h2>Information</h2>${infoHtml}`
      : ''
  }
  
  ${
    result.valid && (result.errors ?? []).length === 0 && (result.warnings ?? []).length === 0
      ? '<p class="empty">No issues found. Document is valid.</p>'
      : ''
  }
</body>
</html>`;
}
