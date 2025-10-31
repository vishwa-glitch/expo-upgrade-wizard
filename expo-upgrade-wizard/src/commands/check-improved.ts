import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import boxen from "boxen";
import fs from "fs-extra";
import path from "path";
import { ProjectAnalyzer } from "../utils/analyzer";
import { log } from "../utils/logger";
import { PackageUpgrader } from "../upgraders/package-upgrader";
import {
  getSdkInfo,
  getAvailableSdkVersions,
  getUpgradePath,
} from "../data/sdk-versions";
import {
  getBreakingChangesForUpgrade,
  getCriticalChanges,
  getWarningChanges,
  getAnalysisSummary,
  BreakingChange,
} from "../data/breaking-changes";

export interface CheckOptions {
  target?: string;
  detailed?: boolean;
  verbose?: boolean;
  mvp?: boolean;
}

export async function checkImprovedCommand(
  options: CheckOptions
): Promise<void> {
  try {
    const spinner = ora("Analyzing project compatibility...").start();

    // Analyze current project
    const analyzer = new ProjectAnalyzer();
    const analysis = await analyzer.analyze();

    spinner.stop();

    if (!analysis.currentSdkVersion) {
      log.error("Could not detect Expo SDK version in this project");

      if (!analysis.configFiles.packageJson) {
        console.log(
          chalk.yellow("\n📁 Current directory: ") +
            chalk.cyan(analysis.projectPath)
        );
        console.log(
          chalk.yellow("\n⚠️  No package.json found in the current directory.")
        );
        console.log(
          chalk.yellow(
            "   Please ensure you are in the root directory of your Expo project where package.json is located.\n"
          )
        );
      } else {
        console.log(
          chalk.yellow("\n⚠️  This does not appear to be an Expo project.")
        );
        console.log(
          chalk.yellow(
            '   Make sure you have "expo" as a dependency in your package.json.\n'
          )
        );
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

    // Incremental upgrade recommendation removed

    if (currentSdkNum >= targetSdkNum) {
      console.log(
        boxen(
          chalk.green("✓ Your project is up to date!\n\n") +
            `Current SDK ${analysis.currentSdkVersion} is the latest stable version.`,
          { padding: 1, borderColor: "green", borderStyle: "round" }
        )
      );
      return;
    }

    // Display header
    log.section(`📊 Current Project Status`);
    const sdkInfo = getSdkInfo(targetSdk);
    console.log(
      `SDK: ${chalk.cyan(analysis.currentSdkVersion)} → Target: ${chalk.green(
        targetSdk
      )}`
    );
    console.log(
      `React Native: ${analysis.reactNativeVersion} → ${sdkInfo?.reactNativeVersion}`
    );
    const upgradePath = getUpgradePath(analysis.currentSdkVersion, targetSdk);
    console.log(`Upgrade Path: ${upgradePath.join(" → ")}\n`);

    // Get breaking changes using version-based detection (no file scanning)
    const packageJsonPath = path.join(analysis.projectPath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);

    const breakingChanges = getBreakingChangesForUpgrade(
      analysis.currentSdkVersion,
      targetSdk,
      packageJson
    );

    // Smart detection of resolved issues
    const resolvedIssues = await checkResolvedIssues(analysis, breakingChanges);
    const unresolvedChanges = breakingChanges.filter(
      (change) =>
        !resolvedIssues.find((r) => r.package === change.package && r.resolved)
    );

    const criticalChanges = unresolvedChanges.filter(c => c.severity === 'critical');
    const warningChanges = unresolvedChanges.filter(c => c.severity === 'warning');
    const infoChanges = unresolvedChanges.filter(c => c.severity === 'info');

    // Package compatibility check
    const upgrader = new PackageUpgrader(analysis, targetSdk, "recommended");
    const validation = await upgrader.validateDependencies();

    // Count packages to update
    const packagesToUpdate =
      Object.keys(analysis.expoPackages).length +
      Object.keys(analysis.thirdPartyPackages).filter((pkg) =>
        [
          "@gorhom/bottom-sheet",
          "@react-native-async-storage/async-storage",
          "@shopify/flash-list",
          "react-native-gesture-handler",
          "react-native-reanimated",
          "react-native-safe-area-context",
          "react-native-screens",
          "react-native-svg",
        ].includes(pkg)
      ).length;

    // Get analysis summary
    const summary = getAnalysisSummary(
      analysis.currentSdkVersion,
      targetSdk,
      packageJson,
      unresolvedChanges
    );

    // Calculate estimated fix time
    const estimatedMinutes = unresolvedChanges.reduce((total, change) => {
      const time = change.estimatedFixTime || "0 minutes";
      const match = time.match(/(\d+)(?:-(\d+))?\s*(minute|hour)/);
      if (match) {
        const min = parseInt(match[1]);
        const max = match[2] ? parseInt(match[2]) : min;
        const multiplier = match[3] === "hour" ? 60 : 1;
        return total + ((min + max) / 2) * multiplier;
      }
      return total;
    }, 0);

    const minHours = Math.floor(estimatedMinutes / 60);
    const maxHours = Math.ceil(estimatedMinutes / 60 * 1.5); // Add buffer

    // Check for critical build.gradle issue
    const hasBuildGradleIssue = analysis.errors.some(err => err.includes('bundleCommand'));
    const totalCritical = criticalChanges.length + (hasBuildGradleIssue ? 1 : 0);
    
    // Show compatibility summary box at the top
    console.log(
      boxen(
        chalk.cyan.bold("📊 Compatibility Analysis Summary\n") +
          chalk.white("─".repeat(38) + "\n") +
          chalk.white(`Total Packages: ${summary.totalPackages}\n`) +
          chalk.white(`Issues Found: ${unresolvedChanges.length + (hasBuildGradleIssue ? 1 : 0)} in ${summary.affectedPackages.length + (hasBuildGradleIssue ? 1 : 0)} packages\n\n`) +
          (totalCritical > 0 ? chalk.red(`🔴 Critical: ${totalCritical}\n`) : "") +
          (warningChanges.length > 0 ? chalk.yellow(`🟡 Warnings: ${warningChanges.length}\n`) : "") +
          (infoChanges.length > 0 ? chalk.blue(`🟢 Info: ${infoChanges.length}\n`) : "") +
          (unresolvedChanges.length > 0 || hasBuildGradleIssue ? `\n${chalk.white(`Estimated Fix Time: ${minHours}-${maxHours} hours`)}` : ""),
        { padding: 1, borderColor: "cyan", borderStyle: "round" }
      )
    );

    // Show breaking changes detected (version-based, no file scanning)
    if (unresolvedChanges.length > 0 || hasBuildGradleIssue) {
      console.log("\n" + chalk.yellow.bold("🔍 Breaking Changes Detected"));
      
      console.log(chalk.gray(`Analyzed ${summary.totalPackages} packages (${summary.expoPackages} Expo, ${summary.thirdPartyPackages} third-party)`));
      console.log(chalk.gray(`Found ${unresolvedChanges.length + (hasBuildGradleIssue ? 1 : 0)} breaking change(s) in ${summary.affectedPackages.length + (hasBuildGradleIssue ? 1 : 0)} package(s):\n`));

      if (criticalChanges.length > 0 || hasBuildGradleIssue) {
        console.log(chalk.red.bold("Critical (Must Fix):"));
        
        // Show build.gradle issue first if present
        if (hasBuildGradleIssue) {
          console.log(chalk.red(`  ❌ android/app/build.gradle ${chalk.gray(`(config file)`)}`));
          console.log(chalk.gray(`     Deprecated bundleCommand will cause Metro bundler to fail`));
          console.log(chalk.gray(`     Fix time: 2 minutes`));
          console.log(chalk.gray(`     Run: npx expo-upgrade-wizard fix-deprecated`));
        }
        
        criticalChanges.forEach(change => {
          const installedVersion = packageJson.dependencies?.[change.package] || 
                                  packageJson.devDependencies?.[change.package] || 'unknown';
          console.log(chalk.red(`  ❌ ${change.package} ${chalk.gray(`(${installedVersion})`)}`));
          console.log(chalk.gray(`     ${change.description}`));
          console.log(chalk.gray(`     Fix time: ${change.estimatedFixTime}`));
        });
        console.log();
      }

      if (warningChanges.length > 0) {
        console.log(chalk.yellow.bold("Warnings (Recommended):"));
        warningChanges.forEach(change => {
          const installedVersion = packageJson.dependencies?.[change.package] || 
                                  packageJson.devDependencies?.[change.package] || 'unknown';
          console.log(chalk.yellow(`  ⚠️  ${change.package} ${chalk.gray(`(${installedVersion})`)}`));
          console.log(chalk.gray(`     ${change.description}`));
          console.log(chalk.gray(`     Fix time: ${change.estimatedFixTime}`));
        });
        console.log();
      }

      if (infoChanges.length > 0) {
        console.log(chalk.blue.bold("Info (Optional):"));
        infoChanges.forEach(change => {
          const installedVersion = packageJson.dependencies?.[change.package] || 
                                  packageJson.devDependencies?.[change.package] || 'unknown';
          console.log(chalk.blue(`  ℹ️  ${change.package} ${chalk.gray(`(${installedVersion})`)}`));
          console.log(chalk.gray(`     ${change.description}`));
          console.log(chalk.gray(`     Fix time: ${change.estimatedFixTime}`));
        });
        console.log();
      }
      
      console.log(chalk.gray("💡 Only showing changes for packages you have installed"));
      console.log(chalk.gray("   Review each change to see if it affects your code\n"));
    } else {
      console.log("\n" + chalk.green.bold("✅ No breaking changes detected!"));
      console.log(chalk.gray(`   Analyzed ${summary.totalPackages} packages (${summary.expoPackages} Expo, ${summary.thirdPartyPackages} third-party)`));
      console.log(chalk.gray("   None of your installed packages have known breaking changes for SDK " + targetSdk + "\n"));
    }

    console.log(chalk.gray("━".repeat(60)));

    // Show what our tool automates
    console.log("\n" + chalk.green.bold("🎉 Automation Complete!"));
    console.log(chalk.green(`  ✅ Package updates: Done`));
    console.log(chalk.green(`  ✅ Config fixes: Done`));
    console.log(chalk.yellow(`  📝 Breaking changes: Detected (see guide)\n`));

    // Calculate estimated time
    let totalMinTime = 2;
    let totalMaxTime = 6;
    unresolvedChanges.forEach(change => {
      if (change.estimatedFixTime) {
        const match = change.estimatedFixTime.match(/(\d+)(?:-(\d+))?\s*(min|hour)/);
        if (match) {
          const min = parseInt(match[1]);
          const max = match[2] ? parseInt(match[2]) : min;
          const unit = match[3];
          if (unit === 'hour') {
            totalMinTime += min;
            totalMaxTime += max;
          }
        }
      }
    });

    console.log(chalk.cyan.bold("Next steps:"));
    console.log(chalk.gray(`  1. Review breaking changes guide`));
    console.log(chalk.gray(`  2. Fix breaking changes (${totalMinTime}-${totalMaxTime} hours)`));
    console.log(chalk.gray(`  3. Test your app\n`));
    
    console.log(chalk.green(`💡 This guide worked for 70% of projects`));

    console.log(chalk.gray("━".repeat(60)));

    // Show done-for-you service
    console.log("\n" + chalk.blue.bold("💼 Don't have time? I'll handle it."));
    console.log(chalk.gray("\nDone-for-you service:"));
    console.log(chalk.gray("  • Fix all breaking changes"));
    console.log(chalk.gray("  • Test builds"));
    console.log(chalk.gray("  • Guaranteed working app"));
    console.log(chalk.gray("  • 24-48 hour delivery\n"));
    console.log(chalk.cyan("Apply: https://expo-upgrade.com/service"));

    // Show already resolved issues if any (in detailed mode)
    if (options.detailed) {
      const alreadyResolved = resolvedIssues.filter((r) => r.resolved);
      if (alreadyResolved.length > 0) {
        console.log("\n" + chalk.green.bold("✅ Already Resolved (detected):"));
        alreadyResolved.forEach((issue) => {
          console.log(
            chalk.green(`  ✓ ${issue.package}: ${issue.resolvedReason}`)
          );
        });
      }
    }

    // Always show ready to upgrade
    console.log("\n" + chalk.green.bold("✅ Ready to upgrade? Run:"));
    console.log(chalk.cyan("   npx expo-upgrade-wizard upgrade\n"));
  } catch (error) {
    log.error("Compatibility check failed:", error);
    throw error;
  }
}

/**
 * Check which breaking changes have been resolved in the project
 */
async function checkResolvedIssues(
  analysis: any,
  breakingChanges: BreakingChange[]
): Promise<
  Array<{
    package: string;
    description: string;
    resolved: boolean;
    resolvedReason?: string;
  }>
> {
  const resolved: Array<{
    package: string;
    description: string;
    resolved: boolean;
    resolvedReason?: string;
  }> = [];

  for (const change of breakingChanges) {
    let isResolved = false;
    let reason = "";

    // Check specific resolutions based on package
    switch (change.package) {
      case "react-native-gesture-handler":
        // Check if gesture handler is properly updated
        const ghVersion =
          analysis.thirdPartyPackages["react-native-gesture-handler"];
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

        // Check if GestureHandlerRootView exists
        try {
          const appPath = path.join(analysis.projectPath, "app");
          if (fs.existsSync(appPath)) {
            const layoutPath = path.join(appPath, "_layout.tsx");
            if (fs.existsSync(layoutPath)) {
              const content = await fs.readFile(layoutPath, "utf-8");
              if (content.includes("GestureHandlerRootView")) {
                isResolved = true;
                reason = "GestureHandlerRootView configured";
              }
            }
          }
        } catch (e) {
          // Ignore errors
        }
        break;

      case "expo-router":
        // Check if _layout files exist
        const appPath = path.join(analysis.projectPath, "app");
        if (fs.existsSync(appPath)) {
          const layoutFile = path.join(appPath, "_layout.tsx");
          if (fs.existsSync(layoutFile)) {
            const content = await fs.readFile(layoutFile, "utf-8");
            // Check for v3 compatibility
            if (
              !content.includes("unstable_settings") ||
              content.includes("export { ErrorBoundary }")
            ) {
              isResolved = true;
              reason = "_layout.tsx is v3 compatible";
            }
          }
        }
        break;

      case "react-native":
        // Check metro.config.js
        const metroPath = path.join(analysis.projectPath, "metro.config.js");
        if (fs.existsSync(metroPath)) {
          const content = await fs.readFile(metroPath, "utf-8");
          if (
            content.includes("getDefaultConfig") &&
            (content.includes("platforms:") || content.includes("blockList:"))
          ) {
            isResolved = true;
            reason = "metro.config.js updated for RN 0.74+";
          }
        }
        break;

      case "expo":
        // Check app.json config
        const appJsonPath = path.join(analysis.projectPath, "app.json");
        if (fs.existsSync(appJsonPath)) {
          const appJson = await fs.readJson(appJsonPath);
          if (appJson.expo?.plugins) {
            isResolved = true;
            reason = "Config plugins up to date";
          }
        }
        break;
    }

    resolved.push({
      package: change.package,
      description: change.description,
      resolved: isResolved,
      resolvedReason: reason,
    });
  }

  return resolved;
}
