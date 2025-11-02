import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { log } from '../utils/logger';
import { getSDK53Issues, SDK53_DOCTOR_COMMAND } from '../data/sdk53-known-issues';
import { execSync } from 'child_process';
import inquirer from 'inquirer';

interface DeprecatedPackageFix {
  oldPackage: string;
  newPackage: string;
  reason: string;
  migrationSteps: string[];
  autoFixable: boolean;
}

export async function fixDeprecatedCommand(options: any = {}): Promise<void> {
  try {
    log.section('🔍 Checking for Deprecated Packages (SDK 53)');
    
    const projectRoot = process.cwd();
    const packageJsonPath = path.join(projectRoot, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      log.error('No package.json found in current directory');
      process.exit(1);
    }
    
    const packageJson = await fs.readJson(packageJsonPath);
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    const installedPackages = Object.keys(allDeps);
    const issues = getSDK53Issues(installedPackages);
    
    if (issues.replacements.length === 0 && 
        issues.deprecations.length === 0 && 
        issues.knownIssues.length === 0) {
      log.success('✅ No deprecated packages found! Your project is up to date.');
      return;
    }
    
    // Display found issues
    log.section('📦 Found Issues');
    
    if (issues.replacements.length > 0) {
      console.log(chalk.red.bold('\n❌ DEPRECATED PACKAGES (Must Replace):'));
      for (const replacement of issues.replacements) {
        console.log(chalk.yellow(`  ${replacement.old}:`));
        console.log(`    → Replace with: ${chalk.green(replacement.new)}`);
        console.log(`    Reason: ${replacement.reason}`);
      }
    }
    
    if (issues.deprecations.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  DEPRECATIONS (Will be removed in SDK 54):'));
      for (const deprecation of issues.deprecations) {
        console.log(chalk.yellow(`  ${deprecation.package}:`));
        console.log(`    → Replace with: ${chalk.green(deprecation.replacement || 'See documentation')}`);
        console.log(`    ${deprecation.description}`);
      }
    }
    
    if (issues.knownIssues.length > 0) {
      console.log(chalk.blue.bold('\nℹ️  KNOWN ISSUES:'));
      for (const issue of issues.knownIssues) {
        console.log(chalk.yellow(`  ${issue.package}:`));
        console.log(`    Issue: ${issue.issue}`);
        console.log(`    Solution: ${issue.solution}`);
        if (issue.minVersion) {
          const currentVersion = allDeps[issue.package];
          console.log(`    Current: ${currentVersion} | Required: ${issue.minVersion}+`);
        }
      }
    }
    
    // Ask user if they want to fix replacements
    if (issues.replacements.length > 0) {
      console.log();
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Would you like to automatically fix deprecated packages?',
          default: true
        }
      ]);
      
      if (proceed) {
        await fixDeprecatedPackages(issues.replacements, packageJson, options);
      }
    }
    
    // Ask user if they want to remove deprecated packages without replacements
    if (issues.deprecations.length > 0) {
      console.log();
      const { removeDeprecated } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'removeDeprecated',
          message: 'Would you like to remove deprecated packages that will be removed in SDK 54?',
          default: true
        }
      ]);
      
      if (removeDeprecated) {
        await removeDeprecatedPackages(issues.deprecations, packageJson, options);
      }
    }
    
    // Check and fix android/app/build.gradle (bundleCommand issue)
    await checkAndFixBuildGradle(options);
    
    // Check and fix metro.config.js
    await checkAndFixMetroConfig(options);
    
    // Check and fix babel.config.js
    await checkAndFixBabelConfig(options);
    
    // SDK 53 specific fixes
    await checkAndFixMetroPackageExports(options);
    await checkAndFixAndroidKotlinVersion(options);
    await checkAndFixEnableBundleCompression(options);
    await checkAndFixExpoDevClient(options);
    await checkAndFixTsConfig(options);
    await checkAndFixNewArchitecture(options);
    await checkAndFixNpmrc(options);
    
    // Suggest running expo-doctor
    log.section('🩺 Next Steps');
    log.info(`Run ${chalk.cyan(SDK53_DOCTOR_COMMAND)} to validate your project`);
    
    if (issues.deprecations.length > 0) {
      log.info('Consider replacing deprecated packages before SDK 54 release');
    }
    
  } catch (error) {
    log.error('Failed to check deprecated packages:', error);
    process.exit(1);
  }
}

