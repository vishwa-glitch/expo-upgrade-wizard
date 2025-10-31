/**
 * Comprehensive app.json auto-fix module
 * Detects and fixes deprecated fields, adds required fields, and validates configuration
 */

import { log } from "./logger";

// TypeScript interfaces
export interface AppJson {
  expo: ExpoConfig;
}

export interface ExpoConfig {
  name: string;
  slug: string;
  version: string;
  sdkVersion?: string; // deprecated SDK 46+
  runtimeVersion?: { policy: string } | string;
  splash?: string | SplashConfig;
  androidStatusBar?: any; // deprecated, use statusBar
  statusBar?: StatusBarConfig;
  facebookScheme?: string; // deprecated, moved to plugin config
  plugins?: (string | [string, any])[];
  extra?: {
    eas?: {
      projectId?: string;
    };
    [key: string]: any;
  };
  ios?: {
    bundleIdentifier?: string;
    infoPlist?: Record<string, any>;
    supportsTablet?: boolean;
  };
  android?: {
    package?: string;
    permissions?: string[];
    adaptiveIcon?: {
      foregroundImage?: string;
      backgroundColor?: string;
    };
  };
  orientation?: string;
  icon?: string;
  userInterfaceStyle?: string;
  [key: string]: any;
}

export interface SplashConfig {
  image: string;
  resizeMode: "contain" | "cover";
  backgroundColor: string;
}

export interface StatusBarConfig {
  style?: "auto" | "inverted" | "light" | "dark";
  backgroundColor?: string;
  translucent?: boolean;
  hidden?: boolean;
}

export interface FixResult {
  fixed: AppJson;
  changes: Change[];
}

export interface Change {
  type: "fixed" | "added" | "warning" | "removed";
  category: string;
  message: string;
  field?: string;
}

/**
 * Main function to auto-fix app.json
 * @param appJson - The app.json object to fix
 * @param targetSdk - Target SDK version (e.g., 53)
 * @returns Fixed app.json and list of changes
 */
export function autoFixAppJson(appJson: AppJson, targetSdk: number): FixResult {
  const changes: Change[] = [];

  // Deep clone to avoid mutating original
  const fixed = JSON.parse(JSON.stringify(appJson)) as AppJson;

  // Apply all fixes in order
  removeSdkVersion(fixed, changes);
  addRuntimeVersion(fixed, targetSdk, changes);
  fixSplashScreen(fixed, changes);
  migrateStatusBar(fixed, changes);
  removeFacebookScheme(fixed, changes);
  configurePlugins(fixed, changes);
  fixIosDeploymentTarget(fixed, targetSdk, changes);
  addDefaultPermissionMessages(fixed, changes);
  validatePlatformConfigs(fixed, changes);
  validateEASConfig(fixed, changes);

  return { fixed, changes };
}

/**
 * Remove deprecated sdkVersion field (deprecated SDK 46+)
 */
function removeSdkVersion(appJson: AppJson, changes: Change[]): void {
  if (appJson.expo.sdkVersion) {
    const oldVersion = appJson.expo.sdkVersion;
    delete appJson.expo.sdkVersion;
    changes.push({
      type: "removed",
      category: "Deprecated Fields",
      message: `Removed deprecated "sdkVersion: ${oldVersion}" - SDK version is now determined by expo package`,
      field: "expo.sdkVersion",
    });
  }
}

/**
 * Add runtimeVersion for SDK 50+ (required for OTA updates)
 */
function addRuntimeVersion(
  appJson: AppJson,
  targetSdk: number,
  changes: Change[]
): void {
  if (targetSdk >= 50 && !appJson.expo.runtimeVersion) {
    appJson.expo.runtimeVersion = { policy: "appVersion" };
    changes.push({
      type: "added",
      category: "Required Fields",
      message:
        "Added \"runtimeVersion: { policy: 'appVersion' }\" for OTA updates (SDK 50+)",
      field: "expo.runtimeVersion",
    });
  }
}

/**
 * Fix splash screen format (string → object)
 */
