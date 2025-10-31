import * as fs from 'fs-extra';
import * as path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';
import { log } from '../utils/logger';
import { getSdkInfo } from '../data/sdk-versions';

export interface ExpoInstallUpgradeResult {
  success: boolean;
  updated: string[];
  errors: string[];
  output: string;
}

/**
 * Simplified upgrader that uses Expo's official `expo install --fix` command
 * This is more reliable than manually managing package versions
 */
export class ExpoInstallUpgrader {
  private projectPath: string;
  private targetSdk: string;

  constructor(projectPath: string, targetSdk: string) {
    this.projectPath = projectPath;
    this.targetSdk = targetSdk;
  }

  /**
   * Upgrade using Expo's official tools
   * 1. Remove deprecated packages
   * 2. Update expo package to target SDK
   * 3. Prompt for React version (SDK 53 only)
   * 4. Run expo install --fix to update all other packages
   * 5. Downgrade to React 18 if user selected it
   */
  public async upgrade(dryRun = false, reactVersion?: '18' | '19'): Promise<ExpoInstallUpgradeResult> {
    const result: ExpoInstallUpgradeResult = {
      success: false,
      updated: [],
      errors: [],
      output: ''
    };

    try {
      // Step 1: Remove deprecated packages for target SDK
      if (!dryRun && this.targetSdk === '53') {
        await this.removeDeprecatedPackages();
      }

      // Step 2: Update expo package to target SDK version
      const sdkInfo = getSdkInfo(this.targetSdk);
      if (!sdkInfo) {
        throw new Error(`SDK ${this.targetSdk} not found`);
      }

      log.info(`Updating expo package to ${sdkInfo.expoPackageVersion}...`);
      
      if (!dryRun) {
        await this.updateExpoPackage(sdkInfo.expoPackageVersion);
        result.updated.push(`expo@${sdkInfo.expoPackageVersion}`);
        
        // Install the expo package first before running expo install --fix
        log.info('Installing expo package...');
        await this.installExpoPackage();
      }

      // Step 3: Run expo install --fix to update all other packages
      log.info('Running expo install --fix to update all packages...');
      
      if (!dryRun) {
        const fixResult = await this.runExpoInstallFix();
        result.output = fixResult.output;
        result.updated.push(...fixResult.packagesUpdated);
        
        if (!fixResult.success) {
          // Include more context in error message
          const errorMsg = `expo install --fix failed. Full output:\n${fixResult.output}`;
          result.errors.push(errorMsg);
          log.error(errorMsg);
          
          // Check for common config plugin errors
          if (fixResult.output.includes('withPlugins') || fixResult.output.includes('config-plugins')) {
            log.error('\n⚠️  Config Plugin Error Detected!');
            log.error('\nThis usually means one of your app.json plugins is incompatible or misconfigured.');
            log.error('\n💡 Solutions:');
            log.error('  1. Check your app.json "plugins" array for outdated or incompatible plugins');
            log.error('  2. Temporarily remove plugins from app.json and try again');
            log.error('  3. Update plugin packages to their latest versions');
            log.error('  4. Check if any plugins require SDK-specific configuration');
          }
          
          return result;
        }
      }

      // Step 4: Downgrade to React 18 if user selected it (SDK 53 only)
      if (!dryRun && this.targetSdk === '53' && reactVersion === '18') {
        const downgradeResult = await this.downgradeToReact18();
        
        if (downgradeResult.success) {
          result.updated.push('react@18.3.1', 'react-dom@18.3.1', 'react-native@0.76.5');
          log.success('✅ Downgraded to React 18.3.1 + React Native 0.76.5 for stability');
        } else {
          // Graceful fallback - React 19 is actually good!
          log.success('✅ Using React 19.0.0 + React Native 0.79.6 (recommended for SDK 53)');
        }
      }

      result.success = true;
      log.success(`Successfully upgraded to SDK ${this.targetSdk}`);

    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      log.error('Upgrade failed:', errorMsg);
      result.errors.push(errorMsg);
      
      // Show helpful suggestions based on error
      if (errorMsg.includes('ERESOLVE') || errorMsg.includes('peer dep')) {
        log.info('\n💡 Suggestions:');
        log.info('  • Try using --install-strategy legacy');
        log.info('  • Or use --install-strategy force as last resort');
      } else if (errorMsg.includes('EACCES') || errorMsg.includes('permission')) {
        log.info('\n💡 Suggestions:');
        log.info('  • Try running with sudo (not recommended)');
        log.info('  • Or fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors');
      }
    }

    return result;
  }



  /**
   * Remove deprecated packages that should be removed for the target SDK
   */
  private async removeDeprecatedPackages(): Promise<void> {
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    // List of packages to remove for SDK 53
    const packagesToRemove = ['@expo/webpack-config'];
    
    const foundPackages = packagesToRemove.filter(pkg => allDeps[pkg]);
    
    if (foundPackages.length === 0) {
      return;
    }
    
    log.info(`Removing deprecated packages: ${foundPackages.join(', ')}`);
    
    for (const pkg of foundPackages) {
      // Remove from package.json
      if (packageJson.dependencies?.[pkg]) {
        delete packageJson.dependencies[pkg];
      }
      if (packageJson.devDependencies?.[pkg]) {
        delete packageJson.devDependencies[pkg];
      }
    }
    
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    log.success(`Removed deprecated packages from package.json`);
  }