async function checkAndFixBuildGradle(options: any): Promise<void> {
  const buildGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
  
  if (!await fs.pathExists(buildGradlePath)) {
    return; // No android folder, nothing to fix
  }
  
  try {
    const content = await fs.readFile(buildGradlePath, 'utf-8');
    
    // Check for deprecated bundleCommand or cliFile
    const hasBundleCommand = /bundleCommand\s*=\s*["']export:embed["']/.test(content);
    const hasCliFile = /cliFile\s*=\s*new File\(\["node",\s*"--print",\s*"require\.resolve\('@expo\/cli'\)"\]/.test(content);
    
    if (!hasBundleCommand && !hasCliFile) {
      return; // No issues found
    }
    
    log.section('🔴 CRITICAL: Deprecated bundleCommand Detected');
    console.log(chalk.red.bold('Found deprecated configuration in android/app/build.gradle:\n'));
    
    if (hasBundleCommand) {
      console.log(chalk.red('❌ bundleCommand = "export:embed"'));
      console.log(chalk.yellow('   → SDK 53 removed the export:embed command'));
    }
    
    if (hasCliFile) {
      console.log(chalk.red('❌ cliFile = new File([...])'));
      console.log(chalk.yellow('   → No longer needed in SDK 53'));
    }
    
    console.log();
    console.log(chalk.yellow('⚠️  IMPACT: Metro bundler will fail with "commands[command] is not a function"'));
    console.log();
    
    // Show what will be changed
    console.log(chalk.cyan('Preview of changes:'));
    console.log(chalk.red('  - cliFile = new File(["node", "--print", "require.resolve(\'@expo/cli\')"]...)'));
    console.log(chalk.red('  - bundleCommand = "export:embed"'));
    console.log(chalk.green('  + // Lines removed - SDK 53 uses default bundling'));
    console.log();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (remove deprecated lines)', value: 'fix' },
          { name: '2. Show me the full diff', value: 'diff' },
          { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);
    
    if (action === 'skip') {
      log.info('Skipped. You can manually remove these lines from android/app/build.gradle');
      return;
    }
    
    if (action === 'diff') {
      // Show more context
      const lines = content.split('\n');
      const reactBlockStart = lines.findIndex(line => /react\s*\{/.test(line));
      const reactBlockEnd = lines.findIndex((line, idx) => idx > reactBlockStart && line.trim() === '}');
      
      if (reactBlockStart !== -1 && reactBlockEnd !== -1) {
        console.log(chalk.cyan('\nCurrent react {} block:'));
        console.log(chalk.gray('─'.repeat(60)));
        for (let i = reactBlockStart; i <= reactBlockEnd; i++) {
          const line = lines[i];
          if (/bundleCommand|cliFile/.test(line)) {
            console.log(chalk.red(`  ${i + 1} | ${line}`));
          } else {
            console.log(chalk.gray(`  ${i + 1} | ${line}`));
          }
        }
        console.log(chalk.gray('─'.repeat(60)));
        console.log();
      }
      
      // Ask again after showing diff
      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Apply the fix now?',
          default: true
        }
      ]);
      
      if (!confirmFix) {
        log.info('Skipped. You can manually remove these lines from android/app/build.gradle');
        return;
      }
    }
    
    // Apply the fix
    if (!options.dryRun) {
      // Create backup
      const backupPath = `${buildGradlePath}.backup`;
      await fs.copy(buildGradlePath, backupPath);
      log.info(`Backup created: ${backupPath}`);
      
      // Remove the deprecated lines
      let fixedContent = content;
      
      // Remove cliFile line (may span multiple lines)
      fixedContent = fixedContent.replace(
        /\s*cliFile\s*=\s*new File\(\["node",\s*"--print",\s*"require\.resolve\('@expo\/cli'\)"\]\.execute\(null,\s*rootDir\)\.text\.trim\(\)\)\s*\n?/g,
        ''
      );
      
      // Remove bundleCommand line
      fixedContent = fixedContent.replace(
        /\s*bundleCommand\s*=\s*["']export:embed["']\s*\n?/g,
        ''
      );
      
      await fs.writeFile(buildGradlePath, fixedContent, 'utf-8');
      
      log.success('✅ Successfully fixed android/app/build.gradle');
      log.info('  Removed deprecated bundleCommand and cliFile');
      log.info(`  Backup saved to: ${path.basename(backupPath)}`);
    } else {
      log.info('[DRY RUN] Would fix android/app/build.gradle');
    }
    
  } catch (error) {
    log.error('Failed to check android/app/build.gradle:', error);
  }
}

async function checkAndFixMetroConfig(options: any): Promise<void> {
  const metroConfigPath = path.join(process.cwd(), 'metro.config.js');
  
  if (!await fs.pathExists(metroConfigPath)) {
    return; // No metro.config.js, nothing to fix
  }
  
  try {
    // Import CodeFixer to detect issues
    const { CodeFixer } = await import('../upgraders/code-fixer');
    const fixer = new CodeFixer(process.cwd());
    
    const issues = await fixer.detectMetroConfigIssues();
    
    if (issues.length === 0) {
      return; // No issues found
    }
    
    log.section('🔧 Metro Config Issues Detected');
    console.log(chalk.yellow.bold(`Found ${issues.length} issue${issues.length > 1 ? 's' : ''} in metro.config.js:\n`));
    
    issues.forEach((issue, index) => {
      const isCritical = issue.includes('build failures') || issue.includes('Missing __dirname');
      const icon = isCritical ? chalk.red('❌') : chalk.yellow('⚠️');
      console.log(`${icon} ${issue}`);
    });
    
    console.log();
    console.log(chalk.cyan('Preview of changes:'));
    
    // Show specific changes based on detected issues
    issues.forEach(issue => {
      if (issue.includes('@expo/metro-config')) {
        console.log(chalk.red(`  - require('@expo/metro-config')`));
        console.log(chalk.green(`  + require('expo/metro-config')`));
      }
      if (issue.includes('Missing __dirname')) {
        console.log(chalk.red('  - getDefaultConfig()'));
        console.log(chalk.green('  + getDefaultConfig(__dirname)'));
      }
      if (issue.includes('assetPlugins')) {
        console.log(chalk.red('  - config.transformer.assetPlugins = [...]'));
        console.log(chalk.green('  + // Removed (deprecated)'));
      }
      if (issue.includes('minifierPath')) {
        console.log(chalk.red('  - config.transformer.minifierPath = ...'));
        console.log(chalk.green('  + // Removed (deprecated)'));
      }
    });
    console.log();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (apply changes)', value: 'fix' },
          { name: '2. Show me the full file', value: 'show' },
          { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);
    
    if (action === 'skip') {
      log.info('Skipped. You can manually fix metro.config.js');
      return;
    }
    
    if (action === 'show') {
      // Show the full file content
      const content = await fs.readFile(metroConfigPath, 'utf-8');
      const lines = content.split('\n');
      
      console.log(chalk.cyan('\nCurrent metro.config.js:'));
      console.log(chalk.gray('─'.repeat(60)));
      lines.forEach((line, idx) => {
        const hasIssue = issues.some(issue => {
          if (issue.includes('@expo/metro-config') && line.includes('@expo/metro-config')) return true;
          if (issue.includes('Missing __dirname') && /getDefaultConfig\(\s*\)/.test(line)) return true;
          if (issue.includes('assetPlugins') && line.includes('assetPlugins')) return true;
          if (issue.includes('minifierPath') && line.includes('minifierPath')) return true;
          return false;
        });
        
        if (hasIssue) {
          console.log(chalk.red(`  ${idx + 1} | ${line}`));
        } else {
          console.log(chalk.gray(`  ${idx + 1} | ${line}`));
        }
      });
      console.log(chalk.gray('─'.repeat(60)));
      console.log();
      
      // Ask again after showing file
      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Apply the fixes now?',
          default: true
        }
      ]);
      
      if (!confirmFix) {
        log.info('Skipped. You can manually fix metro.config.js');
        return;
      }
    }
    
    // Apply the fix
    if (!options.dryRun) {
      // Create backup
      const backupPath = `${metroConfigPath}.backup`;
      await fs.copy(metroConfigPath, backupPath);
      log.info(`Backup created: ${path.basename(backupPath)}`);
      
      const fixed = await fixer.fixMetroConfig(false);
      if (fixed) {
        log.success('✅ Successfully fixed metro.config.js');
        log.info(`  Backup saved to: ${path.basename(backupPath)}`);
      }
    } else {
      log.info('[DRY RUN] Would fix metro.config.js');
    }
  } catch (error) {
    log.warn('Failed to check metro.config.js:', error);
  }
}

