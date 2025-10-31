export interface SdkVersionInfo {
  version: string;
  reactNativeVersion: string;
  releaseDate: string;
  deprecated?: boolean;
  breaking?: boolean;
  minNodeVersion?: string;
  expoPackageVersion: string;
}

// SDK Version compatibility matrix
export const SDK_VERSIONS: Record<string, SdkVersionInfo> = {
  "53": {
    version: "53",
    reactNativeVersion: "0.76.3", // CRITICAL: Use 0.76.3, NOT 0.76.1, 0.76.5, or 0.76.6
    releaseDate: "2024-11-12",
    minNodeVersion: "18.18.0",
    expoPackageVersion: "~53.0.0",
    breaking: true, // Major breaking changes
  },
  "52": {
    version: "52",
    reactNativeVersion: "0.76.0",
    releaseDate: "2024-10-30",
    minNodeVersion: "18.18.0",
    expoPackageVersion: "~52.0.0",
  },
  "51": {
    version: "51",
    reactNativeVersion: "0.74.5",
    releaseDate: "2024-05-07",
    minNodeVersion: "18.0.0",
    expoPackageVersion: "~51.0.0",
  },
  "50": {
    version: "50",
    reactNativeVersion: "0.73.6",
    releaseDate: "2024-01-18",
    minNodeVersion: "18.0.0",
    expoPackageVersion: "~50.0.0",
  },
  "49": {
    version: "49",
    reactNativeVersion: "0.72.10",
    releaseDate: "2023-06-27",
    minNodeVersion: "16.0.0",
    expoPackageVersion: "~49.0.0",
  },
  "48": {
    version: "48",
    reactNativeVersion: "0.71.14",
    releaseDate: "2023-02-09",
    deprecated: true,
    minNodeVersion: "16.0.0",
    expoPackageVersion: "~48.0.0",
  },
  "47": {
    version: "47",
    reactNativeVersion: "0.70.8",
    releaseDate: "2022-11-09",
    deprecated: true,
    minNodeVersion: "16.0.0",
    expoPackageVersion: "~47.0.0",
  },
};

// Core Expo packages that should be aligned with SDK version
export const EXPO_CORE_PACKAGES = [
  "expo",
  // "expo-dev-client", // REMOVED - incompatible with RN 0.76.x in SDK 53
  "expo-updates",
  "expo-splash-screen",
  "expo-status-bar",
  "expo-font",
  "expo-constants",
  "expo-linking",
  "expo-router",
];

// Packages that are INCOMPATIBLE with SDK 53
export const INCOMPATIBLE_PACKAGES_SDK53 = [
  "expo-dev-client", // Compilation errors with RN 0.76.x
  "socket.io-client", // Uses Node.js modules
  "expo-av", // Deprecated - use expo-video and expo-audio
];

// Packages with specific version requirements per SDK
export const PACKAGE_VERSION_OVERRIDES: Record<
  string,
  Record<string, string>
