import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { log } from '../utils/logger';
import { getMetroConfigFix } from '../data/sdk53-breaking-changes';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { detectHermesErrors, autoFixHermesErrors } from './fix-hermes-errors';

interface SDK53Issue {
  name: string;
  detected: boolean;
  severity: 'critical' | 'major' | 'moderate' | 'minor';
  description: string;
  autoFixable: boolean;
  fix?: () => Promise<void>;
}

export async function fixSDK53Command(options: any = {}): Promise<void> {
  try {
    log.section('🔍 Detecting SDK 53 Issues');
    
    const projectRoot = process.cwd();
    const issues = await detectSDK53Issues(projectRoot);
    const detectedIssues = issues.filter(i => i.detected);
    
    // Also detect Hermes-specific errors
    const hermesErrors = await detectHermesErrors(projectRoot);
    const detectedHermesErrors = hermesErrors.filter(e => e.detected);
    
    if (detectedIssues.length === 0 && detectedHermesErrors.length === 0) {
      log.success('✅ No SDK 53 issues detected!');
      return;
    }
    
    // Show Hermes errors if detected
    if (detectedHermesErrors.length > 0) {
      log.section(`🔥 Detected ${detectedHermesErrors.length} Hermes-related Issues`);
      console.log(chalk.yellow('\nThese are common Hermes errors in SDK 53:'));
      detectedHermesErrors.forEach((error, index) => {
        const severityColor = error.severity === 'CRITICAL' ? chalk.red :
                            error.severity === 'HIGH' ? chalk.yellow :
                            chalk.blue;
        console.log(severityColor(`  ${index + 1}. ${error.type}`));
        console.log(`     ${error.message}`);
        if (error.autoFixable) {
          console.log(chalk.green(`     ✓ Auto-fixable`));
        }
      });
      
      const { fixHermes } = await inquirer.prompt([{
        type: 'confirm',
        name: 'fixHermes',
        message: 'Would you like to auto-fix Hermes errors?',
        default: true
      }]);
      
      if (fixHermes) {
        await autoFixHermesErrors(detectedHermesErrors, options);
      }
    }
    
    // Display detected issues
    log.section(`Found ${detectedIssues.length} SDK 53 Issues`);
    
    const criticalIssues = detectedIssues.filter(i => i.severity === 'critical');
    const majorIssues = detectedIssues.filter(i => i.severity === 'major');
    const otherIssues = detectedIssues.filter(i => i.severity !== 'critical' && i.severity !== 'major');
    
    if (criticalIssues.length > 0) {
      console.log(chalk.red.bold('\n❌ CRITICAL ISSUES:'));
      criticalIssues.forEach(issue => {
        console.log(chalk.red(`  • ${issue.name}`));
        console.log(`    ${issue.description}`);
        console.log(`    Auto-fixable: ${issue.autoFixable ? chalk.green('Yes') : chalk.yellow('No')}`);
      });
    }
    
    if (majorIssues.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  MAJOR ISSUES:'));
      majorIssues.forEach(issue => {
        console.log(chalk.yellow(`  • ${issue.name}`));
        console.log(`    ${issue.description}`);
        console.log(`    Auto-fixable: ${issue.autoFixable ? chalk.green('Yes') : chalk.yellow('No')}`);
      });
    }
    
    if (otherIssues.length > 0) {
      console.log(chalk.blue.bold('\nℹ️  OTHER ISSUES:'));
      otherIssues.forEach(issue => {
        console.log(chalk.blue(`  • ${issue.name}`));
        console.log(`    ${issue.description}`);
      });
    }
    
    // Fix auto-fixable issues with interactive prompts
    const autoFixableIssues = detectedIssues.filter(i => i.autoFixable && i.fix);
    
    if (autoFixableIssues.length > 0) {
      console.log();
      
      for (const issue of autoFixableIssues) {
        await promptAndFixIssue(issue, options, projectRoot);
      }
    }
    
    // Show manual fixes needed
    const manualFixes = detectedIssues.filter(i => !i.autoFixable);
    if (manualFixes.length > 0) {
      log.section('📝 Manual Fixes Required');
      manualFixes.forEach(issue => {
        console.log(chalk.yellow(`\n${issue.name}:`));
        console.log(`  ${issue.description}`);
        
        // Show specific manual instructions
        if (issue.name.includes('Firebase')) {
          console.log(chalk.cyan('  Manual steps:'));
          console.log('    1. npm uninstall firebase @firebase/auth @firebase/firestore');
          console.log('    2. npx expo install @react-native-firebase/app @react-native-firebase/auth');
          console.log('    3. Update all Firebase imports and API calls');
          console.log('    4. See docs/SDK53_MIGRATION_GUIDE.md for examples');
        } else if (issue.name.includes('New Architecture')) {
          console.log(chalk.cyan('  To disable:'));
          console.log('    Add to app.json: { "expo": { "experiments": { "newArchEnabled": false } } }');
        }
      });
    }
    
    // Final recommendations
    log.section('📋 Next Steps');
    log.info('1. Run: npx expo-doctor@latest');
    log.info('2. Clear caches: npx expo start --clear');
    log.info('3. Rebuild: npx expo prebuild --clean');
    log.info('4. Test thoroughly with your app');
    log.info('5. Check docs/SDK53_MIGRATION_GUIDE.md for detailed guidance');
    
  } catch (error) {
    log.error('Failed to fix SDK 53 issues:', error);
    process.exit(1);
  }
}

