// Mock VS Code API for testing
export const window = {
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showQuickPick: jest.fn(),
  showInputBox: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn()
  })),
  withProgress: jest.fn()
};

export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn(),
    update: jest.fn(),
    has: jest.fn()
  })),
  workspaceFolders: [],
  onDidChangeConfiguration: jest.fn()
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn()
};

export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path, scheme: 'file' })),
  parse: jest.fn()
};

export const ExtensionContext = jest.fn();

export const ProgressLocation = {
  Notification: 15,
  SourceControl: 1,
  Window: 10
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3
};

export const env = {
  openExternal: jest.fn()
};

export const languages = {
  createDiagnosticCollection: jest.fn(() => ({
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn()
  }))
};

export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3
};

export const Range = jest.fn((startLine: number, startChar: number, endLine: number, endChar: number) => ({
  start: { line: startLine, character: startChar },
  end: { line: endLine, character: endChar }
}));

export const Position = jest.fn((line: number, character: number) => ({
  line,
  character
}));

export const Diagnostic = jest.fn();