> = {
  "53": {
    // PRODUCTION-TESTED VERSIONS - DO NOT AUTO-UPDATE!
    // Core Expo packages (SDK 53 compatible)
    "expo": "~53.0.0",
    "expo-constants": "~17.1.0",
    "expo-font": "~13.0.1",
    "expo-secure-store": "~14.0.0",
    "expo-splash-screen": "~0.30.0",
    "expo-status-bar": "~2.0.0",
    "@expo/metro-runtime": "~4.0.0", // SDK 53 uses v4, not v53
    "expo-image": "~2.0.7",
    "expo-image-picker": "~16.0.7",
    "expo-linking": "~7.0.5",
    "expo-location": "~18.0.8",
    "expo-media-library": "~17.0.7",
    "expo-notifications": "~0.31.4",
    "expo-sensors": "~14.0.5",
    "expo-sharing": "~13.1.5",
    "expo-video": "~2.0.11",
    "expo-audio": "~14.0.0",
    "expo-web-browser": "~14.0.4",
    "expo-document-picker": "~13.1.6",
    // DO NOT USE expo-dev-client with RN 0.76.x - incompatible!
    // "expo-dev-client": "INCOMPATIBLE - DO NOT USE",

    // CRITICAL: React MUST be 18.3.1, NOT 19.x
    react: "18.3.1",
    "react-dom": "18.3.1",
    "@types/react": "~18.3.0",
    "react-test-renderer": "18.3.1",

    // Babel preset
    "babel-preset-expo": "~12.0.0",
    "babel-plugin-module-resolver": "^5.0.0",

    // React Native community packages - EXACT VERSIONS MATTER!
    "react-native-reanimated": "~3.16.3", // NOT 3.17.4 - has issues
    "react-native-gesture-handler": "~2.20.2", // Stable with SDK 53
    "react-native-screens": "~4.11.1",
    "react-native-safe-area-context": "5.0.0",
    "react-native-svg": "15.11.2",
    "react-native-pager-view": "6.7.1",
    "@react-native-async-storage/async-storage": "2.1.0", // NOT 2.1.2
    "@react-native-community/netinfo": "11.4.1",
    "react-native-web": "~0.19.13",
    typescript: "~5.8.3",
  },
  "52": {
    "@expo/metro-runtime": "~4.0.0", // SDK 52 also uses v4, not v52
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.20.0",
    "react-native-screens": "~4.0.0",
    "react-native-safe-area-context": "4.11.0",
    "react-native-svg": "15.8.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "react-native-web": "~0.19.13",
  },
  "51": {
    // Expo packages for SDK 51
    "expo-av": "~14.0.0",
    "expo-camera": "~15.0.0",
    "expo-constants": "~16.0.0",
    "expo-crypto": "~13.0.0",
    "expo-device": "~6.0.0",
    "expo-file-system": "~17.0.0",
    "expo-font": "~12.0.0",
    "expo-image": "~1.12.0",
    "expo-image-picker": "~15.0.0",
    "expo-linking": "~6.3.0",
    "expo-location": "~17.0.0",
    "expo-localization": "~15.0.0",
    "expo-mail-composer": "~13.0.0",
    "expo-media-library": "~16.0.0",
    "expo-notifications": "~0.28.0",
    "expo-screen-orientation": "~7.0.0",
    "expo-secure-store": "~13.0.0",
    "expo-sensors": "~13.0.0",
    "expo-sharing": "~12.0.0",
    "expo-splash-screen": "~0.27.0",
    "expo-status-bar": "~2.0.0",
    "expo-updates": "~0.25.0",
    "expo-web-browser": "~13.0.0",
    "expo-document-picker": "~12.0.0",

    // React Native packages
    "react-native-reanimated": "~3.10.1",
    "react-native-gesture-handler": "~2.16.1",
    "react-native-screens": "3.31.1",
    "react-native-safe-area-context": "4.10.5",
    "react-native-svg": "15.2.0",
    "react-native-pager-view": "6.3.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "react-native-web": "~0.19.10",
    typescript: "~5.3.0",
  },
  "50": {
    // Expo packages for SDK 50
    "expo-av": "~14.0.0",
    "expo-camera": "~15.0.0",
    "expo-constants": "~16.0.0",
    "expo-crypto": "~13.0.0",
    "expo-device": "~6.0.0",
    "expo-file-system": "~17.0.0",
    "expo-font": "~12.0.0",
    "expo-image": "~1.10.0",
    "expo-image-picker": "~15.0.0",
    "expo-linking": "~6.3.0",
    "expo-location": "~17.0.0",
    "expo-localization": "~15.0.0",
    "expo-mail-composer": "~13.0.0",
    "expo-media-library": "~16.0.0",
    "expo-notifications": "~0.28.0",
    "expo-screen-orientation": "~7.0.0",
    "expo-secure-store": "~13.0.0",
    "expo-sensors": "~13.0.0",
    "expo-sharing": "~12.0.0",
    "expo-splash-screen": "~0.27.0",
    "expo-status-bar": "~1.12.0",
    "expo-updates": "~0.25.0",
    "expo-web-browser": "~13.0.0",
    "expo-document-picker": "~12.0.0",

    // React Native packages
    "react-native-reanimated": "~3.6.2",
    "react-native-gesture-handler": "~2.14.0",
    "react-native-screens": "~3.29.0",
    "react-native-safe-area-context": "4.8.2",
    "react-native-svg": "14.1.0",
    "react-native-pager-view": "6.2.3",
    "@react-native-async-storage/async-storage": "1.21.0",
    "react-native-web": "~0.19.6",
    typescript: "~5.3.0",
  },
  "49": {
    "react-native-reanimated": "~3.3.0",
    "react-native-gesture-handler": "~2.12.0",
    "react-native-screens": "~3.22.0",
    "react-native-safe-area-context": "4.6.3",
    "react-native-svg": "13.9.0",
    "@react-native-async-storage/async-storage": "1.18.2",
    "react-native-web": "~0.19.0",
  },
};

