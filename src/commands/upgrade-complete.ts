import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { Listr } from "listr2";
import boxen from "boxen";
import * as fs from "fs-extra";
import * as path from "path";
import { ProjectAnalyzer } from "../utils/analyzer";
import { GitManager } from "../utils/git";
import { StateManager } from "../utils/state-manager";
import { PackageUpgrader } from "../upgraders/package-upgrader";
import { ExpoInstallUpgrader } from "../upgraders/expo-install-upgrader";
import { CodeFixer } from "../upgraders/code-fixer";
import { TaskGuard } from "../utils/task-guard";
import {
  getLatestSdkVersion,
  getAvailableSdkVersions,
  getUpgradePath,
  getSdkInfo,
} from "../data/sdk-versions";
import { getBreakingChangesForUpgrade } from "../data/breaking-changes";
import { log } from "../utils/logger";
import Table from "cli-table3";
import { ProjectContextCollector } from "../utils/project-context-collector";
import { PostUpgradeGuideGenerator } from "../utils/post-upgrade-guide";
import { SmartInstaller, InstallStrategy } from "../utils/install-strategies";
import { CLIOutputFormatter } from "../utils/cli-output";
import { ReactResolutionValidator } from "../utils/react-resolution-validator";
import { CleanReinstaller } from "../utils/clean-reinstall";
import { StateDebugger } from "../utils/state-debug";

// Enhanced interface with all options including clean install
export interface UpgradeOptions {
  target?: string;
  strategy?: "conservative" | "recommended" | "aggressive";
  dryRun?: boolean;
  skipBackup?: boolean;
  skipInstall?: boolean;
  skipValidation?: boolean;
  skipAiAnalysis?: boolean;
  autoFix?: boolean;
  force?: boolean;
  verbose?: boolean;
  packageManager?: "npm" | "yarn" | "pnpm" | "bun";
  cleanInstall?: boolean;
  useExpoInstall?: boolean; // Use expo install --fix instead of manual version management
  installStrategy?: InstallStrategy; // 'expo' (default), 'npm', 'legacy', 'force'
}

interface BackupData {
  packageJson: any;
  appJson: any;
  lockFile: string | null;
  backupBranch: string | null;
}

interface UpgradeContext {
  modifiedFiles?: string[];
  packageChanges?: any;
  appJsonChanges?: any[];
  fixResults?: any;
  doctorOutput?: string;
  doctorPassed?: boolean;
  installCommands?: string[];
  autoFixesApplied?: number;
}

/**
 * Main upgrade command with all functionalities
 * Includes clean install support and comprehensive error handling
 */
