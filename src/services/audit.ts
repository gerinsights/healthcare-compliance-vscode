import * as vscode from 'vscode';

interface AuditLogEntry {
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
  sessionId: string;
}

export class AuditService {
  private outputChannel: vscode.LogOutputChannel;
  private sessionId: string;
  private logBuffer: AuditLogEntry[] = [];
  private readonly maxBufferSize = 1000;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Healthcare Compliance Audit', { log: true });
    this.sessionId = this.generateSessionId();
    this.log('audit_service_initialized', { sessionId: this.sessionId });
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  log(event: string, data: Record<string, unknown>): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      event,
      data: this.sanitizeData(data),
      sessionId: this.sessionId
    };

    // Log to output channel
    this.outputChannel.info(`[${entry.event}] ${JSON.stringify(entry.data)}`);

    // Add to buffer for potential export
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  warn(event: string, data: Record<string, unknown>): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      event,
      data: this.sanitizeData(data),
      sessionId: this.sessionId
    };

    this.outputChannel.warn(`[${entry.event}] ${JSON.stringify(entry.data)}`);
    this.logBuffer.push(entry);
  }

  error(event: string, data: Record<string, unknown>): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      event,
      data: this.sanitizeData(data),
      sessionId: this.sessionId
    };

    this.outputChannel.error(`[${entry.event}] ${JSON.stringify(entry.data)}`);
    this.logBuffer.push(entry);
  }

  /**
   * Sanitize data to avoid logging sensitive information
   */
  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Redact potentially sensitive keys
      if (['apiKey', 'password', 'secret', 'token', 'ssn', 'mrn'].some(
        sensitive => key.toLowerCase().includes(sensitive)
      )) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Truncate long strings
      if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = `[${value.length} chars]`;
        continue;
      }

      // Handle nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeData(value as Record<string, unknown>);
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }

  show(): void {
    this.outputChannel.show();
  }

  getRecentLogs(count = 100): AuditLogEntry[] {
    return this.logBuffer.slice(-count);
  }

  async exportLogs(): Promise<string> {
    return JSON.stringify(this.logBuffer, null, 2);
  }

  dispose(): void {
    this.log('audit_service_disposed', { entriesLogged: this.logBuffer.length });
    this.outputChannel.dispose();
  }
}