async function checkAndFixBabelConfig(options: any): Promise<void> {
  const babelConfigPath = path.join(process.cwd(), 'babel.config.js');
  
  if (!await fs.pathExists(babelConfigPath)) {
    return; // No babel.config.js, nothing to fix
  }
  
  try {
    // Import CodeFixer to detect issues
    const { CodeFixer } = await import('../upgraders/code-fixer');
    const fixer = new CodeFixer(process.cwd());
    
    const issues = await fixer.detectBabelConfigIssues();
    
    if (issues.length === 0) {
      return; // No issues found
    }
    
    log.section('🔧 Babel Config Issues Detected');
    console.log(chalk.red.bold(`Found ${issues.length} CRITICAL issue${issues.length > 1 ? 's' : ''} in babel.config.js:\n`));
    
    issues.forEach((issue) => {
      console.log(chalk.red('❌ ') + issue);
    });
    
    console.log();
    console.log(chalk.yellow('⚠️  CRITICAL: Reanimated plugin MUST be last or animations will break!'));
    console.log();
    
    console.log(chalk.cyan('Preview of changes:'));
    issues.forEach(issue => {
      if (issue.includes('Reanimated plugin is not last')) {
        console.log(chalk.yellow('  • Move react-native-reanimated/plugin to last position'));
      }
      if (issue.includes('expo-router/babel')) {
        console.log(chalk.red('  - "expo-router/babel"'));
        console.log(chalk.green('  + // Removed (now in babel-preset-expo)'));
      }
    });
    console.log();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (apply changes)', value: 'fix' },
          { name: '2. Show me the plugins array', value: 'show' },
          { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);
    
    if (action === 'skip') {
      log.info('Skipped. You can manually fix babel.config.js');
      return;
    }
    
    if (action === 'show') {
      // Show the plugins array
      const content = await fs.readFile(babelConfigPath, 'utf-8');
      const pluginsMatch = content.match(/plugins:\s*\[([\s\S]*?)\]/);
      
      if (pluginsMatch) {
        const pluginsContent = pluginsMatch[1];
        const pluginLines = pluginsContent
          .split(',')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        console.log(chalk.cyan('\nCurrent plugins array:'));
        console.log(chalk.gray('─'.repeat(60)));
        pluginLines.forEach((plugin, idx) => {
          const isReanimated = plugin.includes('react-native-reanimated/plugin');
          const isDeprecated = plugin.includes('expo-router/babel');
          const isLast = idx === pluginLines.length - 1;
          
          if (isReanimated && !isLast) {
            console.log(chalk.red(`  ${idx + 1}. ${plugin} ← MUST BE LAST!`));
          } else if (isDeprecated) {
            console.log(chalk.yellow(`  ${idx + 1}. ${plugin} ← DEPRECATED`));
          } else {
            console.log(chalk.gray(`  ${idx + 1}. ${plugin}`));
          }
        });
        console.log(chalk.gray('─'.repeat(60)));
        console.log();
      }
      
      // Ask again after showing plugins
      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Apply the fixes now?',
          default: true
        }
      ]);
      
      if (!confirmFix) {
        log.info('Skipped. You can manually fix babel.config.js');
        return;
      }
    }
    
    // Apply the fix
    if (!options.dryRun) {
      // Create backup
      const backupPath = `${babelConfigPath}.backup`;
      await fs.copy(babelConfigPath, backupPath);
      log.info(`Backup created: ${path.basename(backupPath)}`);
      
      const fixed = await fixer.fixBabelConfig(false);
      if (fixed) {
        log.success('✅ Successfully fixed babel.config.js');
        log.info('  Reanimated plugin is now in the correct position (last)');
        log.info(`  Backup saved to: ${path.basename(backupPath)}`);
      }
    } else {
      log.info('[DRY RUN] Would fix babel.config.js');
    }
  } catch (error) {
    log.warn('Failed to check babel.config.js:', error);
  }
}