export async function upgradeCompleteCommand(
  options: UpgradeOptions = {}
): Promise<void> {
  // If --dry-run flag is set, show generic preview
  if (options.dryRun) {
    return await showDryRunPreview(options);
  }

  // Detect terminal capabilities and warn if limited
  if (!process.stdout.isTTY) {
    log.warn(
      "Running in non-interactive terminal - progress display may be limited"
    );
  }

  const startTime = Date.now();
  let backupData: BackupData | null = null;
  let projectPath: string = process.cwd();

  try {
    // Default to using expo install --fix (more reliable)
    if (options.useExpoInstall === undefined) {
      options.useExpoInstall = true;
    }

    // Display clean install notice if enabled
    if (options.cleanInstall) {
      log.info(
        "Clean install mode enabled - will remove node_modules before upgrading"
      );
    }

    if (options.useExpoInstall) {
      log.info(
        "Using expo install --fix for reliable package version management"
      );
    }

    // Step 1: Check for cloud storage location (early warning)
    const { CloudStorageDetector } = await import(
      "../utils/cloud-storage-detector"
    );
    const cloudDetection = CloudStorageDetector.detect(projectPath);

    if (cloudDetection.isCloudStorage && !options.force) {
      console.log(
        boxen(
          chalk.yellow.bold('⚠️  ' + cloudDetection.provider + ' Detected!\n\n') +
            'Your project is located in ' + cloudDetection.provider + ':\n' +
            chalk.gray(projectPath) +
            "\n\n" +
            cloudDetection.provider + ' file syncing can cause npm installation failures.\n' +
            chalk.red(
              "This is a common cause of EPERM errors during upgrades.\n\n"
            ) +
            chalk.white("Recommended actions:\n") +
            '  1. Move project to: ' + chalk.cyan(
              cloudDetection.recommendedPath
            ) + '\n' +
            '  2. Or pause ' + cloudDetection.provider + ' sync during upgrade\n' +
            '  3. Or use --force to continue anyway (not recommended)',
          { padding: 1, borderColor: "yellow", borderStyle: "round" }
        )
      );

      const { proceed } = await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message: 'Continue upgrade in ' + cloudDetection.provider + '? (May fail with file locking errors)',
          default: false,
        },
      ]);

      if (!proceed) {
        log.info('\n💡 To move your project safely:');
        log.bullet('1. Copy project to: ' + cloudDetection.recommendedPath);
        log.bullet('2. Delete node_modules in the new location');
        log.bullet('3. Run: npm install');
        log.bullet('4. Then run the upgrade wizard again');
        process.exit(0);
      }

      log.warn(
        'Proceeding with upgrade in ' + cloudDetection.provider + ' - watch for file locking errors'
      );
    }

    // Step 2: Ensure CLI folders are in user's .gitignore
    const git = new GitManager(projectPath);
    await git.ensureWizardLogsIgnored();

    // Step 3: Project Analysis
    log.section("📦 Analyzing your project...");

    const analyzer = new ProjectAnalyzer();
    const analysis = await analyzer.analyze();

    // Validate Expo project
    if (!analysis.expoPackages.expo && !analysis.configFiles.appJson) {
      log.error(
        "This doesn't appear to be an Expo project. Please run this command in an Expo project directory."
      );
      process.exit(1);
    }

    // Display current project info
    log.bullet(`React Native version: ${analysis.reactNativeVersion}`);
    log.bullet(`Workflow type: ${analysis.workflowType}`);
    log.bullet(
      `Package manager: ${
        analysis.packageManager || options.packageManager || "npm"
      }`
    );

    // Override package manager if specified
    const packageManager =
      options.packageManager || analysis.packageManager || "npm";

    // Step 3: Validate current SDK version is 52
    if (analysis.currentSdkVersion !== "52") {
      log.error(
        chalk.red.bold("\n⛔ SDK 52 Required\n")
      );
      log.error(
        `This tool only supports upgrading from Expo SDK 52 to SDK 53.\n` +
        'Current SDK version is: ' + chalk.yellow(analysis.currentSdkVersion || 'unknown')
      );
      
      if (analysis.currentSdkVersion && parseInt(analysis.currentSdkVersion) < 52) {
        log.info("\n💡 Please upgrade to SDK 52 first before using this tool.");
      } else if (analysis.currentSdkVersion === "53") {
        log.info("\n✅ You're already on SDK 53!");
      } else if (analysis.currentSdkVersion && parseInt(analysis.currentSdkVersion) > 53) {
        log.info("\n⚠️  Your SDK version is newer than 53.");
      }
      
      process.exit(1);
    }

    // Set target SDK to 53 (the only supported upgrade path)
    const targetSdk = "53";
    log.info(chalk.cyan(`\n🎯 Upgrading from SDK 52 to SDK 53`));

    // Step 4: Show upgrade path
    const upgradePath = getUpgradePath(
      analysis.currentSdkVersion || "49",
      targetSdk!
    );

    if (upgradePath.length > 1) {
      log.section("🗺️ Upgrade Path");
      console.log('  ' + upgradePath.join(' → '));
    }

    // Step 4: Analyze breaking changes
    // Get list of installed packages to filter relevant breaking changes
    const installedPackages = Object.keys({
      ...analysis.expoPackages,
      ...analysis.thirdPartyPackages,
    });

    const breakingChanges = getBreakingChangesForUpgrade(
      analysis.currentSdkVersion || "49",
      targetSdk!,
      installedPackages
    );
    const autoFixable = breakingChanges.filter(
      (change: any) => change.autoFixable
    );
    const manualChanges = breakingChanges.filter(
      (change: any) => !change.autoFixable
    );

    if (breakingChanges.length > 0) {
      displayBreakingChanges(breakingChanges, autoFixable, manualChanges);
    }

    // Step 5: Select upgrade strategy
    let strategy: "conservative" | "recommended" | "aggressive" =
      options.strategy || "recommended";

    if (!options.strategy) {
      strategy = (await promptForStrategy()) as
        | "conservative"
        | "recommended"
        | "aggressive";
    }

    // Step 6: Check git status and create backup
    projectPath = analysis.projectPath || process.cwd();
    const backupMethod = await prepareBackup(projectPath, options, analysis);

    // Initialize file logging AFTER git check (so logs don't show as uncommitted changes)
    const { initializeFileLogging } = await import("../utils/logger");
    initializeFileLogging();

    // Step 6.5: React version selection (SDK 53 only)
    let reactVersion: "18" | "19" | undefined;
    if (targetSdk === "53" && !options.dryRun) {
      reactVersion = await promptForReactVersion();
    }

    // Step 7: Confirmation
    if (
      !options.dryRun &&
      !(await confirmUpgrade(analysis.currentSdkVersion, targetSdk))
    ) {
      log.info("Upgrade cancelled");
      return;
    }

    // Step 8: Create backup before making changes
    if (!options.dryRun && !options.skipBackup) {
      backupData = await createBackup(analysis, backupMethod);
      // State backup already created in prepareBackup() after git check
    }

    // Step 9: Run interactive auto-fixes BEFORE installation
    log.section("🔧 Detecting Issues and Auto-Fixes");
    
    // Include Hermes error detection and fixes for SDK 53
    const { detectHermesErrors, autoFixHermesErrors } = await import('./fix-hermes-errors');
    const hermesErrors = await detectHermesErrors(projectPath);
    const detectedHermesErrors = hermesErrors.filter(e => e.detected);
    
    if (detectedHermesErrors.length > 0) {
      log.warn('🔥 Detected ' + detectedHermesErrors.length + ' Hermes-related issues for SDK 53');
      const autoFixableHermes = detectedHermesErrors.filter(e => e.autoFixable);
      
      if (autoFixableHermes.length > 0) {
        const { fixHermes } = await inquirer.prompt([{
          type: 'confirm',
          name: 'fixHermes',
          message: 'Would you like to auto-fix Hermes errors?',
          default: true
        }]);
        
        if (fixHermes) {
          await autoFixHermesErrors(autoFixableHermes, { dryRun: options.dryRun });
        }
      }
    }
    
    const { collectAutoFixes } = await import("../utils/collect-auto-fixes");
    const { InteractiveAutoFix } = await import("../utils/interactive-auto-fix");
    
    const autoFixIssues = await collectAutoFixes(projectPath, targetSdk!);
    
    // Store fixed files to restore after installation
    const fixedFiles: Map<string, string> = new Map();
    let autoFixesApplied = 0;
    
    if (autoFixIssues.length > 0) {
      log.info('Found ' + autoFixIssues.length + ' issue' + (autoFixIssues.length > 1 ? 's' : '') + ' that can be auto-fixed');
      console.log();
      
      const interactiveFixer = new InteractiveAutoFix(projectPath);
      const { fixed, skipped } = await interactiveFixer.runAllFixes(autoFixIssues);
      
      // Store the count for the report
      autoFixesApplied = fixed;
      
      console.log();
      log.success('✅ Fixed ' + fixed + ' issue' + (fixed !== 1 ? 's' : ''));
      if (skipped > 0) {
        log.info('⏭️  Skipped ' + skipped + ' issue' + (skipped !== 1 ? 's' : '') + ' (manual fix required)');
      }
      
      // Save fixed files content to restore after installation
      log.info("💾 Saving fixed files to restore after installation...");
      for (const issue of autoFixIssues) {
        const filePath = path.join(projectPath, issue.file);
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          fixedFiles.set(issue.file, content);
          log.debug('Saved ' + issue.file + ' (' + content.length + ' bytes)');
        } else {
          log.warn('File not found for saving: ' + issue.file);
        }
      }
      
      // Also save package.json if it was modified (e.g., expo-build-properties added)
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath) && !fixedFiles.has('package.json')) {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        fixedFiles.set('package.json', content);
        log.debug('Saved package.json (' + content.length + ' bytes)');
      }
      
      log.success('Saved ' + fixedFiles.size + ' fixed files for restoration');
      
      console.log();
    } else {
      log.success("✅ No auto-fixable issues detected");
    }

    // Step 10: Execute upgrade with clean install support (INSTALLATION LAST)
    log.section("🚀 Starting Upgrade Process");

    // Show upgrade summary box
    const packagesCount = Object.keys({
      ...analysis.expoPackages,
      ...analysis.thirdPartyPackages,
    }).length;

    console.log(
      boxen(
        chalk.cyan.bold('🚀 Upgrading to SDK ' + targetSdk + '\n\n') +
          chalk.white('From: SDK ' + analysis.currentSdkVersion + '\n') +
          chalk.white('To: SDK ' + targetSdk + '\n') +
          chalk.white('Packages to update: ~' + packagesCount + '\n') +
          chalk.white('Strategy: ' + strategy + '\n\n') +
          chalk.gray("This may take a few minutes..."),
        { padding: 1, borderColor: "cyan", borderStyle: "round" }
      )
    );
    console.log();

    const upgradeStartTime = Date.now();

    const context = await executeUpgrade(
      analysis,
      targetSdk!,
      strategy,
      packageManager,
      options,
      backupData,
      backupMethod,
      autoFixable,
      manualChanges,
      reactVersion,
      fixedFiles,
      autoFixesApplied
    );

    const upgradeDuration = Date.now() - upgradeStartTime;

    // Step 9.5: Post-upgrade React resolution validation
    if (!options.dryRun && !options.skipValidation) {
      log.section("🔍 Validating React Installation");
      const reactValidator = new ReactResolutionValidator(projectPath);
      const validationResult = await reactValidator.validate();
      reactValidator.printResults(validationResult);

      // If critical issues found, offer to fix
      if (!validationResult.isValid && !options.force) {
        const { fixReact } = await inquirer.prompt([
          {
            type: "confirm",
            name: "fixReact",
            message:
              "Critical React resolution issues detected. Run clean reinstall to fix?",
            default: true,
          },
        ]);

        if (fixReact) {
          const cleanReinstaller = new CleanReinstaller(projectPath);
          const success = await cleanReinstaller.cleanReinstall({
            clearMetroCache: true,
            clearExpoCache: true,
            verbose: options.verbose,
          });

          if (success) {
            // Re-validate after fix
            const revalidationResult = await reactValidator.validate();
            reactValidator.printResults(revalidationResult);

            if (!revalidationResult.isValid) {
              log.warn(
                "Some issues remain after clean reinstall. Manual intervention may be required."
              );
            }
          }
        } else {
          log.warn(
            "Skipping React resolution fix. You may encounter build errors."
          );
        }
      }
    }

    // Show upgrade completion summary
    const formatDuration = (ms: number): string => {
      const hours = Math.floor(ms / 3600);
      const minutes = Math.floor((ms % 3600) / 60);
      const seconds = Math.floor(ms % 60);

      if (hours > 0) {
        return hours + 'h ' + minutes + 'm ' + seconds + 's';
      } else if (minutes > 0) {
        return minutes + 'm ' + seconds + 's';
      }
      return ms + ' seconds';
    };

    const modifiedFilesCount = context.modifiedFiles?.length || 0;
    console.log(
      boxen(
        chalk.green.bold("✓ Upgrade Complete!\n\n") +
          chalk.yellow('  Total time: ' + formatDuration(upgradeDuration) + '\n') +
        chalk.yellow('  Files modified: ' + modifiedFilesCount + '\n') +
          chalk.gray("  • Review changes: git diff\n") +
          chalk.gray("  • Validate project: npx expo-doctor\n") +
          chalk.gray("  • Test your app: npx expo start"),
        { padding: 1, borderColor: "green", borderStyle: "round" }
      )
    );

    // Step 10: Generate report
    generateUpgradeReport(
      startTime,
      targetSdk!,
      context,
      manualChanges,
      options
    );

    // Step 11: AI-powered post-upgrade analysis
    if (!options.skipAiAnalysis && !options.dryRun) {
      await runPostUpgradeAIAnalysis(analysis, targetSdk!, options);
    }

    log.success("\n🎉 Upgrade completed successfully!");

    // Show React version info for SDK 53
    if (targetSdk === "53" && reactVersion) {
      const packageJsonPath = path.join(projectPath, "package.json");
      try {
        const packageJson = await fs.readJson(packageJsonPath);
        const actualReactVersion = packageJson.dependencies?.react || "unknown";
        const actualRNVersion = packageJson.dependencies
          ? packageJson.dependencies["react-native"]
          : "unknown";

        const reactMessage = actualReactVersion.includes("19")
          ? chalk.green(
              "✓ Using React 19 + RN 0.79.x (recommended for Hermes fixes)"
            )
          : chalk.green("✓ Using React 18 + RN 0.76.x (stable configuration)");

        console.log(
          boxen(
            chalk.cyan.bold("📦 React Configuration\n\n") +
              chalk.white('React: ' + actualReactVersion + '\n') +
              chalk.white('React Native: ' + (actualRNVersion || "unknown") + '\n\n') +
              reactMessage,
            { padding: 1, borderColor: "cyan", borderStyle: "round", margin: 1 }
          )
        );
      } catch (error) {
        // Silently fail if we can't read package.json
      }
    }

    // Show modified files
    if (context.modifiedFiles && context.modifiedFiles.length > 0) {
      log.section("📝 Modified Files");
      const uniqueFiles = [...new Set(context.modifiedFiles)];
      log.info(
        uniqueFiles.length + ' file' +
          (uniqueFiles.length > 1 ? "s" : "") +
        ' modified during upgrade:\n'
      );

      uniqueFiles.forEach((file) => {
        log.bullet(chalk.cyan(file));
      });

      // Show app.json changes if available
      if (context.appJsonChanges && context.appJsonChanges.length > 0) {
        const nonWarnings = context.appJsonChanges.filter(
          (c) => c.type !== "warning"
        );
        if (nonWarnings.length > 0) {
          console.log(
            chalk.gray(
              '\n  app.json: ' + nonWarnings.length + ' fix' +
                (nonWarnings.length > 1 ? "es" : "") +
              ' applied'
            )
          );
        }

        // Show detailed changes in verbose mode
        if (options.verbose) {
          console.log(chalk.gray("\n  Detailed app.json changes:"));
          const byType: Record<string, any[]> = {
            removed: context.appJsonChanges.filter((c) => c.type === "removed"),
            added: context.appJsonChanges.filter((c) => c.type === "added"),
            fixed: context.appJsonChanges.filter((c) => c.type === "fixed"),
          };

          if (byType.removed.length > 0) {
            byType.removed.forEach((c) =>
              console.log(chalk.gray('    ➖ ' + c.message))
            );
          }
          if (byType.added.length > 0) {
            byType.added.forEach((c) =>
              console.log(chalk.gray('    ➕ ' + c.message))
            );
          }
          if (byType.fixed.length > 0) {
            byType.fixed.forEach((c) =>
              console.log(chalk.gray('    ✅ ' + c.message))
            );
          }
        }
      }

      console.log();
    }

    // Show commands used for future reference
    if (context.installCommands && context.installCommands.length > 0) {
      log.section("📝 Installation Commands Used");
      log.info("For future reference, these commands were used:");
      context.installCommands.forEach((cmd) => {
        log.bullet(chalk.cyan(cmd));
      });
      log.info(
        "\n💡 Use these commands if you need to reinstall dependencies later"
      );
    }

    // Show helpful tips for reviewing changes
    if (context.modifiedFiles && context.modifiedFiles.length > 0) {
      log.section("💡 Next Steps");
      log.info("Review the changes made to your project:");
      log.bullet(chalk.cyan("git diff") + " - Review all changes");
      log.bullet(
        chalk.cyan("git diff app.json") + " - Review configuration changes"
      );
      log.bullet(chalk.cyan("npx expo-doctor") + " - Validate your project");
      log.bullet(chalk.cyan("npx expo start") + " - Test your app");
      console.log();
      
      // Recommend dev builds for SDK 53
      console.log(
        boxen(
          chalk.cyan.bold("📱 Recommended: Use Development Builds\n\n") +
            chalk.white("For SDK 53, development builds are recommended over Expo Go:\n\n") +
            chalk.gray("  • ") + chalk.cyan("npm run build:dev") + chalk.gray(" - Build for both platforms\n") +
            chalk.gray("  • ") + chalk.cyan("npm run build:dev:android") + chalk.gray(" - Build for Android only\n") +
            chalk.gray("  • ") + chalk.cyan("npm run build:dev:ios") + chalk.gray(" - Build for iOS only\n\n") +
            chalk.yellow("Why dev builds?\n") +
            chalk.gray("  • Full native module support\n") +
            chalk.gray("  • Push notifications work on Android\n") +
            chalk.gray("  • Better testing environment for production"),
          { padding: 1, borderColor: "cyan", borderStyle: "round", margin: 1 }
        )
      );
    }
  } catch (error: any) {
    await handleUpgradeError(error, backupData, options, projectPath);
  }
}

