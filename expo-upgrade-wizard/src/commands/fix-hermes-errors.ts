/**
 * Expo SDK 53 Hermes Error Detector & Auto-Fixer
 * Based on verified issues from May-October 2025
 * Sources: expo/expo GitHub, Stack Overflow, Expo Docs
 */

import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import semver from 'semver';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { log } from '../utils/logger';
import ora from 'ora';

interface HermesError {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  package?: string;
  currentVersion?: string;
  requiredVersion?: string;
  detected: boolean;
  autoFixable: boolean;
  fix?: {
    command?: string;
    metroConfig?: Record<string, any>;
    packageJson?: Record<string, any>;
    appJson?: Record<string, any>;
    description: string;
    alternativeOption?: string;
  };
  source: string;
  manualSteps?: string[];
}

interface ProjectInfo {
  projectRoot: string;
  packageJson: any;
  appJson: any;
  hasMetroConfig: boolean;
  metroContent: string;
  hasBabelConfig: boolean;
  babelContent: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
}

export async function fixHermesErrorsCommand(options: any = {}): Promise<void> {
  try {
    log.section('🔍 Expo SDK 53 Hermes Error Detection');
    console.log(chalk.gray('Scanning for known Hermes-related issues...\n'));
    
    const projectRoot = process.cwd();
    const projectInfo = await gatherProjectInfo(projectRoot);
    
    const spinner = ora('Analyzing project for Hermes errors...').start();
    const errors = await detectAllHermesErrors(projectInfo);
    spinner.stop();
    
    const detectedErrors = errors.filter(e => e.detected);
    
    if (detectedErrors.length === 0) {
      log.success('✅ No Hermes-related errors detected! Your app should be compatible with SDK 53.');
      return;
    }
    
    // Generate and display report
    displayErrorReport(detectedErrors);
    
    // Process auto-fixable errors
    const autoFixableErrors = detectedErrors.filter(e => e.autoFixable && e.fix);
    
    if (autoFixableErrors.length > 0) {
      console.log('\n' + chalk.cyan.bold(`📝 ${autoFixableErrors.length} issues can be auto-fixed`));
      
      const { proceedWithFixes } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceedWithFixes',
          message: 'Would you like to apply auto-fixes?',
          default: true
        }
      ]);
      
      if (proceedWithFixes) {
        await applyAutoFixes(autoFixableErrors, projectInfo, options);
      }
    }
    
    // Show manual fixes required
    const manualFixes = detectedErrors.filter(e => !e.autoFixable);
    if (manualFixes.length > 0) {
      displayManualFixes(manualFixes);
    }
    
    // Generate fix script
    if (!options.skipScript) {
      await generateFixScript(detectedErrors, projectInfo);
    }
    
    // Final recommendations
    displayNextSteps();
    
  } catch (error) {
    log.error('Failed to fix Hermes errors:', error);
    process.exit(1);
  }
}