async function removeDeprecatedPackages(
  deprecations: any[],
  packageJson: any,
  options: any
): Promise<void> {
  const packageManager = detectPackageManager();
  
  for (const deprecation of deprecations) {
    // Skip deprecations that have replacements (handled by fixDeprecatedPackages)
    if (deprecation.replacement && deprecation.replacement !== 'See documentation') {
      continue;
    }
    
    log.section(`Removing ${deprecation.package}`);
    
    try {
      log.info(`Removing ${deprecation.package}...`);
      log.info(`Reason: ${deprecation.description}`);
      
      if (!options.dryRun) {
        const uninstallCmd = getUninstallCommand(packageManager, deprecation.package);
        execSync(uninstallCmd, { stdio: 'inherit' });
      }
      
      log.success(`✅ Successfully removed ${deprecation.package}`);
      
    } catch (error) {
      log.error(`Failed to remove ${deprecation.package}:`, error);
      log.info('You may need to manually run:');
      log.bullet(getUninstallCommand(packageManager, deprecation.package));
    }
  }
}

async function fixDeprecatedPackages(
  replacements: any[],
  packageJson: any,
  options: any
): Promise<void> {
  const packageManager = detectPackageManager();
  
  for (const replacement of replacements) {
    log.section(`Fixing ${replacement.old}`);
    
    try {
      // Step 1: Remove old package
      log.info(`Removing ${replacement.old}...`);
      if (!options.dryRun) {
        const uninstallCmd = getUninstallCommand(packageManager, replacement.old);
        execSync(uninstallCmd, { stdio: 'inherit' });
      }
      
      // Step 2: Install new package
      log.info(`Installing ${replacement.new}...`);
      if (!options.dryRun) {
        const installCmd = getInstallCommand(packageManager, replacement.new);
        execSync(installCmd, { stdio: 'inherit' });
      }
      
      // Step 3: Show migration steps
      if (replacement.migrationSteps && replacement.migrationSteps.length > 0) {
        log.section('📝 Manual Migration Steps Required:');
        replacement.migrationSteps.forEach((step: string, index: number) => {
          if (step.includes('npm ') || step.includes('yarn ') || step.includes('pnpm ')) {
            // Skip install commands as we've already done them
            return;
          }
          console.log(chalk.yellow(`  ${index + 1}. ${step}`));
        });
      }
      
      log.success(`✅ Successfully replaced ${replacement.old} with ${replacement.new}`);
      
    } catch (error) {
      log.error(`Failed to replace ${replacement.old}:`, error);
      log.info('You may need to manually run:');
      log.bullet(getUninstallCommand(packageManager, replacement.old));
      log.bullet(getInstallCommand(packageManager, replacement.new));
    }
  }
  
  // Update imports notice
  log.section('⚠️  Important: Update Your Imports');
  console.log(chalk.yellow('You need to update your import statements:'));
  
  for (const replacement of replacements) {
    console.log(`  ${chalk.red(`- import ... from '${replacement.old}'`)}`);
    console.log(`  ${chalk.green(`+ import ... from '${replacement.new}'`)}`);
  }
  
  // Suggest searching for old imports
  log.info('\n💡 Use these commands to find files that need updating:');
  for (const replacement of replacements) {
    const searchCmd = `grep -r "${replacement.old}" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" .`;
    console.log(chalk.cyan(`  ${searchCmd}`));
  }
}

function detectPackageManager(): string {
  if (fs.existsSync('yarn.lock')) return 'yarn';
  if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (fs.existsSync('bun.lockb')) return 'bun';
  return 'npm';
}

function getInstallCommand(pm: string, packageName: string): string {
  switch (pm) {
    case 'yarn':
      return `yarn add ${packageName}`;
    case 'pnpm':
      return `pnpm add ${packageName}`;
    case 'bun':
      return `bun add ${packageName}`;
    default:
      return `npm install ${packageName}`;
  }
}

