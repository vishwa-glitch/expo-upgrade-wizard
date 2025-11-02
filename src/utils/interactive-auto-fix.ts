import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs-extra';
import * as path from 'path';
import { log } from './logger';

export interface AutoFixIssue {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  file: string;
  issue: string;
  impact: string;
  preview: {
    before: string[];
    after: string[];
  };
  fix: () => Promise<boolean>;
}

export class InteractiveAutoFix {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async promptAndFix(issue: AutoFixIssue): Promise<boolean> {
    // Display the issue in the requested format
    console.log();
    const severityIcon = issue.severity === 'critical' ? chalk.red('🔴 CRITICAL') : 
                         issue.severity === 'warning' ? chalk.yellow('⚠️  WARNING') : 
                         chalk.blue('ℹ️  INFO');
    
    console.log(severityIcon + ': ' + chalk.bold(issue.title));
    console.log(chalk.gray('File: ') + chalk.cyan(issue.file));
    console.log(chalk.gray('Issue: ') + issue.issue);
    console.log(chalk.gray('Impact: ') + issue.impact);
    console.log();
    
    console.log(chalk.cyan('Options:'));
    console.log(chalk.white('[1] Auto-fix (apply changes automatically)'));
    console.log(chalk.white('[2] Show me what will change'));
    console.log(chalk.white('[3] Skip (I\'ll fix manually)'));
    console.log();

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (apply changes automatically)', value: 'fix' },
          { name: '2. Show me what will change', value: 'show' },
          { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);

    if (action === 'skip') {
      log.info(`Skipped. You can manually fix ${issue.file}`);
      return false;
    }

    if (action === 'show') {
      // Show the diff
      console.log();
      console.log(chalk.cyan('Changes to be made:'));
      console.log(chalk.gray('─'.repeat(60)));
      
      if (issue.preview.before.length > 0) {
        console.log(chalk.red('  - Lines to remove/change:'));
        issue.preview.before.forEach(line => {
          console.log(chalk.red(`    ${line}`));
        });
      }
      
      if (issue.preview.after.length > 0) {
        console.log(chalk.green('  + Lines to add/update:'));
        issue.preview.after.forEach(line => {
          console.log(chalk.green(`    ${line}`));
        });
      }
      
      console.log(chalk.gray('─'.repeat(60)));
      
      // For app.json, show a note about the backup
      if (issue.file === 'app.json') {
        console.log();
        console.log(chalk.gray('Note: A backup will be created at app.json.backup'));
      }
      
      console.log();

      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Apply these changes now?',
          default: true
        }
      ]);

      if (!confirmFix) {
        log.info(`Skipped. You can manually fix ${issue.file}`);
        return false;
      }
    }

    // Apply the fix
    try {
      const success = await issue.fix();
      if (success) {
        log.success(`✅ Successfully fixed ${issue.file}`);
        
        // Show backup info
        if (issue.file === 'app.json' || issue.file.includes('.gradle') || 
            issue.file.includes('metro.config') || issue.file.includes('babel.config')) {
          log.info(`  Backup saved to: ${issue.file}.backup`);
        }
        
        return true;
      } else {
        log.error(`Failed to fix ${issue.file}`);
        return false;
      }
    } catch (error) {
      log.error(`Error fixing ${issue.file}:`, error);
      return false;
    }
  }

  async runAllFixes(issues: AutoFixIssue[]): Promise<{ fixed: number; skipped: number }> {
    let fixed = 0;
    let skipped = 0;

    for (const issue of issues) {
      const result = await this.promptAndFix(issue);
      if (result) {
        fixed++;
      } else {
        skipped++;
      }
    }

    return { fixed, skipped };
  }
}
