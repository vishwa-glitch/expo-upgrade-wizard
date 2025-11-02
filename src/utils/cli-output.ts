import chalk from "chalk";
import Table from "cli-table3";
import boxen from "boxen";
import gradientString from "gradient-string";

/**
 * Clean CLI output formatter for marketing/demo purposes
 * Produces polished, screenshot-ready output with vibrant colors
 */
export class CLIOutputFormatter {
  /**
   * Display a visual separator
   */
  static displaySeparator(): void {
    console.log(chalk.gray("─".repeat(60)) + "\n");
  }
  /**
   * Display clean header with gradient colors
   */
  static displayHeader(version: string): void {
    const header = gradientString.pastel.multiline([
      "╔══════════════════════════════════════════╗",
      `║   🚀 Expo SDK Upgrade Wizard v${version.padEnd(7)}    ║`,
      "╚══════════════════════════════════════════╝",
    ].join("\n"));

    console.log("\n" + header + "\n");
    console.log(chalk.cyan.bold("Automate your Expo SDK upgrades with confidence!") + "\n");
  }

  /**
   * Display clean action prompt with colors
   */
  static displayAction(action: string): void {
    console.log(chalk.magenta("?") + chalk.bold(" What would you like to do? ") + chalk.cyan(action));
  }

  /**
   * Display expo install notice with color
   */
  static displayExpoInstallNotice(): void {
    console.log(
      chalk.blue("ℹ") + " Using " + chalk.cyan.bold("expo install --fix") + 
      " for reliable package version management\n"
    );
  }

  /**
   * Display project analysis with colors
   */
  static displayProjectAnalysis(analysis: {
    reactNativeVersion: string;
    workflowType: string;
    packageManager: string;
  }): void {
    console.log(chalk.blue.bold("📦 Analyzing your project..."));
    console.log(chalk.gray("•") + " React Native version: " + chalk.yellow(analysis.reactNativeVersion));
    console.log(chalk.gray("•") + " Workflow type: " + chalk.green(analysis.workflowType));
    console.log(chalk.gray("•") + " Package manager: " + chalk.cyan(analysis.packageManager) + "\n");
  }

  /**
   * Display target SDK selection with colors
   */
  static displayTargetSDK(targetSdk: string): void {
    console.log(
      chalk.magenta("?") + chalk.bold(" Select target SDK version: ") + 
      chalk.green.bold(`SDK ${targetSdk}`) + chalk.gray(" (Latest Stable)") + "\n"
    );
  }

  /**
   * Display upgrade path with gradient colors
   */
  static displayUpgradePath(path: string[]): void {
    console.log(chalk.yellow.bold("🗺️  Upgrade Path"));
    
    // Create a colorful gradient path
    const colors = [chalk.blue, chalk.cyan, chalk.green, chalk.yellow];
    const coloredPath = path.map((version, index) => {
      const colorFn = colors[index % colors.length];
      return colorFn.bold(version);
    });
    
    console.log(coloredPath.join(chalk.gray(" → ")) + "\n");
  }

  /**
   * Display breaking changes table with colors
   */
  static displayBreakingChanges(
    breakingChanges: any[],
    autoFixable: any[],
    manualChanges: any[]
  ): void {
    console.log(chalk.yellow.bold("⚠️  Breaking Changes Detected"));

    const table = new Table({
      head: [
        chalk.cyan.bold("Package"),
        chalk.cyan.bold("Changes"),
        chalk.cyan.bold("Auto-fixable"),
      ],
      chars: {
        top: "─",
        "top-mid": "┬",
        "top-left": "┌",
        "top-right": "┐",
        bottom: "─",
        "bottom-mid": "┴",
        "bottom-left": "└",
        "bottom-right": "┘",
        left: "│",
        "left-mid": "├",
        mid: "─",
        "mid-mid": "┼",
        right: "│",
        "right-mid": "┤",
        middle: "│",
      },
      style: {
        head: [],
        border: ["gray"],
      },
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
          ? chalk.green(`✓ ${typedStats.autoFixable}/${typedStats.total}`)
          : chalk.red("✗");

      table.push([
        chalk.white(pkg),
        chalk.yellow(`${typedStats.total} change(s)`),
        autoFixText,
      ]);
    });

    console.log(table.toString());
    console.log();

    if (autoFixable.length > 0) {
      console.log(chalk.green("•") + ` ${chalk.green.bold(autoFixable.length)} changes can be fixed automatically`);
    }
    if (manualChanges.length > 0) {
      console.log(chalk.yellow("•") + ` ${chalk.yellow.bold(manualChanges.length)} changes require manual intervention\n`);
    }
  }

