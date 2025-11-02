export interface BreakingChange {
  id: string;
  package: string;
  affectedVersions: {
    from: string;  // e.g., "14.x" (package version in old SDK)
    to: string;    // e.g., "16.x" (package version in new SDK)
  };
  affectedSDKs: {
    from: string;  // e.g., "49"
    to: string;    // e.g., "53"
  };
  description: string;
  severity: 'critical' | 'warning' | 'info';
  guideSection: string;
  estimatedFixTime: string;
  manualSteps: string[];
}

export const BREAKING_CHANGES: BreakingChange[] = [
  // expo-camera (SDK 49 → 50+)
  {
    id: 'expo-camera-49-50',
    package: 'expo-camera',
    affectedVersions: {
      from: '14.x',  // SDK 49
      to: '16.x'     // SDK 53
    },
    affectedSDKs: {
      from: '49',
      to: '53'
    },
    description: 'Camera.Constants.Type changed to CameraType enum',
    severity: 'warning',
    guideSection: 'expo-camera',
    estimatedFixTime: '15-30 min',
    manualSteps: [
      'Replace Camera.Constants.Type.front with CameraType.front',
      'Replace Camera.Constants.Type.back with CameraType.back',
      'Replace Camera.Constants.FlashMode with FlashMode enum',
      'Import CameraType and FlashMode from expo-camera',
      'Test camera functionality'
    ]
  },
  
  // expo-location (SDK 50 → 51+)
  {
    id: 'expo-location-50-51',
    package: 'expo-location',
    affectedVersions: {
      from: '16.x',  // SDK 50
      to: '18.x'     // SDK 53
    },
    affectedSDKs: {
      from: '50',
      to: '53'
    },
    description: 'Permission API updated to separate foreground/background',
    severity: 'warning',
    guideSection: 'expo-location',
    estimatedFixTime: '10-20 min',
    manualSteps: [
      'Replace requestPermissionsAsync() with requestForegroundPermissionsAsync()',
      'Replace getPermissionsAsync() with getForegroundPermissionsAsync()',
      'If using background location, separately request requestBackgroundPermissionsAsync()',
      'Test location permissions on both iOS and Android'
    ]
  },
  
  // react-native (SDK 49 → 53)
  {
    id: 'react-native-49-53',
    package: 'react-native',
    affectedVersions: {
      from: '0.72.x',  // SDK 49
      to: '0.76.x'     // SDK 53
    },
    affectedSDKs: {
      from: '49',
      to: '53'
    },
    description: 'New Architecture enabled by default, Hermes updates',
    severity: 'critical',
    guideSection: 'react-native',
    estimatedFixTime: '2-4 hours',
    manualSteps: [
      'Review custom native modules for New Architecture compatibility',
      'Update metro.config.js if customized',
      'Test performance with Hermes engine',
      'Check for deprecated React Native APIs',
      'Test on both iOS and Android',
      'If issues occur, can temporarily opt-out with newArchEnabled: false'
    ]
  },
  
  // expo-router (SDK 50 → 51+)
  {
    id: 'expo-router-50-51',
    package: 'expo-router',
    affectedVersions: {
      from: '3.4.x',  // SDK 50
      to: '3.5.x'     // SDK 53
    },
    affectedSDKs: {
      from: '50',
      to: '53'
    },
    description: 'Expo Router v3 layout changes WILL break navigation',
    severity: 'critical',  // Changed from warning - navigation will break
    guideSection: 'expo-router',
    estimatedFixTime: '1-2 hours',
    manualSteps: [
      'Add _layout.tsx files to directories with nested routes',
      'Update Stack.Screen configurations',
      'Review deep linking configuration',
      'Remove unstable_settings if used',
      'Test navigation flows',
      'Verify deep links work correctly'
    ]
  },
  
  // expo-notifications (SDK 51 → 52+)
  {
    id: 'expo-notifications-51-52',
    package: 'expo-notifications',
    affectedVersions: {
      from: '0.27.x',  // SDK 51
      to: '0.28.x'     // SDK 53
    },
    affectedSDKs: {
      from: '51',
      to: '53'
    },
    description: 'Notification handler API updates',
    severity: 'warning',
    guideSection: 'expo-notifications',
    estimatedFixTime: '15-30 min',
    manualSteps: [
      'Review setNotificationHandler signature changes',
      'Update NotificationContentInput interface usage',
      'Test notification handling on both platforms',
      'Verify notification permissions still work'
    ]
  },
  
  // expo config plugins (SDK 52 → 53)
  {
    id: 'config-plugins-52-53',
    package: 'expo',
    affectedVersions: {
      from: '51.x',  // SDK 52
      to: '52.x'     // SDK 53
    },
    affectedSDKs: {
      from: '52',
      to: '53'
    },
    description: 'Config plugin API updates',
    severity: 'warning',
    guideSection: 'expo-config-plugins',
    estimatedFixTime: '30 min - 1 hour',
    manualSteps: [
      'Review app.json or app.config.js plugin configuration',
      'Replace withPlugins with individual with* functions if used',
      'Update custom config plugins if any',
      'Test prebuild process',
      'Verify all plugins work correctly'
    ]
  },
  
  // react-native-gesture-handler (SDK 49 → 50+)
  {
    id: 'gesture-handler-49-50',
    package: 'react-native-gesture-handler',
    affectedVersions: {
      from: '2.14.x',  // SDK 49
      to: '2.16.x'     // SDK 53
    },
    affectedSDKs: {
      from: '49',
      to: '53'
    },
    description: 'Gesture Handler API v2 migration',
    severity: 'warning',
    guideSection: 'react-native-gesture-handler',
    estimatedFixTime: '1-3 hours',
    manualSteps: [
      'Wrap gesture handlers with GestureDetector',
      'Migrate from class-based to function-based gesture API',
      'Replace TapGestureHandler with Gesture.Tap()',
      'Update gesture event handlers',
      'Test all gesture interactions',
      'Verify gesture composition works correctly'
    ]
  },
  
  // react-native-reanimated (SDK 50 → 51+)
  {
    id: 'reanimated-50-51',
    package: 'react-native-reanimated',
    affectedVersions: {
      from: '3.6.x',  // SDK 50
      to: '3.10.x'    // SDK 53
    },
    affectedSDKs: {
      from: '50',
      to: '53'
    },
    description: 'Reanimated 3 worklet changes',
    severity: 'warning',
    guideSection: 'react-native-reanimated',
    estimatedFixTime: '30 min - 1 hour',
    manualSteps: [
      'Replace useAnimatedGestureHandler with useAnimatedStyle',
      'Update worklet functions for new behavior',
      'Review runOnJS usage and update if needed',
      'Test all animations',
      'Verify gesture + animation combinations work'
    ]
  },

  // Hermes compatibility (SDK 53)
  {
    id: 'sdk-53-hermes',
    package: 'react-native',
    affectedVersions: {
      from: '0.76.x',  // SDK 53 initial version
      to: '0.79.x'     // Fixed version
    },
    affectedSDKs: {
      from: '53',
      to: '53'
    },
    description: 'Hermes require() compatibility issue after SDK 53 upgrade',
    severity: 'warning',
    guideSection: 'hermes-compatibility',
    estimatedFixTime: '15-30 min',
    manualSteps: [
      'If you see Hermes require() error:',
      'Update React Native: npx expo install react-native@0.79.5',
      'Clear Metro cache: npx expo start --clear',
      'Test app functionality',
      'Check Metro bundler logs for any remaining issues'
    ]
  },



  // ============================================
  // CRITICAL: AsyncStorage (NEW)
  // ============================================

  // @react-native-async-storage/async-storage (SDK 49 → 53)
  {
    id: 'async-storage-49-53',
    package: '@react-native-async-storage/async-storage',
    affectedVersions: {
      from: '1.x',  // SDK 49-50
      to: '2.x'     // SDK 51+
    },
    affectedSDKs: {
      from: '49',
      to: '53'
    },
    description: 'AsyncStorage v2 has breaking API changes',
    severity: 'critical',
    guideSection: 'async-storage',
    estimatedFixTime: '30 min - 1 hour',
    manualSteps: [
      'Update import statements if needed',
      'Update getItem/setItem API calls',
      'Update multiGet/multiSet if used',
      'Test all storage operations',
      'Migrate existing data if needed',
      'Verify data persistence works correctly'
    ]
  },

  // ============================================
  // WARNING: Common Expo Packages (NEW)
  // ============================================

  // expo-av (SDK 51 → 53)
  {
    id: 'expo-av-51-53',
    package: 'expo-av',
    affectedVersions: {
      from: '13.x',  // SDK 51
      to: '14.x'     // SDK 53
    },
    affectedSDKs: {
      from: '51',
      to: '53'
    },
    description: 'Audio/Video API updates in SDK 53',
    severity: 'warning',
    guideSection: 'expo-av',
    estimatedFixTime: '20-40 min',
    manualSteps: [
      'Update Audio.Sound API usage',
      'Update Video component props',
      'Test audio playback functionality',
      'Test video playback functionality',
      'Verify controls work correctly'
    ]
  },

  // expo-image-picker (SDK 49 → 53)
  {
    id: 'expo-image-picker-49-53',
    package: 'expo-image-picker',
    affectedVersions: {
      from: '14.x',  // SDK 49
      to: '15.x'     // SDK 53
    },
    affectedSDKs: {
      from: '49',
      to: '53'
    },
    description: 'Image picker permission and API changes',
    severity: 'warning',
    guideSection: 'expo-image-picker',
    estimatedFixTime: '20-30 min',
    manualSteps: [
      'Update permission handling',
      'Update launchImageLibraryAsync options',
      'Update launchCameraAsync options if used',
      'Test image selection on both platforms',
      'Verify permissions work correctly'
    ]
  },

  // expo-secure-store (SDK 50 → 53)
  {
    id: 'expo-secure-store-50-53',
    package: 'expo-secure-store',
    affectedVersions: {
      from: '12.x',  // SDK 50
      to: '13.x'     // SDK 53
    },
    affectedSDKs: {
      from: '50',
      to: '53'
    },
    description: 'SecureStore options parameter changes',
    severity: 'warning',
    guideSection: 'expo-secure-store',
    estimatedFixTime: '15-30 min',
    manualSteps: [
      'Update SecureStore.setItemAsync options',
      'Update SecureStore.getItemAsync options',
      'Update SecureStore.deleteItemAsync if used',
      'Test secure storage operations',
      'Verify data encryption works correctly'
    ]
  },

  // expo-file-system (SDK 50 → 53)
  {
    id: 'expo-file-system-50-53',
    package: 'expo-file-system',
    affectedVersions: {
      from: '16.x',  // SDK 50
      to: '17.x'     // SDK 53
    },
    affectedSDKs: {
      from: '50',
      to: '53'
    },
    description: 'File system API updates for scoped storage',
    severity: 'warning',
    guideSection: 'expo-file-system',
    estimatedFixTime: '30-45 min',
    manualSteps: [
      'Update file path handling for scoped storage',
      'Update downloadAsync options',
      'Update uploadAsync options if used',
      'Test file read/write operations',
      'Verify file permissions work correctly'
    ]
  },

  // ============================================
  // INFO: Nice to Fix (NEW)
  // ============================================

  // expo-font (SDK 49 → 53)
  {
    id: 'expo-font-49-53',
    package: 'expo-font',
    affectedVersions: {
      from: '11.x',  // SDK 49
      to: '12.x'     // SDK 53
    },
    affectedSDKs: {
      from: '49',
      to: '53'
    },
    description: 'Font loading API updates',
    severity: 'info',
    guideSection: 'expo-font',
    estimatedFixTime: '10-15 min',
    manualSteps: [
      'Update Font.loadAsync usage if needed',
      'Verify custom fonts load correctly',
      'Test font rendering on both platforms'
    ]
  },

  // ============================================
  // SDK 53 SPECIFIC CHANGES
  // ============================================

  // iOS Deployment Target (SDK 53)
  {
    id: 'sdk-53-ios-deployment',
    package: 'expo',
    affectedVersions: {
      from: '51.x',  // SDK 52
      to: '53.x'     // SDK 53
    },
    affectedSDKs: {
      from: '52',
      to: '53'
    },
    description: 'iOS deployment target must be 15.1+ for SDK 53',
    severity: 'critical',
    guideSection: 'ios-deployment-target',
    estimatedFixTime: '5 min',
    manualSteps: [
      'Add expo-build-properties to app.json plugins',
      'Set iOS deploymentTarget to "15.1"',
      'This is automatically configured by the upgrade wizard',
      'Required for EAS builds to succeed'
    ]
  },

  // Metro package exports (SDK 53)
  {
    id: 'sdk-53-metro-exports',
    package: 'expo',
    affectedVersions: {
      from: '51.x',  // SDK 52
      to: '53.x'     // SDK 53
    },
    affectedSDKs: {
      from: '52',
      to: '53'
    },
    description: 'Metro package.json exports enabled by default, may break some packages',
    severity: 'warning',
    guideSection: 'metro-package-exports',
    estimatedFixTime: '10-20 min',
    manualSteps: [
      'If you see "dual package hazard" or Node module errors:',
      'Add to metro.config.js: config.resolver.unstable_enablePackageExports = false',
      'Or update affected packages to latest versions',
      'Common affected packages: @supabase/supabase-js, firebase, axios'
    ]
  },

  // New Architecture default (SDK 53)
  {
    id: 'sdk-53-new-arch',
    package: 'expo',
    affectedVersions: {
      from: '51.x',  // SDK 52
      to: '53.x'     // SDK 53
    },
    affectedSDKs: {
      from: '52',
      to: '53'
    },
    description: 'New Architecture enabled by default in SDK 53',
    severity: 'warning',
    guideSection: 'new-architecture',
    estimatedFixTime: '30 min - 2 hours',
    manualSteps: [
      'Test your app thoroughly with New Architecture',
      'Check if custom native modules are compatible',
      'If issues occur, can opt-out with newArchEnabled: false in app.json',
      'Or use expo-build-properties plugin to disable'
    ]
  },

  // Firebase incompatibility (SDK 53)
  {
    id: 'sdk-53-firebase',
    package: 'firebase',
    affectedVersions: {
      from: '10.x',  // Firebase JS SDK
      to: '10.x'     // Still incompatible
    },
    affectedSDKs: {
      from: '52',
      to: '53'
    },
    description: 'Firebase JS SDK incompatible with Metro exports, must migrate to React Native Firebase',
    severity: 'critical',
    guideSection: 'firebase-migration',
    estimatedFixTime: '2-4 hours',
    manualSteps: [
      'Uninstall firebase and @firebase/* packages',
      'Install @react-native-firebase/app and other modules',
      'Update all Firebase imports and API calls',
      'Update Firebase initialization code',
      'Test all Firebase functionality',
      'See migration guide for detailed steps'
    ]
  },

  // Supabase compatibility (SDK 53)
  {
    id: 'sdk-53-supabase',
    package: '@supabase/supabase-js',
    affectedVersions: {
      from: '2.x',  // Older versions
      to: '2.49.5'  // Fixed version
    },
    affectedSDKs: {
      from: '52',
      to: '53'
    },
    description: 'Supabase has WebSocket issues with Metro exports',
    severity: 'warning',
    guideSection: 'supabase-compatibility',
    estimatedFixTime: '10-15 min',
    manualSteps: [
      'Update to @supabase/supabase-js@2.49.5 or later',
      'Or disable package exports in metro.config.js',
      'Test Supabase realtime subscriptions',
      'Verify authentication still works'
    ]
  },

  // expo-notifications plugin required (SDK 53)
  {
    id: 'sdk-53-notifications-plugin',
    package: 'expo-notifications',
    affectedVersions: {
      from: '0.27.x',  // SDK 51-52
      to: '0.28.x'     // SDK 53
    },
    affectedSDKs: {
      from: '52',
      to: '53'
    },
    description: 'expo-notifications must be in plugins array for iOS push notifications',
    severity: 'critical',
    guideSection: 'expo-notifications',
    estimatedFixTime: '5 min',
    manualSteps: [
      'Add "expo-notifications" to plugins array in app.json',
      'Required even if not customizing notification settings',
      'iOS push notifications will fail without this',
      'Test push notifications on iOS device'
    ]
  },

  // AppDelegate Swift migration (SDK 53)
  {
    id: 'sdk-53-appdelegate-swift',
    package: 'expo',
    affectedVersions: {
      from: '51.x',  // SDK 52
      to: '53.x'     // SDK 53
    },
    affectedSDKs: {
      from: '52',
      to: '53'
    },
    description: 'AppDelegate moved from Objective-C to Swift',
    severity: 'warning',
    guideSection: 'appdelegate-swift',
    estimatedFixTime: '30 min - 1 hour',
    manualSteps: [
      'Update config plugins that modify AppDelegate',
      'Use Swift syntax instead of Objective-C',
      'Test iOS builds thoroughly',
      'Check if custom native modules need updates'
    ]
  },

  // expo-av deprecation (SDK 53)
  {
    id: 'sdk-53-expo-av-deprecated',
    package: 'expo-av',
    affectedVersions: {
      from: '13.x',  // SDK 51-52
      to: '14.x'     // SDK 53 (deprecated)
    },
    affectedSDKs: {
      from: '52',
      to: '53'
    },
    description: 'expo-av is deprecated, migrate to expo-video and expo-audio',
    severity: 'warning',
    guideSection: 'expo-av-migration',
    estimatedFixTime: '1-3 hours',
    manualSteps: [
      'Install expo-video and expo-audio',
      'Migrate Video components to expo-video',
      'Migrate Audio API to expo-audio',
      'Update all video/audio playback code',
      'Test media playback on both platforms',
      'Uninstall expo-av when migration complete'
    ]
  }
];