async function gatherProjectInfo(projectRoot: string): Promise<ProjectInfo> {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const appJsonPath = path.join(projectRoot, 'app.json');
  const metroConfigPath = path.join(projectRoot, 'metro.config.js');
  const babelConfigPath = path.join(projectRoot, 'babel.config.js');
  
  const packageJson = await fs.readJson(packageJsonPath);
  const appJson = await fs.pathExists(appJsonPath) ? await fs.readJson(appJsonPath) : {};
  
  const hasMetroConfig = await fs.pathExists(metroConfigPath);
  const metroContent = hasMetroConfig ? await fs.readFile(metroConfigPath, 'utf-8') : '';
  
  const hasBabelConfig = await fs.pathExists(babelConfigPath);
  const babelContent = hasBabelConfig ? await fs.readFile(babelConfigPath, 'utf-8') : '';
  
  // Detect package manager
  let packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' = 'npm';
  if (await fs.pathExists(path.join(projectRoot, 'yarn.lock'))) {
    packageManager = 'yarn';
  } else if (await fs.pathExists(path.join(projectRoot, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  } else if (await fs.pathExists(path.join(projectRoot, 'bun.lockb'))) {
    packageManager = 'bun';
  }
  
  return {
    projectRoot,
    packageJson,
    appJson,
    hasMetroConfig,
    metroContent,
    hasBabelConfig,
    babelContent,
    packageManager
  };
}

async function detectAllHermesErrors(projectInfo: ProjectInfo): Promise<HermesError[]> {
  const errors: HermesError[] = [];
  const deps = { ...projectInfo.packageJson.dependencies, ...projectInfo.packageJson.devDependencies };
  
  // 1. Check styled-components "Property 'document' doesn't exist" error
  const scVersion = deps['styled-components'];
  if (scVersion) {
    const currentVersion = semver.coerce(scVersion);
    const isOutdated = currentVersion && semver.lt(currentVersion, '6.1.19');
    
    errors.push({
      type: 'STYLED_COMPONENTS_DOCUMENT_ERROR',
      severity: 'HIGH',
      message: "Property 'document' doesn't exist error will occur with styled-components",
      package: 'styled-components',
      currentVersion: scVersion,
      requiredVersion: '^6.1.19',
      detected: !!isOutdated,
      autoFixable: true,
      fix: {
        command: `${projectInfo.packageManager} ${projectInfo.packageManager === 'npm' ? 'install' : 'add'} styled-components@^6.1.19`,
        description: 'Update styled-components to version with SDK 53 compatibility fix'
      },
      source: 'GitHub Issue styled-components/styled-components#5581'
    });
  }
  
  // 2. Check Firebase "Component auth has not been registered yet" error
  const hasFirebase = deps['firebase'] || deps['@firebase/auth'] || deps['@firebase/firestore'];
  if (hasFirebase) {
    const needsMetroFix = !projectInfo.metroContent.includes('unstable_enablePackageExports') ||
                          !projectInfo.metroContent.includes('sourceExts') ||
                          !projectInfo.metroContent.includes('cjs');
    
    errors.push({
      type: 'FIREBASE_AUTH_NOT_REGISTERED',
      severity: 'CRITICAL',
      message: 'Component auth has not been registered yet error will occur',
      package: 'firebase',
      detected: needsMetroFix,
      autoFixable: true,
      fix: {
        metroConfig: {
          'resolver.sourceExts': ['push', 'cjs'],
          'resolver.unstable_enablePackageExports': false
        },
        description: 'Add Firebase compatibility settings to metro.config.js',
        alternativeOption: 'Migrate to @react-native-firebase for better compatibility'
      },
      source: 'GitHub Issue expo/expo#36588 & Stack Overflow Q79602687',
      manualSteps: [
        'Alternative: Migrate to React Native Firebase',
        '1. npm uninstall firebase @firebase/auth @firebase/firestore',
        '2. npx expo install @react-native-firebase/app @react-native-firebase/auth',
        '3. Update all Firebase imports and API calls',
        '4. See docs/SDK53_MIGRATION_GUIDE.md for examples'
      ]
    });
  }
  
  // 3. Check RuntimeVersion mismatch
  const hasRuntimeVersion = projectInfo.appJson?.expo?.runtimeVersion;
  errors.push({
    type: 'MISSING_RUNTIME_VERSION',
    severity: 'HIGH',
    message: 'Hermes bytecode mismatch risk - app may crash on updates',
    detected: !hasRuntimeVersion,
    autoFixable: true,
    fix: {
      appJson: {
        expo: {
          runtimeVersion: '1.0.0'
        }
      },
      description: 'Add runtimeVersion field to app.json to prevent bytecode incompatibility'
    },
    source: 'Expo Documentation - Using Hermes Engine'
  });
  
  // 4. Check New Architecture incompatible packages
  const incompatiblePackages = [
    { old: '@react-native-community/masked-view', new: '@react-native-masked-view/masked-view' },
    { old: '@react-native-community/clipboard', new: '@react-native-clipboard/clipboard' },
    { old: 'rn-fetch-blob', new: 'react-native-blob-util' },
    { old: 'react-native-fs', new: 'expo-file-system' },
    { old: 'react-native-geolocation-service', new: 'expo-location' },
    { old: 'react-native-datepicker', new: '@react-native-community/datetimepicker' }
  ];
  
  incompatiblePackages.forEach(({ old: oldPkg, new: newPkg }) => {
    if (deps[oldPkg]) {
      errors.push({
        type: 'INCOMPATIBLE_PACKAGE',
        severity: 'HIGH',
        message: `${oldPkg} is not compatible with New Architecture`,
        package: oldPkg,
        detected: true,
        autoFixable: true,
        fix: {
          command: `${projectInfo.packageManager} ${projectInfo.packageManager === 'npm' ? 'uninstall' : 'remove'} ${oldPkg} && ${projectInfo.packageManager} ${projectInfo.packageManager === 'npm' ? 'install' : 'add'} ${newPkg}`,
          description: `Replace with ${newPkg} for New Architecture compatibility`
        },
        source: 'Expo New Architecture Documentation'
      });
    }
  });
  
  // Check version-specific packages
  const versionChecks = [
    { name: 'react-native-maps', minVersion: '1.20.0', severity: 'MEDIUM' as const },
    { name: '@stripe/react-native', minVersion: '0.45.0', severity: 'HIGH' as const }
  ];
  
  versionChecks.forEach(({ name, minVersion, severity }) => {
    const version = deps[name];
    if (version) {
      const currentVersion = semver.coerce(version);
      const isOutdated = currentVersion && semver.lt(currentVersion, minVersion);
      
      if (isOutdated) {
        errors.push({
          type: 'OUTDATED_PACKAGE_VERSION',
          severity,
          message: `${name} needs update for New Architecture support`,
          package: name,
          currentVersion: version,
          requiredVersion: `>= ${minVersion}`,
          detected: true,
          autoFixable: true,
          fix: {
            command: `${projectInfo.packageManager} ${projectInfo.packageManager === 'npm' ? 'install' : 'add'} ${name}@latest`,
            description: `Update to version ${minVersion} or higher for New Architecture support`
          },
          source: 'Expo SDK 53 Changelog'
        });
      }
    }
  });
  
  // 5. Check "Property 'require' doesn't exist" error (not easily automatable)
  const hasPolyfillIssue = false; // This is a React Native bug, hard to detect
  if (hasPolyfillIssue) {
    errors.push({
      type: 'PROPERTY_REQUIRE_ERROR',
      severity: 'HIGH',
      message: "Property 'require' doesn't exist - React Native 0.79 polyfill bug",
      detected: false,
      autoFixable: false,
      source: 'GitHub Issue expo/expo#39474',
      manualSteps: [
        'This is a React Native 0.79 bug',
        'Check if error occurs in node_modules/@react-native/js-polyfills/console.js:654',
        'Consider downgrading to SDK 52 if critical'
      ]
    });
  }
  
  // 6. Check Node standard library import error
  const problematicPackages = ['ws', 'socket.io-client', 'axios'];
  const hasNodeStdlibIssue = problematicPackages.some(pkg => deps[pkg]) && 
                              (!projectInfo.metroContent.includes('unstable_enablePackageExports'));
  
  if (hasNodeStdlibIssue) {
    errors.push({
      type: 'NODE_STDLIB_IMPORT_ERROR',
      severity: 'MEDIUM',
      message: 'Packages may attempt to import Node standard library modules',
      detected: true,
      autoFixable: true,
      fix: {
        metroConfig: {
          'resolver.unstable_enablePackageExports': false
        },
        description: 'Disable package.json exports in Metro to prevent Node stdlib errors'
      },
      source: 'Expo SDK 53 Changelog + GitHub Issue #36477'
    });
  }
  
  return errors;
}

function displayErrorReport(errors: HermesError[]): void {
  console.log('\n' + '═'.repeat(70));
  console.log(chalk.bold.white('   EXPO SDK 53 HERMES ERROR DETECTION REPORT'));
  console.log('═'.repeat(70) + '\n');
  
  console.log(chalk.yellow(`⚠️  Found ${errors.length} potential Hermes-related issues:\n`));
  
  // Group by severity
  const critical = errors.filter(e => e.severity === 'CRITICAL');
  const high = errors.filter(e => e.severity === 'HIGH');
  const medium = errors.filter(e => e.severity === 'MEDIUM');
  const low = errors.filter(e => e.severity === 'LOW');
  
  if (critical.length > 0) {
    console.log(chalk.red.bold('🔴 CRITICAL ISSUES:'));
    critical.forEach((error, index) => {
      console.log(chalk.red(`  ${index + 1}. ${error.type}`));
      console.log(`     ${chalk.white(error.message)}`);
      if (error.package) {
        console.log(`     Package: ${chalk.cyan(error.package)}`);
        if (error.currentVersion) {
          console.log(`     Current: ${chalk.gray(error.currentVersion)} → Required: ${chalk.green(error.requiredVersion || 'latest')}`);
        }
      }
      console.log(`     Auto-fixable: ${error.autoFixable ? chalk.green('✓ Yes') : chalk.yellow('✗ No')}`);
      console.log(`     Source: ${chalk.gray(error.source)}\n`);
    });
  }
  
  if (high.length > 0) {
    console.log(chalk.yellow.bold('🟡 HIGH PRIORITY ISSUES:'));
    high.forEach((error, index) => {
      console.log(chalk.yellow(`  ${index + 1}. ${error.type}`));
      console.log(`     ${chalk.white(error.message)}`);
      if (error.package) {
        console.log(`     Package: ${chalk.cyan(error.package)}`);
      }
      console.log(`     Auto-fixable: ${error.autoFixable ? chalk.green('✓ Yes') : chalk.yellow('✗ No')}`);
      console.log(`     Source: ${chalk.gray(error.source)}\n`);
    });
  }
  
  if (medium.length > 0) {
    console.log(chalk.blue.bold('🔵 MEDIUM PRIORITY ISSUES:'));
    medium.forEach((error, index) => {
      console.log(chalk.blue(`  ${index + 1}. ${error.type}`));
      console.log(`     ${chalk.white(error.message)}`);
      console.log(`     Source: ${chalk.gray(error.source)}\n`);
    });
  }
  
  console.log('═'.repeat(70) + '\n');
}

async function applyAutoFixes(errors: HermesError[], projectInfo: ProjectInfo, options: any): Promise<void> {
  console.log(chalk.cyan.bold('\n🔧 Applying Auto-Fixes...\n'));
  
  for (const error of errors) {
    if (!error.fix) continue;
    
    const spinner = ora(`Fixing: ${error.type}`).start();
    
    try {
      if (options.dryRun) {
        spinner.info(`[DRY RUN] Would fix: ${error.type}`);
        console.log(chalk.gray(`  ${error.fix.description}`));
        if (error.fix.command) {
          console.log(chalk.gray(`  Command: ${error.fix.command}`));
        }
        continue;
      }
      
      // Apply command fix
      if (error.fix.command) {
        try {
          execSync(error.fix.command, { 
            cwd: projectInfo.projectRoot, 
            stdio: 'pipe' 
          });
        } catch (cmdError) {
          spinner.warn(`Command failed for ${error.type}, may need manual intervention`);
          continue;
        }
      }
      
      // Apply metro.config.js fixes
      if (error.fix.metroConfig) {
        await fixMetroConfig(projectInfo, error.fix.metroConfig);
      }
      
      // Apply package.json fixes
      if (error.fix.packageJson) {
        const packageJsonPath = path.join(projectInfo.projectRoot, 'package.json');
        const packageJson = await fs.readJson(packageJsonPath);
        Object.assign(packageJson, error.fix.packageJson);
        await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      }
      
      // Apply app.json fixes
      if (error.fix.appJson) {
        const appJsonPath = path.join(projectInfo.projectRoot, 'app.json');
        const appJson = await fs.pathExists(appJsonPath) ? await fs.readJson(appJsonPath) : {};
        
        // Deep merge for nested objects
        if (error.fix.appJson.expo) {
          if (!appJson.expo) appJson.expo = {};
          Object.assign(appJson.expo, error.fix.appJson.expo);
        } else {
          Object.assign(appJson, error.fix.appJson);
        }
        
        await fs.writeJson(appJsonPath, appJson, { spaces: 2 });
      }
      
      spinner.succeed(`Fixed: ${error.type}`);
      
    } catch (fixError) {
      spinner.fail(`Failed to fix: ${error.type}`);
      console.log(chalk.red(`  Error: ${fixError}`));
    }
  }
}

async function fixMetroConfig(projectInfo: ProjectInfo, metroFixes: Record<string, any>): Promise<void> {
  const metroConfigPath = path.join(projectInfo.projectRoot, 'metro.config.js');
  
  // Backup existing config
  if (projectInfo.hasMetroConfig) {
    const backupPath = path.join(projectInfo.projectRoot, 'metro.config.js.backup');
    await fs.copy(metroConfigPath, backupPath);
  }
  
  // Generate new metro config with fixes
  const metroConfig = `const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo SDK 53 Hermes compatibility fixes
config.resolver = config.resolver || {};

// Fix for Firebase and other packages with package.json exports
config.resolver.unstable_enablePackageExports = false;

// Add support for .cjs files (Firebase compatibility)
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'cjs'];

// Additional resolver settings for compatibility
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
`;
  
  await fs.writeFile(metroConfigPath, metroConfig);
}

function displayManualFixes(errors: HermesError[]): void {
  if (errors.length === 0) return;
  
  console.log('\n' + chalk.yellow.bold('📝 Manual Fixes Required:'));
  console.log(chalk.gray('─'.repeat(60)) + '\n');
  
  errors.forEach((error, index) => {
    console.log(chalk.yellow(`${index + 1}. ${error.type}`));
    console.log(`   ${error.message}`);
    
    if (error.manualSteps && error.manualSteps.length > 0) {
      console.log(chalk.cyan('   Steps to fix:'));
      error.manualSteps.forEach(step => {
        console.log(`     ${step}`);
      });
    }
    
    if (error.fix?.alternativeOption) {
      console.log(chalk.blue(`   Alternative: ${error.fix.alternativeOption}`));
    }
    
    console.log();
  });
}

async function generateFixScript(errors: HermesError[], projectInfo: ProjectInfo): Promise<void> {
  const fixCommands = errors
    .filter(e => e.autoFixable && e.fix?.command)
    .map(e => e.fix!.command!);
  
  if (fixCommands.length === 0) return;
  
  const scriptContent = `#!/bin/bash
# Expo SDK 53 Hermes Error Auto-Fix Script
# Generated on ${new Date().toISOString()}

echo "🚀 Starting Expo SDK 53 Hermes error fixes..."

${fixCommands.join('\n\n')}

echo "✅ All fixes applied! Please run:"
echo "  npx expo start --clear"
echo "  npx expo prebuild --clean"
`;
  
  const scriptPath = path.join(projectInfo.projectRoot, 'fix-hermes-errors.sh');
  await fs.writeFile(scriptPath, scriptContent);
  await fs.chmod(scriptPath, '755');
  
  console.log(chalk.green(`\n📝 Generated fix script: ${scriptPath}`));
  console.log(chalk.gray('   Run with: ./fix-hermes-errors.sh'));
}

function displayNextSteps(): void {
  console.log('\n' + chalk.cyan.bold('📋 Next Steps:'));
  console.log('─'.repeat(40));
  
  const steps = [
    '1. Run: npx expo-doctor@latest',
    '2. Clear all caches: npx expo start --clear',
    '3. Clean rebuild: npx expo prebuild --clean', 
    '4. Test your app thoroughly',
    '5. Check migration guide for detailed examples'
  ];
  
  steps.forEach(step => {
    console.log(chalk.white(`  ${step}`));
  });
  
  console.log('\n' + chalk.gray('For more information, see:'));
  console.log(chalk.blue('  • https://expo.dev/changelog/sdk-53'));
  console.log(chalk.blue('  • https://docs.expo.dev/guides/new-architecture/'));
  console.log();
}

// Export for use in other commands
export async function detectHermesErrors(projectRoot?: string): Promise<HermesError[]> {
  const root = projectRoot || process.cwd();
  const projectInfo = await gatherProjectInfo(root);
  return detectAllHermesErrors(projectInfo);
}

export async function autoFixHermesErrors(errors: HermesError[], options?: any): Promise<void> {
  const projectInfo = await gatherProjectInfo(process.cwd());
  const autoFixable = errors.filter(e => e.autoFixable && e.fix);
  await applyAutoFixes(autoFixable, projectInfo, options || {});
}
