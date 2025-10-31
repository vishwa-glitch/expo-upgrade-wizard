export interface PackageCompatibility {
  package: string;
  compatibilityMap: {
    [sdkVersion: string]: {
      minVersion: string;
      maxVersion: string;
      recommendedVersion: string;
      notes?: string;
      breakingChanges?: string[];
      migrationSteps?: string[];
    };
  };
}

// Comprehensive React Native package compatibility mapping
export const PACKAGE_COMPATIBILITY: PackageCompatibility[] = [
  // Core React Native packages
  {
    package: '@gorhom/bottom-sheet',
    compatibilityMap: {
      '49': { minVersion: '4.0.0', maxVersion: '4.5.99', recommendedVersion: '4.5.1' },
      '50': { minVersion: '4.5.0', maxVersion: '4.6.99', recommendedVersion: '4.6.0' },
      '51': { minVersion: '4.6.0', maxVersion: '5.0.0-alpha.99', recommendedVersion: '4.6.2' },
      '52': { 
        minVersion: '5.0.0-alpha.0', 
        maxVersion: '5.0.99', 
        recommendedVersion: '5.0.0',
        notes: 'V5 has breaking changes - requires react-native-reanimated >= 3.10.0',
        breakingChanges: [
          'Portal component removed - use @gorhom/portal instead',
          'enablePanDownToClose prop renamed to enableDynamicSizing',
          'handleHeight and handleIndicatorStyle props removed',
          'Requires react-native-reanimated >= 3.10.0'
        ],
        migrationSteps: [
          'Update react-native-reanimated to >= 3.10.0 first',
          'Install @gorhom/portal if using Portal component',
          'Update prop names: enablePanDownToClose → enableDynamicSizing',
          'Remove handleHeight and handleIndicatorStyle props',
          'Review gesture handling changes'
        ]
      },
      '53': { 
        minVersion: '5.0.0', 
        maxVersion: '5.1.99', 
        recommendedVersion: '5.0.2',
        notes: 'Requires react-native-reanimated >= 3.10.1'
      }
    }
  },
  {
    package: '@react-native-async-storage/async-storage',
    compatibilityMap: {
      '49': { minVersion: '1.17.0', maxVersion: '1.19.99', recommendedVersion: '1.18.2' },
      '50': { minVersion: '1.19.0', maxVersion: '1.21.99', recommendedVersion: '1.21.0' },
      '51': { minVersion: '1.21.0', maxVersion: '1.23.99', recommendedVersion: '1.23.1' },
      '52': { 
        minVersion: '1.23.0', 
        maxVersion: '2.0.99', 
        recommendedVersion: '2.0.0',
        notes: 'New Architecture support added',
        breakingChanges: [
          'Minimum React Native version increased to 0.73',
          'getAllKeys() now returns Promise<readonly string[]> instead of Promise<string[]>'
        ]
      },
      '53': { minVersion: '2.0.0', maxVersion: '2.1.99', recommendedVersion: '2.0.0' }
    }
  },
  {
    package: '@shopify/flash-list',
    compatibilityMap: {
      '49': { minVersion: '1.4.0', maxVersion: '1.4.99', recommendedVersion: '1.4.3' },
      '50': { minVersion: '1.5.0', maxVersion: '1.6.99', recommendedVersion: '1.6.3' },
      '51': { minVersion: '1.6.0', maxVersion: '1.6.99', recommendedVersion: '1.6.4' },
      '52': { 
        minVersion: '1.7.0', 
        maxVersion: '1.7.99', 
        recommendedVersion: '1.7.0',
        notes: 'Performance improvements for New Architecture'
      },
      '53': { 
        minVersion: '1.7.0', 
        maxVersion: '1.8.99', 
        recommendedVersion: '1.7.1',
        notes: 'Fabric renderer optimizations'
      }
    }
  },
  {
    package: 'react-native-gesture-handler',
    compatibilityMap: {
      '49': { minVersion: '2.12.0', maxVersion: '2.12.99', recommendedVersion: '2.12.0' },
      '50': { 
        minVersion: '2.14.0', 
        maxVersion: '2.15.99', 
        recommendedVersion: '2.14.0',
        notes: 'Gesture API v2 required',
        breakingChanges: [
          'TapGestureHandler deprecated, use Gesture.Tap() instead',
          'PanGestureHandler deprecated, use Gesture.Pan() instead',
          'All handlers must be wrapped with GestureDetector'
        ],
        migrationSteps: [
          'Replace TapGestureHandler with GestureDetector + Gesture.Tap()',
          'Replace PanGestureHandler with GestureDetector + Gesture.Pan()',
          'Update gesture event handlers to use new API',
          'Remove deprecated onGestureEvent prop'
        ]
      },
      '51': { minVersion: '2.16.0', maxVersion: '2.17.99', recommendedVersion: '2.16.2' },
      '52': { 
        minVersion: '2.18.0', 
        maxVersion: '2.19.99', 
        recommendedVersion: '2.18.1',
        notes: 'New Architecture fully supported'
      },
      '53': { minVersion: '2.20.0', maxVersion: '2.20.99', recommendedVersion: '2.20.0' }
    }
  },
  {
    package: 'react-native-reanimated',
    compatibilityMap: {
      '49': { minVersion: '3.3.0', maxVersion: '3.3.99', recommendedVersion: '3.3.0' },
      '50': { 
        minVersion: '3.5.0', 
        maxVersion: '3.5.99', 
        recommendedVersion: '3.5.4',
        notes: 'Reanimated 3 stable release',
        breakingChanges: [
          'useAnimatedGestureHandler deprecated',
          'useAnimatedScrollHandler signature changed',
          'runOnJS now requires explicit worklet keyword'
        ],
        migrationSteps: [
          'Replace useAnimatedGestureHandler with useAnimatedStyle + gesture handlers',
          'Update useAnimatedScrollHandler to new signature',
          'Add "worklet" directive to functions called from worklets'
        ]
      },
      '51': { minVersion: '3.6.0', maxVersion: '3.7.99', recommendedVersion: '3.6.2' },
      '52': { 
        minVersion: '3.8.0', 
        maxVersion: '3.9.99', 
        recommendedVersion: '3.8.1',
        notes: 'Fabric renderer support'
      },
      '53': { 
        minVersion: '3.10.0', 
        maxVersion: '3.11.99', 
        recommendedVersion: '3.10.0',
        notes: 'Performance optimizations for New Architecture'
      }
    }
  },
  {
    package: 'react-native-safe-area-context',
    compatibilityMap: {
      '49': { minVersion: '4.6.0', maxVersion: '4.6.99', recommendedVersion: '4.6.3' },
      '50': { minVersion: '4.7.0', maxVersion: '4.8.99', recommendedVersion: '4.8.2' },
      '51': { minVersion: '4.9.0', maxVersion: '4.9.99', recommendedVersion: '4.9.0' },
      '52': { 
        minVersion: '4.10.0', 
        maxVersion: '4.10.99', 
        recommendedVersion: '4.10.1',
        notes: 'New Architecture support',
        breakingChanges: [
          'initialMetrics prop type changed for better TypeScript support'
        ]
      },
      '53': { minVersion: '4.11.0', maxVersion: '4.11.99', recommendedVersion: '4.11.0' }
    }
  },
  {
    package: 'react-native-screens',
    compatibilityMap: {
      '49': { minVersion: '3.22.0', maxVersion: '3.22.99', recommendedVersion: '3.22.0' },
      '50': { minVersion: '3.25.0', maxVersion: '3.26.99', recommendedVersion: '3.25.0' },
      '51': { minVersion: '3.27.0', maxVersion: '3.28.99', recommendedVersion: '3.27.0' },
      '52': { 
        minVersion: '3.29.0', 
        maxVersion: '3.30.99', 
        recommendedVersion: '3.29.0',
        notes: 'New Architecture improvements',
        breakingChanges: [
          'enableScreens() is now automatic, remove manual calls',
          'Some Screen props deprecated in favor of options'
        ],
        migrationSteps: [
          'Remove enableScreens() calls from your app',
          'Update Screen component props to use options prop'
        ]
      },
      '53': { 
        minVersion: '3.31.0', 
        maxVersion: '3.32.99', 
        recommendedVersion: '3.31.1',
        notes: 'Fabric optimizations'
      }
    }
  },
  {
    package: 'react-native-svg',
    compatibilityMap: {
      '49': { minVersion: '13.9.0', maxVersion: '13.9.99', recommendedVersion: '13.9.0' },
      '50': { minVersion: '13.14.0', maxVersion: '14.0.99', recommendedVersion: '14.0.0' },
      '51': { minVersion: '14.1.0', maxVersion: '14.1.99', recommendedVersion: '14.1.0' },
      '52': { 
        minVersion: '14.2.0', 
        maxVersion: '15.0.99', 
        recommendedVersion: '15.0.0',
        notes: 'v15 with New Architecture support',
        breakingChanges: [
          'SvgXml and SvgUri components moved to separate imports',
          'Some props renamed for consistency'
        ],
        migrationSteps: [
          'Import SvgXml from "react-native-svg/css" if using CSS features',
          'Update deprecated prop names'
        ]
      },
      '53': { 
        minVersion: '15.2.0', 
        maxVersion: '15.3.99', 
        recommendedVersion: '15.2.0' 
      }
    }
  },
  {
    package: '@react-navigation/native',
    compatibilityMap: {
      '49': { minVersion: '6.1.0', maxVersion: '6.1.99', recommendedVersion: '6.1.7' },
      '50': { minVersion: '6.1.0', maxVersion: '6.1.99', recommendedVersion: '6.1.9' },
      '51': { minVersion: '6.1.0', maxVersion: '6.1.99', recommendedVersion: '6.1.10' },
      '52': { 
        minVersion: '6.1.10', 
        maxVersion: '6.1.99', 
        recommendedVersion: '6.1.17',
        notes: 'Compatible with React Navigation 6.x'
      },
      '53': { minVersion: '6.1.17', maxVersion: '6.1.99', recommendedVersion: '6.1.18' }
    }
  },
  {
    package: '@tanstack/react-query',
    compatibilityMap: {
      '49': { minVersion: '4.0.0', maxVersion: '5.99.99', recommendedVersion: '5.0.0' },
      '50': { minVersion: '5.0.0', maxVersion: '5.99.99', recommendedVersion: '5.12.2' },
      '51': { minVersion: '5.0.0', maxVersion: '5.99.99', recommendedVersion: '5.17.0' },
      '52': { minVersion: '5.0.0', maxVersion: '5.99.99', recommendedVersion: '5.28.0' },
      '53': { minVersion: '5.0.0', maxVersion: '5.99.99', recommendedVersion: '5.32.0' }
    }
  },
  {
    package: 'expo-av',
    compatibilityMap: {
      '49': { minVersion: '~13.4.0', maxVersion: '~13.4.99', recommendedVersion: '~13.4.1' },
      '50': { minVersion: '~13.8.0', maxVersion: '~13.10.99', recommendedVersion: '~13.10.5' },
      '51': { minVersion: '~14.0.0', maxVersion: '~14.0.99', recommendedVersion: '~14.0.7' },
      '52': { 
        minVersion: '~14.0.0', 
        maxVersion: '~14.0.99', 
        recommendedVersion: '~14.0.7',
        notes: 'Audio focus handling improvements'
      },
      '53': { minVersion: '~14.1.0', maxVersion: '~14.1.99', recommendedVersion: '~14.1.0' }
    }
  }
];

