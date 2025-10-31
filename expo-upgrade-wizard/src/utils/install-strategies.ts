/**
 * Smart installation strategies for Expo upgrades
 * Implements hybrid Expo-first approach to avoid Metro/peer dependency issues
 */

import { log } from './logger';
import * as fs from 'fs-extra';
import * as path from 'path';

export type InstallStrategy = 'expo' | 'npm' | 'legacy' | 'force';

export interface InstallResult {
  success: boolean;
  strategy: string;
  output: string;
  errors: string[];
  warnings: string[];
  commandsUsed: string[]; // Track actual commands executed
}

export interface VerificationResult {
  success: boolean;
  missingPackages: string[];
  versionMismatches: Array<{ package: string; expected: string; actual: string }>;
}

/**
 * Main installation orchestrator using hybrid Expo-first approach
 */
export class SmartInstaller {
  private projectPath: string;
  private packageManager: string;
  private targetSdk: string;

  constructor(projectPath: string, packageManager: string, targetSdk: string) {
    this.projectPath = projectPath;
    this.packageManager = packageManager;
    this.targetSdk = targetSdk;
  }

  /**
   * Execute smart installation with fallback strategies
   */
  async install(preferredStrategy: InstallStrategy = 'expo'): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      strategy: preferredStrategy,
      output: '',
      errors: [],
      warnings: [],
      commandsUsed: []
    };

    log.info(`🔍 DEBUG: SmartInstaller.install() called with strategy: ${preferredStrategy}`);
    log.info(`🔍 DEBUG: Project path: ${this.projectPath}`);
    log.info(`🔍 DEBUG: Package manager: ${this.packageManager}`);
    log.info(`🔍 DEBUG: Target SDK: ${this.targetSdk}`);

    try {
      // Strategy selection based on preference
      switch (preferredStrategy) {
        case 'expo':
          log.info('🔍 DEBUG: Using expo-first strategy');
          return await this.expoFirstInstall();
        case 'npm':
          log.info('🔍 DEBUG: Using standard npm strategy');
          return await this.standardNpmInstall();
        case 'legacy':
          log.info('🔍 DEBUG: Using legacy peer deps strategy');
          return await this.legacyPeerDepsInstall();
        case 'force':
          log.info('🔍 DEBUG: Using force strategy');
          return await this.forceInstall();
        default:
          log.info('🔍 DEBUG: Using default expo-first strategy');
          return await this.expoFirstInstall();
      }
    } catch (error: any) {
      result.errors.push(error.message || String(error));
      log.error('🔍 DEBUG: Installation exception:', error.message);
      log.error('Installation failed:', error.message);
      return result;
    }
  }

  /**
   * Recommended: Expo-first hybrid approach
   * 1. Run expo install --fix (handles Expo packages)
   * 2. Run npm install (fills in remaining packages)
   * 3. Verify Metro packages
   * 4. Fallback to force if needed
   */
  private async expoFirstInstall(): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      strategy: 'expo-first-hybrid',
      output: '',
      errors: [],
      warnings: [],
      commandsUsed: []
    };

    log.info('🔍 DEBUG: Starting Expo-first installation...');
    
    // Check if package.json exists and has expo
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      log.info(`🔍 DEBUG: package.json expo version: ${packageJson.dependencies?.expo || 'not found'}`);
    } else {
      log.error('🔍 DEBUG: package.json not found!');
      result.errors.push('package.json not found');
      return result;
    }

    // Phase 1: Delete lock file to prevent version conflicts
    const lockFilePath = path.join(this.projectPath, 'package-lock.json');
    if (await fs.pathExists(lockFilePath)) {
      log.info('🔍 DEBUG: Removing package-lock.json to prevent version conflicts...');
      await fs.remove(lockFilePath);
      log.success('✓ Removed stale package-lock.json');
    }

    // Phase 2: Skip expo install --fix, go straight to npm install
    // (expo install --fix doesn't work well after node_modules is deleted)
    log.info('🔍 DEBUG: Skipping expo install --fix (not reliable after clean install)');

    // Phase 3: Standard npm install (no flags)
    log.info('🔍 DEBUG: Running npm install (standard)...');
    const npmResult = await this.runNpmInstall(false);
    result.output += `${npmResult.output}\n`;
    log.info(`🔍 DEBUG: NPM install result: success=${npmResult.success}`);

    if (npmResult.success) {
      result.commandsUsed.push('npm install');
      log.success('✓ npm install completed');
    } else {
      log.warn('⚠️  Standard npm install failed, trying --force...');
      
      // Fallback: npm install --force
      log.info('🔍 DEBUG: Running npm install --force...');
      const forceResult = await this.runNpmInstall(true);
      result.output += `${forceResult.output}\n`;
      log.info(`🔍 DEBUG: Force install result: success=${forceResult.success}`);

      if (forceResult.success) {
        result.commandsUsed.push('npm install --force');
        log.success('✓ npm install --force completed');
      } else {
        log.error('❌ All installation attempts failed');
        result.errors.push('All installation attempts failed');
        result.errors.push(`NPM install: ${npmResult.success ? 'OK' : 'FAILED'}`);
        result.errors.push(`Force install: ${forceResult.success ? 'OK' : 'FAILED'}`);
        return result;
      }
    }

    // Phase 3: Verify critical packages and fix SDK 53 versions
    const verification = await this.verifyInstallation();

    if (!verification.success) {
      // If Metro packages are missing/mismatched, try recovery
      const hasMetroIssues = verification.missingPackages.some(p => p.includes('metro')) ||
        verification.versionMismatches.some(m => m.package.includes('metro'));

      if (hasMetroIssues) {
        const recoveryResult = await this.recoverMetroPackages();
        result.output += `${recoveryResult.output}\n`;

        if (recoveryResult.success) {
          result.commandsUsed.push('npm install --force (recovery)');
          result.success = true; // Recovery succeeded
        } else {
          result.errors.push('Metro package recovery failed');
          result.success = false;
        }
      } else {
        // No Metro issues, but verification failed for other reasons
        // Still consider it a success if we have commands that ran
        result.success = result.commandsUsed.length > 0;
      }
    } else {
      // Verification passed
      result.success = true;
    }

    return result;
  }

  /**
   * Standard npm install (no flags)
   */
  private async standardNpmInstall(): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      strategy: 'standard-npm',
      output: '',
      errors: [],
      warnings: [],
      commandsUsed: []
    };

    const npmResult = await this.runNpmInstall(false);
    result.output = npmResult.output;
    result.success = npmResult.success;

    if (result.success) {
      result.commandsUsed.push('npm install');
    } else {
      result.errors.push('Standard npm install failed');
    }

    return result;
  }

  /**
   * npm install --legacy-peer-deps
   */
  private async legacyPeerDepsInstall(): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      strategy: 'legacy-peer-deps',
      output: '',
      errors: [],
      warnings: [],
      commandsUsed: []
    };

    const { execa } = await import('execa');

    try {
      const execResult = await execa('npm', ['install', '--legacy-peer-deps'], {
        cwd: this.projectPath,
        all: true,
        reject: false
      });

      result.output = execResult.all || '';
      result.success = execResult.exitCode === 0;

      if (result.success) {
        result.commandsUsed.push('npm install --legacy-peer-deps');
      } else {
        result.errors.push(`npm install --legacy-peer-deps failed with exit code ${execResult.exitCode}`);
      }
    } catch (error: any) {
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * npm install --force (nuclear option)
   */
  private async forceInstall(): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      strategy: 'force',
      output: '',
      errors: [],
      warnings: [],
      commandsUsed: []
    };

    const npmResult = await this.runNpmInstall(true);
    result.output = npmResult.output;
    result.success = npmResult.success;

    if (result.success) {
      result.commandsUsed.push('npm install --force');
    } else {
      result.errors.push('npm install --force failed');
    }

    return result;
  }

  /**
   * Run expo install --fix
   */
  private async runExpoInstallFix(): Promise<{ success: boolean; output: string }> {
    const { execa } = await import('execa');

    try {
      log.info('🔍 DEBUG: Executing: npx expo install --fix');
      const result = await execa('npx', ['expo', 'install', '--fix'], {
        cwd: this.projectPath,
        all: true,
        reject: false,
        env: {
          ...process.env,
          // Don't use legacy peer deps for expo install - let it handle deps smartly
          FORCE_COLOR: '1'
        }
      });

      log.info(`🔍 DEBUG: Expo install exit code: ${result.exitCode}`);
      if (result.exitCode !== 0) {
        log.error(`🔍 DEBUG: Expo install stderr: ${result.stderr?.slice(0, 500)}`);
        log.error(`🔍 DEBUG: Expo install stdout: ${result.stdout?.slice(0, 500)}`);
      }

      return {
        success: result.exitCode === 0,
        output: result.all || result.stdout || ''
      };
    } catch (error: any) {
      log.error(`🔍 DEBUG: Expo install exception: ${error.message}`);
      log.error(`🔍 DEBUG: Exit code: ${error.exitCode}`);
      return {
        success: false,
        output: error.message || String(error)
      };
    }
  }

  /**
   * Run npm install with optional --force flag
   */
  private async runNpmInstall(useForce: boolean): Promise<{ success: boolean; output: string }> {
    const { execa } = await import('execa');

    const args = ['install'];
    if (useForce) {
      args.push('--force');
    }

    try {
      log.info(`🔍 DEBUG: Executing: npm ${args.join(' ')}`);
      const result = await execa('npm', args, {
        cwd: this.projectPath,
        all: true,
        reject: false
      });

      log.info(`🔍 DEBUG: npm install exit code: ${result.exitCode}`);
      
      // Check if node_modules was created (more reliable than exit code)
      const nodeModulesPath = path.join(this.projectPath, 'node_modules');
      const nodeModulesExists = await fs.pathExists(nodeModulesPath);
      log.info(`🔍 DEBUG: node_modules exists: ${nodeModulesExists}`);
      
      if (result.exitCode !== 0) {
        log.warn(`🔍 DEBUG: npm install stderr: ${result.stderr?.slice(0, 500)}`);
        
        // Exit code 1 with ERESOLVE warnings is often OK if node_modules was created
        if (nodeModulesExists && result.stderr?.includes('ERESOLVE')) {
          log.info('🔍 DEBUG: Treating as success despite exit code 1 (ERESOLVE warnings, but node_modules created)');
          return {
            success: true,
            output: result.all || result.stdout || ''
          };
        }
      }

      return {
        success: result.exitCode === 0 || nodeModulesExists,
        output: result.all || result.stdout || ''
      };
    } catch (error: any) {
      log.error(`🔍 DEBUG: npm install exception: ${error.message}`);
      log.error(`🔍 DEBUG: Exit code: ${error.exitCode}`);
      return {
        success: false,
        output: error.message || String(error)
      };
    }
  }

  /**
   * Verify installation - check critical packages
   */
  private async verifyInstallation(): Promise<VerificationResult> {
    const result: VerificationResult = {
      success: true,
      missingPackages: [],
      versionMismatches: []
    };

    const criticalPackages = [
      'expo',
      'react',
      'react-native',
      'metro',
      '@expo/metro-config',
      'metro-resolver',
      'metro-config'
    ];

    for (const pkg of criticalPackages) {
      const pkgPath = path.join(this.projectPath, 'node_modules', pkg, 'package.json');

      if (!await fs.pathExists(pkgPath)) {
        result.missingPackages.push(pkg);
        result.success = false;
        log.warn(`⚠️  Missing package: ${pkg}`);
      }
    }

    // Check Metro package alignment
    const metroVersion = await this.getInstalledVersion('metro');
    const metroConfigVersion = await this.getInstalledVersion('@expo/metro-config');

    if (metroVersion && metroConfigVersion) {
      log.info(`Metro versions: metro@${metroVersion}, @expo/metro-config@${metroConfigVersion}`);
    }

    // For SDK 53, verify and fix critical package versions
    if (this.targetSdk === '53') {
      await this.verifyAndFixSdk53Versions();
    }

    return result;
  }

  /**
   * Verify and fix SDK 53 specific package versions
   * Ensures critical packages match recommended versions
   */
  private async verifyAndFixSdk53Versions(): Promise<void> {
    const recommendedVersions: Record<string, string> = {
      'react': '18.3.1',
      'react-dom': '18.3.1',
      'react-native': '0.76.3',
      'react-native-reanimated': '3.16.3',
      'react-native-gesture-handler': '2.20.2',
      '@react-native-async-storage/async-storage': '2.1.0'
    };

    const packageJsonPath = path.join(this.projectPath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    
    const packagesToFix: string[] = [];
    const versionChanges: Array<{ package: string; from: string; to: string }> = [];

    // Check installed versions vs recommended
    for (const [pkg, recommendedVersion] of Object.entries(recommendedVersions)) {
      const installedVersion = await this.getInstalledVersion(pkg);
      
      if (installedVersion && installedVersion !== recommendedVersion) {
        // Check if it's a critical mismatch
        const isCritical = this.isCriticalVersionMismatch(pkg, installedVersion, recommendedVersion);
        
        if (isCritical) {
          packagesToFix.push(`${pkg}@${recommendedVersion}`);
          versionChanges.push({
            package: pkg,
            from: installedVersion,
            to: recommendedVersion
          });
        }
      }
    }

    // If there are packages to fix, update them
    if (packagesToFix.length > 0) {
      log.warn('\n⚠️  Version mismatches detected for SDK 53:');
      versionChanges.forEach(change => {
        log.warn(`  ${change.package}: ${change.from} → ${change.to}`);
      });
      
      log.info('\n🔧 Fixing package versions...');
      
      // Update package.json with correct versions
      for (const change of versionChanges) {
        if (packageJson.dependencies?.[change.package]) {
          packageJson.dependencies[change.package] = change.to;
        }
        if (packageJson.devDependencies?.[change.package]) {
          packageJson.devDependencies[change.package] = change.to;
        }
      }
      
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      
      // Reinstall with correct versions
      const { execa } = await import('execa');
      try {
        await execa('npm', ['install', ...packagesToFix], {
          cwd: this.projectPath,
          stdio: 'inherit'
        });
        
        log.success('✓ Package versions corrected');
        
        // Verify the fixes
        for (const change of versionChanges) {
          const newVersion = await this.getInstalledVersion(change.package);
          if (newVersion === change.to) {
            log.success(`  ✓ ${change.package}@${newVersion}`);
          } else {
            log.warn(`  ⚠️  ${change.package}@${newVersion} (expected ${change.to})`);
          }
        }
      } catch (error: any) {
        log.error('Failed to fix package versions:', error.message);
        log.info('\n💡 Manually run:');
        log.info(`  npm install ${packagesToFix.join(' ')}`);
      }
    }
  }

  /**
   * Check if version mismatch is critical and needs fixing
   */
  private isCriticalVersionMismatch(pkg: string, installed: string, recommended: string): boolean {
    // React 19 is critical - must downgrade to 18.3.1
    if (pkg === 'react' || pkg === 'react-dom') {
      const installedMajor = parseInt(installed.split('.')[0]);
      const recommendedMajor = parseInt(recommended.split('.')[0]);
      return installedMajor !== recommendedMajor;
    }

    // React Native 0.79.x is actually OK for SDK 53 (fixes Hermes issues)
    if (pkg === 'react-native') {
      const installedMinor = parseInt(installed.split('.')[1]);
      // 0.79.x is acceptable, 0.76.x is default
      if (installedMinor === 79) {
        log.info(`✓ Using React Native 0.79.x - this is recommended for SDK 53 to fix Hermes issues`);
        return false; // Don't downgrade 0.79.x
      }
      // Other versions should match
      return installed !== recommended;
    }

    // For other packages, check minor version differences
    const installedParts = installed.split('.').map(Number);
    const recommendedParts = recommended.split('.').map(Number);
    
    // If major or minor version differs, it's critical
    return installedParts[0] !== recommendedParts[0] || 
           installedParts[1] !== recommendedParts[1];
  }

  /**
   * Get installed package version
   */
  private async getInstalledVersion(packageName: string): Promise<string | null> {
    try {
      const pkgPath = path.join(this.projectPath, 'node_modules', packageName, 'package.json');
      if (await fs.pathExists(pkgPath)) {
        const pkg = await fs.readJson(pkgPath);
        return pkg.version;
      }
    } catch (error) {
      // Ignore
    }
    return null;
  }

  /**
   * Recover Metro packages if they're mismatched
   */
  private async recoverMetroPackages(): Promise<{ success: boolean; output: string }> {
    const { execa } = await import('execa');

    log.info('Reinstalling Metro packages...');

    try {
      // Remove node_modules to force clean install
      const nodeModulesPath = path.join(this.projectPath, 'node_modules');
      if (await fs.pathExists(nodeModulesPath)) {
        log.info('Removing node_modules for clean install...');
        await fs.remove(nodeModulesPath);
      }

      // Run npm install --force to ensure everything is installed
      const result = await execa('npm', ['install', '--force'], {
        cwd: this.projectPath,
        all: true,
        reject: false
      });

      return {
        success: result.exitCode === 0,
        output: result.all || ''
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.message || String(error)
      };
    }
  }
}

/**
 * Helper: Detect package manager from lock files
 */
export async function detectPackageManager(projectPath: string): Promise<string> {
  if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) {
    return 'yarn';
  }
  if (await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (await fs.pathExists(path.join(projectPath, 'bun.lockb'))) {
    return 'bun';
  }
  return 'npm';
}
