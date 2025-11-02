#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import gradientString from "gradient-string";
import updateNotifier from "update-notifier";
import boxen from "boxen";
import inquirer from "inquirer";
import * as fs from "fs-extra";
import * as path from "path";

import { checkCommand } from "./commands/check";
import { checkEnhancedCommand } from "./commands/check-enhanced";
import { checkImprovedCommand } from "./commands/check-improved";
import { upgradeCompleteCommand } from "./commands/upgrade-complete";
import { fixDeprecatedCommand } from "./commands/fix-deprecated";
import { fixSDK53Command } from "./commands/fix-sdk53";
import { fixHermesErrorsCommand } from "./commands/fix-hermes-errors";
import { checkReact19Command } from "./commands/check-react19";
import { createStateCommand } from "./commands/state";
import { validateReactCommand } from "./commands/validate-react";
import { log as logger } from "./utils/logger";

const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = fs.readJsonSync(packageJsonPath);
// Check for updates
const notifier = updateNotifier({
  pkg: packageJson,
  updateCheckInterval: 1000 * 60 * 60 * 24, // 1 day
});

if (notifier.update) {
  console.log(
    boxen(
      `Update available ${chalk.gray(notifier.update.current)} → ${chalk.green(
        notifier.update.latest
      )}\n` +
        `Run ${chalk.cyan("npm install -g expo-upgrade-wizard")} to update`,
      {
        padding: 1,
        margin: 1,
        borderColor: "yellow",
        borderStyle: "round",
      }
    )
  );
}

// Create CLI program
const program = new Command();

// Display branded header
const displayHeader = () => {
  const header = gradientString.rainbow.multiline(
    [
      "╔══════════════════════════════════════════╗",
      "║   🚀 Expo SDK Upgrade Wizard v" + packageJson.version + "     ║",
      "╚══════════════════════════════════════════╝",
    ].join("\n")
  );

  console.log("\n" + header + "\n");
  console.log(chalk.gray("Automate your Expo SDK upgrades with confidence!\n"));
};

// Main program configuration
program
  .name("expo-upgrade-wizard")
  .description("Professional CLI tool to automate Expo SDK upgrades")
  .version(packageJson.version)
  .option("-v, --verbose", "Enable verbose output")
  .option("--dry-run", "Run without making actual changes")
  .option("--target-sdk <version>", "Target SDK version to upgrade to")
  .option("--skip-backup", "Skip creating a backup")
  .option("--config <path>", "Path to custom configuration file")
  .showHelpAfterError(false)
  .showSuggestionAfterError(false);

// Upgrade command (main command)
program
  .command("upgrade")
  .alias("up")
  .description("Upgrade Expo SDK to a newer version")
  .option(
    "-s, --strategy <type>",
    "Upgrade strategy: conservative, recommended, aggressive",
    "recommended"
  )
  .option("-f, --force", "Force upgrade even with uncommitted changes")
  .option("--skip-install", "Skip npm/yarn install after upgrade")
  .option("--skip-validation", "Skip validation after upgrade")
  .option("--auto-fix", "Automatically fix breaking changes", true)
  .option("--clean-install", "Remove node_modules before installing")
  .option(
    "--package-manager <type>",
    "Package manager to use: npm, yarn, pnpm, bun"
  )
  .option(
    "--no-expo-install",
    "Use manual version management instead of expo install --fix"
  )
  .option(
    "--install-strategy <type>",
    "Installation strategy: expo (default), npm, legacy, force",
    "expo"
  )
  .action(async (options) => {
    try {
      const globalOptions = program.opts();
      await upgradeCompleteCommand({ ...options, ...globalOptions });
    } catch (error) {
      logger.error("Upgrade failed:", error);
      process.exit(1);
    }
  });

// Check command - using improved version with encouraging output
program
  .command("check")
  .description("Check project compatibility with target SDK")
  .option("-t, --target <version>", "Target SDK version to check against")
  .option("--detailed", "Show detailed compatibility report")
  .option("--mvp", "Show minimal output for MVP")
  .option("--legacy", "Use legacy check command")
  .option("--enhanced", "Use enhanced check command")
  .action(async (options) => {
    try {
      // Initialize file logging for check command
      const { initializeFileLogging } = await import('./utils/logger');
      initializeFileLogging();
      
      const globalOptions = program.opts();
      // Use improved check by default
      if (options.legacy) {
        await checkCommand({ ...options, ...globalOptions });
      } else if (options.enhanced) {
        await checkEnhancedCommand({ ...options, ...globalOptions });
      } else {
        await checkImprovedCommand({ ...options, ...globalOptions });
      }
    } catch (error) {
      logger.error("Check failed:", error);
      process.exit(1);
    }
  });

