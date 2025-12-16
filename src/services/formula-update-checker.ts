import * as vscode from 'vscode';
import { AuditService } from './audit';

interface FormulaVersion {
  calculatorId: string;
  version: string;
  lastChecked: number;
  guidelineSource: string;
  guidelineDate: string;
}

/**
 * Background service to check for clinical calculator formula updates
 * Runs weekly in the background and notifies if updates are available
 */
export class FormulaUpdateChecker {
  private context: vscode.ExtensionContext;
  private auditService: AuditService;
  private checkInterval: NodeJS.Timeout | undefined;
  private readonly STATE_KEY = 'formulaVersions';
  private readonly LAST_CHECK_KEY = 'lastFormulaCheck';
  private readonly CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(context: vscode.ExtensionContext, auditService: AuditService) {
    this.context = context;
    this.auditService = auditService;
  }

  async initialize(): Promise<void> {
    const config = vscode.workspace.getConfiguration('healthcareCompliance.calculators');
    const autoUpdate = config.get<boolean>('autoUpdate') ?? true;

    if (!autoUpdate) {
      this.auditService.log('formula_update_checker_disabled', {});
      return;
    }

    // Check if we need to run an update check
    const lastCheck = this.context.globalState.get<number>(this.LAST_CHECK_KEY) ?? 0;
    const timeSinceLastCheck = Date.now() - lastCheck;

    if (timeSinceLastCheck > this.CHECK_INTERVAL_MS) {
      // Run check after a short delay to not block startup
      setTimeout(() => this.checkForUpdates(true), 30000);
    }

    // Schedule weekly checks
    this.scheduleWeeklyChecks();
    
    this.auditService.log('formula_update_checker_initialized', {
      lastCheck: new Date(lastCheck).toISOString(),
      nextCheck: new Date(lastCheck + this.CHECK_INTERVAL_MS).toISOString()
    });
  }

  private scheduleWeeklyChecks(): void {
    // Check every 24 hours if we're past the weekly threshold
    this.checkInterval = setInterval(() => {
      const lastCheck = this.context.globalState.get<number>(this.LAST_CHECK_KEY) ?? 0;
      if (Date.now() - lastCheck > this.CHECK_INTERVAL_MS) {
        this.checkForUpdates(true);
      }
    }, 24 * 60 * 60 * 1000);
  }

  async checkForUpdates(silent: boolean): Promise<void> {
    this.auditService.log('formula_update_check_started', { silent });

    try {
      const currentVersions = this.getCurrentVersions();
      const updates = await this.fetchLatestVersions();
      
      const updatedCalculators: string[] = [];
      
      for (const update of updates) {
        const current = currentVersions.find(v => v.calculatorId === update.calculatorId);
        
        if (!current || current.version !== update.version) {
          updatedCalculators.push(update.calculatorId);
          
          // Update stored version
          await this.updateStoredVersion(update);
        }
      }

      // Update last check time
      await this.context.globalState.update(this.LAST_CHECK_KEY, Date.now());

      if (updatedCalculators.length > 0) {
        this.auditService.log('formula_updates_found', { 
          calculators: updatedCalculators,
          count: updatedCalculators.length
        });

        if (!silent) {
          this.showUpdateNotification(updatedCalculators);
        } else {
          // Show a subtle notification for background checks
          const config = vscode.workspace.getConfiguration('healthcareCompliance.calculators');
          if (config.get<boolean>('showUpdateNotifications') !== false) {
            this.showUpdateNotification(updatedCalculators);
          }
        }
      } else {
        this.auditService.log('formula_updates_none', {});
        
        if (!silent) {
          vscode.window.showInformationMessage(
            '✅ All clinical calculator formulas are up to date'
          );
        }
      }
    } catch (error) {
      this.auditService.error('formula_update_check_failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      if (!silent) {
        vscode.window.showErrorMessage(
          `Formula update check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  private getCurrentVersions(): FormulaVersion[] {
    return this.context.globalState.get<FormulaVersion[]>(this.STATE_KEY) ?? [];
  }

  private async updateStoredVersion(version: FormulaVersion): Promise<void> {
    const versions = this.getCurrentVersions();
    const index = versions.findIndex(v => v.calculatorId === version.calculatorId);
    
    if (index >= 0) {
      versions[index] = version;
    } else {
      versions.push(version);
    }

    await this.context.globalState.update(this.STATE_KEY, versions);
  }

  /**
   * Fetch latest formula versions from guideline sources
   * In production, this would check actual guideline publication APIs
   * For now, returns embedded version data
   */
  private async fetchLatestVersions(): Promise<FormulaVersion[]> {
    // In a real implementation, this would:
    // 1. Check professional society websites for guideline updates
    // 2. Parse version/date information from guidelines
    // 3. Compare against embedded calculator versions
    
    // For now, return the embedded calculator versions
    return [
      {
        calculatorId: 'cha2ds2-vasc',
        version: '2023.1',
        lastChecked: Date.now(),
        guidelineSource: 'ACC/AHA',
        guidelineDate: '2023-11-01'
      },
      {
        calculatorId: 'curb-65',
        version: '2019.1',
        lastChecked: Date.now(),
        guidelineSource: 'IDSA/ATS',
        guidelineDate: '2019-10-01'
      },
      {
        calculatorId: 'gfr-ckd-epi',
        version: '2024.1',
        lastChecked: Date.now(),
        guidelineSource: 'KDIGO',
        guidelineDate: '2024-01-01'
      },
      {
        calculatorId: 'qsofa',
        version: '2016.1',
        lastChecked: Date.now(),
        guidelineSource: 'Sepsis-3',
        guidelineDate: '2016-02-01'
      },
      {
        calculatorId: 'beers-criteria',
        version: '2023.1',
        lastChecked: Date.now(),
        guidelineSource: 'AGS',
        guidelineDate: '2023-01-01'
      },
      {
        calculatorId: 'wells-dvt',
        version: '2003.1',
        lastChecked: Date.now(),
        guidelineSource: 'Wells et al.',
        guidelineDate: '2003-01-01'
      },
      {
        calculatorId: 'nihss',
        version: '2022.1',
        lastChecked: Date.now(),
        guidelineSource: 'AHA/ASA',
        guidelineDate: '2022-01-01'
      }
    ];
  }

  private showUpdateNotification(calculators: string[]): void {
    const message = calculators.length === 1
      ? `Clinical calculator "${calculators[0]}" formula has been updated`
      : `${calculators.length} clinical calculator formulas have been updated`;

    vscode.window.showInformationMessage(
      `🧮 ${message}`,
      'View Details',
      'Show Calculators'
    ).then((choice) => {
      if (choice === 'View Details') {
        this.showUpdateDetails(calculators);
      } else if (choice === 'Show Calculators') {
        vscode.commands.executeCommand('healthcareCompliance.showCalculatorList');
      }
    });
  }

  private showUpdateDetails(calculators: string[]): void {
    const versions = this.getCurrentVersions();
    
    const details = calculators.map(id => {
      const v = versions.find(ver => ver.calculatorId === id);
      return v 
        ? `• ${id}: v${v.version} (${v.guidelineSource}, ${v.guidelineDate})`
        : `• ${id}: updated`;
    }).join('\n');

    vscode.window.showInformationMessage(
      `Updated calculators:\n${details}`,
      { modal: true }
    );
  }

  dispose(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