/**
 * Get breaking changes for an upgrade path based on SDK versions and installed packages
 * Uses version-based detection - no file scanning required
 * Only shows changes relevant to packages actually installed in the project
 */
export function getBreakingChangesForUpgrade(
  fromSdk: string,
  toSdk: string,
  packageJson?: any
): BreakingChange[] {
  const from = parseInt(fromSdk);
  const to = parseInt(toSdk);
  
  // Get all dependencies if package.json provided
  const installedPackages = packageJson ? {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  } : {};
  
  const detectedChanges: BreakingChange[] = [];
  
  for (const change of BREAKING_CHANGES) {
    // Check if this change applies to the SDK versions being upgraded
    const changeFromSDK = parseInt(change.affectedSDKs.from);
    const changeToSDK = parseInt(change.affectedSDKs.to);
    
    // Does this change apply to the SDK upgrade path?
    // The change applies if:
    // 1. We're upgrading TO a version that includes this change (to >= changeToSDK)
    // 2. We're upgrading FROM a version before or at the change introduction (from <= changeFromSDK)
    if (to < changeToSDK) {
      // Not upgrading to a version that has this change
      continue;
    }
    
    if (from > changeFromSDK) {
      // Already past the version where this change was introduced
      continue;
    }
    
    // If no package.json provided, skip (we want to be specific)
    if (!packageJson) {
      continue;
    }
    
    // Check if user has this package installed
    const installedVersion = installedPackages[change.package];
    if (!installedVersion) {
      // Package not installed, skip this change
      continue;
    }
    
    // Check if installed version is in the affected range
    if (isVersionInAffectedRange(installedVersion, change.affectedVersions.from)) {
      detectedChanges.push(change);
    }
  }
  
  return detectedChanges;
}