  /**
   * Display strategy selection with colors
   */
  static displayStrategy(strategy: string): void {
    const strategyText =
      strategy === "recommended"
        ? chalk.green("Recommended") + chalk.gray(" - Update core packages to compatible versions")
        : strategy === "conservative"
        ? chalk.blue("Conservative") + chalk.gray(" - Minimal changes, keep existing versions where possible")
        : chalk.red("Aggressive") + chalk.gray(" - Update to latest compatible versions");

    console.log(chalk.magenta("?") + chalk.bold(" Select upgrade strategy: ") + strategyText + "\n");
  }

  /**
   * Display state capture with colors
   */
  static displayStateCapture(timestamp: string): void {
    console.log(chalk.gray("Project state captured: ") + chalk.cyan(timestamp) + "\n");
  }

  /**
   * Display uncommitted changes warning with colors
   */
  static displayUncommittedWarning(): void {
    const warning = boxen(
      chalk.yellow.bold("⚠️  Uncommitted changes detected!\n\n") +
        chalk.white("Please commit or stash your changes before upgrading.\n") +
        chalk.gray("Use --force to upgrade anyway (not recommended)."),
      {
        padding: 1,
        borderColor: "yellow",
        borderStyle: "round",
        margin: { top: 0, bottom: 1, left: 0, right: 0 },
      }
    );

    console.log(warning);
  }

  /**
   * Display confirmation prompt with colors
   */
  static displayConfirmation(
    question: string,
    answer: "Yes" | "No" = "Yes"
  ): void {
    const answerColor = answer === "Yes" ? chalk.green.bold(answer) : chalk.red.bold(answer);
    console.log(chalk.magenta("?") + " " + chalk.bold(question) + " " + answerColor + "\n");
  }

  /**
   * Display backup creation with colors
   */
  static displayBackup(timestamp: string): void {
    console.log(chalk.blue.bold("💾 Creating backup..."));
    console.log(chalk.gray("Project state captured: ") + chalk.cyan(timestamp) + "\n");
  }

  /**
   * Display upgrade progress with colors and status indicators
   */
  static displayUpgradeProgress(): void {
    console.log(chalk.green.bold("🚀 Starting Upgrade Process\n"));
    console.log(chalk.green("✓") + " " + chalk.white("Cleaning node_modules") + chalk.gray(" (clean install mode)"));
    console.log(chalk.green("✓") + " " + chalk.white("Creating git backup"));
    console.log(chalk.blue("↓") + " " + chalk.white("Creating zip backup"));
    console.log(chalk.green("✓") + " " + chalk.white("Auto-fixing app.json configuration"));
    console.log(chalk.yellow("⟳") + " " + chalk.white("Updating package.json and installing"));
    console.log(chalk.cyan("▸") + " " + chalk.gray("Updating Expo configuration"));
    console.log(chalk.cyan("▸") + " " + chalk.gray("Applying automatic fixes"));
    console.log(chalk.cyan("▸") + " " + chalk.gray("Fixing metro.config.js import path"));
    console.log(chalk.cyan("▸") + " " + chalk.gray("Fixing babel.config.js (Reanimated plugin position)"));
    console.log(chalk.cyan("▸") + " " + chalk.gray("Verifying installation"));
    console.log(chalk.cyan("▸") + " " + chalk.gray("Running expo-doctor validation\n"));
  }

