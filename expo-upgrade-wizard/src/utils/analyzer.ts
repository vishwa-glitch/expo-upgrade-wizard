import * as fs from "fs-extra";
import * as path from "path";
import semver from "semver";
import { log } from "./logger.js";

export interface ProjectAnalysis {
  currentSdkVersion: string | null;
  reactNativeVersion: string | null;
  expoPackages: Record<string, string>;
  thirdPartyPackages: Record<string, string>;
  workflowType: "managed" | "bare" | "unknown";
  hasCustomNativeCode: boolean;
  configFiles: {
    packageJson: boolean;
    appJson: boolean;
    appConfig: boolean;
    easJson: boolean;
    metroConfig: boolean;
    babelConfig: boolean;
    tsConfig: boolean;
  };
  projectPath: string;
  packageManager: "npm" | "yarn" | "pnpm" | "bun";
  errors: string[];
  warnings: string[];
}

export class ProjectAnalyzer {
  private projectPath: string;
  private analysis: ProjectAnalysis;

  constructor(projectPath?: string) {
    this.projectPath = projectPath || process.cwd();
    this.analysis = this.initializeAnalysis();
  }

  private initializeAnalysis(): ProjectAnalysis {
    return {
      currentSdkVersion: null,
      reactNativeVersion: null,
      expoPackages: {},
      thirdPartyPackages: {},
      workflowType: "unknown",
      hasCustomNativeCode: false,
      configFiles: {
        packageJson: false,
        appJson: false,
        appConfig: false,
        easJson: false,
        metroConfig: false,
        babelConfig: false,
        tsConfig: false,
      },
      projectPath: this.projectPath,
      packageManager: "npm",
      errors: [],
      warnings: [],
    };
  }

  public async analyze(): Promise<ProjectAnalysis> {
    log.debug(`Analyzing project at: ${this.projectPath}`);

    try {
      // Check for essential files
      await this.detectConfigFiles();

      // Analyze package.json
      const packageJson = await this.readPackageJson();
      if (packageJson) {
        await this.analyzePackageJson(packageJson);
      }

      // Analyze app.json/app.config.js
      await this.analyzeExpoConfig();

      // Detect workflow type
      await this.detectWorkflowType();

      // Detect package manager
      await this.detectPackageManager();

      // Check for custom native code
      await this.checkCustomNativeCode();
    } catch (error) {
      log.error("Error during project analysis:", error);
      this.analysis.errors.push(`Analysis failed: ${error}`);
    }

    return this.analysis;
  }

  private async detectConfigFiles(): Promise<void> {
    const files = {
      packageJson: "package.json",
      appJson: "app.json",
      appConfig: "app.config.js",
      easJson: "eas.json",
      metroConfig: "metro.config.js",
      babelConfig: "babel.config.js",
      tsConfig: "tsconfig.json",
    };

    for (const [key, filename] of Object.entries(files)) {
      const filePath = path.join(this.projectPath, filename);
      this.analysis.configFiles[key as keyof typeof this.analysis.configFiles] =
        await fs.pathExists(filePath);
    }
  }

  private async readPackageJson(): Promise<any> {
    const packageJsonPath = path.join(this.projectPath, "package.json");

    if (!(await fs.pathExists(packageJsonPath))) {
      this.analysis.errors.push(
        `No package.json found in current directory: ${this.projectPath}\n` +
          "Please make sure you are running this command from the root directory of your Expo project."
      );
      return null;
    }

    try {
      return await fs.readJson(packageJsonPath);
    } catch (error) {
      this.analysis.errors.push(`Failed to read package.json: ${error}`);
      return null;
    }
  }