/**
 * Check if installed version matches the affected version range
 * This checks if the package is installed (regardless of version)
 * The breaking change applies if the package exists
 */
function isVersionInAffectedRange(installed: string, affected: string): boolean {
  // If the package is installed, the breaking change applies
  // We don't need strict version matching because:
  // 1. The SDK version range already filters appropriately
  // 2. If they have the package, they need to know about the change
  return true;
  
  // Alternative: strict version matching (commented out for now)
  // const cleanInstalled = installed.replace(/[\^~=]/g, '');
  // const cleanAffected = affected.replace(/[\^~=]/g, '');
  // const installedMajor = parseInt(cleanInstalled.split('.')[0]);
  // const affectedMajor = parseInt(cleanAffected.split('.')[0] || cleanAffected);
  // return installedMajor === affectedMajor;
}

// Helper to get critical changes
export function getCriticalChanges(changes: BreakingChange[]): BreakingChange[] {
  return changes.filter(c => c.severity === 'critical');
}

// Helper to get warning changes
export function getWarningChanges(changes: BreakingChange[]): BreakingChange[] {
  return changes.filter(c => c.severity === 'warning');
}

// Group changes by package
export function groupChangesByPackage(changes: BreakingChange[]): Record<string, BreakingChange[]> {
  return changes.reduce((acc, change) => {
    if (!acc[change.package]) {
      acc[change.package] = [];
    }
    acc[change.package].push(change);
    return acc;
  }, {} as Record<string, BreakingChange[]>);
}

/**
 * Get a summary of what packages were analyzed and what was found
 */
export function getAnalysisSummary(
  fromSdk: string,
  toSdk: string,
  packageJson: any,
  detectedChanges: BreakingChange[]
): {
  totalPackages: number;
  expoPackages: number;
  thirdPartyPackages: number;
  affectedPackages: string[];
  unaffectedPackages: number;
} {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  const totalPackages = Object.keys(allDeps).length;
  const expoPackages = Object.keys(allDeps).filter(pkg => 
    pkg.startsWith('expo') || pkg.startsWith('@expo')
  ).length;
  const thirdPartyPackages = totalPackages - expoPackages;
  
  const affectedPackages = [...new Set(detectedChanges.map(c => c.package))];
  const unaffectedPackages = totalPackages - affectedPackages.length;
  
  return {
    totalPackages,
    expoPackages,
    thirdPartyPackages,
    affectedPackages,
    unaffectedPackages
  };
}