  /**
   * Display upgrade report with colors
   */
  static displayUpgradeReport(report: {
    duration: number;
    packagesUpdated: number;
    packagesRemoved: number;
    filesModified: number;
    autoFixes: number;
    manualFixes: number;
  }): void {
    console.log(chalk.blue.bold("📋 Upgrade Report"));

    const table = new Table({
      chars: {
        top: "─",
        "top-mid": "┬",
        "top-left": "┌",
        "top-right": "┐",
        bottom: "─",
        "bottom-mid": "┴",
        "bottom-left": "└",
        "bottom-right": "┘",
        left: "│",
        "left-mid": "├",
        mid: "─",
        "mid-mid": "┼",
        right: "│",
        "right-mid": "┤",
        middle: "│",
      },
      style: {
        head: [],
        border: ["gray"],
      },
    });

    table.push(
      [chalk.gray("Duration"), chalk.cyan(`${report.duration} seconds`)],
      [chalk.gray("Packages Updated"), chalk.green.bold(report.packagesUpdated.toString())],
      [chalk.gray("Packages Removed"), chalk.yellow(report.packagesRemoved.toString())],
      [chalk.gray("Files Modified"), chalk.blue(report.filesModified.toString())],
      [chalk.gray("Code Auto-fixes Applied"), chalk.green(report.autoFixes.toString())],
      [chalk.gray("Manual Fixes Required"), chalk.yellow.bold(report.manualFixes.toString())]
    );

    console.log(table.toString());
    console.log();
  }

  /**
   * Display manual steps with colors and better formatting
   */
  static displayManualSteps(manualChanges: any[]): void {
    console.log(chalk.magenta.bold("📝 Manual Steps Required\n"));

    // Group by severity
    const critical = manualChanges.filter((c) => c.severity === "critical");
    const warnings = manualChanges.filter((c) => c.severity === "warning");

    if (critical.length > 0) {
      console.log(chalk.red.bold("❌ CRITICAL") + chalk.red(" (App won't build without this):") + "\n");
      critical.forEach((change) => {
        console.log(chalk.red.bold(change.package) + chalk.white(":") + chalk.yellow(change.title));
        if (change.description) {
          const lines = change.description.split("\n");
          lines.forEach((line: string) => {
            if (line.trim()) {
              console.log(chalk.gray("•") + " " + chalk.white(line.trim()));
            }
          });
        }
        console.log();
      });
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow.bold("⚠️  WARNING") + chalk.yellow(" (Recommended but not blocking):") + "\n");
      warnings.forEach((change) => {
        console.log(chalk.yellow.bold(change.package) + chalk.white(":") + chalk.cyan(change.title));
        if (change.description) {
          const lines = change.description.split("\n");
          lines.forEach((line: string) => {
            if (line.trim()) {
              console.log(chalk.gray("•") + " " + chalk.white(line.trim()));
            }
          });
        }
        console.log();
      });
    }
  }

  /**
   * Display success banner
   */
  static displaySuccessBanner(): void {
    const banner = boxen(
      chalk.green.bold("✨ Upgrade Complete! ✨\n\n") +
        chalk.white("Your project has been upgraded successfully.\n") +
        chalk.gray("Review the manual steps above and test your app."),
      {
        padding: 1,
        borderColor: "green",
        borderStyle: "round",
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
      }
    );
    console.log(banner);
  }

  /**
   * Display next steps
   */
  static displayNextSteps(): void {
    console.log(chalk.cyan.bold("🚀 Next Steps:\n"));
    console.log(chalk.gray("1.") + " " + chalk.white("Review the manual changes above"));
    console.log(chalk.gray("2.") + " " + chalk.white("Run ") + chalk.cyan("npx expo start") + chalk.white(" to test your app"));
    console.log(chalk.gray("3.") + " " + chalk.white("Check for any runtime errors"));
    console.log(chalk.gray("4.") + " " + chalk.white("Update your documentation\n"));
  }
}