function getUninstallCommand(pm: string, packageName: string): string {
  switch (pm) {
    case 'yarn':
      return `yarn remove ${packageName}`;
    case 'pnpm':
      return `pnpm remove ${packageName}`;
    case 'bun':
      return `bun remove ${packageName}`;
    default:
      return `npm uninstall ${packageName}`;
  }
}

async function checkAndFixMetroPackageExports(options: any): Promise<void> {
  const metroConfigPath = path.join(process.cwd(), 'metro.config.js');
  
  if (!await fs.pathExists(metroConfigPath)) {
    // No metro.config.js - might need to create one
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Check if project uses packages that need this fix
    const needsFix = deps['axios'] || deps['@supabase/supabase-js'] || 
                     deps['socket.io-client'] || deps['firebase'];
    
    if (!needsFix) return;
    
    log.section('🔴 CRITICAL: Metro Package Exports Configuration Missing');
    console.log(chalk.red.bold('SDK 53 enables package.json exports by default\n'));
    console.log(chalk.red('❌ No metro.config.js found'));
    console.log(chalk.yellow('   → Will cause "Cannot find module" errors'));
    console.log(chalk.yellow('   → Affects: Axios, Supabase, Firebase, Socket.io\n'));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (create metro.config.js)', value: 'fix' },
          { name: '2. Show me the configuration', value: 'show' },
          { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);
    
    if (action === 'skip') {
      log.info('Skipped. You can manually create metro.config.js');
      return;
    }
    
    const metroConfig = `const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// CRITICAL: Disable package exports to prevent Node.js module errors
config.resolver.unstable_enablePackageExports = false;

// Additional recommended settings
config.resolver.unstable_enableSymlinks = false;
config.resolver.sourceExts = [...config.resolver.sourceExts, "cjs", "mjs"];
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

module.exports = config;
`;
    
    if (action === 'show') {
      console.log(chalk.cyan('\nProposed metro.config.js:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(metroConfig);
      console.log(chalk.gray('─'.repeat(60)));
      console.log();
      
      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Create this file now?',
          default: true
        }
      ]);
      
      if (!confirmFix) {
        log.info('Skipped. You can manually create metro.config.js');
        return;
      }
    }
    
    if (!options.dryRun) {
      await fs.writeFile(metroConfigPath, metroConfig, 'utf-8');
      log.success('✅ Successfully created metro.config.js');
      log.info('  Added package exports fix for SDK 53');
    } else {
      log.info('[DRY RUN] Would create metro.config.js');
    }
    
    return;
  }
  
  // Check existing metro.config.js
  try {
    const content = await fs.readFile(metroConfigPath, 'utf-8');
    
    if (content.includes('unstable_enablePackageExports')) {
      return; // Already configured
    }
    
    log.section('🔴 CRITICAL: Metro Package Exports Not Configured');
    console.log(chalk.red.bold('SDK 53 requires package exports to be disabled\n'));
    console.log(chalk.red('❌ metro.config.js missing unstable_enablePackageExports'));
    console.log(chalk.yellow('   → Will cause "Cannot find module" errors\n'));
    
    console.log(chalk.cyan('Preview of changes:'));
    console.log(chalk.green('  + config.resolver.unstable_enablePackageExports = false;'));
    console.log();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (add configuration)', value: 'fix' },
          { name: '2. Show me the full file', value: 'show' },
          { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);
    
    if (action === 'skip') {
      log.info('Skipped. You can manually update metro.config.js');
      return;
    }
    
    if (action === 'show') {
      const lines = content.split('\n');
      console.log(chalk.cyan('\nCurrent metro.config.js:'));
      console.log(chalk.gray('─'.repeat(60)));
      lines.forEach((line, idx) => {
        console.log(chalk.gray(`  ${idx + 1} | ${line}`));
      });
      console.log(chalk.gray('─'.repeat(60)));
      console.log();
      
      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Apply the fix now?',
          default: true
        }
      ]);
      
      if (!confirmFix) {
        log.info('Skipped. You can manually update metro.config.js');
        return;
      }
    }
    
    if (!options.dryRun) {
      const backupPath = `${metroConfigPath}.backup`;
      await fs.copy(metroConfigPath, backupPath);
      log.info(`Backup created: ${path.basename(backupPath)}`);
      
      // Add the configuration after getDefaultConfig
      let newContent = content;
      
      // Find where to insert (after config = getDefaultConfig...)
      const configMatch = content.match(/(const config = getDefaultConfig\([^)]*\);?)/);
      if (configMatch) {
        const insertion = `\n\n// CRITICAL: Disable package exports to prevent Node.js module errors\nconfig.resolver.unstable_enablePackageExports = false;\n`;
        newContent = content.replace(configMatch[0], configMatch[0] + insertion);
      }
      
      await fs.writeFile(metroConfigPath, newContent, 'utf-8');
      log.success('✅ Successfully updated metro.config.js');
      log.info(`  Backup saved to: ${path.basename(backupPath)}`);
    } else {
      log.info('[DRY RUN] Would update metro.config.js');
    }
  } catch (error) {
    log.warn('Failed to check metro.config.js:', error);
  }
}