async function detectSDK53Issues(projectRoot: string): Promise<SDK53Issue[]> {
  const issues: SDK53Issue[] = [];
  
  // Check package.json
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Check app.json
  const appJsonPath = path.join(projectRoot, 'app.json');
  const appJson = await fs.pathExists(appJsonPath) ? await fs.readJson(appJsonPath) : null;
  
  // Check metro.config.js
  const metroConfigPath = path.join(projectRoot, 'metro.config.js');
  const hasMetroConfig = await fs.pathExists(metroConfigPath);
  const metroContent = hasMetroConfig ? await fs.readFile(metroConfigPath, 'utf-8') : '';
  
  // 1. Check for missing babel-plugin-module-resolver
  const hasBabelConfig = await fs.pathExists(path.join(projectRoot, 'babel.config.js'));
  const babelContent = hasBabelConfig ? await fs.readFile(path.join(projectRoot, 'babel.config.js'), 'utf-8') : '';
  const usesBabelModuleResolver = babelContent.includes('module-resolver') || babelContent.includes('babel-plugin-module-resolver');
  
  issues.push({
    name: 'Missing babel-plugin-module-resolver',
    detected: usesBabelModuleResolver && !deps['babel-plugin-module-resolver'],
    severity: 'critical',
    description: 'babel.config.js uses module-resolver but the package is not installed',
    autoFixable: true,
    fix: async () => {
      log.info('Installing babel-plugin-module-resolver...');
      const packageManager = await fs.pathExists(path.join(projectRoot, 'yarn.lock')) ? 'yarn' : 'npm';
      const command = packageManager === 'yarn' 
        ? 'yarn add -D babel-plugin-module-resolver'
        : 'npm install --save-dev babel-plugin-module-resolver';
      
      try {
        execSync(command, { cwd: projectRoot, stdio: 'inherit' });
        log.success('Installed babel-plugin-module-resolver');
      } catch (error) {
        log.error('Failed to install babel-plugin-module-resolver');
        throw error;
      }
    }
  });
  
  // 2. Check for Supabase issues
  issues.push({
    name: 'Supabase WebSocket Error',
    detected: deps['@supabase/supabase-js'] && 
              (!deps['@supabase/supabase-js'].includes('2.49.5') || 
               !metroContent.includes('unstable_enablePackageExports')),
    severity: 'critical',
    description: 'Supabase attempts to import Node modules with package.json exports',
    autoFixable: true,
    fix: async () => {
      await fixMetroConfig(projectRoot);
    }
  });
  
  // 2. Check for Firebase JS SDK
  issues.push({
    name: 'Firebase JS SDK Incompatibility',
    detected: deps['firebase'] || deps['@firebase/auth'] || deps['@firebase/firestore'],
    severity: 'critical',
    description: 'Firebase JS SDK is incompatible with SDK 53, must migrate to React Native Firebase',
    autoFixable: false
  });
  
  // 3. Check React version
  issues.push({
    name: 'React Version Issue',
    detected: deps['react'] && (deps['react'].includes('19') || deps['react'].includes('^19')),
    severity: 'critical',
    description: 'SDK 53 requires React 18.3.1, NOT React 19',
    autoFixable: true,
    fix: async () => {
      // Add overrides to package.json
      packageJson.overrides = packageJson.overrides || {};
      packageJson.overrides.react = '18.3.1';
      packageJson.overrides['react-dom'] = '18.3.1';
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      log.info('Added React version overrides to package.json');
    }
  });
  
  // 4. Check expo-notifications plugin
  issues.push({
    name: 'Missing expo-notifications Plugin',
    detected: deps['expo-notifications'] && 
              appJson && 
              (!appJson.expo?.plugins || !appJson.expo.plugins.includes('expo-notifications')),
    severity: 'major',
    description: 'iOS notifications require expo-notifications in plugins array',
    autoFixable: true,
    fix: async () => {
      if (!appJson.expo) appJson.expo = {};
      if (!appJson.expo.plugins) appJson.expo.plugins = [];
      if (!appJson.expo.plugins.includes('expo-notifications')) {
        appJson.expo.plugins.push('expo-notifications');
        await fs.writeJson(appJsonPath, appJson, { spaces: 2 });
        log.info('Added expo-notifications to plugins array');
      }
    }
  });
  
  // 5. Check for expo-av deprecation
  issues.push({
    name: 'expo-av Deprecated',
    detected: deps['expo-av'] !== undefined,
    severity: 'major',
    description: 'expo-av is deprecated, migrate to expo-video and expo-audio',
    autoFixable: false
  });
  
  // 6. Check for deprecated community packages
  const deprecatedPackages = [
    '@react-native-community/masked-view',
    '@react-native-community/clipboard',
    'rn-fetch-blob',
    'react-native-fs',
    'react-native-geolocation-service',
    'react-native-datepicker'
  ];
  
  deprecatedPackages.forEach(pkg => {
    if (deps[pkg]) {
      issues.push({
        name: `Deprecated Package: ${pkg}`,
        detected: true,
        severity: 'moderate',
        description: `This package should be replaced with a newer alternative`,
        autoFixable: false
      });
    }
  });
  
  // 7. Check Metro config for package exports issues
  if (hasMetroConfig && !metroContent.includes('unstable_enablePackageExports')) {
    const hasProblematicPackages = deps['axios'] || deps['socket.io-client'] || 
                                   deps['@supabase/supabase-js'] || deps['firebase'];
    
    if (hasProblematicPackages) {
      issues.push({
        name: 'Metro Config Missing Package Exports Fix',
        detected: true,
        severity: 'major',
        description: 'Metro config needs unstable_enablePackageExports = false for some packages',
        autoFixable: true,
        fix: async () => {
          await fixMetroConfig(projectRoot);
        }
      });
    }
  }
  
  // 8. Check Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  issues.push({
    name: 'Node Version',
    detected: majorVersion < 20,
    severity: 'moderate',
    description: 'Node 18 reached EOL, SDK 53 recommends Node 20+',
    autoFixable: false
  });
  
  return issues;
}