// Helper function to get package compatibility for a specific SDK
export function getPackageCompatibility(packageName: string, sdkVersion: string) {
  const pkg = PACKAGE_COMPATIBILITY.find(p => p.package === packageName);
  if (!pkg) return null;
  
  return pkg.compatibilityMap[sdkVersion] || null;
}

// React 19 Compatibility Matrix
// Based on actual peer dependencies from npm registry
export interface React19Compatibility {
  package: string;
  minVersion: string;
  oldPattern: RegExp;
  reason: string;
  peerDependency: string;
  verifyCommand: string;
}

export const REACT_19_COMPAT: React19Compatibility[] = [
  {
    package: '@reduxjs/toolkit',
    minVersion: '2.0.0',
    oldPattern: /^\^?1\./,
    reason: 'React 19 support added in v2.0.0',
    peerDependency: '"react": "^16.9.0 || ^17.0.0 || ^18 || ^19"',
    verifyCommand: 'npm view @reduxjs/toolkit@2.0.0 peerDependencies'
  },
  {
    package: 'react-redux',
    minVersion: '9.0.0',
    oldPattern: /^\^?8\./,
    reason: 'React 19 support added in v9.0.0',
    peerDependency: '"react": "^18.0 || ^19.0"',
    verifyCommand: 'npm view react-redux@9.0.0 peerDependencies'
  },
  {
    package: 'react-native-reanimated',
    minVersion: '3.6.0',
    oldPattern: /^\^?3\.[0-5]\./,
    reason: 'React 19 support added in v3.6.0',
    peerDependency: '"react": "^18.2.0 || ^19.0.0"',
    verifyCommand: 'npm view react-native-reanimated@3.6.0 peerDependencies'
  },
  {
    package: '@tanstack/react-query',
    minVersion: '5.0.0',
    oldPattern: /^\^?4\./,
    reason: 'React 19 support added in v5.0.0',
    peerDependency: '"react": "^18.0.0 || ^19.0.0"',
    verifyCommand: 'npm view @tanstack/react-query@5.0.0 peerDependencies'
  },
  {
    package: 'react-hook-form',
    minVersion: '7.48.0',
    oldPattern: /^\^?7\.([0-3][0-9]|4[0-7])\./,
    reason: 'React 19 support added in v7.48.0',
    peerDependency: '"react": "^16.8.0 || ^17 || ^18 || ^19"',
    verifyCommand: 'npm view react-hook-form@7.48.0 peerDependencies'
  },
  {
    package: 'formik',
    minVersion: '2.4.5',
    oldPattern: /^\^?2\.[0-3]\./,
    reason: 'React 19 support added in v2.4.5',
    peerDependency: '"react": ">=16.8.0"',
    verifyCommand: 'npm view formik@2.4.5 peerDependencies'
  }
];