async function checkAndFixAndroidKotlinVersion(options: any): Promise<void> {
  const buildGradlePath = path.join(process.cwd(), 'android', 'build.gradle');
  
  if (!await fs.pathExists(buildGradlePath)) {
    return; // No android folder
  }
  
  try {
    const content = await fs.readFile(buildGradlePath, 'utf-8');
    
    // Check if kotlinVersion is set to 2.0.21
    const kotlinMatch = content.match(/kotlinVersion\s*=\s*["']([^"']+)["']/);
    
    if (kotlinMatch && kotlinMatch[1] === '2.0.21') {
      return; // Already correct
    }
    
    log.section('🔴 CRITICAL: Android Kotlin Version Incorrect');
    console.log(chalk.red.bold('SDK 53 requires Kotlin 2.0.21\n'));
    
    if (kotlinMatch) {
      console.log(chalk.red(`❌ Current version: ${kotlinMatch[1]}`));
    } else {
      console.log(chalk.red('❌ kotlinVersion not set'));
    }
    console.log(chalk.yellow('   → Builds will fail with "Key 1.9.24 is missing"\n'));
    
    console.log(chalk.cyan('Preview of changes:'));
    if (kotlinMatch) {
      console.log(chalk.red(`  - kotlinVersion = "${kotlinMatch[1]}"`));
    }
    console.log(chalk.green('  + kotlinVersion = "2.0.21"'));
    console.log();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (update Kotlin version)', value: 'fix' },
          { name: '2. Show me the ext block', value: 'show' },
          { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);
    
    if (action === 'skip') {
      log.info('Skipped. You can manually update android/build.gradle');
      return;
    }
    
    if (action === 'show') {
      const lines = content.split('\n');
      const extStart = lines.findIndex(line => /ext\s*\{/.test(line));
      const extEnd = lines.findIndex((line, idx) => idx > extStart && line.trim() === '}');
      
      if (extStart !== -1 && extEnd !== -1) {
        console.log(chalk.cyan('\nCurrent ext block:'));
        console.log(chalk.gray('─'.repeat(60)));
        for (let i = extStart; i <= extEnd; i++) {
          const line = lines[i];
          if (line.includes('kotlinVersion')) {
            console.log(chalk.red(`  ${i + 1} | ${line}`));
          } else {
            console.log(chalk.gray(`  ${i + 1} | ${line}`));
          }
        }
        console.log(chalk.gray('─'.repeat(60)));
        console.log();
      }
      
      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Apply the fix now?',
          default: true
        }
      ]);
      
      if (!confirmFix) {
        log.info('Skipped. You can manually update android/build.gradle');
        return;
      }
    }
    
    if (!options.dryRun) {
      const backupPath = `${buildGradlePath}.backup`;
      await fs.copy(buildGradlePath, backupPath);
      log.info(`Backup created: ${path.basename(backupPath)}`);
      
      let newContent = content;
      
      if (kotlinMatch) {
        // Update existing kotlinVersion
        newContent = content.replace(
          /kotlinVersion\s*=\s*["'][^"']+["']/,
          'kotlinVersion = "2.0.21"'
        );
      } else {
        // Add kotlinVersion to ext block
        newContent = content.replace(
          /(ext\s*\{[^}]*)(targetSdkVersion\s*=\s*\d+)/,
          '$1$2\n        kotlinVersion = "2.0.21"'
        );
      }
      
      await fs.writeFile(buildGradlePath, newContent, 'utf-8');
      log.success('✅ Successfully updated android/build.gradle');
      log.info(`  Backup saved to: ${path.basename(backupPath)}`);
      log.warn('⚠️  This fix is LOST on "expo prebuild --clean" - must reapply!');
    } else {
      log.info('[DRY RUN] Would update android/build.gradle');
    }
  } catch (error) {
    log.warn('Failed to check android/build.gradle:', error);
  }
}

async function checkAndFixEnableBundleCompression(options: any): Promise<void> {
  const appBuildGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
  
  if (!await fs.pathExists(appBuildGradlePath)) {
    return; // No android folder
  }
  
  try {
    const content = await fs.readFile(appBuildGradlePath, 'utf-8');
    
    if (!content.includes('enableBundleCompression')) {
      return; // Already removed
    }
    
    log.section('🔴 CRITICAL: Deprecated enableBundleCompression Found');
    console.log(chalk.red.bold('This property was removed in React Native 0.76.x\n'));
    console.log(chalk.red('❌ enableBundleCompression property found'));
    console.log(chalk.yellow('   → Causes build failures\n'));
    
    console.log(chalk.cyan('Preview of changes:'));
    console.log(chalk.red('  - enableBundleCompression = ...'));
    console.log(chalk.green('  + // Removed (deprecated in RN 0.76)'));
    console.log();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (remove property)', value: 'fix' },
          { name: '2. Show me the line', value: 'show' },
          { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);
    
    if (action === 'skip') {
      log.info('Skipped. You can manually update android/app/build.gradle');
      return;
    }
    
    if (action === 'show') {
      const lines = content.split('\n');
      console.log(chalk.cyan('\nLines with enableBundleCompression:'));
      console.log(chalk.gray('─'.repeat(60)));
      lines.forEach((line, idx) => {
        if (line.includes('enableBundleCompression')) {
          console.log(chalk.red(`  ${idx + 1} | ${line}`));
        }
      });
      console.log(chalk.gray('─'.repeat(60)));
      console.log();
      
      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Remove this line now?',
          default: true
        }
      ]);
      
      if (!confirmFix) {
        log.info('Skipped. You can manually update android/app/build.gradle');
        return;
      }
    }
    
    if (!options.dryRun) {
      const backupPath = `${appBuildGradlePath}.backup`;
      await fs.copy(appBuildGradlePath, backupPath);
      log.info(`Backup created: ${path.basename(backupPath)}`);
      
      // Remove the line
      const newContent = content.replace(
        /\s*enableBundleCompression\s*=\s*[^\n]+\n?/g,
        ''
      );
      
      await fs.writeFile(appBuildGradlePath, newContent, 'utf-8');
      log.success('✅ Successfully updated android/app/build.gradle');
      log.info(`  Backup saved to: ${path.basename(backupPath)}`);
      log.warn('⚠️  This fix is LOST on "expo prebuild --clean" - must reapply!');
    } else {
      log.info('[DRY RUN] Would update android/app/build.gradle');
    }
  } catch (error) {
    log.warn('Failed to check android/app/build.gradle:', error);
  }
}