async function fixMetroConfig(projectRoot: string): Promise<void> {
  const metroConfigPath = path.join(projectRoot, 'metro.config.js');
  
  // Backup existing config
  if (await fs.pathExists(metroConfigPath)) {
    const backupPath = path.join(projectRoot, 'metro.config.js.backup');
    await fs.copy(metroConfigPath, backupPath);
    log.info(`Backed up existing metro.config.js to metro.config.js.backup`);
  }
  
  // Write fixed config
  const fixedConfig = getMetroConfigFix();
  await fs.writeFile(metroConfigPath, fixedConfig);
  log.success('Updated metro.config.js with package.json exports fix');
}


async function promptAndFixIssue(issue: SDK53Issue, options: any, projectRoot: string): Promise<void> {
  log.section(`🔧 ${issue.name}`);
  
  const severityIcon = issue.severity === 'critical' ? chalk.red('🔴 CRITICAL') : 
                       issue.severity === 'major' ? chalk.yellow('🟡 MAJOR') : 
                       chalk.blue('ℹ️  INFO');
  
  console.log(severityIcon);
  console.log(chalk.white(`\n${issue.description}\n`));
  
  // Show specific preview based on issue type
  await showIssuePreview(issue, projectRoot);
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How would you like to proceed?',
      choices: [
        { name: '1. Auto-fix (apply changes)', value: 'fix' },
        { name: '2. Show me more details', value: 'show' },
        { name: '3. Skip (I\'ll fix manually)', value: 'skip' }
      ],
      default: 'fix'
    }
  ]);
  
  if (action === 'skip') {
    log.info(`Skipped: ${issue.name}`);
    return;
  }
  
  if (action === 'show') {
    await showIssueDetails(issue, projectRoot);
    
    const { confirmFix } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmFix',
        message: 'Apply the fix now?',
        default: true
      }
    ]);
    
    if (!confirmFix) {
      log.info(`Skipped: ${issue.name}`);
      return;
    }
  }
  
  // Apply the fix
  if (!options.dryRun && issue.fix) {
    try {
      log.info(`Fixing: ${issue.name}...`);
      await issue.fix();
      log.success(`✅ Fixed: ${issue.name}`);
    } catch (error) {
      log.error(`Failed to fix ${issue.name}:`, error);
    }
  } else if (options.dryRun) {
    log.info(`[DRY RUN] Would fix: ${issue.name}`);
  }
}

