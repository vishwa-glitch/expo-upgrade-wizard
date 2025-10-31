/**
 * Show SDK 50 Post-Upgrade Guide Command
 * Displays the comprehensive SDK 50 breaking changes guide
 */

import chalk from "chalk";
import boxen from "boxen";
import { log } from "../utils/logger";

export async function showSdk50GuideCommand(): Promise<void> {
  log.info("SDK 50 Breaking Changes Guide\n");
  
  console.log(
    boxen(
      chalk.cyan.bold("🚀 Expo SDK 50 Breaking Changes\n\n") +
        chalk.white("Critical Changes:\n") +
        chalk.yellow("• expo-router: Babel plugin required\n") +
        chalk.yellow("• Ionicons: Renamed icons\n") +
        chalk.yellow("• Android: targetSdkVersion 34 required\n\n") +
        chalk.white("Recommended Actions:\n") +
        chalk.gray("1. Update babel.config.js\n") +
        chalk.gray("2. Check Ionicons usage\n") +
        chalk.gray("3. Update Android config\n\n") +
        chalk.cyan("Full guide: https://expo.dev/changelog/2024/05-07-sdk-50"),
      { padding: 1, borderColor: "cyan", borderStyle: "round" }
    )
  );
  
  log.success("\n✅ Guide displayed!");
  log.info("💡 For detailed migration steps, visit:");
  log.info("   https://expo.dev/changelog/2024/05-07-sdk-50");
}