  private async analyzePackageJson(packageJson: any): Promise<void> {
    const { dependencies = {}, devDependencies = {} } = packageJson;
    const allDeps = { ...dependencies, ...devDependencies };

    // Extract Expo SDK version
    if (allDeps.expo) {
      const expoVersion = this.cleanVersion(allDeps.expo);
      this.analysis.currentSdkVersion = this.extractSdkVersion(expoVersion);
    } else {
      // Try to detect SDK from other expo packages if main expo package is missing
      for (const [name, version] of Object.entries(allDeps)) {
        if (name.startsWith("expo-") && typeof version === "string") {
          const cleanedVersion = this.cleanVersion(version);
          const possibleSdk = this.extractSdkVersion(cleanedVersion);
          if (possibleSdk) {
            this.analysis.currentSdkVersion = possibleSdk;
            this.analysis.warnings.push(
              "Expo package not found, SDK version detected from other expo packages"
            );
            break;
          }
        }
      }

      // If still no SDK detected, try to infer from React Native version
      if (!this.analysis.currentSdkVersion && allDeps["react-native"]) {
        const rnVersion = this.cleanVersion(allDeps["react-native"]);
        const inferredSdk = this.inferSdkFromReactNative(rnVersion);
        if (inferredSdk) {
          this.analysis.currentSdkVersion = inferredSdk;
          this.analysis.warnings.push(
            `SDK version inferred from React Native ${rnVersion}`
          );
        }
      }
    }

    // Extract React Native version
    if (allDeps["react-native"]) {
      this.analysis.reactNativeVersion = this.cleanVersion(
        allDeps["react-native"]
      );
    }

    // Separate Expo packages from third-party packages
    for (const [name, version] of Object.entries(allDeps)) {
      if (name.startsWith("expo") || name.startsWith("@expo")) {
        this.analysis.expoPackages[name] = version as string;
      } else if (name !== "react" && name !== "react-native") {
        this.analysis.thirdPartyPackages[name] = version as string;
      }
    }
  }

