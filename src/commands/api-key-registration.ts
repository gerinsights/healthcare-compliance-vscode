import * as vscode from 'vscode';
import { AuditService } from '../services/audit';

const CMS_API_KEY_REGISTRATION_URL = 'https://data.cms.gov/api-keys';
const OPENSTATES_API_KEY_REGISTRATION_URL = 'https://openstates.org/accounts/signup/';

export function registerApiKeyCommands(
  context: vscode.ExtensionContext,
  auditService: AuditService
): void {
  // Show API key status
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.showApiKeyStatus', async () => {
      await showApiKeyStatus(context, auditService);
    })
  );

  // Register CMS API key
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.registerCmsApiKey', async () => {
      await registerCmsApiKey(context, auditService);
    })
  );

  // Register OpenStates API key
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.registerOpenStatesApiKey', async () => {
      await registerOpenStatesApiKey(context, auditService);
    })
  );

  // Clear all API keys
  context.subscriptions.push(
    vscode.commands.registerCommand('healthcareCompliance.clearApiKeys', async () => {
      await clearApiKeys(context, auditService);
    })
  );
}

async function showApiKeyStatus(
  context: vscode.ExtensionContext,
  auditService: AuditService
): Promise<void> {
  const config = vscode.workspace.getConfiguration('healthcareCompliance.apiKeys');
  const cmsKey = config.get<string>('cms');
  const openStatesKey = config.get<string>('openStates');

  const cmsStatus = cmsKey ? '✅ Configured' : '⚪ Not configured (optional)';
  const openStatesStatus = openStatesKey ? '✅ Configured' : '⚪ Not configured (optional)';

  const panel = vscode.window.createWebviewPanel(
    'apiKeyStatus',
    'Healthcare Compliance - API Key Status',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getApiKeyStatusHtml(cmsStatus, openStatesStatus, !!cmsKey, !!openStatesKey);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'registerCms':
          vscode.commands.executeCommand('healthcareCompliance.registerCmsApiKey');
          break;
        case 'registerOpenStates':
          vscode.commands.executeCommand('healthcareCompliance.registerOpenStatesApiKey');
          break;
        case 'clearKeys':
          vscode.commands.executeCommand('healthcareCompliance.clearApiKeys');
          panel.dispose();
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  auditService.log('api_key_status_viewed', {
    cmsConfigured: !!cmsKey,
    openStatesConfigured: !!openStatesKey
  });
}

async function registerCmsApiKey(
  context: vscode.ExtensionContext,
  auditService: AuditService
): Promise<void> {
  // Step 1: Offer to open registration page
  const openRegistration = await vscode.window.showInformationMessage(
    'CMS API keys are free and provide enhanced access to Medicare coverage data. Would you like to open the registration page?',
    'Open CMS Registration',
    'I have a key',
    'Cancel'
  );

  if (openRegistration === 'Cancel' || !openRegistration) {
    return;
  }

  if (openRegistration === 'Open CMS Registration') {
    await vscode.env.openExternal(vscode.Uri.parse(CMS_API_KEY_REGISTRATION_URL));
    
    // Wait for user to return with key
    const proceed = await vscode.window.showInformationMessage(
      'After registering, you will receive an API key via email. Return here to enter it.',
      'Enter API Key',
      'Cancel'
    );
    
    if (proceed !== 'Enter API Key') {
      return;
    }
  }

  // Step 2: Prompt for API key
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter your CMS data.cms.gov API key',
    placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    password: true,
    validateInput: (value) => {
      if (!value) {
        return 'API key is required';
      }
      // CMS keys are UUIDs
      if (!/^[a-f0-9-]{36}$/i.test(value)) {
        return 'Invalid format. CMS API keys are UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)';
      }
      return null;
    }
  });

  if (!apiKey) {
    return;
  }

  // Step 3: Validate the key by making a test request
  const validating = vscode.window.setStatusBarMessage('$(sync~spin) Validating CMS API key...');
  
  try {
    const isValid = await validateCmsApiKey(apiKey);
    validating.dispose();

    if (!isValid) {
      vscode.window.showErrorMessage('Invalid CMS API key. Please check the key and try again.');
      auditService.log('cms_api_key_validation_failed', {});
      return;
    }

    // Step 4: Store the key in settings
    await vscode.workspace.getConfiguration('healthcareCompliance.apiKeys').update(
      'cms',
      apiKey,
      vscode.ConfigurationTarget.Global
    );

    vscode.window.showInformationMessage('CMS API key saved successfully! Enhanced LCD/NCD lookups are now available.');
    auditService.log('cms_api_key_registered', {});

  } catch (error) {
    validating.dispose();
    vscode.window.showErrorMessage(`Error validating CMS API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    auditService.log('cms_api_key_validation_error', { error: String(error) });
  }
}

async function validateCmsApiKey(apiKey: string): Promise<boolean> {
  try {
    // Make a simple test request to verify the key works
    const response = await fetch('https://data.cms.gov/data-api/v1/dataset', {
      headers: {
        'X-API-Key': apiKey
      }
    });
    return response.ok || response.status === 200;
  } catch {
    // If the request fails, assume the key might still be valid
    // (could be network issues)
    return true;
  }
}

async function registerOpenStatesApiKey(
  context: vscode.ExtensionContext,
  auditService: AuditService
): Promise<void> {
  // Step 1: Explain the benefit and offer to open registration
  const openRegistration = await vscode.window.showInformationMessage(
    'OpenStates provides access to state healthcare legislation tracking. Free tier: 1000 requests/month. Would you like to register?',
    'Open OpenStates Signup',
    'I have a key',
    'Cancel'
  );

  if (openRegistration === 'Cancel' || !openRegistration) {
    return;
  }

  if (openRegistration === 'Open OpenStates Signup') {
    await vscode.env.openExternal(vscode.Uri.parse(OPENSTATES_API_KEY_REGISTRATION_URL));
    
    const proceed = await vscode.window.showInformationMessage(
      'After creating an account, go to your profile to get your API key. Return here to enter it.',
      'Enter API Key',
      'Cancel'
    );
    
    if (proceed !== 'Enter API Key') {
      return;
    }
  }

  // Step 2: Prompt for API key
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter your OpenStates API key',
    placeHolder: 'Your OpenStates API key',
    password: true,
    validateInput: (value) => {
      if (!value) {
        return 'API key is required';
      }
      if (value.length < 20) {
        return 'API key seems too short';
      }
      return null;
    }
  });

  if (!apiKey) {
    return;
  }

  // Step 3: Validate the key
  const validating = vscode.window.setStatusBarMessage('$(sync~spin) Validating OpenStates API key...');
  
  try {
    const isValid = await validateOpenStatesApiKey(apiKey);
    validating.dispose();

    if (!isValid) {
      vscode.window.showErrorMessage('Invalid OpenStates API key. Please check the key and try again.');
      auditService.log('openstates_api_key_validation_failed', {});
      return;
    }

    // Step 4: Store the key
    await vscode.workspace.getConfiguration('healthcareCompliance.apiKeys').update(
      'openStates',
      apiKey,
      vscode.ConfigurationTarget.Global
    );

    vscode.window.showInformationMessage('OpenStates API key saved successfully! State law lookups are now available.');
    auditService.log('openstates_api_key_registered', {});

  } catch (error) {
    validating.dispose();
    vscode.window.showErrorMessage(`Error validating OpenStates API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    auditService.log('openstates_api_key_validation_error', { error: String(error) });
  }
}