async function checkAndFixExpoDevClient(options: any): Promise<void> {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!await fs.pathExists(packageJsonPath)) {
    return;
  }
  
  try {
    const packageJson = await fs.readJson(packageJsonPath);
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (!deps['expo-dev-client']) {
      return; // Not installed
    }
    
    log.section('🔴 CRITICAL: expo-dev-client Incompatible');
    console.log(chalk.red.bold('expo-dev-client is incompatible with React Native 0.76.x\n'));
    console.log(chalk.red('❌ expo-dev-client found in dependencies'));
    console.log(chalk.yellow('   → Development builds will fail'));
    console.log(chalk.yellow('   → Use preview or production builds instead\n'));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (uninstall expo-dev-client)', value: 'fix' },
          { name: '2. Show me alternatives', value: 'show' },
          { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);
    
    if (action === 'skip') {
      log.info('Skipped. You can manually uninstall expo-dev-client');
      return;
    }
    
    if (action === 'show') {
      console.log(chalk.cyan('\nAlternatives to development builds:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.green('  ✓ Preview builds: eas build --profile preview'));
      console.log(chalk.green('  ✓ Production builds: eas build --profile production'));
      console.log(chalk.green('  ✓ Expo Go: npx expo start (limited features)'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log();
      
      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Uninstall expo-dev-client now?',
          default: true
        }
      ]);
      
      if (!confirmFix) {
        log.info('Skipped. You can manually uninstall expo-dev-client');
        return;
      }
    }
    
    if (!options.dryRun) {
      const packageManager = detectPackageManager();
      const uninstallCmd = getUninstallCommand(packageManager, 'expo-dev-client');
      
      log.info('Uninstalling expo-dev-client...');
      execSync(uninstallCmd, { stdio: 'inherit' });
      
      log.success('✅ Successfully uninstalled expo-dev-client');
      log.info('  Use preview or production builds instead');
    } else {
      log.info('[DRY RUN] Would uninstall expo-dev-client');
    }
  } catch (error) {
    log.warn('Failed to check expo-dev-client:', error);
  }
}

async function checkAndFixTsConfig(options: any): Promise<void> {
  const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
  
  if (!await fs.pathExists(tsConfigPath)) {
    return; // No TypeScript
  }
  
  try {
    const tsConfig = await fs.readJson(tsConfigPath);
    const compilerOptions = tsConfig.compilerOptions || {};
    
    const needsFix = compilerOptions.moduleResolution !== 'bundler';
    
    if (!needsFix) {
      return; // Already correct
    }
    
    log.section('🟡 TypeScript Configuration Update');
    console.log(chalk.yellow.bold('SDK 53 requires updated TypeScript configuration\n'));
    console.log(chalk.yellow('⚠️  moduleResolution should be "bundler"'));
    console.log(chalk.gray('   → Required for Metro bundler compatibility\n'));
    
    console.log(chalk.cyan('Preview of changes:'));
    if (compilerOptions.moduleResolution) {
      console.log(chalk.red(`  - "moduleResolution": "${compilerOptions.moduleResolution}"`));
    }
    console.log(chalk.green('  + "moduleResolution": "bundler"'));
    console.log();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (update tsconfig.json)', value: 'fix' },
          { name: '2. Show me the full config', value: 'show' },
          { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);
    
    if (action === 'skip') {
      log.info('Skipped. You can manually update tsconfig.json');
      return;
    }
    
    if (action === 'show') {
      console.log(chalk.cyan('\nCurrent tsconfig.json:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(JSON.stringify(tsConfig, null, 2));
      console.log(chalk.gray('─'.repeat(60)));
      console.log();
      
      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Apply the fix now?',
          default: true
        }
      ]);
      
      if (!confirmFix) {
        log.info('Skipped. You can manually update tsconfig.json');
        return;
      }
    }
    
    if (!options.dryRun) {
      const backupPath = `${tsConfigPath}.backup`;
      await fs.copy(tsConfigPath, backupPath);
      log.info(`Backup created: ${path.basename(backupPath)}`);
      
      tsConfig.compilerOptions = tsConfig.compilerOptions || {};
      tsConfig.compilerOptions.moduleResolution = 'bundler';
      
      await fs.writeJson(tsConfigPath, tsConfig, { spaces: 2 });
      log.success('✅ Successfully updated tsconfig.json');
      log.info(`  Backup saved to: ${path.basename(backupPath)}`);
    } else {
      log.info('[DRY RUN] Would update tsconfig.json');
    }
  } catch (error) {
    log.warn('Failed to check tsconfig.json:', error);
  }
}

