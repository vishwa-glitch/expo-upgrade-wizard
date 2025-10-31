import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger';
import { ProjectAnalyzer } from './analyzer';
import { GitManager } from './git';

export interface ProjectState {
  // Project Identity
  projectPath: string;
  projectName: string;
  timestamp: string;
  stateId: string;
  
  // SDK Information
  currentSdkVersion: string;
  targetSdkVersion?: string;
  reactNativeVersion: string;
  
  // Dependencies Snapshot
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  
  // Configuration Files
  configFiles: {
    packageJson: any;
    appJson: any;
    appConfigJs?: string;
    easJson?: any;
    metroConfig?: string;
    babelConfig?: any;
    tsConfig?: any;
  };
  
  // Project Characteristics
  projectType: 'managed' | 'bare' | 'hybrid';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  hasCustomNativeCode: boolean;
  hasEas: boolean;
  
  // Git Information
  gitBranch: string;
  gitCommitHash: string;
  gitStatus: 'clean' | 'dirty';
  
  // Upgrade History
  upgradeHistory: UpgradeRecord[];
  
  // Warnings & Issues
  warnings: string[];
  errors: string[];
}

export interface UpgradeRecord {
  fromSdk: string;
  toSdk: string;
  timestamp: string;
  strategy: 'conservative' | 'recommended' | 'latest';
  breakingChangesApplied: string[];
  success: boolean;
  rollbackAvailable: boolean;
  duration: number;
}

export interface StateComparison {
  dependencyChanges: {
    added: Record<string, string>;
    removed: string[];
    updated: Record<string, { from: string; to: string }>;
  };
  configChanges: string[];
  sdkChange?: { from: string; to: string };
  warnings: string[];
}

export class StateManager {
  private projectPath: string;
  private stateDir: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = path.resolve(projectPath);
    const wizardDir = path.join(this.projectPath, '.expo-upgrade-wizard');
    