function fixSplashScreen(appJson: AppJson, changes: Change[]): void {
  if (typeof appJson.expo.splash === "string") {
    const oldPath = appJson.expo.splash;
    appJson.expo.splash = {
      image: oldPath,
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    };
    changes.push({
      type: "fixed",
      category: "Configuration Format",
      message: `Updated splash screen from string to object format (image: "${oldPath}")`,
      field: "expo.splash",
    });
  }
}

/**
 * Migrate androidStatusBar to statusBar (deprecated SDK 47+)
 */
function migrateStatusBar(appJson: AppJson, changes: Change[]): void {
  if (appJson.expo.androidStatusBar) {
    if (!appJson.expo.statusBar) {
      appJson.expo.statusBar = appJson.expo.androidStatusBar;
      changes.push({
        type: "fixed",
        category: "Deprecated Fields",
        message: 'Migrated "androidStatusBar" to "statusBar" (cross-platform)',
        field: "expo.statusBar",
      });
    }
    delete appJson.expo.androidStatusBar;
    changes.push({
      type: "removed",
      category: "Deprecated Fields",
      message: 'Removed deprecated "androidStatusBar" field',
      field: "expo.androidStatusBar",
    });
  }
}

/**
 * Remove deprecated facebookScheme (moved to plugin config)
 */
function removeFacebookScheme(appJson: AppJson, changes: Change[]): void {
  if (appJson.expo.facebookScheme) {
    const scheme = appJson.expo.facebookScheme;
    delete appJson.expo.facebookScheme;
    changes.push({
      type: "removed",
      category: "Deprecated Fields",
      message: `Removed deprecated "facebookScheme: ${scheme}" - configure via expo-facebook plugin instead`,
      field: "expo.facebookScheme",
    });
    changes.push({
      type: "warning",
      category: "Manual Action Required",
      message: `Add Facebook configuration to expo-facebook plugin: ["expo-facebook", { "scheme": "${scheme}" }]`,
    });
  }
}

/**
 * Fix iOS deployment target for SDK 53+
 * SDK 53 requires iOS 15.1 minimum
 */
function fixIosDeploymentTarget(
  appJson: AppJson,
  targetSdk: number,
  changes: Change[]
): void {
  // Only apply for SDK 53+
  if (targetSdk < 53) {
    return;
  }

  // Ensure plugins array exists
  if (!appJson.expo.plugins) {
    appJson.expo.plugins = [];
  }

  // Find expo-build-properties plugin
  let buildPropertiesIndex = -1;
  let buildPropertiesConfig: any = null;

  for (let i = 0; i < appJson.expo.plugins.length; i++) {
    const plugin = appJson.expo.plugins[i];
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;

    if (pluginName === "expo-build-properties") {
      buildPropertiesIndex = i;
      buildPropertiesConfig = Array.isArray(plugin) ? plugin[1] : {};
      break;
    }
  }

  // Check if iOS deployment target needs to be updated
  const currentTarget = buildPropertiesConfig?.ios?.deploymentTarget;
  const minRequired = "15.1";

  if (!currentTarget || parseFloat(currentTarget) < parseFloat(minRequired)) {
    // Create or update the build properties config
    if (!buildPropertiesConfig) {
      buildPropertiesConfig = {};
    }
    if (!buildPropertiesConfig.ios) {
      buildPropertiesConfig.ios = {};
    }

    buildPropertiesConfig.ios.deploymentTarget = minRequired;

    // Update or add the plugin
    if (buildPropertiesIndex >= 0) {
      appJson.expo.plugins[buildPropertiesIndex] = [
        "expo-build-properties",
        buildPropertiesConfig,
      ];
      changes.push({
        type: "fixed",
        category: "iOS Configuration",
        message: `Updated ios.deploymentTarget to ${minRequired} (required for SDK 53)`,
        field: "expo.plugins.expo-build-properties.ios.deploymentTarget",
      });
    } else {
      appJson.expo.plugins.push([
        "expo-build-properties",
        buildPropertiesConfig,
      ]);
      changes.push({
        type: "added",
        category: "iOS Configuration",
        message: `Added expo-build-properties plugin with ios.deploymentTarget: ${minRequired} (required for SDK 53)`,
        field: "expo.plugins.expo-build-properties",
      });
    }
  }
}