// Helper functions
// Removed promptForTargetSdk - no longer needed as we only support SDK 52 to 53

async function promptForStrategy(): Promise<
  "conservative" | "recommended" | "aggressive"
> {
  const { selectedStrategy } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedStrategy",
      message: "Select upgrade strategy:",
      choices: [
        {
          name: "Recommended - Update core packages to compatible versions",
          value: "recommended",
        },
        {
          name: "Conservative - Minimal changes, keep existing versions where possible",
          value: "conservative",
        },
        {
          name: "Aggressive - Update to latest compatible versions",
          value: "aggressive",
        },
      ],
    },
  ]);

  return selectedStrategy as "conservative" | "recommended" | "aggressive";
}

async function promptForReactVersion(): Promise<"18" | "19"> {
  console.log(
    boxen(
      chalk.cyan.bold("📦 Installing Expo SDK 53...\n\n") +
        chalk.white("React version selection:\n") +
        chalk.green("1. React 18.3.1 (recommended - stable) ✓\n") +
        chalk.yellow(
          "2. React 19.0.0 (Latest - may have compatibility issues)\n\n"
        ),
      { padding: 1, borderColor: "cyan", borderStyle: "round" }
    )
  );

  const { reactVersion } = await inquirer.prompt([
    {
      type: "list",
      name: "reactVersion",
      message: "Select React version:",
      choices: [
        {
          name: "React 18.3.1 (recommended - stable)",
          value: "18",
        },
        {
          name: "React 19.0.0 (Latest - may have compatibility issues)",
          value: "19",
        },
      ],
      default: "18",
    },
  ]);

  return reactVersion as "18" | "19";
}

async function confirmUpgrade(
  currentSdk: string | undefined | null,
  targetSdk: string
): Promise<boolean> {
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: chalk.bold(
        'Proceed with upgrade from SDK ' + currentSdk + ' to SDK ' + targetSdk + '?'
      ),
      default: true,
    },
  ]);

  return confirm;
}

function displayBreakingChanges(
  breakingChanges: any[],
  autoFixable: any[],
  manualChanges: any[]
): void {
  log.section("⚠️ Breaking Changes Detected");

  const table = new Table({
    head: ["Package", "Changes", "Auto-fixable"],
    style: { head: ["cyan"] },
  });

  const changesByPackage = breakingChanges.reduce((acc: any, change: any) => {
    if (!acc[change.package]) {
      acc[change.package] = { total: 0, autoFixable: 0 };
    }
    acc[change.package].total++;
    if (change.autoFixable) {
      acc[change.package].autoFixable++;
    }
    return acc;
  }, {} as Record<string, { total: number; autoFixable: number }>);

  Object.entries(changesByPackage).forEach(([pkg, stats]) => {
    const typedStats = stats as { total: number; autoFixable: number };
    const autoFixText =
      typedStats.autoFixable > 0
        ? chalk.green('✓ ' + typedStats.autoFixable + '/' + typedStats.total)
        : chalk.red("✗");

    table.push([pkg, typedStats.total + ' change(s)', autoFixText]);
  });

  console.log(table.toString());
  console.log();

  if (autoFixable.length > 0) {
    log.bullet(autoFixable.length + ' changes can be fixed automatically');
  }
  if (manualChanges.length > 0) {
    log.bullet(manualChanges.length + ' changes require manual intervention');
  }
}

async function prepareBackup(
  projectPath: string,
  options: UpgradeOptions,
  analysis: any
): Promise<"git" | "zip" | "none"> {
  const git = new GitManager();
  const isGitRepo = await git.isGitRepository();
  let backupMethod: "git" | "zip" | "none" = "none";

  // First, check git status and get user confirmation BEFORE creating any files
  if (!options.skipBackup && !options.dryRun) {
    if (isGitRepo) {
      const hasChanges = await git.hasUncommittedChanges();

      if (hasChanges && !options.force) {
        console.log(
          boxen(
            chalk.yellow("  Uncommitted changes detected!\n\n") +
              "Please commit or stash your changes before upgrading.\n" +
              "Use --force to upgrade anyway (not recommended).",
            { padding: 1, borderColor: "yellow", borderStyle: "round" }
          )
        );

        const { proceed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "proceed",
            message: "Force upgrade with uncommitted changes?",
            default: false,
          },
        ]);

        if (!proceed) {
          throw new Error("Upgrade cancelled due to uncommitted changes");
        }
      }

      backupMethod = "git";
    } else {
      const { backup } = await inquirer.prompt([
        {
          type: "confirm",
          name: "backup",
          message: "Create a zip backup of your project?",
          default: true,
        },
      ]);

      backupMethod = backup ? "zip" : "none";
    }
  }

  // Only create state backup AFTER git check passes and user confirms
  if (!options.dryRun) {
    try {
      const stateManager = new StateManager(projectPath);
      await stateManager.initialize();
      const state = await stateManager.captureCurrentState("pre-upgrade");

      log.info('\n      State backup created successfully');
    } catch (error) {
      log.warn(
        "Failed to create state backup, continuing with git backup only"
      );
      if (error instanceof Error) {
        log.error('\n      State backup error: ' + error.message);
      }
    }
  }

  return backupMethod;
}

async function createBackup(
  analysis: any,
  backupMethod: "git" | "zip" | "none"
): Promise<BackupData> {
  log.section(" Creating backup...");

  const packageJsonPath = path.join(analysis.projectPath, "package.json");
  const appJsonPath = path.join(analysis.projectPath, "app.json");

  const backupData: BackupData = {
    packageJson: await fs.readJson(packageJsonPath),
    appJson: (await fs.pathExists(appJsonPath))
      ? await fs.readJson(appJsonPath)
      : null,
    lockFile: null,
    backupBranch: null,
  };

  const lockFiles: Record<string, string> = {
    npm: "package-lock.json",
    yarn: "yarn.lock",
    pnpm: "pnpm-lock.yaml",
    bun: "bun.lockb",
  };

  const lockFilePath = path.join(
    analysis.projectPath,
    lockFiles[analysis.packageManager] || lockFiles.npm
  );

  if (await fs.pathExists(lockFilePath)) {
    backupData.lockFile = lockFilePath;
  }

  log.success("Backup created");
  return backupData;
}

