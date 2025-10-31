import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import boxen from 'boxen';
import fs from 'fs-extra';
import path from 'path';
import { ProjectAnalyzer } from '../utils/analyzer';
import { log } from '../utils/logger';
import { PackageUpgrader } from '../upgraders/package-upgrader';
import {
  getSdkInfo,
  getAvailableSdkVersions,
  getUpgradePath,
} from '../data/sdk-versions';
import {
  getBreakingChangesForUpgrade,
  getCriticalChanges,
  getWarningChanges,
  BreakingChange
} from '../data/breaking-changes';

export interface CheckOptions {
  target?: string;
  detailed?: boolean;
  verbose?: boolean;
  mvp?: boolean;
}

interface ResolvedIssue {
  package: string;
  description: string;
  resolved: boolean;
  resolvedReason?: string;
}

export async function checkEnhancedCommand(options: CheckOptions): Promise<void> {
  try {
    const spinner = ora('Analyzing project compatibility...').start();

    // Analyze current project
    const analyzer = new ProjectAnalyzer();
    const analysis = await analyzer.analyze();

    spinner.stop();

    if (!analysis.currentSdkVersion) {
      log.error('Could not detect Expo SDK version in this project');
      
      if (!analysis.configFiles.packageJson) {
        console.log(chalk.yellow('\n📁 Current directory: ') + chalk.cyan(analysis.projectPath));
        console.log(chalk.yellow('\n⚠️  No package.json found in the current directory.'));
        console.log(chalk.yellow('   Please ensure you are in the root directory of your Expo project where package.json is located.\n'));
      } else {
        console.log(chalk.yellow('\n⚠️  This does not appear to be an Expo project.'));
        console.log(chalk.yellow('   Make sure you have "expo" as a dependency in your package.json.\n'));
      }
      
      return;
    }

    // Determine target SDK
    let targetSdk = options.target;
    if (!targetSdk) {
      const availableVersions = getAvailableSdkVersions();
      targetSdk = availableVersions[0]; // Latest version
    }

    const currentSdkNum = parseInt(analysis.currentSdkVersion);
    const targetSdkNum = parseInt(targetSdk);

    if (currentSdkNum >= targetSdkNum) {
      console.log(
        boxen(
          chalk.green('✓ Your project is up to date!\n\n') +
          `Current SDK ${analysis.currentSdkVersion} is the latest stable version.`,
          { padding: 1, borderColor: 'green', borderStyle: 'round' }
        )
      );
      return;
    }

    // Display header
    log.section(`📊 Current Project Status`);
    console.log(`SDK: ${chalk.cyan(analysis.currentSdkVersion)} → Target: ${chalk.green(targetSdk)}`);
    console.log(`React Native: ${analysis.reactNativeVersion} → ${getSdkInfo(targetSdk)?.reactNativeVersion}`);
    const upgradePath = getUpgradePath(analysis.currentSdkVersion, targetSdk);
    console.log(`Upgrade Path: ${upgradePath.join(' → ')}`);

    // Get breaking changes and check which are resolved
    const installedPackages = [
      ...Object.keys(analysis.expoPackages),
      ...Object.keys(analysis.thirdPartyPackages)
    ];
    
    const breakingChanges = getBreakingChangesForUpgrade(
      analysis.currentSdkVersion,
      targetSdk,
      installedPackages
    );
    
    // Check which issues are actually resolved
    const resolvedIssues = await checkResolvedIssues(analysis, breakingChanges);
    const unresolvedChanges = breakingChanges.filter(
      change => !resolvedIssues.find(r => r.package === change.package && r.resolved)
    );
    
    const autoFixable = getCriticalChanges(unresolvedChanges);
    const manual = getWarningChanges(unresolvedChanges);
    
    // Package compatibility check
    const upgrader = new PackageUpgrader(analysis, targetSdk, 'recommended');
    const validation = await upgrader.validateDependencies();
    
    // Check which package issues are resolved
    const resolvedPackageIssues = await checkResolvedPackageIssues(analysis, validation);
    const unresolvedPackageIssues = (validation.detailedIssues || []).filter(
      issue => !resolvedPackageIssues.find(r => r.package === issue.package && r.resolved)
    );

    // Calculate counts
    const totalPackagesToUpdate = Object.keys(analysis.expoPackages).length + 
      Object.keys(analysis.thirdPartyPackages).filter(pkg => 
        ['@gorhom/bottom-sheet', '@react-native-async-storage/async-storage', '@shopify/flash-list', 
         'react-native-gesture-handler', 'react-native-reanimated', 'react-native-safe-area-context',
         'react-native-screens', 'react-native-svg'].includes(pkg)
      ).length;
    
    const automatedIssues = autoFixable.length + unresolvedPackageIssues.filter(i => i.severity !== 'critical').length;
    const manualCritical = manual.filter((c: any) => c.severity === 'critical').length;
    const manualRecommended = manual.filter((c: any) => c.severity !== 'critical').length;

    // Show automated capabilities
    console.log(
      boxen(
        chalk.green.bold('✅ AUTOMATED BY OUR TOOL') + chalk.gray(' (5 minutes)') + '\n\n' +
        `  ${chalk.green('•')} Update ${totalPackagesToUpdate} packages\n` +
        `  ${chalk.green('•')} Fix ${automatedIssues} compatibility issues\n` +
        `  ${chalk.green('•')} Update app.json, eas.json\n` +
        `  ${chalk.green('•')} Create git backup\n` +
        `  ${chalk.green('•')} Run validation checks`,
        { 
          padding: 1, 
          margin: { top: 1 },
          borderColor: 'green', 
          borderStyle: 'round',
          title: '',
          titleAlignment: 'center'
        }
      )
    );

    // Show manual tasks (only unresolved ones)
    if (manualCritical > 0 || manualRecommended > 0) {
      const manualContent = [];
      
      manualContent.push(chalk.yellow.bold("📝 YOU'LL HANDLE") + chalk.gray(' (30-60 minutes)') + '\n');
      
      if (manualCritical > 0) {
        manualContent.push(chalk.red.bold('  ❌ CRITICAL (Must do):'));
        manual.filter((c: any) => c.severity === 'critical').forEach((change: any) => {
          const isResolved = resolvedIssues.find(r => r.package === change.package && r.resolved);
          if (!isResolved) {
            manualContent.push(`  ${chalk.red('•')} ${change.manualSteps?.[0] || change.description}`);
          }
        });
      }
      
      if (manualRecommended > 0) {
        manualContent.push('');
        manualContent.push(chalk.yellow.bold('  ⚠️  RECOMMENDED (Should do):'));
        const recommendedChanges = manual.filter((c: any) => c.severity !== 'critical').slice(0, 3);
        recommendedChanges.forEach((change: any) => {
          const isResolved = resolvedIssues.find(r => r.package === change.package && r.resolved);
          if (!isResolved) {
            manualContent.push(`  ${chalk.yellow('•')} ${change.manualSteps?.[0] || change.description}`);
          }
        });
      }
      
      manualContent.push('');
      manualContent.push(chalk.gray("  💡 Don't worry - we'll show you how"));
      
      console.log(
        boxen(
          manualContent.join('\n'),
          { 
            padding: 1,
            margin: { top: 1 },
            borderColor: 'yellow', 
            borderStyle: 'round'
          }
        )
      );
    }

    // Show value proposition
    if (!options.mvp) {
      const manualHours = Math.ceil((manual.length * 0.5 + 5) / 60) * 2; // Estimate 2x time for manual upgrade
      const upworkCost = manualHours * 75; // Average $75/hour for React Native dev
      
      console.log(
        boxen(
          chalk.blue.bold('💰 VALUE COMPARISON') + '\n\n' +
          `  Manual upgrade:   ${manualHours}-${manualHours * 2} hours\n` +
          `  Upwork cost:      $${upworkCost}-$${upworkCost * 2}\n\n` +
          `  With our tool:    5 min auto + 30 min\n` +
          `  Cost:             $29\n\n` +
          chalk.green.bold(`  Your savings:     ~$${upworkCost - 29} & ${manualHours * 2 - 1} hours`),
          { 
            padding: 1,
            margin: { top: 1 },
            borderColor: 'blue', 
            borderStyle: 'round'
          }
        )
      );
    }

    // Show already resolved issues if any
    const alreadyResolved = resolvedIssues.filter(r => r.resolved);
    if (alreadyResolved.length > 0 && options.detailed) {
      log.section('✅ Already Resolved');
      alreadyResolved.forEach(issue => {
        console.log(chalk.green(`  ✓ ${issue.package}: ${issue.resolvedReason}`));
      });
    }

    // Next steps
    console.log('');
    if (manualCritical === 0) {
      console.log(chalk.green.bold('? Ready to upgrade?') + chalk.gray(' (Y/n)'));
    } else {
      console.log(chalk.yellow('⚠️  Please fix critical issues first, then run:'));
      console.log(chalk.cyan('   npx expo-upgrade-wizard upgrade'));
    }

  } catch (error) {
    log.error('Compatibility check failed:', error);
    throw error;
  }
}