/**
 * Configure plugins with default settings
 */
function configurePlugins(appJson: AppJson, changes: Change[]): void {
  if (!appJson.expo.plugins) {
    return;
  }

  const pluginConfigs: Record<string, any> = {
    "expo-location": {
      locationAlwaysAndWhenInUsePermission:
        "Allow $(PRODUCT_NAME) to use your location.",
    },
    "expo-camera": {
      cameraPermission: "Allow $(PRODUCT_NAME) to access your camera.",
      microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
    },
    "expo-media-library": {
      photosPermission: "Allow $(PRODUCT_NAME) to access your photos.",
      savePhotosPermission: "Allow $(PRODUCT_NAME) to save photos.",
    },
    "expo-notifications": {
      icon: "./assets/notification-icon.png",
      color: "#ffffff",
    },
    "expo-contacts": {
      contactsPermission: "Allow $(PRODUCT_NAME) to access your contacts.",
    },
    "expo-calendar": {
      calendarPermission: "Allow $(PRODUCT_NAME) to access your calendar.",
    },
  };

  appJson.expo.plugins = appJson.expo.plugins.map((plugin) => {
    if (typeof plugin === "string" && pluginConfigs[plugin]) {
      changes.push({
        type: "added",
        category: "Plugin Configuration",
        message: `Added default configuration for ${plugin}`,
        field: `expo.plugins.${plugin}`,
      });
      return [plugin, pluginConfigs[plugin]];
    }
    return plugin;
  });
}

/**
 * Add default permission messages for iOS
 */
function addDefaultPermissionMessages(
  appJson: AppJson,
  changes: Change[]
): void {
  if (!appJson.expo.ios) {
    return;
  }

  if (!appJson.expo.ios.infoPlist) {
    appJson.expo.ios.infoPlist = {};
  }

  const defaultMessages: Record<string, string> = {
    NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access your camera",
    NSMicrophoneUsageDescription:
      "Allow $(PRODUCT_NAME) to access your microphone",
    NSPhotoLibraryUsageDescription:
      "Allow $(PRODUCT_NAME) to access your photos",
    NSLocationWhenInUseUsageDescription:
      "Allow $(PRODUCT_NAME) to use your location",
    NSLocationAlwaysAndWhenInUseUsageDescription:
      "Allow $(PRODUCT_NAME) to use your location",
    NSCalendarsUsageDescription:
      "Allow $(PRODUCT_NAME) to access your calendar",
    NSContactsUsageDescription: "Allow $(PRODUCT_NAME) to access your contacts",
  };

  // Only add if plugins are present that need these permissions
  const plugins = appJson.expo.plugins || [];
  const pluginNames = plugins.map((p) => (typeof p === "string" ? p : p[0]));

  const permissionMap: Record<string, string[]> = {
    "expo-camera": ["NSCameraUsageDescription", "NSMicrophoneUsageDescription"],
    "expo-media-library": ["NSPhotoLibraryUsageDescription"],
    "expo-location": [
      "NSLocationWhenInUseUsageDescription",
      "NSLocationAlwaysAndWhenInUseUsageDescription",
    ],
    "expo-calendar": ["NSCalendarsUsageDescription"],
    "expo-contacts": ["NSContactsUsageDescription"],
  };

  for (const pluginName of pluginNames) {
    const requiredPermissions = permissionMap[pluginName];
    if (requiredPermissions) {
      for (const permission of requiredPermissions) {
        if (!appJson.expo.ios.infoPlist[permission]) {
          appJson.expo.ios.infoPlist[permission] = defaultMessages[permission];
          changes.push({
            type: "added",
            category: "iOS Permissions",
            message: `Added ${permission} for ${pluginName}`,
            field: `expo.ios.infoPlist.${permission}`,
          });
        }
      }
    }
  }
}

/**
 * Validate platform configurations
 */
