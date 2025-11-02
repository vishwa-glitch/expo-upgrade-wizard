import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { BreakingChange } from '../data/breaking-changes.js';
import { isVersionCompatible, getPackageCompatibility } from '../data/package-compatibility.js';
import * as semver from 'semver';
import {
  getPackageVersion,
  EXPO_CORE_PACKAGES,
  PACKAGE_VERSION_OVERRIDES,
  getDeprecatedPackages,
  DEPRECATED_PACKAGES,
  getSdkInfo
} from '../data/sdk-versions.js';

export interface UpgradeResult {
  updated: string[];
  skipped: string[];
  removed: string[];
  errors: string[];
  packageJson: any;
}

export class PackageUpgrader {
  private analysis: any;
  private targetSdk: string;
  private strategy: 'conservative' | 'recommended' | 'aggressive';
  private packageJsonPath: string;

  constructor(
    analysis: any,
    targetSdk: string,
    strategy: 'conservative' | 'recommended' | 'aggressive' = 'recommended'
  ) {
    this.analysis = analysis;
    this.targetSdk = targetSdk;
    this.strategy = strategy;
    this.packageJsonPath = path.join(analysis.projectPath, 'package.json');
  }

  public async upgrade(dryRun = false): Promise<UpgradeResult> {
    const result: UpgradeResult = {
      updated: [],
      skipped: [],
      removed: [],
      errors: [],
      packageJson: null
    };

    try {
      // Read current package.json
      const packageJson = await fs.readJson(this.packageJsonPath);
      const { dependencies = {}, devDependencies = {} } = packageJson;

      // Remove deprecated packages first
      for (const packageName of getDeprecatedPackages(this.targetSdk)) {
        if (dependencies[packageName]) {
          delete dependencies[packageName];
          result.removed.push(packageName);
          const info = DEPRECATED_PACKAGES[packageName];
          logger.warn(`Removing deprecated package: ${packageName}`);
          if (info.replacement) {
            logger.info(`  → Replace with: ${info.replacement}`);
          }
          if (info.reason) {
            logger.info(`  → Reason: ${info.reason}`);
          }
        } else if (devDependencies[packageName]) {
          delete devDependencies[packageName];
          if (!result.removed.includes(packageName)) {
            result.removed.push(packageName);
          }
        }
      }

      // Get target SDK info
      const sdkInfo = getSdkInfo(this.targetSdk);
      if (!sdkInfo) {
        throw new Error(`SDK ${this.targetSdk} not found in compatibility matrix`);
      }

      // Update expo package
      if (dependencies.expo || devDependencies.expo) {
        const isDevDep = !dependencies.expo;
        const deps = isDevDep ? devDependencies : dependencies;
        
        deps.expo = sdkInfo.expoPackageVersion;
        result.updated.push('expo');
        logger.info(`Updated expo to ${sdkInfo.expoPackageVersion}`);
      }

      // Update React Native
      if (dependencies['react-native'] || devDependencies['react-native']) {
        const isDevDep = !dependencies['react-native'];
        const deps = isDevDep ? devDependencies : dependencies;
        
        deps['react-native'] = sdkInfo.reactNativeVersion;
        result.updated.push('react-native');
        logger.info(`Updated react-native to ${sdkInfo.reactNativeVersion}`);
      }

      // Update React and React DOM (match with React Native version)
      const reactVersion = this.getReactVersionForRN(sdkInfo.reactNativeVersion);
      
      if (dependencies.react || devDependencies.react) {
        const isDevDep = !dependencies.react;
        const deps = isDevDep ? devDependencies : dependencies;
        
        deps.react = reactVersion;
        result.updated.push('react');
        logger.info(`Updated react to ${reactVersion}`);
      }
      
      // Update react-dom to match React version
      if (dependencies['react-dom'] || devDependencies['react-dom']) {
        const isDevDep = !dependencies['react-dom'];
        const deps = isDevDep ? devDependencies : dependencies;
        
        deps['react-dom'] = reactVersion;
        result.updated.push('react-dom');
        logger.info(`Updated react-dom to ${reactVersion}`);
      }
      
      // Update @types/react to match React version
      if (dependencies['@types/react'] || devDependencies['@types/react']) {
        const isDevDep = !dependencies['@types/react'];
        const deps = isDevDep ? devDependencies : dependencies;
        const typesVersion = reactVersion.startsWith('18.3') ? '~18.3.0' : 
                            reactVersion.startsWith('18.2') ? '~18.2.0' : '~18.0.0';
        
        deps['@types/react'] = typesVersion;
        result.updated.push('@types/react');
        logger.info(`Updated @types/react to ${typesVersion}`);
      }

      // Update Expo packages based on strategy
      await this.updateExpoPackages(
        dependencies,
        devDependencies,
        result
      );

      // Update commonly used React Native community packages
      await this.updateCommunityPackages(
        dependencies,
        devDependencies,
        result
      );

      // Save updated package.json
      if (!dryRun) {
        await fs.writeJson(this.packageJsonPath, packageJson, { spaces: 2 });
        const changesSummary = [
          result.updated.length > 0 ? `${result.updated.length} updated` : null,
          result.removed.length > 0 ? `${result.removed.length} removed` : null
        ].filter(Boolean).join(', ');
        logger.info(`Updated package.json: ${changesSummary}`);
      }

      result.packageJson = packageJson;

    } catch (error: any) {
      logger.error('Failed to upgrade packages:', error);
      result.errors.push(`Package upgrade failed: ${error}`);
    }

    return result;
  }