async function executeUpgrade(
  analysis: any,
  targetSdk: string,
  strategy: "conservative" | "recommended" | "aggressive",
  packageManager: string,
  options: UpgradeOptions,
  backupData: BackupData | null,
  backupMethod: "git" | "zip" | "none",
  autoFixable: any[],
  manualChanges: any[],
  reactVersion?: "18" | "19",
  fixedFiles?: Map<string, string>,
  autoFixesApplied?: number
): Promise<UpgradeContext> {
  const git = new GitManager();

  // Reset task guard for this upgrade session
  TaskGuard.reset();

  const tasks = new Listr<UpgradeContext>(
    [
      {
        title: "Performing clean reinstall (clean install mode)",
        skip: () => !!(options.cleanInstall === false || options.dryRun),
        task: async (ctx, task) => {
          const taskId = "clean-reinstall";
          if (!TaskGuard.shouldExecute(taskId, 5000)) {
            log.debug("Clean reinstall already executed, skipping");
            task.skip("Already executed");
            return;
          }
          
          log.info("Starting clean reinstall...");
          TaskGuard.markStarted(taskId);

          const cleanReinstaller = new CleanReinstaller(analysis.projectPath);

          // Remove node_modules
          const nodeModulesPath = path.join(
            analysis.projectPath,
            "node_modules"
          );
          if (await fs.pathExists(nodeModulesPath)) {
            log.info("Removing node_modules...");
            await fs.remove(nodeModulesPath);
            log.success("Removed node_modules");
          }

          // Remove lock files
          const lockFiles = [
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml",
          ];
          for (const lockFile of lockFiles) {
            const lockFilePath = path.join(analysis.projectPath, lockFile);
            if (await fs.pathExists(lockFilePath)) {
              log.info('Removing ' + lockFile + '...');
              await fs.remove(lockFilePath);
            }
          }

          // Clear Metro cache
          const metroCachePath = path.join(analysis.projectPath, ".metro");
          if (await fs.pathExists(metroCachePath)) {
            log.info("Clearing Metro cache...");
            await fs.remove(metroCachePath);
          }

          // Clear Expo cache (but NEVER touch .expo-upgrade-wizard!)
          const expoCachePath = path.join(analysis.projectPath, ".expo");
          const wizardDir = path.join(
            analysis.projectPath,
            ".expo-upgrade-wizard"
          );

          if (await fs.pathExists(expoCachePath)) {
            // .expo and .expo-upgrade-wizard are DIFFERENT folders
            // We should ONLY remove .expo, NOT .expo-upgrade-wizard
            // So we just skip this step to be safe
            log.debug("Skipping .expo cache removal to protect .expo-upgrade-wizard");
          }
          
          log.success("Clean reinstall preparation complete");
        },
      },
      {
        title: "Creating git backup",
        skip: () =>
          !!(options.skipBackup || options.dryRun || backupMethod !== "git"),
        task: async (ctx, task) => {
          const taskId = "git-backup";
          if (!TaskGuard.shouldExecute(taskId, 5000)) {
            task.skip("Already executed");
            return;
          }
          TaskGuard.markStarted(taskId);

          const branchName = await git.createBackupBranch();
          if (backupData && branchName) {
            backupData.backupBranch = branchName;
          }
        },
      },
      {
        title: "Creating zip backup",
        skip: () =>
          !!(options.skipBackup || options.dryRun || backupMethod !== "zip"),
        task: async (ctx, task) => {
          const taskId = "zip-backup";
          if (!TaskGuard.shouldExecute(taskId, 5000)) {
            task.skip("Already executed");
            return;
          }
          TaskGuard.markStarted(taskId);

          await git.createZipBackup();
        },
      },

      {
        title: "Updating Expo configuration",
        task: async (ctx) => {
          ctx.modifiedFiles = ctx.modifiedFiles || [];
          const modified = await updateExpoConfig(
            analysis,
            targetSdk,
            options.dryRun
          );
          if (modified.length > 0) {
            ctx.modifiedFiles.push(...modified);
          }
        },
      },
      {
        title: "Applying automatic fixes",
        skip: () => !options.autoFix || autoFixable.length === 0,
        task: async (ctx, task) => {
          const fixer = new CodeFixer();
          const results = await fixer.applyFixes(autoFixable, options.dryRun);
          ctx.fixResults = results;
        },
      },
      {
        title: "Restoring fixed configuration files (before installation)",
        skip: () => !!(options.dryRun || !fixedFiles || fixedFiles.size === 0),
        task: async (ctx, task) => {
          if (!fixedFiles) {
            log.debug("No fixedFiles map provided");
            return;
          }
          
          task.output = 'Restoring ' + fixedFiles.size + ' fixed files before installation...';
          
          let restoredCount = 0;
          
          for (const [file, savedContent] of fixedFiles.entries()) {
            const filePath = path.join(analysis.projectPath, file);
            
            task.output = 'Restoring ' + file + '...';
            
            // Check if file still exists
            if (!(await fs.pathExists(filePath))) {
              log.warn('File missing: ' + file);
              continue;
            }
            
            // Write the saved content
            await fs.writeFile(filePath, savedContent, 'utf-8');
            restoredCount++;
            
            if (ctx.modifiedFiles && !ctx.modifiedFiles.includes(file)) {
              ctx.modifiedFiles.push(file);
            }
          }
          
          log.success('Restored ' + restoredCount + ' fixed files before installation');
          task.title = 'Restored ' + restoredCount + ' fixed configuration file' + (restoredCount > 1 ? 's' : '') + ' (before installation)';
        },
      },
      {
        title: "Clearing Metro and Expo caches",
        skip: () => !!options.dryRun,
        task: async (ctx, task) => {
          // Clear Metro cache
          const metroCachePaths = [
            path.join(analysis.projectPath, ".metro"),
            path.join(analysis.projectPath, "node_modules", ".cache", "metro"),
          ];

          for (const cachePath of metroCachePaths) {
            if (await fs.pathExists(cachePath)) {
              await fs.remove(cachePath);
            }
          }

          // Clear Expo cache (but NEVER touch .expo-upgrade-wizard!)
          const expoCachePaths = [
            path.join(analysis.projectPath, ".expo"),
            path.join(analysis.projectPath, "node_modules", ".cache", "expo"),
          ];

          for (const cachePath of expoCachePaths) {
            // Skip if this is the wizard directory
            if (cachePath.includes(".expo-upgrade-wizard")) {
              continue;
            }

            if (await fs.pathExists(cachePath)) {
              // Double-check we're not removing the wizard directory
              const wizardDir = path.join(
                analysis.projectPath,
                ".expo-upgrade-wizard"
              );
              if (
                cachePath === wizardDir ||
                cachePath.startsWith(wizardDir + path.sep)
              ) {
                continue;
              }

              await fs.remove(cachePath);
            }
          }
        },
      },
      {
        title: "Installing packages (this may take several minutes)",
        skip: () => !!(options.skipInstall || options.dryRun),
        task: async (ctx, task) => {
          ctx.modifiedFiles = ctx.modifiedFiles || [];

          // Show installation progress info
          task.output = chalk.gray(
            'Installing packages with ' + packageManager + '... This may take several minutes'
          );

          // Use ExpoInstallUpgrader - it uses expo install --fix which gets correct versions
          const expoUpgrader = new ExpoInstallUpgrader(
            analysis.projectPath,
            targetSdk
          );

          task.output = chalk.gray("Running expo install --fix...");

          const result = await expoUpgrader.upgrade(
            options.dryRun,
            reactVersion
          );

          if (!result.success) {
            const errorDetails = result.errors.join("\n");
            throw new Error('Expo install upgrade failed:\n' + errorDetails);
          }

          task.output = chalk.gray(
            'Installed ' + result.updated.length + ' packages'
          );

          ctx.packageChanges = {
            updated: result.updated,
            removed: [],
            errors: result.errors,
          };
          ctx.modifiedFiles.push("package.json");

          // Update install commands based on React version
          if (reactVersion === "18") {
            ctx.installCommands = [
              "npx expo install --fix",
              "npx expo install react@18.3.1 react-dom@18.3.1 react-native@0.76.5",
            ];
          } else {
            ctx.installCommands = ["npx expo install --fix"];
          }
        },
      },

      {
        title: "Verifying installation",
        skip: () =>
          !!(options.skipInstall || options.dryRun || options.skipValidation),
        task: async (ctx, task) => {
          const verified = await verifyInstallation(analysis, targetSdk);
          if (!verified) {
            throw new Error("Installation verification failed");
          }
        },
      },
      {
        title: "Running expo-doctor validation",
        skip: () =>
          !!(options.skipInstall || options.dryRun || options.skipValidation),
        task: async (ctx, task) => {
          try {
            const { execa } = await import("execa");
            const result = await execa("npx", ["expo-doctor@latest"], {
              cwd: process.cwd(),
              reject: false,
              timeout: 60000,
            });

            ctx.doctorOutput = result.stdout;
            ctx.doctorPassed = result.exitCode === 0;
          } catch (error) {
            // Silently handle error - will be reported in summary
          }
        },
      },
    ],
    {
      // Configure Listr2 to prevent duplicate rendering
      concurrent: false,
      exitOnError: false,
      // Use simple renderer if terminal doesn't support cursor control
      renderer: process.stdout.isTTY ? "default" : "default",
      rendererOptions: {
        // Prevent duplicate task rendering
        showSubtasks: false, // Don't show subtasks (prevents duplication)
        clearOutput: false, // Keep output visible
        showErrorMessage: true,
        removeEmptyLines: true,
        indentation: 2,
        formatOutput: "wrap",
        suffixSkips: true, // Show skip reason as suffix
        // Force disable animations if terminal doesn't support it
        ...(process.stdout.isTTY ? {} : { showSpinner: false }),
      },
    }
  );

  const result = await tasks.run();

  // Add auto-fixes count to the result
  if (autoFixesApplied !== undefined) {
    result.autoFixesApplied = autoFixesApplied;
  }

  // DEBUG: Check if state folder still exists after all tasks
  const stateDir = path.join(
    analysis.projectPath,
    ".expo-upgrade-wizard",
    "state"
  );

  return result;
}

async function updateExpoConfig(
  analysis: any,
  targetSdk: string,
  dryRun?: boolean
): Promise<string[]> {
  const modifiedFiles: string[] = [];

  if (analysis.configFiles.appJson) {
    const appJsonPath = path.join(analysis.projectPath, "app.json");
    const appJson = await fs.readJson(appJsonPath);

    if (appJson.expo?.sdkVersion) {
      log.warn(
        "Removing sdkVersion from app.json - SDK version is determined by expo package"
      );
      delete appJson.expo.sdkVersion;

      if (!dryRun) {
        await fs.writeJson(appJsonPath, appJson, { spaces: 2 });
        modifiedFiles.push("app.json");
      }
    }
  }

  if (analysis.configFiles.appConfig) {
    const appConfigPath = path.join(analysis.projectPath, "app.config.js");
    const configContent = await fs.readFile(appConfigPath, "utf-8");

    if (configContent.includes("sdkVersion")) {
      log.warn("app.config.js contains sdkVersion - please remove it manually");
      log.info(
        "SDK version should be determined by the expo package version in package.json"
      );
    }
  }

  return modifiedFiles;
}