  /**
   * Update the expo package in package.json
   */
  private async updateExpoPackage(version: string): Promise<void> {
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);

    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    packageJson.dependencies.expo = version;
    
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    log.success(`Updated expo to ${version} in package.json`);
  }

  /**
   * Install the expo package (needed before running expo install --fix)
   */
  private async installExpoPackage(): Promise<void> {
    const { execa } = await import('execa');
    const { CloudStorageDetector } = await import('../utils/cloud-storage-detector');
    
    try {
      await execa('npm', ['install', 'expo', '--legacy-peer-deps'], {
        cwd: this.projectPath,
        stdio: 'inherit'
      });
      log.success('Expo package installed');
    } catch (error: any) {
      // Check if this is a cloud storage related error
      const detection = CloudStorageDetector.detect(this.projectPath);
      const isCloudError = CloudStorageDetector.isCloudStorageError(error);
      
      if (detection.isCloudStorage && isCloudError) {
        log.error(`\n⚠️  ${detection.provider} File Locking Detected!`);
        log.error(`\n${detection.provider} is syncing your project files and preventing npm from modifying them.`);
        log.error('\n💡 Solutions:');
        log.error(`  1. Move your project outside ${detection.provider}:`);
        log.error(`     Recommended: ${detection.recommendedPath}`);
        log.error(`  2. Or pause ${detection.provider} sync during the upgrade`);
        log.error(`  3. Or exclude node_modules from ${detection.provider} sync`);
        
        // Create enhanced error with cloud storage context
        const enhancedError = new Error(
          `Expo install upgrade failed:\n${error.message}\n\n` +
          `This error is likely caused by ${detection.provider} file locking.\n` +
          `Please move your project to: ${detection.recommendedPath}`
        );
        throw enhancedError;
      }
      
      log.error('Installation Failed:', error instanceof Error ? error.message : String(error));
      log.info('\n💡 Suggestions:');
      log.info('  • Try: npm install expo --legacy-peer-deps');
      log.info('  • Check network connection');
      log.info('  • Clear npm cache: npm cache clean --force');
      throw error;
    }
  }

  /**
   * Run expo install --fix to update all packages to compatible versions
   */
  private async runExpoInstallFix(): Promise<{
    success: boolean;
    output: string;
    packagesUpdated: string[];
  }> {
    const { execa } = await import('execa');
    
    try {
      log.info('Executing: npx expo install --fix --npm');
      
      // Use --npm flag to force npm usage
      // Set NPM_CONFIG_LEGACY_PEER_DEPS to handle peer dependency conflicts in SDK 52/53
      const result = await execa('npx', ['expo', 'install', '--fix', '--npm'], {
        cwd: this.projectPath,
        all: true,
        reject: false,
        // Capture all output including stderr
        buffer: true,
        env: {
          ...process.env,
          NPM_CONFIG_LEGACY_PEER_DEPS: 'true',
          // Force color output off to avoid ANSI codes in error messages
          FORCE_COLOR: '0',
          NO_COLOR: '1'
        }
      });

      const output = result.all || result.stdout || result.stderr || '';
      
      log.info(`expo install --fix exit code: ${result.exitCode}`);
      
      if (result.exitCode !== 0) {
        log.error(`expo install --fix failed with exit code ${result.exitCode}`);
        
        // Log full error output for debugging
        if (output.length > 1000) {
          log.error(`Full output (${output.length} chars):`);
          log.error(output);
        } else {
          log.error(`Output: ${output}`);
        }
        
        // Check for yarn-related errors
        if (output.includes('yarnpkg') || output.includes('spawn yarn')) {
          log.error('\n⚠️  Yarn is not installed but your project is trying to use it.');
          log.info('\n💡 Solutions:');
          log.info('  1. Install yarn: npm install -g yarn');
          log.info('  2. Or delete yarn.lock file to use npm instead');
          log.info('  3. Or run: npx expo-upgrade-wizard upgrade --no-expo-install');
        }
      }
      
      // Parse output to find updated packages
      const packagesUpdated = this.parseUpdatedPackages(output);

      return {
        success: result.exitCode === 0,
        output,
        packagesUpdated
      };
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorOutput = error.stderr || error.stdout || '';
      
      log.error('Failed to run expo install --fix:', errorMsg);
      
      // Check for yarn-related errors
      if (errorMsg.includes('yarnpkg') || errorMsg.includes('spawn yarn') || errorMsg.includes('ENOENT') || errorOutput.includes('yarn')) {
        log.error('\n⚠️  Yarn is not installed but your project is trying to use it.');
        log.info('\n💡 Solutions:');
        log.info('  1. Install yarn: npm install -g yarn');
        log.info('  2. Or delete yarn.lock file to use npm instead');
        log.info('  3. Or run: npx expo-upgrade-wizard upgrade --no-expo-install');
      }
      
      return {
        success: false,
        output: errorMsg,
        packagesUpdated: []
      };
    }
  }



  /**
   * Parse expo install --fix output to extract updated packages
   */
  private parseUpdatedPackages(output: string): string[] {
    const packages: string[] = [];
    
    // Look for lines like "✔ Updated expo-av to 14.0.0"
    const updateRegex = /(?:Updated|Installing|Installed)\s+([a-z0-9@/-]+)(?:\s+to\s+([0-9.]+))?/gi;
    let match;
    
    while ((match = updateRegex.exec(output)) !== null) {
      const packageName = match[1];
      const version = match[2];
      packages.push(version ? `${packageName}@${version}` : packageName);
    }

    return packages;
  }

  /**
   * Downgrade to React 18.3.1 + React Native 0.76.5 (for SDK 53 stability)
   * Note: React Native 0.79.x requires React 19, so we must downgrade both
   */
  private async downgradeToReact18(): Promise<{ success: boolean }> {
    const { execa } = await import('execa');
    const fs = await import('fs-extra');
    const path = await import('path');
    
    try {
      const result = await execa(
        'npx',
        ['expo', 'install', 'react@18.3.1', 'react-dom@18.3.1', 'react-native@0.76.5'],
        {
          cwd: this.projectPath,
          all: true,
          reject: false,
          env: {
            ...process.env,
            NPM_CONFIG_LEGACY_PEER_DEPS: 'true'
          }
        }
      );
      
      if (result.exitCode !== 0) {
        const errorOutput = result.all || result.stderr || result.stdout || '';
        
        // Check for yarn not installed error
        if (errorOutput.includes('yarnpkg') || errorOutput.includes('spawn yarn')) {
          log.warn('\n⚠️  Yarn Lock File Detected but Yarn Not Installed');
          log.info('\n💡 Your project has yarn.lock but Yarn is not installed.');
          log.info('   React 18 downgrade skipped. To manually downgrade:\n');
          
          console.log(
            boxen(
              chalk.yellow.bold('Option 1: Install Yarn (Recommended)\n\n') +
                chalk.white('npm install -g yarn\n') +
                chalk.white('npx expo install react@18.3.1 react-dom@18.3.1 react-native@0.76.5\n') +
                chalk.white('npx expo start --clear\n\n') +
                chalk.yellow.bold('Option 2: Switch to npm (Easier)\n\n') +
                chalk.white('del yarn.lock\n') +
                chalk.white('npx expo install react@18.3.1 react-dom@18.3.1 react-native@0.76.5\n') +
                chalk.white('npx expo start --clear\n\n') +
                chalk.yellow.bold('Option 3: Force with npm\n\n') +
                chalk.white('npm install react@18.3.1 react-dom@18.3.1 react-native@0.76.5 --legacy-peer-deps --force\n') +
                chalk.white('npx expo start --clear\n\n') +
                chalk.gray('Note: Your app works fine with React 19 + RN 0.79.6 (current state)'),
              { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
            )
          );
          
          return { success: false };
        }
        
        // Check for peer dependency conflicts
        if (errorOutput.includes('ERESOLVE') || errorOutput.includes('peer dep')) {
          log.warn('\n⚠️  Peer Dependency Conflict');
          log.info('\n💡 React Native 0.79.x requires React 19.');
          log.info('   Your app is currently on React 19 + RN 0.79.6 (recommended).');
          log.info('   To use React 18, you would need to downgrade both together.');
          log.info('   Continuing with React 19 is the better choice for SDK 53.');
          return { success: false };
        }
        
        // Generic error
        log.warn('\n⚠️  React 18 Downgrade Failed');
        log.info('\n💡 Your app is on React 19 + React Native 0.79.6');
        log.info('   This is actually the recommended configuration for SDK 53!');
        log.info('   React 19 + RN 0.79.6 includes important Hermes fixes.');
        
        if (errorOutput && errorOutput.length < 1000) {
          log.debug(`\nError details: ${errorOutput}`);
        }
        
        return { success: false };
      }
      
      return { success: true };
    } catch (error: any) {
      const errorMsg = String(error.message || error);
      
      // Check for yarn-related errors
      if (errorMsg.includes('yarnpkg') || errorMsg.includes('spawn yarn')) {
        log.warn('\n⚠️  Yarn Not Installed');
        log.info('\n💡 Your project uses Yarn but it\'s not installed.');
        log.info('   Continuing with React 19 + RN 0.79.6 (recommended for SDK 53).');
        log.info('\n   To manually switch to React 18 later:');
        log.info('   1. Install Yarn: npm install -g yarn');
        log.info('   2. Run: npx expo install react@18.3.1 react-dom@18.3.1 react-native@0.76.5');
        return { success: false };
      }
      
      log.warn('\n⚠️  React 18 Downgrade Skipped');
      log.info('\n💡 Continuing with React 19 + React Native 0.79.6');
      log.info('   This is the recommended configuration for SDK 53.');
      
      return { success: false };
    }
  }

  /**
   * Verify that expo install is available
   */
  public static async isExpoInstallAvailable(): Promise<boolean> {
    try {
      const { execa } = await import('execa');
      await execa('npx', ['expo', '--version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}