  private getReactVersionForRN(reactNativeVersion: string): string {
    // Map React Native versions to React versions
    const rnMajor = semver.major(reactNativeVersion);
    const rnMinor = semver.minor(reactNativeVersion);
    
    if (rnMajor === 0 && rnMinor >= 76) {
      return '18.3.1';
    } else if (rnMajor === 0 && rnMinor >= 74) {
      return '18.2.0';
    } else if (rnMajor === 0 && rnMinor >= 72) {
      return '18.2.0';
    } else if (rnMajor === 0 && rnMinor >= 71) {
      return '18.2.0';
    }
    
    return '18.2.0'; // Default to 18.2.0
  }

  private shouldUpdatePackage(name: string, currentVersion: string, newVersion: string): boolean {
    if (this.strategy === 'aggressive') {
      return true;
    }
    
    if (this.strategy === 'conservative') {
      // Only update if major version changes
      const currentMajor = semver.major(semver.coerce(currentVersion) || '0.0.0');
      const newMajor = semver.major(semver.coerce(newVersion) || '0.0.0');
      return currentMajor !== newMajor;
    }
    
    // Recommended strategy: update if version is different
    return currentVersion !== newVersion;
  }

  private async getLatestCompatibleVersion(packageName: string): Promise<string | null> {
    // In a real implementation, this would fetch from npm registry
    // For now, return a placeholder
    return `~${semver.major(this.targetSdk)}.0.0`;
  }

  private async updateExpoPackages(
    dependencies: Record<string, string>,
    devDependencies: Record<string, string>,
    result: UpgradeResult
  ): Promise<void> {
    const allDeps = { ...dependencies, ...devDependencies };
    
    for (const [name, currentVersion] of Object.entries(allDeps)) {
      // Skip if already updated
      if (result.updated.includes(name)) {
        continue;
      }

      // Check if it's an Expo package
      if (!name.startsWith('expo') && !name.startsWith('@expo')) {
        continue;
      }

      const newVersion = getPackageVersion(name, this.targetSdk);
      
      if (newVersion) {
        // Determine if it's in dependencies or devDependencies
        const isDevDep = !dependencies[name];
        const deps = isDevDep ? devDependencies : dependencies;
        
        // Apply strategy
        if (this.shouldUpdatePackage(name, currentVersion, newVersion)) {
          deps[name] = newVersion;
          result.updated.push(name);
          logger.info(`Updated ${name} from ${currentVersion} to ${newVersion}`);
        } else {
          result.skipped.push(name);
        }
      } else if (this.strategy === 'aggressive') {
        // For aggressive strategy, try to update to latest compatible version
        const latestVersion = await this.getLatestCompatibleVersion(name);
        if (latestVersion) {
          const isDevDep = !dependencies[name];
          const deps = isDevDep ? devDependencies : dependencies;
          deps[name] = latestVersion;
          result.updated.push(name);
          logger.warn(`Package ${name} has a non-exact version: ${currentVersion}`);
        }
      }
    }
  }