async function installDependencies(
  packageManager: string,
  cleanInstall?: boolean
): Promise<void> {
  const { execa } = await import("execa");

  // Verify package manager is available, fall back to npm if not
  let actualPM = packageManager;
  if (packageManager !== "npm") {
    try {
      await execa(packageManager, ["--version"], { timeout: 5000 });
    } catch (error) {
      log.warn(packageManager + ' is not available, falling back to npm');
      actualPM = "npm";
    }
  }

  if (cleanInstall) {
    const lockFiles: Record<string, string> = {
      npm: "package-lock.json",
      yarn: "yarn.lock",
      pnpm: "pnpm-lock.yaml",
      bun: "bun.lockb",
    };

    const lockFile = path.join(process.cwd(), lockFiles[actualPM]);
    if (await fs.pathExists(lockFile)) {
      await fs.remove(lockFile);
      log.info('Removed ' + lockFiles[actualPM] + ' for clean install');
    }
  }

  // For npm, try legacy-peer-deps first (most compatible)
  // For yarn, try with --ignore-engines flag as fallback
  const commands: Record<string, string[][]> = {
    npm: [
      ["npm", "install", "--legacy-peer-deps"],
      ["npm", "install", "--force"],
    ],
    yarn: [
      ["yarn", "install"],
      ["yarn", "install", "--ignore-engines"],
    ],
    pnpm: [["pnpm", "install"]],
    bun: [["bun", "install"]],
  };

  const commandsToTry = commands[actualPM] || commands.npm;
  let lastError: any = null;
  let lastErrorOutput: string = "";

  for (let i = 0; i < commandsToTry.length; i++) {
    const [cmd, ...args] = commandsToTry[i];

    try {
      if (i > 0) {
        log.warn('Trying alternative install method: ' + cmd + ' ' + args.join(' '));
      }

      // Use inherit for real-time output, but also capture for error reporting
      const result = await execa(cmd, args, {
        cwd: process.cwd(),
        reject: true,
        all: true, // Capture combined stdout/stderr
        stdio: ["inherit", "pipe", "pipe"], // Inherit stdin, pipe stdout/stderr
      });

      // If we get here, install succeeded
      return;
    } catch (error: any) {
      lastError = error;
      // Capture the combined output or individual streams
      lastErrorOutput =
        error.all || error.stderr || error.stdout || error.message || "";

      // If this was the last attempt, throw a more detailed error
      if (i === commandsToTry.length - 1) {
        // Extract the most relevant error info (last 1000 chars to see the actual error)
        const errorSnippet = lastErrorOutput.slice(-1000);

        // Try to find peer dependency errors
        const peerDepMatch = errorSnippet.match(/error.*peer.*dependencies?/i);
        const conflictMatch = errorSnippet.match(/conflict.*with/i);

        let helpfulMessage = cmd + ' ' + args.join(' ') + ' failed with exit code ' +
          error.exitCode;

        if (peerDepMatch || conflictMatch) {
          helpfulMessage +=
            "\n\n💡 Peer dependency conflict detected. Try:\n" +
            "  1. Upgrade incrementally (SDK 49 → 51 → 53)\n" +
            "  2. Switch to npm: rm yarn.lock && npm install --legacy-peer-deps\n" +
            "  3. Check package.json for incompatible versions";
        }

        if (errorSnippet) {
          helpfulMessage += '\n\nLast error output:\n' + errorSnippet;
        }

        const detailedError = new Error(helpfulMessage);
        throw detailedError;
      }

      // Otherwise, log and try next method
      log.warn(
        cmd + ' ' + args.join(' ') + ' failed with exit code ' +
          error.exitCode + ', trying alternative method...'
      );
    }
  }

  // This should never be reached, but just in case
  if (lastError) {
    throw lastError;
  }
}

async function verifyInstallation(
  analysis: any,
  targetSdk: string
): Promise<boolean> {
  try {
    const expoModulePath = path.join(
      process.cwd(),
      "node_modules/expo/package.json"
    );

    if (!(await fs.pathExists(expoModulePath))) {
      log.error("Expo package not found in node_modules after installation");
      return false;
    }

    const installedExpoPkg = await fs.readJson(expoModulePath);
    const sdkInfo = getSdkInfo(targetSdk);

    if (!sdkInfo) {
      log.warn("Could not verify installation - SDK info not found");
      return true;
    }

    const expectedVersion = sdkInfo.expoPackageVersion.replace(/[~^]/g, "");
    const installedVersion = installedExpoPkg.version;

    const expectedMajor = expectedVersion.split(".")[0];
    const installedMajor = installedVersion.split(".")[0];

    if (installedMajor !== expectedMajor) {
      log.error(
        'Expo version mismatch! Expected SDK ' + targetSdk + ' (expo ' + expectedVersion + '), got expo ' + installedVersion
      );
      return false;
    }

    log.success(
      'Verified expo@' + installedVersion + ' is installed (SDK ' + targetSdk + ')'
    );

    const rnModulePath = path.join(
      process.cwd(),
      "node_modules/react-native/package.json"
    );

    if (await fs.pathExists(rnModulePath)) {
      const installedRN = await fs.readJson(rnModulePath);
      const expectedRN = sdkInfo.reactNativeVersion;
      const expectedRNMajor = expectedRN.split(".")[0];
      const installedRNMajor = installedRN.version.split(".")[0];

      // Only check major version match (0.76.x vs 0.79.x both work for SDK 53)
      if (installedRNMajor !== expectedRNMajor) {
        log.error(
          'React Native major version mismatch! Expected ' + expectedRN + ', got ' + installedRN.version
        );
        return false;
      }

      // If minor version differs, show info but don't fail
      const expectedRNMinor = expectedRN.split(".").slice(0, 2).join(".");
      const installedRNMinor = installedRN.version
        .split(".")
        .slice(0, 2)
        .join(".");

      if (installedRNMinor !== expectedRNMinor) {
        log.info(
          'React Native version: ' + installedRN.version + ' (SDK ' + targetSdk + ' default is ' + expectedRN + ')'
        );

        // Special case for SDK 53 with RN 0.79.x (Hermes fix)
        if (targetSdk === "53" && installedRN.version.startsWith("0.79")) {
          log.info(
            "✓ Using React Native 0.79.x - this is recommended for SDK 53 to fix Hermes issues"
          );
        }
      } else {
        log.success(
          'Verified react-native@' + installedRN.version + ' is installed'
        );
      }
    }

    return true;
  } catch (error) {
    log.error("Failed to verify installation:", error);
    return false;
  }
}

function formatDoctorOutput(output: string): string {
  const lines = output.split("\n");
  let formatted = "";
  const warnings: Array<{ title: string; details: string[]; advice: string }> =
    [];
  let currentWarning: {
    title: string;
    details: string[];
    advice: string;
  } | null = null;
  let passedCount = 0;
  let warningCount = 0;
  let inWarningBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Count passed/failed checks
    if (line.includes("checks passed")) {
      const match = line.match(/(\d+)\/(\d+) checks passed/);
      if (match) {
        passedCount = parseInt(match[1]);
        const totalChecks = parseInt(match[2]);
        warningCount = totalChecks - passedCount;
      }
      continue;
    }

    // Detect warning blocks (lines starting with ⚠ or ✖)
    if (trimmed.match(/^[⚠✖]/)) {
      // Save previous warning if exists
      if (currentWarning) {
        warnings.push(currentWarning);
      }
      // Start new warning
      currentWarning = {
        title: trimmed.replace(/^[⚠✖]\s*/, "").trim(),
        details: [],
        advice: "",
      };
      inWarningBlock = true;
    } else if (inWarningBlock && currentWarning) {
      // Skip box drawing characters
      if (trimmed.match(/^[╭╰│─┤├]+$/)) {
        continue;
      }

      // Collect warning details
      if (trimmed.length > 0) {
        // Remove leading box characters
        const cleanLine = trimmed.replace(/^[│]\s*/, "");
        if (cleanLine.length > 0) {
          currentWarning.details.push(cleanLine);
        }
      }

      // Check if we've reached the end of this warning block
      if (
        trimmed === "" &&
        i < lines.length - 1 &&
        !lines[i + 1].trim().match(/^[│]/)
      ) {
        inWarningBlock = false;
      }
    }
  }

  // Add last warning
  if (currentWarning) {
    warnings.push(currentWarning);
  }

  // Format header with summary
  if (passedCount > 0 || warningCount > 0) {
    formatted += chalk.gray(
      '\n' + passedCount + '/' + (passedCount + warningCount) + ' checks passed'
    );
    if (warningCount > 0) {
      formatted += chalk.yellow(
        ', ' + warningCount + ' warning' + (warningCount > 1 ? "s" : "")
      );
    }
    formatted += "\n";
  }

  // Display warnings with improved formatting
  if (warnings.length > 0) {
    formatted += chalk.gray("\n" + "─".repeat(60) + "\n");

    warnings.forEach((warning, index) => {
      const isCritical = isCriticalWarning(warning.title);
      const icon = isCritical ? chalk.red("⚠") : chalk.yellow("⚠");

      // Warning title with better spacing
      formatted += '\n' + icon + '  ' + chalk.bold.white(warning.title) + '\n\n';

      // Show details with proper indentation
      if (warning.details.length > 0) {
        // Group and clean up details
        const cleanDetails = warning.details
          .filter((d) => d.length > 0 && !d.match(/^[─]+$/))
          .map((d) => d.trim());

        cleanDetails.forEach((detail) => {
          // Wrap long lines
          if (detail.length > 80) {
            const words = detail.split(" ");
            let currentLine = "";
            words.forEach((word) => {
              if ((currentLine + word).length > 80) {
                formatted += chalk.gray('   ' + currentLine.trim() + '\n');
                currentLine = word + " ";
              } else {
                currentLine += word + " ";
              }
            });
            if (currentLine.trim()) {
              formatted += chalk.gray('   ' + currentLine.trim() + '\n');
            }
          } else {
            formatted += chalk.gray('   ' + detail + '\n');
          }
        });
      }

      // Add separator between warnings
      if (index < warnings.length - 1) {
        formatted += chalk.gray("\n" + "─".repeat(60) + "\n");
      }
    });

    formatted += chalk.gray("\n" + "─".repeat(60) + "\n");
  }

  return formatted;
}

