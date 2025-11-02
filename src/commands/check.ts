import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import boxen from 'boxen';
import { ProjectAnalyzer } from '../utils/analyzer';
import { log } from '../utils/logger';
import { PackageUpgrader } from '../upgraders/package-upgrader';
import {
  getSdkInfo,
  getAvailableSdkVersions,
  getUpgradePath,
  PACKAGE_VERSION_OVERRIDES
} from '../data/sdk-versions';
import {
  getBreakingChangesForUpgrade,
  getCriticalChanges,
  getWarningChanges,
  groupChangesByPackage
} from '../data/breaking-changes';

export interface CheckOptions {
  target?: string;
  detailed?: boolean;
  verbose?: boolean;
}

export async function checkCommand(options: CheckOptions): Promise<void> {
  try {
    // Ensure CLI folders are in user's .gitignore
    const { GitManager } = await import('../utils/git');
    const git = new GitManager();
    await git.ensureWizardLogsIgnored();

    const spinner = ora('Analyzing project compatibility...').start();

    // Analyze current project
    const analyzer = new ProjectAnalyzer();
    const analysis = await analyzer.analyze();

    spinner.stop();

    if (!analysis.currentSdkVersion) {
      log.error('Could not detect Expo SDK version in this project');
      
      // Check if package.json exists
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

    // Display current project status
    log.section('📊 Current Project Status');
    
    const statusTable = new Table({
      style: { head: ['cyan'] }
    });

    statusTable.push(
      ['SDK Version', chalk.cyan(`SDK ${analysis.currentSdkVersion}`)],
      ['React Native', analysis.reactNativeVersion || 'Unknown'],
      ['Workflow', analysis.workflowType],
      ['Package Manager', analysis.packageManager],
      ['Expo Packages', Object.keys(analysis.expoPackages).length.toString()],
      ['Total Dependencies', Object.keys({...analysis.expoPackages, ...analysis.thirdPartyPackages}).length.toString()]
    );

    console.log(statusTable.toString());

    // Check for issues in current setup
    if (analysis.errors.length > 0 || analysis.warnings.length > 0) {
      log.section('⚠️ Current Issues');
      
      if (analysis.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        analysis.errors.forEach(error => {
          log.bullet(error, '✗');
        });
      }

      if (analysis.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        analysis.warnings.forEach(warning => {
          log.bullet(warning, '⚠');
        });
      }
    }

    // Determine target SDK
    let targetSdk = options.target;
    if (!targetSdk) {
      const availableVersions = getAvailableSdkVersions();
      targetSdk = availableVersions[0]; // Latest version
    }

    // Check if upgrade is needed
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

    // Show upgrade compatibility
    log.section(`🔍 Compatibility Check: SDK ${analysis.currentSdkVersion} → SDK ${targetSdk}`);

    // Check breaking changes - filter by installed packages
    const installedPackages = [
      ...Object.keys(analysis.expoPackages),
      ...Object.keys(analysis.thirdPartyPackages)
    ];
    const breakingChanges = getBreakingChangesForUpgrade(
      analysis.currentSdkVersion,
      targetSdk,
      installedPackages
    );
    const autoFixable = getCriticalChanges(breakingChanges);
    const manual = getWarningChanges(breakingChanges);

    // Check package compatibility
    const upgrader = new PackageUpgrader(analysis, targetSdk, 'recommended');
    const validation = await upgrader.validateDependencies();

    // Display compatibility report
    const compatTable = new Table({
      head: ['Category', 'Status', 'Details'],
      style: { head: ['yellow'] }
    });

    // SDK compatibility
    const sdkInfo = getSdkInfo(targetSdk);
    compatTable.push([
      'Target SDK',
      chalk.green('✓ Available'),
      `SDK ${targetSdk} (RN ${sdkInfo?.reactNativeVersion})`
    ]);

    // Upgrade path
    const upgradePath = getUpgradePath(analysis.currentSdkVersion, targetSdk);
    compatTable.push([
      'Upgrade Path',
      upgradePath.length > 1 ? chalk.yellow('⚠ Multi-step') : chalk.green('✓ Direct'),
      upgradePath.length > 0 ? upgradePath.join(' → ') : 'Direct upgrade'
    ]);

    // Breaking changes
    compatTable.push([
      'Breaking Changes',
      breakingChanges.length > 0 ? chalk.yellow(`⚠ ${breakingChanges.length}`) : chalk.green('✓ None'),
      `${autoFixable.length} auto-fixable, ${manual.length} manual`
    ]);

    // Package compatibility
    const totalIssues = (validation.detailedIssues || []).length;
    compatTable.push([
      'Package Issues',
      totalIssues > 0 ? chalk.yellow(`⚠ ${totalIssues}`) : chalk.green('✓ None'),
      totalIssues > 0 ? 'See details below' : 'All compatible'
    ]);

    console.log(compatTable.toString());

    // Always show manual fixes for better UX (not just in detailed mode)
    if (manual.length > 0) {
      log.section('📝 Manual Steps Required');
      
      // Group by severity
      const criticalChanges = manual.filter((c: any) => c.severity === 'critical');
      const warningChanges = manual.filter((c: any) => c.severity === 'warning');
      const infoChanges = manual.filter((c: any) => c.severity === 'info');
      const unspecifiedChanges = manual.filter((c: any) => !c.severity);
      
      // Display critical changes
      if (criticalChanges.length > 0) {
        console.log(chalk.red.bold('\n❌ CRITICAL (App won\'t build without this):'));
        for (const change of criticalChanges) {
          console.log(chalk.yellow(`  ${change.package}:`));
          console.log(`    ${change.description}`);
          if (change.manualSteps) {
            change.manualSteps.forEach((step: string) => {
              console.log(`    ${chalk.gray('•')} ${step}`);
            });
          }
        }
      }
      
      // Display warning changes (but limit to most important ones)
      if (warningChanges.length > 0) {
        console.log(chalk.yellow.bold('\n⚠️  IMPORTANT (Recommended fixes):'));
        // Show only first 3 warning changes to avoid overwhelming users
        const displayWarnings = warningChanges.slice(0, 3);
        for (const change of displayWarnings) {
          console.log(chalk.yellow(`  ${change.package}:`));
          console.log(`    ${change.description}`);
          if (change.manualSteps) {
            change.manualSteps.forEach((step: string) => {
              console.log(`    ${chalk.gray('•')} ${step}`);
            });
          }
        }
        
        if (warningChanges.length > 3) {
          console.log(chalk.gray(`\n    ... and ${warningChanges.length - 3} more (use --detailed to see all)`));
        }
      }
      
      // Display unspecified severity (backward compatibility)
      if (unspecifiedChanges.length > 0) {
        for (const change of unspecifiedChanges.slice(0, 2)) { // Limit to 2 for MVP
          console.log(chalk.yellow(`\n  ${change.package}:`));
          console.log(`    ${change.description}`);
          if (change.manualSteps) {
            change.manualSteps.forEach((step: string) => {
              console.log(`    ${chalk.gray('•')} ${step}`);
            });
          }
        }
        
        if (unspecifiedChanges.length > 2) {
          console.log(chalk.gray(`\n    ... and ${unspecifiedChanges.length - 2} more (use --detailed to see all)`));
        }
      }
    }

    // Show package-specific compatibility issues
    if (validation.detailedIssues && validation.detailedIssues.length > 0) {
      log.section('📦 Package Compatibility Issues');
      
      const criticalIssues = validation.detailedIssues.filter((i: any) => i.severity === 'critical');
      const warningIssues = validation.detailedIssues.filter((i: any) => i.severity === 'warning');
      const infoIssues = validation.detailedIssues.filter((i: any) => i.severity === 'info');
      
      // Show critical package issues
      if (criticalIssues.length > 0) {
        console.log(chalk.red.bold('\n❌ INCOMPATIBLE PACKAGES (Must fix):'));
        for (const issue of criticalIssues) {
          console.log(chalk.red(`  ${issue.package}@${issue.currentVersion}:`));
          console.log(`    ${issue.issue}`);
          if (issue.recommendation) {
            console.log(`    ${chalk.green('→')} ${issue.recommendation}`);
          }
          if (issue.migrationSteps) {
            console.log(`    ${chalk.yellow('Migration steps:')}`);
            issue.migrationSteps.forEach((step: string) => {
              console.log(`      ${chalk.gray('•')} ${step}`);
            });
          }
        }
      }
      
      // Show warning package issues (limit in non-detailed mode)
      if (warningIssues.length > 0) {
        const displayWarnings = options.detailed ? warningIssues : warningIssues.slice(0, 3);
        console.log(chalk.yellow.bold('\n⚠️  PACKAGES WITH BREAKING CHANGES:'));
        for (const issue of displayWarnings) {
          console.log(chalk.yellow(`  ${issue.package}@${issue.currentVersion}:`));
          if (issue.recommendation) {
            console.log(`    ${chalk.green('→')} ${issue.recommendation}`);
          }
          if (issue.breakingChanges && issue.breakingChanges.length > 0) {
            console.log(`    ${chalk.yellow('Breaking changes:')}`);
            const changes = options.detailed ? issue.breakingChanges : issue.breakingChanges.slice(0, 2);
            changes.forEach((change: string) => {
              console.log(`      ${chalk.gray('•')} ${change}`);
            });
            if (!options.detailed && issue.breakingChanges.length > 2) {
              console.log(`      ${chalk.gray(`... and ${issue.breakingChanges.length - 2} more`)}`);
            }
          }
        }
        if (!options.detailed && warningIssues.length > 3) {
          console.log(chalk.gray(`\n    ... and ${warningIssues.length - 3} more packages (use --detailed to see all)`));
        }
      }
      
      // Show info issues only in detailed mode
      if (options.detailed && infoIssues.length > 0) {
        console.log(chalk.blue.bold('\nℹ️  OTHER RECOMMENDATIONS:'));
        for (const issue of infoIssues) {
          console.log(chalk.blue(`  ${issue.package}:`));
          console.log(`    ${issue.issue}`);
          if (issue.recommendation) {
            console.log(`    ${chalk.green('→')} ${issue.recommendation}`);
          }
        }
      }
    }

    // Detailed breaking changes report (additional details when requested)
    if (options.detailed && breakingChanges.length > 0) {
      log.section('📋 Breaking Changes Detail');
      
      const grouped = groupChangesByPackage(breakingChanges);
      
      for (const [pkg, changes] of Object.entries(grouped)) {
        console.log(chalk.yellow(`\n${pkg}:`));
        
        for (const change of changes) {
          console.log(`  ${chalk.gray('•')} ${change.description}`);
          
          if (change.severity === 'critical') {
            console.log(`    ${chalk.red('✗ Critical - Manual fix required')}`);
          } else if (change.severity === 'warning') {
            console.log(`    ${chalk.yellow('⚠ Warning - Manual fix recommended')}`);
          } else {
            console.log(`    ${chalk.blue('ℹ Info - Optional fix')}`);
          }
          
          if (change.manualSteps) {
            change.manualSteps.forEach(step => {
              console.log(`      ${chalk.gray('-')} ${step}`);
            });
          }
        }
      }
    }

    // Package compatibility details
    if (options.detailed && validation.issues.length > 0) {
      log.section('📦 Package Compatibility Issues');
      
      validation.issues.forEach(issue => {
        log.bullet(issue, '⚠');
      });
    }

    // Check for deprecated packages
    const deprecatedPackages = await checkDeprecatedPackages(analysis);
    if (deprecatedPackages.length > 0) {
      log.section('🚫 Deprecated Packages');
      
      deprecatedPackages.forEach(pkg => {
        log.bullet(`${pkg.name} - ${pkg.reason}`, '⚠');
      });
    }

    // Recommendations
    log.section('💡 Next Steps');
    
    const recommendations: string[] = [];
    
    // Critical issues first
    const criticalIssues = manual.filter((c: any) => c.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(`${chalk.red('REQUIRED:')} Fix ${criticalIssues.length} critical issue(s) above before upgrading`);
    }
    
    // Then other manual fixes
    const nonCriticalManual = manual.filter((c: any) => c.severity !== 'critical');
    if (nonCriticalManual.length > 0) {
      recommendations.push(`${chalk.yellow('RECOMMENDED:')} Address ${nonCriticalManual.length} compatibility issue(s) above`);
    }
    
    // Upgrade path guidance
    if (upgradePath.length > 1) {
      recommendations.push(`${chalk.blue('TIP:')} Consider upgrading step-by-step: ${upgradePath.slice(0, 2).join(' → ')} first`);
    }
    
    // Ready to upgrade
    if (criticalIssues.length === 0) {
      if (manual.length === 0) {
        recommendations.push(`${chalk.green('✓ READY:')} Run ${chalk.cyan('expo-upgrade-wizard upgrade')} to proceed`);
      } else {
        recommendations.push(`${chalk.yellow('OPTIONAL:')} You can upgrade now and fix warnings later`);
        recommendations.push(`${chalk.green('RUN:')} ${chalk.cyan('expo-upgrade-wizard upgrade')} when ready`);
      }
    }
    
    // Add helpful resources
    if (manual.length > 0) {
      recommendations.push(`${chalk.gray('HELP:')} Visit https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/ for guides`);
    }
    
    recommendations.forEach(rec => {
      log.bullet(rec);
    });

    // Summary box
    const readyForUpgrade = 
      breakingChanges.length === 0 || 
      (autoFixable.length === breakingChanges.length);
    
    console.log(
      boxen(
        (readyForUpgrade ? chalk.green('✓ Ready for upgrade\n\n') : chalk.yellow('⚠ Preparation needed\n\n')) +
        `Upgrade complexity: ${getComplexityLevel(breakingChanges.length, manual.length)}\n` +
        `Estimated time: ${getTimeEstimate(breakingChanges.length, manual.length)}`,
        { 
          padding: 1, 
          borderColor: readyForUpgrade ? 'green' : 'yellow', 
          borderStyle: 'round' 
        }
      )
    );

  } catch (error) {
    log.error('Compatibility check failed:', error);
    throw error;
  }
}

function getComplexityLevel(totalChanges: number, manualChanges: number): string {
  if (totalChanges === 0) return chalk.green('Simple');
  if (manualChanges === 0) return chalk.green('Low');
  if (manualChanges <= 2) return chalk.yellow('Medium');
  return chalk.red('High');
}

function getTimeEstimate(totalChanges: number, manualChanges: number): string {
  const autoTime = 5; // 5 minutes for automated process
  const manualTime = manualChanges * 15; // 15 minutes per manual change
  const total = autoTime + manualTime;
  
  if (total <= 5) return '~5 minutes';
  if (total <= 30) return '~30 minutes';
  if (total <= 60) return '~1 hour';
  return `~${Math.ceil(total / 60)} hours`;
}

async function checkDeprecatedPackages(analysis: any): Promise<Array<{name: string; reason: string}>> {
  const deprecated: Array<{name: string; reason: string}> = [];
  
  // Check for known deprecated packages
  const knownDeprecated: Record<string, string> = {
    'expo-app-loading': 'Use expo-splash-screen instead',
    'expo-app-auth': 'Use expo-auth-session instead',
    'expo-google-app-auth': 'Use expo-auth-session with Google provider',
    'expo-facebook': 'Use expo-auth-session with Facebook provider',
    'expo-google-sign-in': 'Use expo-auth-session with Google provider',
    'expo-analytics': 'Use expo-analytics-segment or other analytics solutions',
    'expo-ads-admob': 'Use react-native-google-mobile-ads instead',
    'expo-ads-facebook': 'Use react-native-fbads instead',
    'expo-background-fetch': 'Use expo-task-manager instead',
    'expo-barcode-scanner': 'Use expo-camera with barcode scanning',
    'expo-brightness': 'Use expo-system-brightness instead',
    'expo-error-recovery': 'Built into Expo SDK now',
    'expo-face-detector': 'Use expo-camera with face detection',
    'expo-firebase-analytics': 'Use @react-native-firebase/analytics',
    'expo-firebase-recaptcha': 'Use @react-native-firebase/app',
    'expo-payments-stripe': 'Use @stripe/stripe-react-native'
  };
  
  const allPackages = {
    ...analysis.expoPackages,
    ...analysis.thirdPartyPackages
  };
  
  for (const [name, reason] of Object.entries(knownDeprecated)) {
    if (allPackages[name]) {
      deprecated.push({ name, reason });
    }
  }
  
  return deprecated;
}