    this.stateDir = path.join(wizardDir, 'state');
  }

  /**
   * Initialize the state management system (current state + last backup only)
   */
  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.stateDir);
      
      // Ensure .expo-upgrade-wizard is in .gitignore
      await this.ensureGitignore();
      
      logger.debug('State management system initialized');
    } catch (error) {
      logger.error('Failed to initialize state management:', error);
      throw error;
    }
  }

  /**
   * Ensure .expo-upgrade-wizard directory is added to .gitignore
   */
  private async ensureGitignore(): Promise<void> {
    try {
      const gitignorePath = path.join(this.projectPath, '.gitignore');
      const entryToAdd = '.expo-upgrade-wizard';
      
      // Check if .gitignore exists
      if (await fs.pathExists(gitignorePath)) {
        const content = await fs.readFile(gitignorePath, 'utf8');
        
        // Check if entry already exists
        const lines = content.split('\n');
        const hasEntry = lines.some(line => line.trim() === entryToAdd);
        
        if (!hasEntry) {
          // Add entry with proper newline handling
          const newContent = content.endsWith('\n') 
            ? `${content}${entryToAdd}\n`
            : `${content}\n${entryToAdd}\n`;
          
          await fs.writeFile(gitignorePath, newContent, 'utf8');
          logger.debug('Added .expo-upgrade-wizard to .gitignore');
        }
      } else {
        // Create .gitignore with the entry
        await fs.writeFile(gitignorePath, `${entryToAdd}\n`, 'utf8');
        logger.debug('Created .gitignore with .expo-upgrade-wizard entry');
      }
    } catch (error) {
      // Don't fail initialization if gitignore update fails
      logger.warn('Failed to update .gitignore:', error);
    }
  }

  /**
   * Capture current project state
   */
  async captureCurrentState(type: 'pre-upgrade' | 'post-upgrade' | 'snapshot' = 'snapshot'): Promise<ProjectState> {
    try {
      await this.initialize();
      
      const analyzer = new ProjectAnalyzer(this.projectPath);
      const analysis = await analyzer.analyze();
      
      const gitManager = new GitManager(this.projectPath);
      const gitInfo = await this.getGitInfo(gitManager);
      
      const timestamp = new Date().toISOString();
      const stateId = `${type}-${timestamp.replace(/[:.]/g, '-')}`;
      
      // Read package.json to get project name and dependencies
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = await fs.readJson(packageJsonPath).catch(() => ({}));
      
      const state: ProjectState = {
        projectPath: this.projectPath,
        projectName: packageJson.name || path.basename(this.projectPath),
        timestamp,
        stateId,
        
        currentSdkVersion: analysis.currentSdkVersion || 'unknown',
        reactNativeVersion: analysis.reactNativeVersion || 'unknown',
        
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {},
        
        configFiles: await this.readConfigFiles(),
        
        projectType: analysis.workflowType === 'managed' ? 'managed' : analysis.workflowType === 'bare' ? 'bare' : 'hybrid',
        packageManager: analysis.packageManager,
        hasCustomNativeCode: analysis.hasCustomNativeCode,
        hasEas: analysis.configFiles.easJson,
        
        gitBranch: gitInfo.branch,
        gitCommitHash: gitInfo.commitHash,
        gitStatus: gitInfo.status,
        
        upgradeHistory: await this.loadUpgradeHistory(),
        
        warnings: analysis.warnings,
        errors: analysis.errors
      };
      
      await this.saveState(state);
      logger.info(`Project state captured: ${stateId}`);
      
      return state;
    } catch (error) {
      logger.error('Failed to capture project state:', error);
      throw error;
    }
  }

  /**
   * Save project state to disk (current + backup only)
   */
  async saveState(state: ProjectState): Promise<void> {
    try {
      const currentStateFile = path.join(this.stateDir, 'current.json');
      const backupStateFile = path.join(this.stateDir, 'backup.json');
      
      // If current state exists, move it to backup before saving new current
      if (await fs.pathExists(currentStateFile)) {
        const currentState = await fs.readJson(currentStateFile);
        await fs.writeJson(backupStateFile, currentState, { spaces: 2 });
      } else {
        // First time: save as both current AND backup (so rollback works immediately)
        await fs.writeJson(backupStateFile, state, { spaces: 2 });
      }
      
      // Save new current state
      await fs.writeJson(currentStateFile, state, { spaces: 2 });
      
      logger.debug(`State saved: ${state.stateId}`);
    } catch (error) {
      logger.error('Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Load project state from disk (current or backup only)
   */
  async loadState(stateId: 'current' | 'backup'): Promise<ProjectState | null> {
    try {
      const stateFile = stateId === 'current' 
        ? path.join(this.stateDir, 'current.json')
        : path.join(this.stateDir, 'backup.json');
      
      if (!(await fs.pathExists(stateFile))) {
        return null;
      }
      
      const state = await fs.readJson(stateFile);
      return state as ProjectState;
    } catch (error) {
      logger.error(`Failed to load state ${stateId}:`, error);
      return null;
    }
  }

  /**
   * List available states (current and backup only)
   */
  async listStates(): Promise<Array<{ id: string; timestamp: string; type: string }>> {
    try {
      const states = [];
      
      // Check current state
      const currentStateFile = path.join(this.stateDir, 'current.json');
      if (await fs.pathExists(currentStateFile)) {
        const currentState = await fs.readJson(currentStateFile);
        states.push({
          id: 'current',
          timestamp: currentState.timestamp,
          type: 'current'
        });
      }
      
      // Check backup state
      const backupStateFile = path.join(this.stateDir, 'backup.json');
      if (await fs.pathExists(backupStateFile)) {
        const backupState = await fs.readJson(backupStateFile);
        states.push({
          id: 'backup',
          timestamp: backupState.timestamp,
          type: 'backup'
        });
      }
      
      return states;
    } catch (error) {
      logger.error('Failed to list states:', error);
      return [];
    }
  }

  /**
   * Restore project to a previous state (backup only)
   */
  async restoreToState(stateId: 'backup'): Promise<void> {
    try {
      const targetState = await this.loadState(stateId);
      if (!targetState) {
        throw new Error(`State ${stateId} not found`);
      }
      
      logger.info(`Restoring project to state: ${stateId}`);
      
      // Restore package.json
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      await fs.writeJson(packageJsonPath, targetState.configFiles.packageJson, { spaces: 2 });
      
      // Restore other config files
      await this.restoreConfigFiles(targetState.configFiles);
      
      // Git rollback if available
      if (targetState.gitCommitHash) {
        const gitManager = new GitManager(this.projectPath);
        try {
          await gitManager.resetToCommit(targetState.gitCommitHash);
        } catch (error) {
          logger.warn('Git rollback failed, continuing with file restoration:', error);
        }
      }
      
      logger.info(`Project restored to state: ${stateId}`);
      logger.info('Run npm/yarn install to restore dependencies');
      
    } catch (error) {
      logger.error('Failed to restore state:', error);
      throw error;
    }
  }

  /**
   * Add upgrade record to history
   */
  async addUpgradeRecord(record: UpgradeRecord): Promise<void> {
    try {
      const currentState = await this.loadState('current');
      if (!currentState) {
        throw new Error('No current state found');
      }
      
      currentState.upgradeHistory.push(record);
      await this.saveState(currentState);
      
      logger.debug('Upgrade record added to history');
    } catch (error) {
      logger.error('Failed to add upgrade record:', error);
      throw error;
    }
  }

  // Private helper methods

  private async readConfigFiles(): Promise<ProjectState['configFiles']> {
    const configFiles: ProjectState['configFiles'] = {
      packageJson: null,
      appJson: null
    };
    
    // package.json
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        configFiles.packageJson = await fs.readJson(packageJsonPath);
      }
    } catch (error) {
      logger.warn('Error reading package.json:', error);
    }
    
    // app.json
    try {
      const appJsonPath = path.join(this.projectPath, 'app.json');
      if (await fs.pathExists(appJsonPath)) {
        configFiles.appJson = await fs.readJson(appJsonPath);
      }
    } catch (error) {
      logger.warn('Error reading app.json:', error);
    }
    
    // app.config.js
    try {
      const appConfigPath = path.join(this.projectPath, 'app.config.js');
      if (await fs.pathExists(appConfigPath)) {
        configFiles.appConfigJs = await fs.readFile(appConfigPath, 'utf8');
      }
    } catch (error) {
      logger.warn('Error reading app.config.js:', error);
    }
    
    // eas.json
    try {
      const easJsonPath = path.join(this.projectPath, 'eas.json');
      if (await fs.pathExists(easJsonPath)) {
        configFiles.easJson = await fs.readJson(easJsonPath);
      }
    } catch (error) {
      logger.warn('Error reading eas.json:', error);
    }
    
    // metro.config.js
    try {
      const metroConfigPath = path.join(this.projectPath, 'metro.config.js');
      if (await fs.pathExists(metroConfigPath)) {
        configFiles.metroConfig = await fs.readFile(metroConfigPath, 'utf8');
      }
    } catch (error) {
      logger.warn('Error reading metro.config.js:', error);
    }
    
    // babel.config.js
    try {
      const babelConfigPath = path.join(this.projectPath, 'babel.config.js');
      if (await fs.pathExists(babelConfigPath)) {
        configFiles.babelConfig = await fs.readFile(babelConfigPath, 'utf8');
      }
    } catch (error) {
      logger.warn('Error reading babel.config.js:', error);
    }
    
    // tsconfig.json - handle JSONC format (comments, trailing commas)
    try {
      const tsConfigPath = path.join(this.projectPath, 'tsconfig.json');
      if (await fs.pathExists(tsConfigPath)) {
        const content = await fs.readFile(tsConfigPath, 'utf8');
        // Try to parse as-is first
        try {
          configFiles.tsConfig = JSON.parse(content);
        } catch {
          // If that fails, strip comments and trailing commas for JSONC support
          const stripped = content
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
            .replace(/\/\/.*/g, '') // Remove // comments
            .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
          configFiles.tsConfig = JSON.parse(stripped);
        }
      }
    } catch (error) {
      logger.warn('Error reading tsconfig.json (skipping):', error);
      // Don't fail the entire process if tsconfig.json can't be read
    }
    
    return configFiles;
  }

  private async restoreConfigFiles(configFiles: ProjectState['configFiles']): Promise<void> {
    try {
      // Restore app.json
      if (configFiles.appJson) {
        const appJsonPath = path.join(this.projectPath, 'app.json');
        await fs.writeJson(appJsonPath, configFiles.appJson, { spaces: 2 });
      }
      
      // Restore app.config.js
      if (configFiles.appConfigJs) {
        const appConfigPath = path.join(this.projectPath, 'app.config.js');
        await fs.writeFile(appConfigPath, configFiles.appConfigJs);
      }
      
      // Restore eas.json
      if (configFiles.easJson) {
        const easJsonPath = path.join(this.projectPath, 'eas.json');
        await fs.writeJson(easJsonPath, configFiles.easJson, { spaces: 2 });
      }
      
      // Restore metro.config.js
      if (configFiles.metroConfig) {
        const metroConfigPath = path.join(this.projectPath, 'metro.config.js');
        await fs.writeFile(metroConfigPath, configFiles.metroConfig);
      }
      
      // Restore babel.config.js
      if (configFiles.babelConfig) {
        const babelConfigPath = path.join(this.projectPath, 'babel.config.js');
        await fs.writeFile(babelConfigPath, configFiles.babelConfig);
      }
      
      // Restore tsconfig.json
      if (configFiles.tsConfig) {
        const tsConfigPath = path.join(this.projectPath, 'tsconfig.json');
        await fs.writeJson(tsConfigPath, configFiles.tsConfig, { spaces: 2 });
      }
      
    } catch (error) {
      logger.error('Error restoring config files:', error);
      throw error;
    }
  }

  private async getGitInfo(gitManager: GitManager): Promise<{
    branch: string;
    commitHash: string;
    status: 'clean' | 'dirty';
  }> {
    try {
      const [branch, commitHash, isClean] = await Promise.all([
        gitManager.getCurrentBranch(),
        gitManager.getCurrentCommit(),
        gitManager.isWorkingDirectoryClean()
      ]);
      
      return {
        branch: branch || 'unknown',
        commitHash: commitHash || 'unknown',
        status: isClean ? 'clean' : 'dirty'
      };
    } catch (error) {
      logger.warn('Failed to get git info:', error);
      return {
        branch: 'unknown',
        commitHash: 'unknown',
        status: 'dirty'
      };
    }
  }

  private async loadUpgradeHistory(): Promise<UpgradeRecord[]> {
    try {
      const currentState = await this.loadState('current');
      return currentState?.upgradeHistory || [];
    } catch (error) {
      return [];
    }
  }
}
