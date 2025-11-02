import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Debug utility to track state folder lifecycle
 */
export class StateDebugger {
  private projectPath: string;
  private stateDir: string;
  private logFile: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = path.resolve(projectPath);
    const wizardDir = path.join(this.projectPath, '.expo-upgrade-wizard');
    this.stateDir = path.join(wizardDir, 'state');
    this.logFile = path.join(wizardDir, 'state-debug.log');
  }

  /**
   * Check if state folder exists and log details
   */
  async checkStateFolder(checkpoint: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const exists = await fs.pathExists(this.stateDir);
    
    let details = `\n[${timestamp}] CHECKPOINT: ${checkpoint}\n`;
    details += `State Dir: ${this.stateDir}\n`;
    details += `Exists: ${exists}\n`;

    if (exists) {
      try {
        const files = await fs.readdir(this.stateDir);
        details += `Files: ${files.join(', ')}\n`;
        
        for (const file of files) {
          const filePath = path.join(this.stateDir, file);
          const stats = await fs.stat(filePath);
          details += `  - ${file}: ${stats.size} bytes, modified: ${stats.mtime}\n`;
        }
      } catch (error) {
        details += `Error reading directory: ${error}\n`;
      }
    } else {
      details += `State folder does NOT exist!\n`;
      
      // Check if parent directory exists
      const wizardDir = path.dirname(this.stateDir);
      const wizardExists = await fs.pathExists(wizardDir);
      details += `Parent (.expo-upgrade-wizard) exists: ${wizardExists}\n`;
      
      if (wizardExists) {
        try {
          const parentFiles = await fs.readdir(wizardDir);
          details += `Parent contents: ${parentFiles.join(', ')}\n`;
        } catch (error) {
          details += `Error reading parent: ${error}\n`;
        }
      }
    }

    // Log to console
    console.log(chalk.cyan(details));

    // Append to log file
    try {
      await fs.ensureDir(path.dirname(this.logFile));
      await fs.appendFile(this.logFile, details);
    } catch (error) {
      console.error('Failed to write debug log:', error);
    }
  }

  /**
   * Get the debug log file path
   */
  getLogPath(): string {
    return this.logFile;
  }
}