function isCriticalWarning(warningTitle: string): boolean {
  // Determine if a warning is critical (red) or just a recommendation (yellow)
  const criticalKeywords = [
    "package.json",
    "dependencies",
    "version mismatch",
    "incompatible",
    "error",
    "failed",
  ];

  const lowerTitle = warningTitle.toLowerCase();
  return criticalKeywords.some((keyword) => lowerTitle.includes(keyword));
}

function generateUpgradeReport(
  startTime: number,
  targetSdk: string,
  context: UpgradeContext,
  manualChanges: any[],
  options: UpgradeOptions
): void {
  log.section("📋 Upgrade Report");

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Get actual package changes by comparing package.json before/after
  let actualPackagesUpdated = 0;
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const currentPackageJson = fs.readJsonSync(packageJsonPath);
    
    // Count all dependencies that were updated
    const allDeps = {
      ...currentPackageJson.dependencies,
      ...currentPackageJson.devDependencies,
    };
    
    // For expo install --fix, we know it updates many packages
    // Use a more accurate count based on expo packages
    const expoPackages = Object.keys(allDeps).filter(pkg => 
      pkg.startsWith('expo') || 
      pkg === 'react' || 
      pkg === 'react-dom' || 
      pkg === 'react-native'
    );
    
    actualPackagesUpdated = expoPackages.length;
    
    // If we have explicit update info from context, use that instead
    if (context.packageChanges?.updated && context.packageChanges.updated.length > 0) {
      actualPackagesUpdated = context.packageChanges.updated.length;
    }
  } catch (error) {
    // Fallback to context data
    actualPackagesUpdated = context.packageChanges?.updated.length || 0;
  }

  // Get unique modified files count
  const uniqueModifiedFiles = context.modifiedFiles 
    ? [...new Set(context.modifiedFiles)].length 
    : 0;

  // Get auto-fixes count from context (set during the upgrade process)
  const autoFixesApplied = context.autoFixesApplied || 0;

  const reportTable = new Table({
    style: { head: ["cyan"] },
  });

  reportTable.push(
    ["Duration", duration + ' seconds'],
    ["Packages Updated", actualPackagesUpdated],
    ["Packages Removed", context.packageChanges?.removed.length || 0],
    ["Files Modified", uniqueModifiedFiles],
    ["Code Auto-fixes Applied", autoFixesApplied],
    ["Manual Fixes Required", manualChanges.length]
  );

  console.log(reportTable.toString());

  if (context.packageChanges?.removed?.length > 0) {
    log.section("🗑️  Removed Deprecated Packages");
    context.packageChanges.removed.forEach((pkg: string) => {
      log.bullet('   ' + pkg + ' no longer needed (SDK ' + targetSdk + ')');
    });
  }

  if (manualChanges.length > 0) {
    displayManualSteps(manualChanges);
  }

  if (context.doctorOutput && !context.doctorPassed) {
    log.section("🩺 Expo Doctor Validation");

    // Parse and format doctor output to highlight important warnings
    const formattedOutput = formatDoctorOutput(context.doctorOutput);
    console.log(formattedOutput);
  } else if (context.doctorPassed) {
    log.success("\n✅ Expo Doctor validation passed - no issues detected");
  }
}

function displayManualSteps(manualChanges: any[]): void {
  log.section("📝 Manual Steps Required");

  const criticalChanges = manualChanges.filter(
    (c: any) => c.severity === "critical"
  );
  const warningChanges = manualChanges.filter(
    (c: any) => c.severity === "warning"
  );
  const infoChanges = manualChanges.filter((c: any) => c.severity === "info");
  const unspecifiedChanges = manualChanges.filter((c: any) => !c.severity);

  if (criticalChanges.length > 0) {
    console.log(
      chalk.red.bold("\n❌ CRITICAL (App won't build without this):")
    );
    criticalChanges.forEach(displayChange);
  }

  if (warningChanges.length > 0) {
    console.log(
      chalk.yellow.bold("\n⚠️  WARNING (Recommended but not blocking):")
    );
    warningChanges.forEach(displayChange);
  }

  if (infoChanges.length > 0) {
    console.log(chalk.cyan.bold("\nℹ️  INFO (Optional improvements):"));
    infoChanges.forEach(displayChange);
  }

  if (unspecifiedChanges.length > 0) {
    unspecifiedChanges.forEach(displayChange);
  }
}

function displayChange(change: any): void {
  console.log(chalk.yellow('  ' + change.package + ':'));
  console.log('    ' + change.description);
  if (change.manualSteps) {
    change.manualSteps.forEach((step: string) => {
      console.log('    ' + chalk.gray("•") + ' ' + step);
    });
  }
}

// Removed: displayNextSteps function - no longer needed
/*
function displayNextSteps(
  manualChanges: any[],
  context: UpgradeContext,
  options: UpgradeOptions
): void {
  log.section("✅ Next Steps");

  const nextSteps = [
    "Review the changes in your code editor",
    "Test your app thoroughly",
    "Run npm start or yarn start to test in development",
    "If using EAS Build, run 'eas build' to test production builds",
  ];

  if (manualChanges.length > 0) {
    nextSteps.unshift("Complete the manual fixes listed above");
  }

  if (!context.doctorPassed && !context.doctorOutput) {
    nextSteps.unshift("Run 'npx expo-doctor' to check for any issues");
  }

  nextSteps.forEach((step) => {
    log.bullet(step);
  });

  if (options.dryRun) {
    console.log(
      boxen(
        chalk.yellow("DRY RUN MODE\n\n") +
          "No changes were actually made to your project.\n" +
          "Remove --dry-run to perform the actual upgrade.",
        { padding: 1, borderColor: "yellow", borderStyle: "round" }
      )
    );
  }
}
*/

async function runPostUpgradeAIAnalysis(
  analysis: any,
  targetSdk: string,
  options: UpgradeOptions
): Promise<void> {
  try {
    log.section("📋 Post-Upgrade Guide");

    // Use SDK-specific guide if available
    if (targetSdk === "52") {
      console.log(
        boxen(
          chalk.yellow.bold("⚠️  SDK 52 Breaking Changes\n\n") +
            "SDK 52 includes the MOST breaking changes of any Expo SDK release.\n" +
            "Please review the guide carefully before building your app.\n\n" +
            chalk.white("Key changes:\n") +
            chalk.gray("  • New Architecture enabled by default (Hermes required)\n") +
            chalk.gray("  • expo-av Video deprecated → migrate to expo-video\n") +
            chalk.gray("  • expo-camera/legacy removed\n") +
            chalk.gray("  • expo-sqlite/legacy removed\n") +
            chalk.gray("  • Push notifications deprecated in Expo Go\n") +
            chalk.gray("  • iOS 15.1+ and Android 7.0+ required\n\n") +
            chalk.cyan("Estimated fix time: 4-8 hours\n\n") +
            chalk.white("Full guide: https://expo.dev/changelog/2024/11-12-sdk-52"),
          { padding: 1, borderColor: "yellow", borderStyle: "round" }
        )
      );
    } else if (targetSdk === "51") {
      console.log(
        boxen(
          chalk.yellow.bold("⚠️  SDK 51 Breaking Changes\n\n") +
            "SDK 51 includes major API rewrites that require attention.\n" +
            "Please review the guide carefully before building your app.\n\n" +
            chalk.white("Key changes:\n") +
            chalk.gray("  • expo-camera API completely rewritten\n") +
            chalk.gray("  • expo-sqlite API completely rewritten\n") +
            chalk.gray("  • Xcode 15.3+ required\n") +
            chalk.gray("  • Expo Go single SDK support\n") +
            chalk.gray("  • New Architecture support available\n\n") +
            chalk.cyan("Estimated fix time: 1-3 hours (legacy) or 4-8 hours (new APIs)\n\n") +
            chalk.white("Full guide: https://expo.dev/changelog/2024/08-13-sdk-51"),
          { padding: 1, borderColor: "yellow", borderStyle: "round" }
        )
      );
    } else if (targetSdk === "50") {
      console.log(
        boxen(
          chalk.yellow.bold("⚠️  SDK 50 Breaking Changes\n\n") +
            "SDK 50 includes important changes that require attention.\n" +
            "Please review the guide carefully before building your app.\n\n" +
            chalk.white("Key changes:\n") +
            chalk.gray("  • expo-router: Babel plugin required\n") +
            chalk.gray("  • Ionicons: Renamed icons\n") +
            chalk.gray("  • Android: targetSdkVersion 34 required\n") +
            chalk.gray("  • Sentry SDK migration recommended\n\n") +
            chalk.cyan("Estimated fix time: 1-2 hours\n\n") +
            chalk.white("Full guide: https://expo.dev/changelog/2024/05-07-sdk-50"),
          { padding: 1, borderColor: "yellow", borderStyle: "round" }
        )
      );

      console.log(
        boxen(
          chalk.yellow.bold("⚠️  SDK 50 Breaking Changes\n\n") +
            "SDK 50 includes several breaking changes that require manual fixes.\n" +
            "Please review the guide above carefully before building your app.\n\n" +
            chalk.white("Key changes:\n") +
            chalk.gray("  • expo-router/babel plugin removed\n") +
            chalk.gray("  • Ionicons prefix changes (ios-/md-)\n") +
            chalk.gray("  • Android SDK 34 + Java 17 required\n") +
            chalk.gray("  • Classic Updates deprecated\n\n") +
            chalk.cyan("Estimated fix time: 2-4 hours"),
          { padding: 1, borderColor: "yellow", borderStyle: "round" }
        )
      );
    } else {
      // Generate rule-based post-upgrade guide (no AI needed)
      const generator = new PostUpgradeGuideGenerator(
        analysis.projectPath || process.cwd()
      );
      const terminalOutput = generator.generate();

      // Display in terminal
      console.log(terminalOutput);

      log.info(chalk.cyan("\n💾 Full guide saved to:"));
      log.info(chalk.gray("   .expo-upgrade-wizard/POST_UPGRADE_GUIDE.md"));

      console.log(
        boxen(
          chalk.yellow.bold("⚠️  Important\n\n") +
            "These are production-tested recommendations based on real SDK upgrades.\n" +
            "Follow the steps carefully for a smooth upgrade experience.",
          { padding: 1, borderColor: "yellow", borderStyle: "round" }
        )
      );
    }
  } catch (error) {
    log.debug("Post-upgrade guide generation failed:", error);
    log.info("Skipping post-upgrade guide - upgrade completed successfully");
  }
}