  private async analyzeExpoConfig(): Promise<void> {
    let expoConfig: any = null;

    // Try app.json first
    const appJsonPath = path.join(this.projectPath, "app.json");
    if (await fs.pathExists(appJsonPath)) {
      try {
        const appJson = await fs.readJson(appJsonPath);
        expoConfig = appJson.expo || appJson;
      } catch (error) {
        this.analysis.warnings.push(`Failed to read app.json: ${error}`);
      }
    }

    // Try app.config.js if app.json doesn't exist or doesn't have expo config
    if (!expoConfig) {
      const appConfigPath = path.join(this.projectPath, "app.config.js");
      if (await fs.pathExists(appConfigPath)) {
        try {
          // Note: This is a simplified approach. In production, we'd need to properly evaluate the JS file
          const configContent = await fs.readFile(appConfigPath, "utf-8");
          if (configContent.includes("sdkVersion")) {
            // Extract SDK version using regex (simplified)
            const sdkMatch = configContent.match(
              /sdkVersion['":\s]+(['"])(\d+\.\d+\.\d+)\1/
            );
            if (sdkMatch) {
              const detectedSdk = this.extractSdkVersion(sdkMatch[2]);
              if (!this.analysis.currentSdkVersion && detectedSdk) {
                this.analysis.currentSdkVersion = detectedSdk;
              }
            }
          }
        } catch (error) {
          this.analysis.warnings.push(`Failed to read app.config.js: ${error}`);
        }
      }
    }

    // Extract SDK version from expo config
    if (expoConfig?.sdkVersion) {
      const configSdk = this.extractSdkVersion(expoConfig.sdkVersion);
      if (!this.analysis.currentSdkVersion && configSdk) {
        this.analysis.currentSdkVersion = configSdk;
      } else if (this.analysis.currentSdkVersion !== configSdk) {
        this.analysis.warnings.push(
          `SDK version mismatch: package.json has ${this.analysis.currentSdkVersion}, ` +
            `app config has ${configSdk}`
        );
      }
    }
  }

  private async detectWorkflowType(): Promise<void> {
    const hasIosFolder = await fs.pathExists(
      path.join(this.projectPath, "ios")
    );
    const hasAndroidFolder = await fs.pathExists(
      path.join(this.projectPath, "android")
    );

    if (hasIosFolder || hasAndroidFolder) {
      this.analysis.workflowType = "bare";
    } else if (this.analysis.currentSdkVersion) {
      this.analysis.workflowType = "managed";
    }
  }

  private async detectPackageManager(): Promise<void> {
    // First, detect based on lock files
    let detectedPM: "npm" | "yarn" | "pnpm" | "bun" = "npm";

    if (await fs.pathExists(path.join(this.projectPath, "yarn.lock"))) {
      detectedPM = "yarn";
    } else if (
      await fs.pathExists(path.join(this.projectPath, "pnpm-lock.yaml"))
    ) {
      detectedPM = "pnpm";
    } else if (await fs.pathExists(path.join(this.projectPath, "bun.lockb"))) {
      detectedPM = "bun";
    }

    // Verify the detected package manager is actually available
    if (detectedPM !== "npm") {
      try {
        const { execa } = await import("execa");
        await execa(detectedPM, ["--version"], { timeout: 5000 });
        this.analysis.packageManager = detectedPM;
      } catch (error) {
        // Package manager not available, fall back to npm
        this.analysis.warnings.push(
          `${detectedPM} lock file found but ${detectedPM} is not installed. Falling back to npm.`
        );
        this.analysis.packageManager = "npm";
      }
    } else {
      this.analysis.packageManager = "npm";
    }
  }

  private async checkCustomNativeCode(): Promise<void> {
    if (this.analysis.workflowType !== "bare") {
      return;
    }

    // Check for custom native modules (simplified check)
    const nativeExtensions = [".m", ".mm", ".swift", ".java", ".kt", ".cpp"];
    const nativeDirs = ["ios", "android"];

    for (const dir of nativeDirs) {
      const dirPath = path.join(this.projectPath, dir);
      if (await fs.pathExists(dirPath)) {
        // This is a simplified check - in production, we'd do a more thorough scan
        this.analysis.hasCustomNativeCode = true;
        break;
      }
    }
    
    // Check for deprecated bundleCommand in build.gradle
    await this.checkBuildGradleIssues();
  }
  
  private async checkBuildGradleIssues(): Promise<void> {
    const buildGradlePath = path.join(this.projectPath, 'android', 'app', 'build.gradle');
    
    if (!await fs.pathExists(buildGradlePath)) {
      return;
    }
    
    try {
      const content = await fs.readFile(buildGradlePath, 'utf-8');
      
      // Check for deprecated bundleCommand or cliFile
      const hasBundleCommand = /bundleCommand\s*=\s*["']export:embed["']/.test(content);
      const hasCliFile = /cliFile\s*=\s*new File\(\["node",\s*"--print",\s*"require\.resolve\('@expo\/cli'\)"\]/.test(content);
      
      if (hasBundleCommand || hasCliFile) {
        this.analysis.errors.push(
          'CRITICAL: Deprecated bundleCommand found in android/app/build.gradle. ' +
          'This will cause Metro bundler to fail. Run "npx expo-upgrade-wizard fix-deprecated" to fix.'
        );
      }
    } catch (error) {
      // Silently ignore read errors
    }
  }

  private cleanVersion(version: string): string {
    // Remove version prefixes like ^, ~, >=, etc.
    return version.replace(/^[\^~>=<\s]+/, "");
  }

  private extractSdkVersion(version: string): string | null {
    // Extract SDK version from expo package version
    // Expo SDK versions typically match the major version of the expo package
    const cleaned = this.cleanVersion(version);
    const parsed = semver.parse(cleaned);

    if (parsed) {
      return `${parsed.major}`;
    }

    // Try to extract from string like "49.0.0"
    const match = cleaned.match(/^(\d+)\./);
    return match ? match[1] : null;
  }

  private inferSdkFromReactNative(rnVersion: string): string | null {
    // Map React Native versions to likely Expo SDK versions
    const rnToSdkMap: Record<string, string> = {
      "0.76.3": "53",
      "0.76.0": "52",
      "0.74.5": "51",
      "0.73.6": "50",
      "0.72.10": "49",
      "0.71.14": "48",
      "0.70.8": "47",
    };

    // Try exact match first
    if (rnToSdkMap[rnVersion]) {
      return rnToSdkMap[rnVersion];
    }

    // Try to match by major.minor
    const parsed = semver.parse(rnVersion);
    if (parsed) {
      const majorMinor = `${parsed.major}.${parsed.minor}`;

      // Map major.minor versions
      const majorMinorMap: Record<string, string> = {
        "0.76": "52", // Default to SDK 52 for RN 0.76.x
        "0.74": "51",
        "0.73": "50",
        "0.72": "49",
        "0.71": "48",
        "0.70": "47",
      };

      return majorMinorMap[majorMinor] || null;
    }

    return null;
  }

  public static async validateProject(projectPath?: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const analyzer = new ProjectAnalyzer(projectPath);
    const analysis = await analyzer.analyze();

    const result = {
      isValid: true,
      errors: [...analysis.errors],
      warnings: [...analysis.warnings],
    };

    // Check for required files
    if (!analysis.configFiles.packageJson) {
      result.errors.push("No package.json found");
      result.isValid = false;
    }

    if (!analysis.currentSdkVersion) {
      result.errors.push("Could not detect Expo SDK version");
      result.isValid = false;
    }

    if (!analysis.configFiles.appJson && !analysis.configFiles.appConfig) {
      result.warnings.push("No app.json or app.config.js found");
    }

    return result;
  }
}