/**
 * Check if package version is compatible with React 19
 * Returns null if compatible, or upgrade info if incompatible
 */
export function checkReact19Compatibility(
  packageName: string,
  currentVersion: string,
  reactVersion: string
): {
  compatible: boolean;
  requiredVersion?: string;
  reason?: string;
  currentVersion?: string;
} | null {
  // Only check if using React 19
  if (!reactVersion.match(/^(\^|~)?19\./)) {
    return null;
  }

  const compat = REACT_19_COMPAT.find(c => c.package === packageName);
  if (!compat) {
    return null; // No known compatibility issues
  }

  // Check if current version matches old pattern
  if (compat.oldPattern.test(currentVersion)) {
    return {
      compatible: false,
      requiredVersion: `^${compat.minVersion}`,
      reason: compat.reason,
      currentVersion: currentVersion
    };
  }

  return { compatible: true };
}

/**
 * Fix React 19 compatibility issues in package.json
 * Returns array of fixes applied
 */
export function fixReact19Compatibility(packageJson: any): string[] {
  const reactVersion = packageJson.dependencies?.react || packageJson.devDependencies?.react;
  
  if (!reactVersion || !reactVersion.match(/^(\^|~)?19\./)) {
    return []; // Not using React 19
  }

  const fixes: string[] = [];
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  for (const compat of REACT_19_COMPAT) {
    const currentVersion = allDeps[compat.package];
    
    if (currentVersion && compat.oldPattern.test(currentVersion)) {
      const newVersion = `^${compat.minVersion}`;
      
      // Update in the correct section
      if (packageJson.dependencies?.[compat.package]) {
        packageJson.dependencies[compat.package] = newVersion;
      } else if (packageJson.devDependencies?.[compat.package]) {
        packageJson.devDependencies[compat.package] = newVersion;
      }
      
      fixes.push(`${compat.package}: ${currentVersion} → ${newVersion} (${compat.reason})`);
    }
  }

  return fixes;
}

