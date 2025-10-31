import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { log } from './logger';

export class GitManager {
  private git: SimpleGit;
  private projectPath: string;

  constructor(projectPath?: string) {
    this.projectPath = projectPath || process.cwd();
    this.git = simpleGit(this.projectPath);
  }

  /**
   * Check if the current directory is a git repository
   */
  public async isGitRepository(): Promise<boolean> {
    try {
      await this.git.revparse(['--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check for uncommitted changes
   */
  public async hasUncommittedChanges(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return !status.isClean();
    } catch (error) {
      log.warn('Failed to check git status:', error);
      return false;
    }
  }

  /**
   * Get current branch name
   */
  public async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch (error) {
      log.error('Failed to get current branch:', error);
      throw error;
    }
  }

  /**
   * Ensure wizard directory and logs are in .gitignore
   */
  private async ensureWizardLogsIgnored(): Promise<void> {
    const gitignorePath = path.join(this.projectPath, '.gitignore');
    const patternsToIgnore = [
      '.expo-upgrade-wizard/',      // Main wizard directory (contains state backups!)
      '.expo-upgrade-wizard-logs/', // Logs directory
    ];
    
    try {
      let content = '';
      let needsUpdate = false;
      
      // Check if .gitignore exists
      if (await fs.pathExists(gitignorePath)) {
        content = await fs.readFile(gitignorePath, 'utf-8');
      }
      
      // Check which patterns need to be added
      for (const pattern of patternsToIgnore) {
        if (!content.includes(pattern)) {
          needsUpdate = true;
          // Add pattern to content
          content = content.endsWith('\n') 
            ? `${content}${pattern}\n`
            : content 
              ? `${content}\n${pattern}\n`
              : `${pattern}\n`;
          log.info(`Added ${pattern} to .gitignore`);
        }
      }
      
      // Write updated content if needed
      if (needsUpdate) {
        await fs.writeFile(gitignorePath, content, 'utf-8');
      }
    } catch (error) {
      // Non-critical error, just log it
      log.debug('Could not update .gitignore:', error);
    }
  }

  /**
   * Create a backup branch
   */
  public async createBackupBranch(skipIfClean = false): Promise<string | null> {
    try {
      // Ensure wizard logs are ignored before creating backup
      await this.ensureWizardLogsIgnored();
      
      // Check if we should skip backup
      if (skipIfClean && !(await this.hasUncommittedChanges())) {
        log.info('No uncommitted changes, skipping backup branch creation');
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const branchName = `${process.env.GIT_BACKUP_BRANCH_PREFIX || 'backup/pre-sdk-upgrade'}-${timestamp}`;
      
      // Store the current branch name to return to it later
      const currentBranch = await this.getCurrentBranch();
      
      // Check if there are uncommitted changes
      const hasChanges = await this.hasUncommittedChanges();
      
      if (hasChanges) {
        // If there are changes, commit them to the backup branch
        // Create and checkout new branch from current HEAD
        await this.git.checkoutBranch(branchName, 'HEAD');
        
        // Add and commit all changes
        await this.git.add('.');
        // Use --no-verify to bypass pre-commit hooks (like husky/lint-staged)
        const { execa } = await import('execa');
        await execa('git', ['commit', '-m', `Backup before SDK upgrade - ${timestamp}`, '--no-verify'], {
          cwd: this.projectPath
        });
        
        // Return to the original branch
        await this.git.checkout(currentBranch);
        
        log.success(`Created backup branch with uncommitted changes: ${chalk.cyan(branchName)}`);
      } else {
        // If no changes, just create a branch pointing to current HEAD
        await this.git.checkoutBranch(branchName, 'HEAD');
        await this.git.checkout(currentBranch);
        log.success(`Created backup branch: ${chalk.cyan(branchName)}`);
      }
      
      return branchName;
    } catch (error) {
      log.error('Failed to create backup branch:', error);
      throw error;
    }
  }

  /**
   * Create a zip backup (alternative to git backup)
   */
  public async createZipBackup(): Promise<string> {
    const archiver = require('archiver');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = path.join(this.projectPath, '.expo-upgrade-wizard-backups');
    const backupPath = path.join(backupDir, `backup-${timestamp}.zip`);

    await fs.ensureDir(backupDir);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        log.success(`Created backup: ${chalk.cyan(path.relative(this.projectPath, backupPath))}`);
        log.info(`Backup size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
        resolve(backupPath);
      });

      archive.on('error', (err: any) => {
        log.error('Backup creation failed:', err);
        reject(err);
      });

      archive.pipe(output);

      // Add project files, excluding common directories
      archive.glob('**/*', {
        cwd: this.projectPath,
        ignore: [
          'node_modules/**',
          '.git/**',
          'dist/**',
          'build/**',
          '.expo/**',
          '.expo-shared/**',
          '*.log',
          '.expo-upgrade-wizard-backups/**'
        ]
      });

      archive.finalize();
    });
  }

  /**
   * Commit changes with a message
   */
  public async commitChanges(message: string, skipHooks = false): Promise<void> {
    try {
      await this.git.add('.');
      if (skipHooks) {
        // Use --no-verify to bypass pre-commit hooks
        const { execa } = await import('execa');
        await execa('git', ['commit', '-m', message, '--no-verify'], {
          cwd: this.projectPath
        });
      } else {
        await this.git.commit(message);
      }
      log.success(`Committed changes: ${chalk.cyan(message)}`);
    } catch (error) {
      log.error('Failed to commit changes:', error);
      throw error;
    }
  }

  /**
   * Get diff summary
   */
  public async getDiffSummary(): Promise<string[]> {
    try {
      const diff = await this.git.diff(['--name-status']);
      return diff.split('\n').filter(line => line.trim());
    } catch (error) {
      log.warn('Failed to get diff summary:', error);
      return [];
    }
  }

  /**
   * Get list of modified files
   */
  public async getModifiedFiles(): Promise<string[]> {
    try {
      const status = await this.git.status();
      return [
        ...status.modified,
        ...status.created,
        ...status.deleted,
        ...status.renamed.map(r => r.to)
      ];
    } catch (error) {
      log.warn('Failed to get modified files:', error);
      return [];
    }
  }

  /**
   * Restore to a previous branch or commit
   */
  public async restoreBackup(branchOrCommit: string): Promise<void> {
    try {
      // Stash current changes if any
      const hasChanges = await this.hasUncommittedChanges();
      if (hasChanges) {
        await this.git.stash(['push', '-m', 'Auto-stash before restore']);
      }

      // Checkout the backup
      await this.git.checkout(branchOrCommit);
      
      log.success(`Restored to: ${chalk.cyan(branchOrCommit)}`);
    } catch (error) {
      log.error('Failed to restore backup:', error);
      throw error;
    }
  }

  /**
   * Get git status summary
   */
  public async getStatusSummary(): Promise<StatusResult> {
    return await this.git.status();
  }

  /**
   * Initialize git repository if not exists
   */
  public async initializeIfNeeded(): Promise<boolean> {
    if (await this.isGitRepository()) {
      return false;
    }

    try {
      await this.git.init();
      await this.git.add('.');
      await this.git.commit('Initial commit');
      log.success('Initialized git repository');
      return true;
    } catch (error) {
      log.error('Failed to initialize git repository:', error);
      throw error;
    }
  }

  /**
   * Get current commit hash
   */
  public async getCurrentCommit(): Promise<string> {
    try {
      const commit = await this.git.revparse(['HEAD']);
      return commit.trim();
    } catch (error) {
      log.warn('Failed to get current commit:', error);
      return '';
    }
  }

  /**
   * Check if working directory is clean
   */
  public async isWorkingDirectoryClean(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return status.isClean();
    } catch (error) {
      log.warn('Failed to check working directory status:', error);
      return false;
    }
  }

  /**
   * Reset to a specific commit
   */
  public async resetToCommit(commitHash: string): Promise<void> {
    try {
      // Use checkout to reset to a specific commit
      await this.git.checkout(commitHash);
      log.info(`Reset to commit: ${chalk.cyan(commitHash.substring(0, 8))}`);
    } catch (error) {
      log.error('Failed to reset to commit:', error);
      throw error;
    }
  }
}