async function checkAndFixNewArchitecture(options: any): Promise<void> {
  const appJsonPath = path.join(process.cwd(), 'app.json');
  
  if (!await fs.pathExists(appJsonPath)) {
    return;
  }
  
  try {
    const appJson = await fs.readJson(appJsonPath);
    const expo = appJson.expo || {};
    
    // Check if newArchEnabled is already set to false
    if (expo.newArchEnabled === false) {
      return; // Already disabled
    }
    
    log.section('🟡 New Architecture Configuration');
    console.log(chalk.yellow.bold('Many packages are still incompatible with New Architecture\n'));
    console.log(chalk.yellow('⚠️  newArchEnabled not explicitly disabled'));
    console.log(chalk.gray('   → Recommended to disable for compatibility\n'));
    
    console.log(chalk.cyan('Preview of changes:'));
    console.log(chalk.green('  + "newArchEnabled": false'));
    console.log();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '1. Auto-fix (disable New Architecture)', value: 'fix' },
          { name: '2. Show me the configuration', value: 'show' },
          { name: '3. Skip (I want to use New Architecture)', value: 'skip' }
        ],
        default: 'fix'
      }
    ]);
    
    if (action === 'skip') {
      log.info('Skipped. New Architecture will remain enabled');
      return;
    }
    
    if (action === 'show') {
      console.log(chalk.cyan('\nProposed configuration:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(JSON.stringify({
        expo: {
          newArchEnabled: false,
          ios: { newArchEnabled: false },
          android: { newArchEnabled: false }
        }
      }, null, 2));
      console.log(chalk.gray('─'.repeat(60)));
      console.log();
      
      const { confirmFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmFix',
          message: 'Apply this configuration?',
          default: true
        }
      ]);
      
      if (!confirmFix) {
        log.info('Skipped. New Architecture will remain enabled');
        return;
      }
    }
    
    if (!options.dryRun) {
      const backupPath = `${appJsonPath}.backup`;
      await fs.copy(appJsonPath, backupPath);
      log.info(`Backup created: ${path.basename(backupPath)}`);
      
      appJson.expo = appJson.expo || {};
      appJson.expo.newArchEnabled = false;
      appJson.expo.ios = appJson.expo.ios || {};
      appJson.expo.ios.newArchEnabled = false;
      appJson.expo.android = appJson.expo.android || {};
      appJson.expo.android.newArchEnabled = false;
      
      await fs.writeJson(appJsonPath, appJson, { spaces: 2 });
      log.success('✅ Successfully updated app.json');
      log.info(`  Backup saved to: ${path.basename(backupPath)}`);
    } else {
      log.info('[DRY RUN] Would update app.json');
    }
  } catch (error) {
    log.warn('Failed to check app.json:', error);
  }
}

async function checkAndFixNpmrc(options: any): Promise<void> {
  const npmrcPath = path.join(process.cwd(), '.npmrc');
  
  if (await fs.pathExists(npmrcPath)) {
    const content = await fs.readFile(npmrcPath, 'utf-8');
    if (content.includes('legacy-peer-deps=true')) {
      return; // Already configured
    }
  }
  
  log.section('🟡 NPM Configuration');
  console.log(chalk.yellow.bold('Recommended: Configure .npmrc for easier installations\n'));
  console.log(chalk.yellow('⚠️  No .npmrc with legacy-peer-deps found'));
  console.log(chalk.gray('   → Prevents peer dependency conflicts\n'));
  
  console.log(chalk.cyan('Preview of .npmrc:'));
  console.log(chalk.green('  + legacy-peer-deps=true'));
  console.log();
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How would you like to proceed?',
      choices: [
        { name: '1. Auto-fix (create/update .npmrc)', value: 'fix' },
        { name: '2. Skip (I\'ll configure manually)', value: 'skip' }
      ],
      default: 'fix'
    }
  ]);
  
  if (action === 'skip') {
    log.info('Skipped. You can manually create .npmrc');
    return;
  }
  
  if (!options.dryRun) {
    let content = 'legacy-peer-deps=true\n';
    
    if (await fs.pathExists(npmrcPath)) {
      const existing = await fs.readFile(npmrcPath, 'utf-8');
      const backupPath = `${npmrcPath}.backup`;
      await fs.copy(npmrcPath, backupPath);
      log.info(`Backup created: ${path.basename(backupPath)}`);
      content = existing + '\nlegacy-peer-deps=true\n';
    }
    
    await fs.writeFile(npmrcPath, content, 'utf-8');
    log.success('✅ Successfully configured .npmrc');
    log.info('  Added legacy-peer-deps=true');
  } else {
    log.info('[DRY RUN] Would create/update .npmrc');
  }
}