/**
 * Check which breaking changes have been resolved in the project
 */
async function checkResolvedIssues(
  analysis: any, 
  breakingChanges: BreakingChange[]
): Promise<ResolvedIssue[]> {
  const resolved: ResolvedIssue[] = [];
  
  for (const change of breakingChanges) {
    let isResolved = false;
    let reason = '';
    
    // Check specific resolutions based on package
    switch (change.package) {
      case 'react-native-gesture-handler':
        // Check if gesture handler is properly updated
        const ghVersion = analysis.thirdPartyPackages['react-native-gesture-handler'];
        if (ghVersion) {
          const versionMatch = ghVersion.match(/(\d+)\.(\d+)/);
          if (versionMatch) {
            const major = parseInt(versionMatch[1]);
            const minor = parseInt(versionMatch[2]);
            if (major >= 2 && minor >= 20) {
              isResolved = true;
              reason = `Updated to ${ghVersion}`;
            }
          }
        }
        
        // Check if GestureDetector is used (if needed)
        try {
          const srcPath = path.join(analysis.projectPath, 'app');
          if (fs.existsSync(srcPath)) {
            const files = await findFilesWithExtension(srcPath, ['.tsx', '.ts', '.jsx', '.js']);
            let usesGestureHandler = false;
            let usesGestureDetector = false;
            
            for (const file of files) {
              const content = await fs.readFile(file, 'utf-8');
              if (content.includes('from \'react-native-gesture-handler\'') || 
                  content.includes('from "react-native-gesture-handler"')) {
                usesGestureHandler = true;
                if (content.includes('GestureDetector')) {
                  usesGestureDetector = true;
                }
              }
            }
            
            if (!usesGestureHandler || usesGestureDetector) {
              isResolved = true;
              reason = usesGestureHandler ? 'Uses GestureDetector API' : 'No gesture handlers used';
            }
          }
        } catch (e) {
          // Ignore errors in checking
        }
        break;
        
      case 'expo-router':
        // Check if _layout files exist
        const appPath = path.join(analysis.projectPath, 'app');
        if (fs.existsSync(appPath)) {
          const layoutFile = path.join(appPath, '_layout.tsx');
          if (fs.existsSync(layoutFile)) {
            const content = await fs.readFile(layoutFile, 'utf-8');
            // Check for v3 compatibility
            if (!content.includes('unstable_settings') || 
                content.includes('export { ErrorBoundary }')) {
              isResolved = true;
              reason = '_layout.tsx is v3 compatible';
            }
          }
        }
        break;
        
      case 'react-native':
        // Check metro.config.js
        const metroPath = path.join(analysis.projectPath, 'metro.config.js');
        if (fs.existsSync(metroPath)) {
          const content = await fs.readFile(metroPath, 'utf-8');
          if (content.includes('getDefaultConfig') && 
              (content.includes('platforms:') || content.includes('blockList:'))) {
            isResolved = true;
            reason = 'metro.config.js updated for RN 0.74+';
          }
        }
        break;
    }
    
    resolved.push({
      package: change.package,
      description: change.description,
      resolved: isResolved,
      resolvedReason: reason
    });
  }
  
  return resolved;
}

