/**
 * Official Expo SDK 53 Known Issues and Breaking Changes
 * Source: Expo SDK 53 documentation
 */

export interface LibraryReplacement {
  old: string;
  new: string;
  reason: string;
  migrationSteps?: string[];
}

export interface KnownIssue {
  package: string;
  issue: string;
  solution: string;
  minVersion?: string;
}

export interface Deprecation {
  package: string;
  replacement?: string;
  description: string;
  willBeRemovedIn?: string;
}

export const SDK53_LIBRARY_REPLACEMENTS: LibraryReplacement[] = [
  {
    old: '@react-native-community/masked-view',
    new: '@react-native-masked-view/masked-view',
    reason: 'Community package deprecated',
    migrationSteps: [
      'npm uninstall @react-native-community/masked-view',
      'npm install @react-native-masked-view/masked-view',
      'Update all imports from @react-native-community/masked-view to @react-native-masked-view/masked-view'
    ]
  },
  {
    old: '@react-native-community/clipboard',
    new: '@react-native-clipboard/clipboard',
    reason: 'Community package deprecated',
    migrationSteps: [
      'npm uninstall @react-native-community/clipboard',
      'npm install @react-native-clipboard/clipboard',
      'Update all imports from @react-native-community/clipboard to @react-native-clipboard/clipboard'
    ]
  },
  {
    old: 'rn-fetch-blob',
    new: 'react-native-blob-util',
    reason: 'Package no longer maintained',
    migrationSteps: [
      'npm uninstall rn-fetch-blob',
      'npm install react-native-blob-util',
      'Update imports: RNFetchBlob → ReactNativeBlobUtil'
    ]
  },
  {
    old: 'react-native-fs',
    new: 'expo-file-system',
    reason: 'Better Expo ecosystem integration',
    migrationSteps: [
      'npm uninstall react-native-fs',
      'npx expo install expo-file-system',
      'Migrate file operations to expo-file-system API'
    ]
  },
  {
    old: 'react-native-geolocation-service',
    new: 'expo-location',
    reason: 'Better Expo ecosystem integration',
    migrationSteps: [
      'npm uninstall react-native-geolocation-service',
      'npx expo install expo-location',
      'Update location API calls to expo-location format'
    ]
  },
  {
    old: 'react-native-datepicker',
    new: 'react-native-date-picker',
    reason: 'Package deprecated',
    migrationSteps: [
      'npm uninstall react-native-datepicker',
      'npm install react-native-date-picker',
      'Or use @react-native-community/datetimepicker for native picker'
    ]
  }
];

export const SDK53_DEPRECATIONS: Deprecation[] = [
  {
    package: 'expo-av',
    replacement: 'expo-video and expo-audio',
    description: 'Video component replaced by expo-video in SDK 52, Audio API replaced by expo-audio in SDK 53',
    willBeRemovedIn: 'SDK 54'
  },
  {
    package: 'expo-background-fetch',
    replacement: 'expo-background-task',
    description: 'Replaced with modern platform APIs',
    willBeRemovedIn: 'SDK 54'
  },
  {
    package: '@expo/webpack-config',
    description: 'Webpack support for Expo web has been deprecated. Use Metro for web instead',
    willBeRemovedIn: 'SDK 54'
  },
  {
    package: 'jsEngine field',
    description: 'JavaScriptCore support deprecated in React Native 0.79',
    replacement: '@react-native-community/javascriptcore',
    willBeRemovedIn: 'SDK 54'
  }
];