async function showIssuePreview(issue: SDK53Issue, projectRoot: string): Promise<void> {
  console.log(chalk.cyan('Preview of changes:'));
  
  switch (issue.name) {
    case 'Missing babel-plugin-module-resolver':
      console.log(chalk.green('  + npm install --save-dev babel-plugin-module-resolver'));
      break;
      
    case 'Supabase WebSocket Error':
    case 'Metro Config Missing Package Exports Fix':
      console.log(chalk.green('  + config.resolver.unstable_enablePackageExports = false'));
      console.log(chalk.gray('    (in metro.config.js)'));
      break;
      
    case 'React Version Issue':
      console.log(chalk.green('  + "overrides": {'));
      console.log(chalk.green('  +   "react": "18.3.1",'));
      console.log(chalk.green('  +   "react-dom": "18.3.1"'));
      console.log(chalk.green('  + }'));
      console.log(chalk.gray('    (in package.json)'));
      break;
      
    case 'Missing expo-notifications Plugin':
      console.log(chalk.green('  + "expo-notifications"'));
      console.log(chalk.gray('    (in app.json plugins array)'));
      break;
      
    default:
      console.log(chalk.gray('  See details for more information'));
  }
  
  console.log();
}

async function showIssueDetails(issue: SDK53Issue, projectRoot: string): Promise<void> {
  console.log(chalk.cyan('\nDetailed Information:'));
  console.log(chalk.gray('─'.repeat(60)));
  
  switch (issue.name) {
    case 'Missing babel-plugin-module-resolver':
      console.log(chalk.white('This package is required for path aliasing in babel.config.js'));
      console.log(chalk.white('Without it, imports using aliases will fail'));
      console.log();
      console.log(chalk.cyan('Will run:'));
      console.log(chalk.gray('  npm install --save-dev babel-plugin-module-resolver'));
      break;
      
    case 'Supabase WebSocket Error':
    case 'Metro Config Missing Package Exports Fix':
      const metroConfigPath = path.join(projectRoot, 'metro.config.js');
      if (await fs.pathExists(metroConfigPath)) {
        const content = await fs.readFile(metroConfigPath, 'utf-8');
        console.log(chalk.white('Current metro.config.js:'));
        console.log(chalk.gray(content.substring(0, 500) + '...'));
      } else {
        console.log(chalk.white('Will create new metro.config.js with:'));
        console.log(chalk.gray('  - unstable_enablePackageExports = false'));
        console.log(chalk.gray('  - Recommended resolver settings'));
      }
      break;
      
    case 'React Version Issue':
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = await fs.readJson(packageJsonPath);
      console.log(chalk.white('Current React version:'), packageJson.dependencies?.react || 'unknown');
      console.log(chalk.white('Will add overrides to force React 18.3.1'));
      console.log();
      console.log(chalk.yellow('Why: SDK 53 requires React 18.3.1, NOT React 19'));
      break;
      
    case 'Missing expo-notifications Plugin':
      const appJsonPath = path.join(projectRoot, 'app.json');
      if (await fs.pathExists(appJsonPath)) {
        const appJson = await fs.readJson(appJsonPath);
        console.log(chalk.white('Current plugins:'));
        console.log(chalk.gray(JSON.stringify(appJson.expo?.plugins || [], null, 2)));
      }
      console.log();
      console.log(chalk.white('Will add "expo-notifications" to plugins array'));
      console.log(chalk.yellow('Why: Required for iOS push notifications to work'));
      break;
      
    default:
      console.log(chalk.white(issue.description));
  }
  
  console.log(chalk.gray('─'.repeat(60)));
  console.log();
}