function validatePlatformConfigs(appJson: AppJson, changes: Change[]): void {
  // Check iOS bundleIdentifier
  if (!appJson.expo.ios?.bundleIdentifier) {
    changes.push({
      type: "warning",
      category: "Platform Configuration",
      message: "Missing iOS bundleIdentifier - required for iOS builds",
      field: "expo.ios.bundleIdentifier",
    });
  }

  // Check Android package
  if (!appJson.expo.android?.package) {
    changes.push({
      type: "warning",
      category: "Platform Configuration",
      message: "Missing Android package name - required for Android builds",
      field: "expo.android.package",
    });
  }

  // Validate bundleIdentifier format
  if (appJson.expo.ios?.bundleIdentifier) {
    const bundleId = appJson.expo.ios.bundleIdentifier;
    if (!/^[a-zA-Z0-9.-]+$/.test(bundleId) || !bundleId.includes(".")) {
      changes.push({
        type: "warning",
        category: "Platform Configuration",
        message: `iOS bundleIdentifier "${bundleId}" may be invalid - should be reverse domain notation (e.g., com.company.app)`,
        field: "expo.ios.bundleIdentifier",
      });
    }
  }

  // Validate Android package format
  if (appJson.expo.android?.package) {
    const packageName = appJson.expo.android.package;
    if (
      !/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName)
    ) {
      changes.push({
        type: "warning",
        category: "Platform Configuration",
        message: `Android package "${packageName}" may be invalid - should be reverse domain notation (e.g., com.company.app)`,
        field: "expo.android.package",
      });
    }
  }
}

/**
 * Validate EAS configuration
 */
function validateEASConfig(appJson: AppJson, changes: Change[]): void {
  if (!appJson.expo.extra?.eas?.projectId) {
    changes.push({
      type: "warning",
      category: "EAS Configuration",
      message:
        'Missing EAS projectId - run "eas init" after upgrade to set up EAS',
      field: "expo.extra.eas.projectId",
    });
  }
}

/**
 * Generate a summary report of changes
 */
export function generateChangeReport(changes: Change[]): string {
  if (changes.length === 0) {
    return "✅ No changes needed - app.json is up to date!";
  }

  const report: string[] = [];
  report.push(
    `\n📋 app.json Auto-Fix Report (${changes.length} change${
      changes.length > 1 ? "s" : ""
    })\n`
  );

  // Group by category
  const byCategory: Record<string, Change[]> = {};
  for (const change of changes) {
    if (!byCategory[change.category]) {
      byCategory[change.category] = [];
    }
    byCategory[change.category].push(change);
  }

  // Display by category
  for (const [category, categoryChanges] of Object.entries(byCategory)) {
    report.push(`\n${getCategoryIcon(category)} ${category}:`);
    for (const change of categoryChanges) {
      const icon = getChangeIcon(change.type);
      report.push(`  ${icon} ${change.message}`);
    }
  }

  return report.join("\n");
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    "Deprecated Fields": "🗑️",
    "Required Fields": "✨",
    "Configuration Format": "🔧",
    "Plugin Configuration": "🔌",
    "iOS Permissions": "🍎",
    "Platform Configuration": "📱",
    "EAS Configuration": "☁️",
    "Manual Action Required": "⚠️",
  };
  return icons[category] || "📝";
}

function getChangeIcon(type: string): string {
  const icons: Record<string, string> = {
    fixed: "✅",
    added: "➕",
    removed: "➖",
    warning: "⚠️",
  };
  return icons[type] || "•";
}

/**
 * Validate app.json structure
 */
export function validateAppJsonStructure(appJson: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!appJson.expo) {
    errors.push('Missing "expo" field in app.json');
    return { valid: false, errors };
  }

  if (!appJson.expo.name) {
    errors.push("Missing required field: expo.name");
  }

  if (!appJson.expo.slug) {
    errors.push("Missing required field: expo.slug");
  }

  if (!appJson.expo.version) {
    errors.push("Missing required field: expo.version");
  }

  return { valid: errors.length === 0, errors };
}