  private async updateCommunityPackages(
    dependencies: Record<string, string>,
    devDependencies: Record<string, string>,
    result: UpgradeResult
  ): Promise<void> {
    const overrides = PACKAGE_VERSION_OVERRIDES[this.targetSdk] || {};
    
    for (const [name, newVersion] of Object.entries(overrides)) {
      // Skip if already updated (prevents double updates for React, etc.)
      if (result.updated.includes(name)) {
        continue;
      }
      
      if (dependencies[name] || devDependencies[name]) {
        const isDevDep = !dependencies[name];
        const deps = isDevDep ? devDependencies : dependencies;
        const currentVersion = deps[name];
        
        if (this.shouldUpdatePackage(name, currentVersion, newVersion)) {
          deps[name] = newVersion;
          result.updated.push(name);
          logger.info(`Updated ${name} from ${currentVersion} to ${newVersion}`);
        } else {
          result.skipped.push(name);
        }
      }
    }
  }

  public async validateDependencies(): Promise<{
    valid: boolean;
    issues: string[];
    detailedIssues?: Array<{
      package: string;
      currentVersion: string;
      issue: string;
      severity: 'critical' | 'warning' | 'info';
      recommendation?: string;
      breakingChanges?: string[];
      migrationSteps?: string[];
    }>;
  }> {
    const issues: string[] = [];
    const detailedIssues: Array<{
      package: string;
      currentVersion: string;
      issue: string;
      severity: 'critical' | 'warning' | 'info';
      recommendation?: string;
      breakingChanges?: string[];
      migrationSteps?: string[];
    }> = [];
    
    try {
      const packageJson = await fs.readJson(this.packageJsonPath);
      const { dependencies = {}, devDependencies = {} } = packageJson;
      const allDeps = { ...dependencies, ...devDependencies };
      
      // Check React Native package compatibility
      for (const [name, version] of Object.entries(allDeps)) {
        const versionStr = String(version);
        
        // Check against our compatibility database
        const compatCheck = isVersionCompatible(name, versionStr, this.targetSdk);
        
        if (!compatCheck.compatible) {
          // Critical issue - package is incompatible
          issues.push(`${name}@${versionStr} is incompatible with SDK ${this.targetSdk}`);
          detailedIssues.push({
            package: name,
            currentVersion: versionStr,
            issue: compatCheck.reason || 'Version incompatibility detected',
            severity: 'critical',
            recommendation: compatCheck.recommendation,
            breakingChanges: compatCheck.breakingChanges,
            migrationSteps: compatCheck.migrationSteps
          });
        } else if (compatCheck.recommendation) {
          // Warning - package works but update recommended
          const compatibility = getPackageCompatibility(name, this.targetSdk);
          if (compatibility && compatibility.breakingChanges) {
            issues.push(`${name}@${versionStr} has breaking changes for SDK ${this.targetSdk}`);
            detailedIssues.push({
              package: name,
              currentVersion: versionStr,
              issue: 'Package has breaking changes in this SDK version',
              severity: 'warning',
              recommendation: compatCheck.recommendation,
              breakingChanges: compatibility.breakingChanges,
              migrationSteps: compatibility.migrationSteps
            });
          } else if (compatCheck.reason) {
            issues.push(`${name}@${versionStr}: ${compatCheck.reason}`);
            detailedIssues.push({
              package: name,
              currentVersion: versionStr,
              issue: compatCheck.reason,
              severity: 'info',
              recommendation: compatCheck.recommendation
            });
          }
        }
        
        // Special check for Expo packages
        if (name.startsWith('expo-') || name === 'expo') {
          // Parse SDK version from Expo package versions
          const expectedVersion = `~${semver.major(this.targetSdk)}.`;
          if (!versionStr.includes(expectedVersion) && !versionStr.includes(`^${semver.major(this.targetSdk)}.`)) {
            const existingIssue = detailedIssues.find(i => i.package === name);
            if (!existingIssue) {
              issues.push(`${name}@${versionStr} may not be compatible with SDK ${this.targetSdk}`);
              detailedIssues.push({
                package: name,
                currentVersion: versionStr,
                issue: `Expo package version doesn't match SDK ${this.targetSdk}`,
                severity: 'warning',
                recommendation: `Update to version compatible with SDK ${this.targetSdk}`
              });
            }
          }
        }
      }
      
      // Check for duplicate packages
      for (const name of Object.keys(dependencies)) {
        if (devDependencies[name]) {
          issues.push(`${name} is listed in both dependencies and devDependencies`);
          detailedIssues.push({
            package: name,
            currentVersion: String(dependencies[name]),
            issue: 'Package is listed in both dependencies and devDependencies',
            severity: 'info',
            recommendation: 'Remove from devDependencies'
          });
        }
      }
      
    } catch (error) {
      issues.push(`Failed to validate dependencies: ${error}`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      detailedIssues: detailedIssues.length > 0 ? detailedIssues : undefined
    };
  }
}