/**
 * Check which package compatibility issues have been resolved
 */
async function checkResolvedPackageIssues(
  analysis: any,
  validation: any
): Promise<ResolvedIssue[]> {
  const resolved: ResolvedIssue[] = [];
  
  if (!validation.detailedIssues) return resolved;
  
  for (const issue of validation.detailedIssues) {
    let isResolved = false;
    let reason = '';
    
    // Check if package version has been updated
    const currentVersion = analysis.expoPackages[issue.package] || 
                           analysis.thirdPartyPackages[issue.package];
    
    if (currentVersion && issue.recommendation) {
      const recommendedVersion = issue.recommendation.match(/(\d+\.\d+\.\d+)/)?.[1];
      if (recommendedVersion && currentVersion.includes(recommendedVersion)) {
        isResolved = true;
        reason = `Updated to ${currentVersion}`;
      }
    }
    
    resolved.push({
      package: issue.package,
      description: issue.issue,
      resolved: isResolved,
      resolvedReason: reason
    });
  }
  
  return resolved;
}

/**
 * Find all files with specific extensions in a directory
 */
async function findFilesWithExtension(
  dir: string, 
  extensions: string[]
): Promise<string[]> {
  const files: string[] = [];
  
  async function traverse(currentDir: string) {
    try {
      const items = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          await traverse(fullPath);
        } else if (item.isFile()) {
          if (extensions.some(ext => item.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  await traverse(dir);
  return files;
}