export const SDK53_KNOWN_ISSUES: KnownIssue[] = [
  {
    package: 'android/app/build.gradle',
    issue: 'Deprecated bundleCommand = "export:embed" causes Metro bundler to fail with "commands[command] is not a function"',
    solution: 'Remove bundleCommand and cliFile lines from react {} block in android/app/build.gradle. Run: npx expo-upgrade-wizard fix-deprecated'
  },
  {
    package: 'babel-plugin-module-resolver',
    issue: 'Missing babel-plugin-module-resolver after SDK 53 upgrade causes bundling to fail',
    solution: 'Install babel-plugin-module-resolver as a dev dependency: npm install --save-dev babel-plugin-module-resolver',
    minVersion: '5.0.0'
  },
  {
    package: 'react-native-maps',
    issue: 'Version 1.20.x works with interop layer but v1.21.0 (New Architecture-first) is still stabilizing',
    solution: 'Use v1.20.x for stability or test v1.21.0 and report issues. Consider expo-maps for iOS 17+ only apps',
    minVersion: '1.20.0'
  },
  {
    package: '@stripe/react-native',
    issue: 'New Architecture support requires v0.45.0 or higher',
    solution: 'Update to v0.45.0 or higher',
    minVersion: '0.45.0'
  }
];

export const SDK53_BREAKING_CHANGES = {
  react19: {
    description: 'React 19 breaking changes',
    changes: [
      'Review React 19 upgrade guide',
      'Skip web-specific instructions',
      'Update component lifecycle methods if needed'
    ]
  },
  reactNativeImports: {
    description: 'Internal imports in React Native updated to export syntax',
    changes: [
      'Update any require() calls with nested paths (react-native/x/y)',
      'Use import syntax instead of require for React Native internals'
    ]
  },
  packageJsonExports: {
    description: 'package.json exports and imports enabled by default',
    changes: [
      'Review Metro bundler ES Module resolution',
      'Update any custom Metro configuration'
    ]
  },
  androidTheme: {
    description: 'Default AppTheme changed to DayNight',
    changes: [
      'New projects use DayNight theme',
      'Facilitates edge-to-edge layout',
      'Compatible with react-native-edge-to-edge'
    ]
  },
  edgeToEdge: {
    description: 'Edge-to-edge enabled by default',
    changes: [
      'Enabled in new projects and Expo Go',
      'Will be mandatory in future Android versions',
      'Update layouts to handle edge-to-edge'
    ]
  },
  setImmediate: {
    description: 'setImmediate polyfill removed',
    changes: [
      'Replace setImmediate with setTimeout(..., 0)',
      'Or use queueMicrotask for microtask timing'
    ]
  },
  androidScheme: {
    description: 'Android package name no longer auto-added as linking scheme',
    changes: [
      'Add package name to android.scheme in app config if needed',
      'Example: "android": { "scheme": ["your.package.name"] }'
    ]
  },
  pushNotifications: {
    description: 'Push notifications no longer supported in Expo Go for Android',
    changes: [
      'Use development builds for testing push notifications on Android',
      'Configure push notifications properly for production'
    ]
  },
  reactDevTools: {
    description: 'React DevTools removed from Expo CLI',
    changes: [
      'Press "j" for React Native DevTools instead',
      'React DevTools available within React Native DevTools'
    ]
  },
  node18EOL: {
    description: 'Node 18 reached End-Of-Life',
    changes: [
      'Update to Node 20 or higher',
      'Node 18 EOL was April 30, 2025'
    ]
  }
};

export const SDK53_NEW_ARCHITECTURE_INFO = {
  description: 'React Native 0.74+ includes Interop Layers for Old Architecture compatibility',
  notes: [
    'Many libraries work on New Architecture without changes',
    'Libraries with third-party native code may need updates',
    'Check React Native Directory for compatibility',
    'Test thoroughly with New Architecture enabled'
  ]
};

export const SDK53_DOCTOR_COMMAND = 'npx expo-doctor@latest';

/**
 * Get all SDK 53 specific issues for a list of packages
 */
export function getSDK53Issues(installedPackages: string[]): {
  replacements: LibraryReplacement[];
  deprecations: Deprecation[];
  knownIssues: KnownIssue[];
} {
  const replacements = SDK53_LIBRARY_REPLACEMENTS.filter(r => 
    installedPackages.includes(r.old)
  );
  
  const deprecations = SDK53_DEPRECATIONS.filter(d => 
    installedPackages.includes(d.package)
  );
  
  const knownIssues = SDK53_KNOWN_ISSUES.filter(i => 
    installedPackages.includes(i.package)
  );
  
  return { replacements, deprecations, knownIssues };
}