async function handleUpgradeError(
  error: any,
  backupData: BackupData | null,
  options: UpgradeOptions,
  projectPath: string
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const { CloudStorageDetector } = await import(
    "../utils/cloud-storage-detector"
  );

  // Detect if it's a cloud storage error
  const cloudDetection = CloudStorageDetector.detect(projectPath);
  const isCloudError = CloudStorageDetector.isCloudStorageError(error);

  // Detect if it's a peer dependency error
  const isPeerDepError =
    errorMessage.includes("peer") ||
    errorMessage.includes("ERESOLVE") ||
    errorMessage.includes("conflicting");

  // Detect if it's a yarn error
  const isYarnError =
    errorMessage.includes("yarnpkg") ||
    errorMessage.includes("spawn yarn") ||
    (errorMessage.includes("ENOENT") && errorMessage.includes("yarn"));

  console.log(
    boxen(
      chalk.red.bold("❌ Upgrade Failed\n\n") +
        (cloudDetection.isCloudStorage && isCloudError
          ? chalk.yellow(cloudDetection.provider + ' file locking detected\n') +
            cloudDetection.provider + ' is preventing npm from modifying files.\n\n'
          : "") +
        (isPeerDepError
          ? chalk.yellow("Peer dependency conflict detected\n") +
            "This usually happens when React Native and React versions don't align.\n\n"
          : "") +
        (isYarnError
          ? chalk.yellow("Yarn is not installed\n") +
            "Your project is trying to use yarn but it's not available.\n\n"
          : "") +
        chalk.white('Error: ' + errorMessage),
      { padding: 1, borderColor: "red", borderStyle: "round" }
    )
  );

  if (backupData && !options.dryRun) {
    log.section("🔄 Attempting automatic rollback...");

    try {
      const packageJsonPath = path.join(process.cwd(), "package.json");
      await fs.writeJson(packageJsonPath, backupData.packageJson, {
        spaces: 2,
      });
      log.success("✓ Restored package.json");

      if (backupData.appJson) {
        const appJsonPath = path.join(process.cwd(), "app.json");
        await fs.writeJson(appJsonPath, backupData.appJson, { spaces: 2 });
        log.success("✓ Restored app.json");
      }

      if (
        backupData.lockFile &&
        (await fs.pathExists(backupData.lockFile + ".backup"))
      ) {
        await fs.move(backupData.lockFile + ".backup", backupData.lockFile, {
          overwrite: true,
        });
        log.success("✓ Restored lock file");
      }

      // Clean up broken node_modules (with timeout for Windows)
      const nodeModulesPath = path.join(process.cwd(), "node_modules");
      if (await fs.pathExists(nodeModulesPath)) {
        log.info("Cleaning up node_modules...");
        try {
          // Use platform-specific removal with timeout
          const { execa } = await import("execa");
          if (process.platform === "win32") {
            // Windows: use rmdir /s /q which is faster
            await execa("cmd", ["/c", "rmdir", "/s", "/q", "node_modules"], {
              cwd: process.cwd(),
              timeout: 30000, // 30 second timeout
            });
          } else {
            // Unix: use rm -rf
            await execa("rm", ["-rf", "node_modules"], {
              cwd: process.cwd(),
              timeout: 30000,
            });
          }
          log.success("✓ Removed broken node_modules");
        } catch (removeError) {
          log.warn("⚠️  Could not remove node_modules automatically");
          log.info("Please manually delete the node_modules folder");
        }
      }

      console.log(
        boxen(
          chalk.green.bold("✅ Rollback Complete\n\n") +
            "Your project has been restored to its previous state.\n\n" +
            chalk.white("Next steps:\n") +
            "  1. Run: npm install\n" +
            "  2. Verify your app works: npm start",
          { padding: 1, borderColor: "green", borderStyle: "round" }
        )
      );

      if (backupData.backupBranch) {
        log.info(
          '\nGit backup also available: ' + chalk.cyan(backupData.backupBranch)
        );
      }
    } catch (rollbackError) {
      log.error("❌ Automatic rollback failed");

      console.log(
        boxen(
          chalk.yellow.bold("⚠️  Manual Recovery Required\n\n") +
            "Please restore your project manually:\n\n" +
            (backupData.backupBranch
              ? '1. Git restore: git checkout ' + backupData.backupBranch + '\n'
              : "1. Git restore: git checkout HEAD -- package.json app.json\n") +
            "2. Or use: expo-upgrade-wizard state rollback\n" +
            "3. Clean install: rm -rf node_modules package-lock.json && npm install",
          { padding: 1, borderColor: "yellow", borderStyle: "round" }
        )
      );
    }
  } else {
    // No backup data available
    console.log(
      boxen(
        chalk.yellow.bold("🔧 Recovery Options\n\n") +
          "1. Restore from git:\n" +
          "   git checkout HEAD -- package.json app.json\n\n" +
          "2. Or restore from git stash:\n" +
          "   git stash pop\n\n" +
          "3. Clean reinstall:\n" +
          "   rm -rf node_modules package-lock.json\n" +
          "   npm install",
        { padding: 1, borderColor: "yellow", borderStyle: "round" }
      )
    );
  }

  if (cloudDetection.isCloudStorage && isCloudError) {
    log.section("💡 Why This Happened");
    console.log(
      chalk.gray(
        'Your project is located in ' + cloudDetection.provider + ', which actively syncs files.\n' +
          'This causes file locking issues when npm tries to modify node_modules.\n' +
          'The EPERM (operation not permitted) errors indicate files are locked by ' + cloudDetection.provider + '.\n'
      )
    );

    log.section("🔧 Recommended Solutions");
    log.bullet(
      chalk.green('Move your project outside ' + cloudDetection.provider + ':') +
        '\n     ' + chalk.cyan(
          cloudDetection.recommendedPath ||
            "C:\\Users\\YourName\\Projects\\your-project"
        )
    );
    log.bullet('Pause ' + cloudDetection.provider + ' sync during the upgrade');
    log.bullet(
      'Exclude node_modules folder from ' + cloudDetection.provider + ' sync'
    );
    log.bullet(
      'Close any file explorers or editors that might be locking files'
    );

    console.log(
      boxen(
        chalk.yellow.bold("⚠️  Important\n\n") +
          'Working with npm projects in ' + cloudDetection.provider + ' is not recommended.\n' +
          'File sync conflicts can cause installation failures and data corruption.\n\n' +
          chalk.white(
            "Best practice: Keep development projects in a local folder."
          ),
        { padding: 1, borderColor: "yellow", borderStyle: "round" }
      )
    );
  } else if (isYarnError) {
    log.section("💡 Why This Happened");
    console.log(
      chalk.gray(
        "Your project has a yarn.lock file but yarn is not installed.\n" +
          "Expo CLI detected the yarn.lock file and tried to use yarn.\n"
      )
    );

    log.section("🔧 Solutions");
    log.bullet("Install yarn: npm install -g yarn");
    log.bullet("Or delete yarn.lock file to use npm instead");
    log.bullet(
      "Or run with manual mode: npx expo-upgrade-wizard upgrade --no-expo-install"
    );
  } else if (isPeerDepError) {
    log.section("💡 Why This Happened");
    console.log(
      chalk.gray(
        "Peer dependency conflicts occur when package versions don't align.\n" +
          "This is common during major SDK upgrades.\n"
      )
    );

    log.section("🔧 Troubleshooting Tips");
    log.bullet("Ensure you have the latest npm: npm install -g npm@latest");
    log.bullet("Try clearing npm cache: npm cache clean --force");
    log.bullet("Check for conflicting package versions in package.json");
    log.bullet("Consider upgrading in smaller steps (e.g., SDK 49 → 51 → 53)");
  }

  process.exit(1);
}

/**
 * Run clean CLI demo output for marketing/screenshots
 * Produces polished, screenshot-ready output matching the user's desired format
 */
