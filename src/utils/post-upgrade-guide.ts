/**
 * Post-Upgrade Guide Generator (Rule-Based, No AI)
 * 
 * WHY: Generates comprehensive post-upgrade instructions based on detected project configuration.
 * This is a deterministic, rule-based system that analyzes your project files and provides
 * relevant manual fixes without requiring AI services.
 * 
 * USE CASE: After running the upgrade wizard, users need clear, actionable steps to complete
 * their upgrade manually. This guide is customized to their specific project setup.
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { logger } from "./logger";

export interface PostUpgradeSection {
  title: string;
  priority: "critical" | "recommended" | "optional";
  why: string;
  when: string;
  checkCommand?: string;
  steps: string[];
  verifyCommand?: string;
  warning?: string;
  codeExample?: {
    language: string;
    before?: string;
    after?: string;
  };
}

export class PostUpgradeGuideGenerator {
  private projectPath: string;
  private packageJson: any;
  private hasAndroid: boolean;
  private hasIos: boolean;
  private hasTypeScript: boolean;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.packageJson = this.loadPackageJson();
    this.hasAndroid = fs.existsSync(path.join(projectPath, "android"));
    this.hasIos = fs.existsSync(path.join(projectPath, "ios"));
    this.hasTypeScript = fs.existsSync(path.join(projectPath, "tsconfig.json"));
  }

  /**
   * Generate complete post-upgrade guide
   */
  generate(): string {
    const sections = this.buildSections();
    const markdown = this.formatAsMarkdown(sections);
    this.saveToFile(markdown);
    return this.formatForTerminal(sections);
  }

  /**
   * Build all relevant sections based on project analysis
   */
  private buildSections(): PostUpgradeSection[] {
    const sections: PostUpgradeSection[] = [];

    // Always include these critical sections
    sections.push(this.getMetroConfigSection());
    sections.push(this.getCacheClearSection());
    sections.push(this.getVerificationSection());

    // Conditional sections based on project setup
    if (this.needsBabelFix()) {
      sections.push(this.getBabelConfigSection());
    }

    if (this.hasAndroid) {
      sections.push(this.getAndroidKotlinSection());
      sections.push(this.getAndroidBundleCompressionSection());
    }

    if (this.needsIosDeploymentTarget()) {
      sections.push(this.getIosDeploymentTargetSection());
    }

    if (this.hasDevClient()) {
      sections.push(this.getDevClientRemovalSection());
    }

    if (this.needsFirebaseMigration()) {
      sections.push(this.getFirebaseMigrationSection());
    }

    if (this.hasTypeScript) {
      sections.push(this.getTypeScriptConfigSection());
    }

    sections.push(this.getNewArchitectureSection());
    sections.push(this.getNpmrcSection());
    sections.push(this.getPrebuildSection());
    sections.push(this.getReactVersionSection());

    // Sort by priority
    return sections.sort((a, b) => {
      const priority = { critical: 0, recommended: 1, optional: 2 };
      return priority[a.priority] - priority[b.priority];
    });
  }

  /**
   * Metro Configuration Section
   */
  private getMetroConfigSection(): PostUpgradeSection {
    return {
      title: "Metro Configuration",
      priority: "critical",
      why: "SDK 53 enables package.json exports by default, causing 'Cannot find module' errors with packages like Axios, Supabase, Firebase, and Socket.io",
      when: "Required for all projects using third-party packages with Node.js modules",
      checkCommand: "cat metro.config.js",
      steps: [
        "Create or update metro.config.js in your project root",
        "Add the configuration shown below",
        "This disables package exports to prevent module resolution errors",
      ],
      codeExample: {
        language: "javascript",
        after: `const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// CRITICAL: Disable package exports to prevent Node.js module errors
config.resolver.unstable_enablePackageExports = false;

// Additional recommended settings
config.resolver.unstable_enableSymlinks = false;
config.resolver.sourceExts = [...config.resolver.sourceExts, "cjs", "mjs"];
config.resolver.resolverMainFields = ["react-native", "browser", "main"];
config.resetCache = true;

module.exports = config;`,
      },
      verifyCommand: "npx expo start --clear",
      warning:
        "Without this fix, you'll see 'Cannot find module' errors for many popular packages",
    };
  }

  /**
   * Babel Configuration Section
   */
  private getBabelConfigSection(): PostUpgradeSection {
    return {
      title: "Babel Configuration",
      priority: "critical",
      why: "Incorrect plugin order causes 'Cannot read property S of undefined' errors, and deprecated plugins cause warnings",
      when: "Required if using react-native-reanimated or expo-router",
      checkCommand: "cat babel.config.js",
      steps: [
        "Open babel.config.js",
        "Remove 'expo-router/babel' if present (now included in babel-preset-expo)",
        "Ensure 'react-native-reanimated/plugin' is the LAST plugin in the array",
        "The order matters - Reanimated must transform code after all other plugins",
      ],
      codeExample: {
        language: "javascript",
        before: `// ❌ WRONG
plugins: [
  'expo-router/babel',  // Deprecated!
  'react-native-reanimated/plugin',  // Not last!
  ['module-resolver', { ... }]
]`,
        after: `// ✅ CORRECT
plugins: [
  // expo-router/babel removed (now in babel-preset-expo)
  ['module-resolver', { ... }],
  'react-native-reanimated/plugin'  // Must be last!
]`,
      },
      verifyCommand: "npx expo start",
      warning:
        "Wrong plugin order breaks animations and causes cryptic runtime errors",
    };
  }

  /**
   * Android Kotlin Version Section
   */
  private getAndroidKotlinSection(): PostUpgradeSection {
    return {
      title: "Android Kotlin Version",
      priority: "critical",
      why: "SDK 53 requires Kotlin 2.0.21. Without it, builds fail with 'Key 1.9.24 is missing in the map'",
      when: "Required for all Android builds",
      checkCommand: "grep kotlinVersion android/build.gradle",
      steps: [
        "Open android/build.gradle",
        "Find the ext block inside buildscript",
        'Add: kotlinVersion = "2.0.21"',
      ],
      codeExample: {
        language: "gradle",
        after: `buildscript {
    ext {
        buildToolsVersion = "35.0.0"
        minSdkVersion = 23
        compileSdkVersion = 35
        targetSdkVersion = 35
        kotlinVersion = "2.0.21"  // ← Add this line
        ndkVersion = "27.0.12077973"
    }
}`,
      },
      verifyCommand: "grep kotlinVersion android/build.gradle",
      warning:
        "⚠️ This fix is LOST every time you run 'expo prebuild --clean'! You must reapply it.",
    };
  }

  /**
   * Android Bundle Compression Section
   */
  private getAndroidBundleCompressionSection(): PostUpgradeSection {
    return {
      title: "Remove enableBundleCompression",
      priority: "critical",
      why: "This property was removed in React Native 0.76.x and causes build failures",
      when: "Required for all Android builds",
      checkCommand: "grep enableBundleCompression android/app/build.gradle",
      steps: [
        "Open android/app/build.gradle",
        "Search for 'enableBundleCompression'",
        "Delete the entire line containing it",
      ],
      codeExample: {
        language: "gradle",
        before: `// ❌ Remove this line:
enableBundleCompression = (findProperty('android.enableBundleCompression') ?: false).toBoolean()`,
      },
      verifyCommand:
        "grep enableBundleCompression android/app/build.gradle (should return nothing)",
      warning: "⚠️ Also lost on 'expo prebuild --clean' - must remove again",
    };
  }

  /**
   * iOS Deployment Target Section
   */
  private getIosDeploymentTargetSection(): PostUpgradeSection {
    return {
      title: "iOS Deployment Target",
      priority: "critical",
      why: "SDK 53 requires iOS 15.1 minimum. EAS builds fail without this setting",
      when: "Required for all iOS builds",
      checkCommand: "grep -A 5 expo-build-properties app.json",
      steps: [
        "Open app.json",
        "Find or add 'expo-build-properties' plugin",
        'Set ios.deploymentTarget to "15.1"',
        "Install the package: npm install expo-build-properties --legacy-peer-deps",
      ],
      codeExample: {
        language: "json",
        after: `"plugins": [
  ["expo-build-properties", {
    "ios": {
      "deploymentTarget": "15.1"
    }
  }]
]`,
      },
      verifyCommand: 'grep deploymentTarget app.json (should show "15.1")',
      warning:
        "Without this, EAS builds fail with: ios.deploymentTarget needs to be at least version 15.1",
    };
  }

  /**
   * Cache Clear Section
   */
  private getCacheClearSection(): PostUpgradeSection {
    return {
      title: "Clear All Caches",
      priority: "critical",
      why: "Old cache from previous SDK versions causes mysterious bundling and build errors",
      when: "Required after every SDK upgrade",
      steps: [
        "Remove node_modules and lock files",
        "Clear Expo and Metro caches",
        "Clear npm cache",
        "Reinstall all dependencies",
        "Start with clean cache",
      ],
      codeExample: {
        language: "bash",
        after: `# Remove node_modules and lock files
rm -rf node_modules package-lock.json yarn.lock pnpm-lock.yaml

# Clear Expo cache
rm -rf .expo

# Clear Metro cache (Windows)
del /s /q "%TEMP%\\metro-*" "%TEMP%\\haste-*" "%TEMP%\\react-*"

# Clear Metro cache (Mac/Linux)
rm -rf /tmp/metro-* /tmp/haste-* /tmp/react-*

# Clear watchman (if installed)
watchman watch-del-all

# Clear npm cache
npm cache clean --force

# Reinstall everything
npm install

# Start with clean cache
npx expo start --clear`,
      },
    };
  }

  /**
   * Verification Section
   */
  private getVerificationSection(): PostUpgradeSection {
    return {
      title: "Verify Installation",
      priority: "critical",
      why: "Ensures all packages are correctly installed and compatible with SDK 53",
      when: "Run after completing all fixes",
      steps: [
        "Check installed package versions",
        "Run Expo doctor to detect issues",
        "Test Metro bundler",
        "Test builds on both platforms",
      ],
      codeExample: {
        language: "bash",
        after: `# Check versions
npm list react react-native expo

# Run Expo doctor
npx expo-doctor@latest

# Test Metro bundler
npx expo start --clear

# Test builds
eas build --profile preview --platform android
eas build --profile preview --platform ios`,
      },
    };
  }

  /**
   * Dev Client Removal Section
   */
  private getDevClientRemovalSection(): PostUpgradeSection {
    return {
      title: "Remove expo-dev-client",
      priority: "critical",
      why: "expo-dev-client is incompatible with React Native 0.76.x used in SDK 53",
      when: "Required if expo-dev-client is in your dependencies",
      checkCommand: "grep expo-dev-client package.json",
      steps: [
        "Remove expo-dev-client from package.json",
        "Run: npm uninstall expo-dev-client",
        "Use preview or production builds instead",
        "Development builds will not work until Expo releases a compatible version",
      ],
      codeExample: {
        language: "bash",
        after: `# Remove expo-dev-client
npm uninstall expo-dev-client

# Use these build profiles instead:
eas build --profile preview --platform android
eas build --profile production --platform android

# DO NOT use:
# eas build --profile development  (will fail)`,
      },
      warning: "Development builds are not supported in SDK 53 with RN 0.76.x",
    };
  }

  /**
   * Firebase Migration Section
   */
  private getFirebaseMigrationSection(): PostUpgradeSection {
    return {
      title: "Migrate to React Native Firebase",
      priority: "recommended",
      why: "Firebase JS SDK is incompatible with Metro's package.json exports in SDK 53",
      when: "Required if using Firebase JS SDK (firebase package)",
      checkCommand: "grep -E 'firebase|@firebase' package.json",
      steps: [
        "Uninstall Firebase JS SDK packages",
        "Install React Native Firebase packages",
        "Update all Firebase imports in your code",
        "Update Firebase initialization",
        "Test all Firebase functionality",
      ],
      codeExample: {
        language: "javascript",
        before: `// ❌ OLD (Firebase JS SDK)
import { signInWithEmailAndPassword } from "firebase/auth";
await signInWithEmailAndPassword(auth, email, password);`,
        after: `// ✅ NEW (React Native Firebase)
import auth from "@react-native-firebase/auth";
await auth().signInWithEmailAndPassword(email, password);`,
      },
    };
  }

  /**
   * TypeScript Config Section
   */
  private getTypeScriptConfigSection(): PostUpgradeSection {
    return {
      title: "Update TypeScript Configuration",
      priority: "recommended",
      why: "Required for Metro bundler compatibility with SDK 53",
      when: "Required if using TypeScript",
      steps: [
        "Open tsconfig.json",
        "Update compilerOptions as shown",
        "Verify TypeScript compiles without errors",
      ],
      codeExample: {
        language: "json",
        after: `{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "lib": ["ESNext", "DOM"],
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}`,
      },
      verifyCommand: "npx tsc --noEmit",
    };
  }

  /**
   * New Architecture Section
   */
  private getNewArchitectureSection(): PostUpgradeSection {
    return {
      title: "Disable New Architecture",
      priority: "recommended",
      why: "Many packages are still incompatible with New Architecture in SDK 53",
      when: "Recommended unless all your packages support New Architecture",
      checkCommand: "grep newArchEnabled app.json",
      steps: [
        "Open app.json",
        "Add newArchEnabled: false to expo config",
        "Add platform-specific settings for iOS and Android",
      ],
      codeExample: {
        language: "json",
        after: `{
  "expo": {
    "newArchEnabled": false,
    "ios": {
      "jsEngine": "hermes",
      "newArchEnabled": false
    },
    "android": {
      "jsEngine": "hermes",
      "newArchEnabled": false
    }
  }
}`,
      },
      warning: "Expo Go does NOT support New Architecture",
    };
  }

  /**
   * .npmrc Section
   */
  private getNpmrcSection(): PostUpgradeSection {
    return {
      title: "Configure .npmrc",
      priority: "recommended",
      why: "Prevents peer dependency conflicts and simplifies package installations for your team",
      when: "Recommended for all projects",
      steps: [
        "Create .npmrc in your project root",
        "Add legacy-peer-deps=true",
        "Commit to repository for team consistency",
      ],
      codeExample: {
        language: "bash",
        after: `# Create .npmrc
echo "legacy-peer-deps=true" > .npmrc

# Commit to repository
git add .npmrc
git commit -m "Add .npmrc for legacy peer deps"`,
      },
      verifyCommand: "cat .npmrc",
    };
  }

  /**
   * Prebuild Section
   */
  private getPrebuildSection(): PostUpgradeSection {
    return {
      title: "Generate Native Folders",
      priority: "critical",
      why: "SDK 53 requires native android/ and ios/ folders for EAS builds. Without this, builds will fail",
      when: "Required before running EAS builds",
      steps: [
        "Apply ALL fixes above first (especially Android fixes)",
        "Run: npx expo prebuild --clean",
        "Reapply Android fixes (Kotlin version and enableBundleCompression)",
        "Commit android/ and ios/ folders to git",
      ],
      codeExample: {
        language: "bash",
        after: `# Generate native folders
npx expo prebuild --clean

# Reapply Android fixes:
# 1. Set kotlinVersion = "2.0.21" in android/build.gradle
# 2. Remove enableBundleCompression from android/app/build.gradle

# Commit to git
git add android ios
git commit -m "Generate native folders for SDK 53"`,
      },
      warning:
        "⚠️ expo prebuild --clean regenerates files and loses manual Android fixes!",
      verifyCommand: "ls -la (should see android/ and ios/ folders)",
    };
  }

  /**
   * React Version Section
   */
  private getReactVersionSection(): PostUpgradeSection {
    return {
      title: "React Version (Fallback)",
      priority: "optional",
      why: "Only needed if you encounter bundling errors with the React version from expo install --fix",
      when: "Use only if you have specific errors with React 19",
      checkCommand: "npm list react",
      steps: [
        "expo install --fix automatically selects compatible React versions",
        "Most projects work fine with the selected version",
        "Only use React 18.3.1 fallback if you encounter bundling errors",
      ],
      codeExample: {
        language: "bash",
        after: `# Only if you have issues with React 19:
npm install react@18.3.1 react-dom@18.3.1 --legacy-peer-deps
npx expo start --clear`,
      },
      verifyCommand: "npm list react",
    };
  }

  /**
   * Format sections as markdown
   */
  private formatAsMarkdown(sections: PostUpgradeSection[]): string {
    let md = "# Expo SDK 53 Post-Upgrade Guide\n\n";
    md +=
      "> **Complete manual fixes and verification steps after upgrading to SDK 53**\n\n";
    md +=
      "This guide is automatically generated based on your project configuration.\n\n";

    md += "## Overview\n\n";
    md +=
      "After running the upgrade wizard, you need to complete these manual steps to ensure your project works correctly with SDK 53. ";
    md +=
      "Each section explains WHY the fix is needed and WHEN to apply it.\n\n";

    md += "## Quick Checklist\n\n";
    sections
      .filter((s) => s.priority === "critical")
      .forEach((s) => {
        md += `- [ ] ${s.title}\n`;
      });
    md += "\n---\n\n";

    sections.forEach((section, index) => {
      const priorityEmoji = {
        critical: "🔴",
        recommended: "🟡",
        optional: "🟢",
      };

      md += `## ${index + 1}. ${priorityEmoji[section.priority]} ${section.title}\n\n`;
      md += `**Priority:** ${section.priority.toUpperCase()}\n\n`;
      md += `**Why:** ${section.why}\n\n`;
      md += `**When:** ${section.when}\n\n`;

      if (section.warning) {
        md += `> ⚠️ **WARNING:** ${section.warning}\n\n`;
      }

      if (section.checkCommand) {
        md += `**Check current state:**\n\`\`\`bash\n${section.checkCommand}\n\`\`\`\n\n`;
      }

      md += `**Steps:**\n\n`;
      section.steps.forEach((step, i) => {
        md += `${i + 1}. ${step}\n`;
      });
      md += "\n";

      if (section.codeExample) {
        if (section.codeExample.before) {
          md += `**Before (WRONG):**\n\`\`\`${section.codeExample.language}\n${section.codeExample.before}\n\`\`\`\n\n`;
        }
        if (section.codeExample.after) {
          const label = section.codeExample.before ? "After (CORRECT)" : "Code";
          md += `**${label}:**\n\`\`\`${section.codeExample.language}\n${section.codeExample.after}\n\`\`\`\n\n`;
        }
      }

      if (section.verifyCommand) {
        md += `**Verify:**\n\`\`\`bash\n${section.verifyCommand}\n\`\`\`\n\n`;
      }

      md += "---\n\n";
    });

    md += "## Build Commands\n\n";
    md += "### ✅ Recommended:\n\n";
    md += "```bash\n";
    md += "# Testing\n";
    md += "eas build --profile preview --platform android\n";
    md += "eas build --profile preview --platform ios\n\n";
    md += "# Production\n";
    md += "eas build --profile production --platform android\n";
    md += "eas build --profile production --platform ios\n\n";
    md += "# Development\n";
    md += "eas build --profile development --platform android\n";
    md += "eas build --profile development --platform ios\n";
    md += "```\n\n";

    md += "## Additional Resources\n\n";
    md +=
      "- [Expo SDK 53 Changelog](https://expo.dev/changelog/2025/01-14-sdk-53)\n";
    md +=
      "- [React Native 0.76 Upgrade Guide](https://reactnative.dev/docs/upgrading)\n";
    md +=
      "- [New Architecture Documentation](https://reactnative.dev/docs/the-new-architecture/landing-page)\n\n";

    md += "---\n\n";
    md += "_Generated by Expo Upgrade Wizard_\n";

    return md;
  }

  /**
   * Format sections for terminal display
   */
  private formatForTerminal(sections: PostUpgradeSection[]): string {
    let output = "\n" + chalk.bold.cyan("📋 POST-UPGRADE GUIDE\n\n");

    const critical = sections.filter((s) => s.priority === "critical");
    const recommended = sections.filter((s) => s.priority === "recommended");
    const optional = sections.filter((s) => s.priority === "optional");

    output += chalk.white("A comprehensive post-upgrade guide has been generated with:\n\n");
    
    if (critical.length > 0) {
      output += chalk.red(`  🔴 ${critical.length} Critical Fix${critical.length > 1 ? 'es' : ''} (Required)\n`);
    }
    
    if (recommended.length > 0) {
      output += chalk.yellow(`  🟡 ${recommended.length} Recommended Fix${recommended.length > 1 ? 'es' : ''}\n`);
    }
    
    if (optional.length > 0) {
      output += chalk.green(`  🟢 ${optional.length} Optional Fix${optional.length > 1 ? 'es' : ''}\n`);
    }

    output += chalk.bold.cyan("\n📝 Full guide saved to:\n");
    output += chalk.gray(
      "   .expo-upgrade-wizard/POST_UPGRADE_GUIDE.md\n\n"
    );

    return output;
  }



  /**
   * Save guide to file
   */
  private saveToFile(content: string): void {
    const dir = path.join(this.projectPath, ".expo-upgrade-wizard");
    const filePath = path.join(dir, "POST_UPGRADE_GUIDE.md");

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content);
      logger.debug(`Post-upgrade guide saved to ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save post-upgrade guide: ${error}`);
    }
  }

  /**
   * Load package.json
   */
  private loadPackageJson(): any {
    try {
      const pkgPath = path.join(this.projectPath, "package.json");
      return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } catch {
      return { dependencies: {}, devDependencies: {} };
    }
  }

  /**
   * Check if project needs Babel fix
   */
  private needsBabelFix(): boolean {
    return !!(
      this.packageJson.dependencies?.["react-native-reanimated"] ||
      this.packageJson.dependencies?.["expo-router"]
    );
  }

  /**
   * Check if project needs iOS deployment target fix
   */
  private needsIosDeploymentTarget(): boolean {
    return this.hasIos || !this.hasAndroid; // If iOS exists or no native folders yet
  }

  /**
   * Check if project has expo-dev-client
   */
  private hasDevClient(): boolean {
    return !!(
      this.packageJson.dependencies?.["expo-dev-client"] ||
      this.packageJson.devDependencies?.["expo-dev-client"]
    );
  }

  /**
   * Check if project needs Firebase migration
   */
  private needsFirebaseMigration(): boolean {
    const deps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };
    return !!(
      deps["firebase"] ||
      deps["@firebase/auth"] ||
      deps["@firebase/firestore"]
    );
  }
}