// Check if a package version is compatible with target SDK
export function isVersionCompatible(
  packageName: string, 
  currentVersion: string, 
  targetSdk: string
): {
  compatible: boolean;
  reason?: string;
  recommendation?: string;
  breakingChanges?: string[];
  migrationSteps?: string[];
} {
  const compatibility = getPackageCompatibility(packageName, targetSdk);
  
  if (!compatibility) {
    // No compatibility data available
    return { compatible: true };
  }
  
  // Remove common prefixes like ^, ~, etc.
  const cleanVersion = currentVersion.replace(/^[\^~>=<]/, '');
  
  // Simple version comparison (you might want to use semver for more accuracy)
  const isCompatible = cleanVersion >= compatibility.minVersion && cleanVersion <= compatibility.maxVersion;
  
  if (!isCompatible) {
    return {
      compatible: false,
      reason: `Current version ${currentVersion} is not compatible with SDK ${targetSdk}`,
      recommendation: `Update to ${compatibility.recommendedVersion}`,
      breakingChanges: compatibility.breakingChanges,
      migrationSteps: compatibility.migrationSteps
    };
  }
  
  // Check if update is recommended even if compatible
  if (cleanVersion !== compatibility.recommendedVersion) {
    return {
      compatible: true,
      reason: `Consider updating to recommended version`,
      recommendation: `${compatibility.recommendedVersion}${compatibility.notes ? ` - ${compatibility.notes}` : ''}`
    };
  }
  
  return { compatible: true };
}