async function runCleanCLIDemo(options: UpgradeOptions): Promise<void> {
  const packageJsonPath = path.join(__dirname, "..", "..", "package.json");
  const packageJson = await fs.readJson(packageJsonPath);

  // Display header
  CLIOutputFormatter.displayHeader(packageJson.version);

  // Display action
  CLIOutputFormatter.displayAction("🚀 Upgrade Expo SDK");

  // Display expo install notice
  CLIOutputFormatter.displayExpoInstallNotice();

  // Display project analysis
  CLIOutputFormatter.displayProjectAnalysis({
    reactNativeVersion: "0.72.4",
    workflowType: "bare",
    packageManager: "npm",
  });

  // Display target SDK
  CLIOutputFormatter.displayTargetSDK("53");

  // Display upgrade path
  CLIOutputFormatter.displayUpgradePath(["50", "51", "52", "53"]);

  // Display breaking changes
  const mockBreakingChanges = [
    {
      package: "react-native",
      title: "React Native 0.74 to 0.76 migration",
      autoFixable: true,
      severity: "warning",
    },
    {
      package: "expo-router",
      title: "Expo Router v3 migration",
      autoFixable: true,
      severity: "warning",
    },
    {
      package: "expo-notifications",
      title: "Notification API updates",
      autoFixable: true,
      severity: "warning",
    },
    {
      package: "expo",
      title: "Config plugin API updates",
      autoFixable: true,
      severity: "warning",
    },
    {
      package: "react-native-gesture-handler",
      title: "Gesture Handler API v2 migration",
      autoFixable: false,
      severity: "warning",
    },
    {
      package: "react-native-reanimated",
      title: "Reanimated plugin position",
      autoFixable: true,
      severity: "warning",
    },
  ];

  const autoFixable = mockBreakingChanges.filter((c) => c.autoFixable);
  const manualChanges = mockBreakingChanges.filter((c) => !c.autoFixable);

  CLIOutputFormatter.displayBreakingChanges(
    mockBreakingChanges,
    autoFixable,
    manualChanges
  );

  // Display strategy
  CLIOutputFormatter.displayStrategy("recommended");

  // Display state capture
  CLIOutputFormatter.displayStateCapture(
    "pre-upgrade-2025-10-18T12-15-20-750Z"
  );

  // Display uncommitted changes warning
  CLIOutputFormatter.displayUncommittedWarning();

  // Display confirmation prompts
  CLIOutputFormatter.displayConfirmation(
    "Force upgrade with uncommitted changes?",
    "Yes"
  );
  CLIOutputFormatter.displayConfirmation(
    "Proceed with upgrade from SDK 49 to SDK 53?",
    "Yes"
  );

  // Display backup
  CLIOutputFormatter.displayBackup("pre-upgrade-2025-10-18T12-15-22-820Z");

  // Display upgrade progress
  CLIOutputFormatter.displayUpgradeProgress();

  // Display upgrade report
  CLIOutputFormatter.displayUpgradeReport({
    duration: 765,
    packagesUpdated: 4,
    packagesRemoved: 0,
    filesModified: 2,
    autoFixes: 5,
    manualFixes: 1,
  });

  // Add separator before manual steps
  CLIOutputFormatter.displaySeparator();

  // Display manual steps (only the one non-auto-fixable change)
  const mockManualSteps = [
    {
      package: "react-native-gesture-handler",
      title: "Gesture Handler API v2 migration",
      severity: "warning",
      description:
        "Wrap gesture handlers with GestureDetector\nMigrate from class-based to function-based gesture API\nUpdate gesture event handlers",
    },
  ];

  CLIOutputFormatter.displayManualSteps(mockManualSteps);

  // Display success banner
  CLIOutputFormatter.displaySuccessBanner();

  // Display next steps
  CLIOutputFormatter.displayNextSteps();
}

/**
 * Show dry-run preview with generic example output
 */
async function showDryRunPreview(options: UpgradeOptions): Promise<void> {
  console.log(
    boxen(
      chalk.cyan.bold("🔍 DRY RUN MODE - PREVIEW ONLY\n\n") +
        chalk.gray(
          "No files will be modified. This is a generic example of what the upgrade would do."
        ),
      { padding: 1, borderColor: "cyan", borderStyle: "round" }
    )
  );

  console.log();

  // Step 1: Project Analysis
  log.section("📦 Analyzing your project...");
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log(chalk.gray("• Current SDK: 50"));
  console.log(chalk.gray("• React Native version: 0.73.6"));
  console.log(chalk.gray("• Workflow type: managed"));
  console.log(chalk.gray("• Package manager: npm"));
  console.log();

  // Step 2: Target Selection
  log.section("🎯 Target SDK Selection");
  console.log(chalk.cyan("Selected: SDK 53 (Latest Stable)"));
  console.log(chalk.gray("Strategy: Recommended"));
  console.log();

  // Step 3: Upgrade Path
  log.section("🗺️  Upgrade Path");
  console.log(chalk.yellow("50 → 51 → 52 → 53"));
  console.log();

  // Step 4: Package Changes Preview
  log.section("📦 Package Changes (Preview)");

  const packageTable = new Table({
    head: [
      chalk.cyan("Package"),
      chalk.cyan("Current"),
      chalk.cyan("New"),
      chalk.cyan("Change"),
    ],
    colWidths: [35, 15, 15, 15],
  });

  packageTable.push(
    ["expo", "~49.0.0", "~53.0.0", chalk.green("↑ Major")],
    ["react-native", "0.73.6", "0.76.3", chalk.green("↑ Minor")],
    ["react", "18.2.0", "18.3.1", chalk.green("↑ Patch")],
    ["expo-router", "~3.4.0", "~4.0.0", chalk.green("↑ Major")],
    ["react-native-reanimated", "~3.6.0", "~3.16.3", chalk.green("↑ Minor")],
    ["expo-notifications", "~0.27.0", "~0.28.0", chalk.green("↑ Minor")]
  );

  console.log(packageTable.toString());
  console.log();

  // Step 5: Breaking Changes
  log.section("⚠️  Breaking Changes Detected");
  console.log(chalk.yellow("• Babel Configuration"));
  console.log(chalk.gray("  - Remove deprecated expo-router/babel plugin"));
  console.log(chalk.gray("  - Ensure react-native-reanimated/plugin is last"));
  console.log();

  console.log(chalk.yellow("• Metro Configuration"));
  console.log(chalk.gray("  - Disable unstable_enablePackageExports"));
  console.log(chalk.gray("  - Add source extensions for .cjs and .mjs"));
  console.log();

  console.log(chalk.yellow("• iOS Deployment Target"));
  console.log(chalk.gray("  - Update to iOS 15.1 minimum"));
  console.log();

  // Step 6: Auto-fixes
  log.section("🔧 Automatic Fixes");
  console.log(chalk.green("✓ babel.config.js - Plugin order and deprecations"));
  console.log(chalk.green("✓ metro.config.js - Package exports and resolvers"));
  console.log(chalk.green("✓ app.json - iOS deployment target"));
  console.log(chalk.green("✓ tsconfig.json - Module resolution"));
  console.log();

  // Step 7: Installation Commands
  log.section("📥 Installation Commands");
  console.log(chalk.cyan("expo install --fix"));
  console.log(chalk.gray("This will install all compatible package versions"));
  console.log();

  // Step 8: Manual Steps
  log.section("📝 Manual Steps Required");
  console.log(chalk.yellow("1. Review breaking changes guide"));
  console.log(
    chalk.gray("   Location: .expo-upgrade-wizard/SDK53_MANUAL_FIXES.md")
  );
  console.log();

  console.log(chalk.yellow("2. Clear all caches"));
  console.log(chalk.gray("   rm -rf node_modules .expo"));
  console.log(chalk.gray("   npm cache clean --force"));
  console.log();

  console.log(chalk.yellow("3. Test your application"));
  console.log(chalk.gray("   npx expo start --clear"));
  console.log();

  // Step 9: Estimated Time
  log.section("⏱️  Estimated Time");
  console.log(chalk.cyan("Automated steps: 5-10 minutes"));
  console.log(
    chalk.cyan("Manual fixes: 1-3 hours (depending on breaking changes)")
  );
  console.log();

  // Step 10: Summary
  console.log(
    boxen(
      chalk.bold.white("📋 UPGRADE SUMMARY\n\n") +
        chalk.gray(
          "This dry-run shows a generic example of the upgrade process.\n"
        ) +
        chalk.gray(
          "Actual changes will vary based on your project configuration.\n\n"
        ) +
        chalk.white("What happens during actual upgrade:\n") +
        chalk.green("  ✓ Automatic backup created before changes\n") +
        chalk.green("  ✓ Package versions updated\n") +
        chalk.green("  ✓ Config files fixed automatically\n") +
        chalk.green("  ✓ Breaking changes guide generated\n") +
        chalk.green("  ✓ Dependencies installed\n\n") +
        chalk.cyan("💡 State Rollback Available:\n") +
        chalk.gray("   If anything goes wrong, you can rollback:\n") +
        chalk.white("   npx expo-upgrade-wizard state rollback\n\n") +
        chalk.yellow(
          "⚠️  This is a generic preview. Run without --dry-run to see\n"
        ) +
        chalk.yellow("   actual changes specific to your project."),
      { padding: 1, borderColor: "green", borderStyle: "round" }
    )
  );

  console.log();
  console.log(chalk.bold.cyan("Ready to upgrade for real?"));
  console.log(
    chalk.white("Run: ") + chalk.cyan("npx expo-upgrade-wizard upgrade")
  );
  console.log();
}