// Rollback command
program
  .command("rollback")
  .description("Rollback to previous SDK version")
  .action(async (options) => {
    try {
      logger.warn("Rollback functionality is coming soon!");
      logger.info("For now, please use git to revert changes.");
    } catch (error) {
      logger.error("Rollback failed:", error);
      process.exit(1);
    }
  });

// Fix deprecated packages command
program
  .command("fix-deprecated")
  .description("Detect and fix deprecated packages for SDK 53")
  .option("--dry-run", "Preview changes without applying")
  .action(async (options) => {
    try {
      await fixDeprecatedCommand(options);
    } catch (error) {
      logger.error("Fix deprecated failed:", error);
      process.exit(1);
    }
  });

// Fix SDK 53 specific issues command
program
  .command("fix-sdk53")
  .description(
    "Detect and fix common SDK 53 issues (Supabase, Firebase, React version, etc.)"
  )
  .option("--dry-run", "Preview changes without applying")
  .action(async (options) => {
    try {
      await fixSDK53Command(options);
    } catch (error) {
      logger.error("Fix SDK 53 issues failed:", error);
      process.exit(1);
    }
  });

// Fix Hermes errors command - comprehensive SDK 53 Hermes error detection and auto-fixing
program
  .command("fix-hermes")
  .description(
    "Detect and auto-fix Hermes-related errors for Expo SDK 53 (styled-components, Firebase, Metro config, etc.)"
  )
  .option("--dry-run", "Preview changes without applying")
  .option("--skip-script", "Skip generating fix script")
  .option("-v, --verbose", "Show detailed output")
  .action(async (options) => {
    try {
      await fixHermesErrorsCommand(options);
    } catch (error) {
      logger.error("Fix Hermes errors failed:", error);
      process.exit(1);
    }
  });

// Check React 19 compatibility command
program
  .command("check-react19")
  .description("Check and fix React 19 compatibility issues based on peer dependencies")
  .option("--fix", "Automatically fix incompatible packages")
  .option("--dry-run", "Preview changes without applying")
  .option("-v, --verbose", "Show detailed peer dependency information")
  .action(async (options) => {
    try {
      await checkReact19Command(options);
    } catch (error) {
      logger.error("Check React 19 failed:", error);
      process.exit(1);
    }
  });

// State management command (rollback)
program.addCommand(createStateCommand());

// Validate React installation command
program
  .command("validate-react")
  .description("Validate React module resolution and fix common issues")
  .option("--fix", "Automatically fix issues with clean reinstall")
  .option("-v, --verbose", "Show detailed output")
  .action(async (options) => {
    try {
      await validateReactCommand(options);
    } catch (error) {
      logger.error("Validate React failed:", error);
      process.exit(1);
    }
  });



// Interactive mode function
async function runInteractiveMode() {
  displayHeader();
  const actions = [
    {
      name: "🚀 Upgrade Expo SDK",
      value: "upgrade",
      action: async () => {
        // File logging will be initialized after git check in upgradeCompleteCommand
        await upgradeCompleteCommand({ ...program.opts() });
      },
    },
    {
      name: "🔍 Check Compatibility",
      value: "check",
      action: async () => {
        // Initialize file logging for check command (no git check needed)
        const { initializeFileLogging } = await import('./utils/logger');
        initializeFileLogging();
        // Use improved check command with encouraging output
        await checkImprovedCommand(program.opts());
      },
    },
    {
      name: "👋 Exit",
      value: "exit",
      action: async () => {
        console.log(chalk.gray("\nGoodbye! 👋\n"));
        process.exit(0);
      },
    },
  ];
  const response = await inquirer.prompt([
    {
      type: "list",
      name: "command",
      message: "What would you like to do?",
      choices: actions,
    },
  ]);
  const { command } = response;
  const action = actions.find((action) => action.value === command);
  if (action) {
    await action.action();
  } else {
    logger.error("Invalid command:", command);
    process.exit(1);
  }
}

// Parse and execute
(async () => {
  const args = process.argv.slice(2);

  // Check if user wants help or version
  if (args.includes("-h") || args.includes("--help")) {
    program.help();
    return;
  }

  if (args.includes("-V") || args.includes("--version")) {
    console.log(packageJson.version);
    return;
  }

  // Check if a command was provided
  const commands = [
    "upgrade",
    "up",
    "check",
    "rollback",
    "state",
    "fix-deprecated",
    "fix-sdk53",
    "fix-hermes",
    "check-react19",
    "validate-react",
    "help",
  ];
  const hasCommand = args.length > 0 && commands.includes(args[0]);

  if (hasCommand) {
    // Parse and execute the command
    try {
      await program.parseAsync(process.argv);
    } catch (error: any) {
      if (
        error.code === "commander.help" ||
        error.code === "commander.version"
      ) {
        process.exit(0);
      }
      logger.error("An unexpected error occurred:", error);
      process.exit(1);
    }
  } else {
    // No command provided - run interactive mode
    await runInteractiveMode();
  }
})();

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});