export function getSdkInfo(version: string): SdkVersionInfo | undefined {
  return SDK_VERSIONS[version];
}

export function getLatestSdkVersion(): string {
  const versions = Object.keys(SDK_VERSIONS)
    .filter((v) => !SDK_VERSIONS[v]?.deprecated)
    .sort((a, b) => parseInt(b) - parseInt(a));
  return versions[0] || "53";
}

export function getAvailableSdkVersions(includeDeprecated = false): string[] {
  return Object.keys(SDK_VERSIONS)
    .filter((v) => includeDeprecated || !SDK_VERSIONS[v]?.deprecated)
    .sort((a, b) => parseInt(b) - parseInt(a));
}

export function getUpgradePath(
  fromVersion: string,
  toVersion: string
): string[] {
  const from = parseInt(fromVersion);
  const to = parseInt(toVersion);

  if (from >= to) {
    return [];
  }

  const path: string[] = [];
  for (let v = from + 1; v <= to; v++) {
    if (SDK_VERSIONS[v.toString()]) {
      path.push(v.toString());
    }
  }

  return path;
}

// Deprecated packages that should be removed
export const DEPRECATED_PACKAGES: Record<
  string,
  { removedInSdk: string; replacement?: string; reason: string }
> = {
  "react-native-unimodules": {
    removedInSdk: "50",
    reason:
      "Expo SDK 50+ no longer requires react-native-unimodules (now built-in)",
  },
  "expo-app-loading": {
    removedInSdk: "46",
    replacement: "expo-splash-screen",
    reason: "Use expo-splash-screen instead",
  },
  "expo-app-auth": {
    removedInSdk: "42",
    replacement: "expo-auth-session",
    reason: "Use expo-auth-session instead",
  },
  "expo-permissions": {
    removedInSdk: "45",
    reason:
      "Use individual package permission APIs (e.g., expo-camera.requestPermissionsAsync())",
  },
};

export function getPackageVersion(
  packageName: string,
  sdkVersion: string
): string | undefined {
  // Check for specific overrides first
  const overrides = PACKAGE_VERSION_OVERRIDES[sdkVersion];
  if (overrides && overrides[packageName]) {
    return overrides[packageName];
  }

  // For Expo core packages, use the SDK version
  if (EXPO_CORE_PACKAGES.includes(packageName)) {
    const sdkInfo = getSdkInfo(sdkVersion);
    return sdkInfo?.expoPackageVersion;
  }

  // For other Expo packages not in overrides, try to infer version
  if (packageName.startsWith("expo-") || packageName.startsWith("@expo/")) {
    const sdkInfo = getSdkInfo(sdkVersion);
    return sdkInfo?.expoPackageVersion;
  }

  return undefined;
}

export function getDeprecatedPackages(targetSdk: string): string[] {
  const sdkNum = parseInt(targetSdk);
  return Object.entries(DEPRECATED_PACKAGES)
    .filter(([_, info]) => parseInt(info.removedInSdk) <= sdkNum)
    .map(([pkg, _]) => pkg);
}