async function validateOpenStatesApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://v3.openstates.org/jurisdictions', {
      headers: {
        'X-API-Key': apiKey
      }
    });
    return response.ok;
  } catch {
    return true; // Assume valid if network issues
  }
}

async function clearApiKeys(
  context: vscode.ExtensionContext,
  auditService: AuditService
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    'Are you sure you want to clear all API keys? Features requiring API keys will fall back to limited functionality.',
    'Clear All Keys',
    'Cancel'
  );

  if (confirm !== 'Clear All Keys') {
    return;
  }

  const config = vscode.workspace.getConfiguration('healthcareCompliance.apiKeys');
  await config.update('cms', undefined, vscode.ConfigurationTarget.Global);
  await config.update('openStates', undefined, vscode.ConfigurationTarget.Global);

  vscode.window.showInformationMessage('All API keys have been cleared.');
  auditService.log('api_keys_cleared', {});
}

function getApiKeyStatusHtml(
  cmsStatus: string,
  openStatesStatus: string,
  cmsConfigured: boolean,
  openStatesConfigured: boolean
): string {
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
    .api-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      background: var(--vscode-editor-inactiveSelectionBackground);
    }
    .api-card h3 {
      margin-top: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status {
      font-size: 14px;
      margin: 8px 0;
    }
    .features {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin: 8px 0;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 8px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .info-box {
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      border-radius: 4px;
      padding: 12px;
      margin: 16px 0;
    }
    .free-badge {
      background: #4CAF50;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <h1>🔑 API Key Status</h1>
  
  <div class="info-box">
    <strong>Note:</strong> Most features work without API keys. API keys are optional and enhance specific tools.
  </div>

  <div class="api-card">
    <h3>🏛️ CMS Data API <span class="free-badge">FREE</span></h3>
    <div class="status">${cmsStatus}</div>
    <div class="features">
      <strong>Enables:</strong> Enhanced LCD/NCD lookups, Medicare coverage determination search, utilization data
    </div>
    <div class="features">
      <strong>Without key:</strong> Basic LCD lookup from cached data, manual search guidance
    </div>
    ${!cmsConfigured ? '<button onclick="registerCms()">Register CMS Key</button>' : '<span style="color: var(--vscode-testing-iconPassed)">✓ Configured</span>'}
  </div>

  <div class="api-card">
    <h3>🏛️ OpenStates API <span class="free-badge">FREE (1000/mo)</span></h3>
    <div class="status">${openStatesStatus}</div>
    <div class="features">
      <strong>Enables:</strong> State healthcare legislation tracking, bill status, voting records
    </div>
    <div class="features">
      <strong>Without key:</strong> Links to state legislature websites, manual search guidance
    </div>
    ${!openStatesConfigured ? '<button onclick="registerOpenStates()">Register OpenStates Key</button>' : '<span style="color: var(--vscode-testing-iconPassed)">✓ Configured</span>'}
  </div>

  <h2>Free APIs (No Key Required)</h2>
  <div class="api-card">
    <h3>✅ NPPES NPI Registry</h3>
    <div class="features">Provider lookup, NPI validation, taxonomy codes - <strong>Always available</strong></div>
  </div>
  <div class="api-card">
    <h3>✅ FDA NDC Directory</h3>
    <div class="features">Drug lookup, NDC codes, manufacturer info - <strong>Always available</strong></div>
  </div>

  ${(cmsConfigured || openStatesConfigured) ? '<button class="secondary" onclick="clearKeys()">Clear All API Keys</button>' : ''}

  <script>
    const vscode = acquireVsCodeApi();
    function registerCms() { vscode.postMessage({ command: 'registerCms' }); }
    function registerOpenStates() { vscode.postMessage({ command: 'registerOpenStates' }); }
    function clearKeys() { vscode.postMessage({ command: 'clearKeys' }); }
  </script>
</body>
</html>`;
}
