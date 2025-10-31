/**
 * Comprehensive SDK 53 Breaking Changes from Official Documentation
 * Sources: 
 * - Expo SDK 53 Changelog
 * - GitHub Issues #36375, #36651, #36477, #36598
 * - Community Reports
 */

export interface BreakingChange {
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'moderate' | 'minor';
  affectedPackages?: string[];
  solution: string[];
  codeExample?: {
    before?: string;
    after?: string;
  };
}

export const SDK53_MAJOR_BREAKING_CHANGES: BreakingChange[] = [
  {
    title: 'iOS Deployment Target Minimum 15.1',
    description: 'SDK 53 requires iOS deployment target to be at least 15.1',
    severity: 'critical',
    solution: [
      'Add expo-build-properties plugin to app.json:',
      '["expo-build-properties", { "ios": { "deploymentTarget": "15.1" } }]',
      'The upgrade wizard automatically sets this for you',
      'Required for EAS builds to succeed'
    ],
    codeExample: {
      before: `// app.json - Missing or too old
{
  "expo": {
    "plugins": [
      ["expo-build-properties", {
        "ios": { "deploymentTarget": "13.0" }  // ❌ Too old
      }]
    ]
  }
}`,
      after: `// app.json - SDK 53 compatible
{
  "expo": {
    "plugins": [
      ["expo-build-properties", {
        "ios": { "deploymentTarget": "15.1" }  // ✅ Required for SDK 53
      }]
    ]
  }
}`
    }
  },
  {
    title: 'New Architecture Enabled by Default',
    description: 'The New Architecture is now enabled by default in all projects in SDK 53',
    severity: 'major',
    solution: [
      'Test your app thoroughly with New Architecture',
      'To opt out temporarily, add to app.json:',
      '{ "expo": { "experiments": { "newArchEnabled": false } } }',
      'Or use expo-build-properties plugin'
    ]
  },
  {
    title: 'React 19 and React Native 0.79',
    description: 'SDK 53 includes React Native 0.79 with React 19, which has breaking changes',
    severity: 'critical',
    solution: [
      'Add to package.json to prevent multiple React installations:',
      '{ "overrides": { "react": "^19.0.0", "react-dom": "^19.0.0" } }',
      'For Yarn use "resolutions", for pnpm use "pnpm.overrides"',
      'Review React 19 breaking changes documentation'
    ]
  },
  {
    title: 'Metro package.json exports field enabled',
    description: 'The package.json exports field is now enabled by default in Metro bundler, causing "dual package hazard" and Node module import errors',
    severity: 'critical',
    affectedPackages: ['@supabase/supabase-js', 'firebase', 'ws', 'axios'],
    solution: [
      'Add to metro.config.js to disable:',
      'config.resolver.unstable_enablePackageExports = false',
      'Or use browser version for specific packages',
      'Update affected packages to latest versions'
    ],
    codeExample: {
      after: `// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = false;
module.exports = config;`
    }
  },
  {
    title: 'Firebase JS SDK Incompatibility',
    description: 'Firebase JS SDK for Auth is incompatible with Metro\'s package.json:exports in SDK 53',
    severity: 'critical',
    affectedPackages: ['firebase', '@firebase/auth', '@firebase/firestore'],
    solution: [
      'Migrate to React Native Firebase',
      'npm uninstall firebase @firebase/auth @firebase/firestore',
      'npx expo install @react-native-firebase/app @react-native-firebase/auth',
      'Update all Firebase imports and syntax'
    ],
    codeExample: {
      before: `import { signInWithEmailAndPassword } from 'firebase/auth';
await signInWithEmailAndPassword(auth, email, password);`,
      after: `import auth from '@react-native-firebase/auth';
await auth().signInWithEmailAndPassword(email, password);`
    }
  },
  {
    title: 'expo-notifications config plugin required',
    description: 'iOS notifications fail without expo-notifications in plugins array (undocumented)',
    severity: 'major',
    affectedPackages: ['expo-notifications'],
    solution: [
      'Add "expo-notifications" to plugins array in app.json',
      'Even if not customizing notification settings',
      'Required for iOS push notifications to work'
    ]
  },
  {
    title: 'Edge-to-Edge Display for Android',
    description: 'Edge-to-edge on Android is enabled by default in Expo Go and new projects',
    severity: 'moderate',
    solution: [
      'For existing projects, install react-native-edge-to-edge',
      'Update layouts to handle edge-to-edge display',
      'Test on devices with notches/cutouts'
    ]
  },
  {
    title: 'AppDelegate Moved to Swift',
    description: 'AppDelegate has moved from Objective-C to Swift',
    severity: 'major',
    solution: [
      'Update config plugins that modify AppDelegate',
      'Use Swift syntax instead of Objective-C',
      'Test iOS builds thoroughly'
    ]
  },
  {
    title: 'expo-av Deprecated',
    description: 'expo-av is deprecated, Video component replaced by expo-video, Audio API replaced by expo-audio',
    severity: 'major',
    affectedPackages: ['expo-av'],
    solution: [
      'npm uninstall expo-av',
      'npx expo install expo-video expo-audio',
      'Migrate Video components to expo-video',
      'Migrate Audio API to expo-audio'
    ]
  },
  {
    title: 'Push Notifications Removed from Expo Go (Android)',
    description: 'Push notifications are no longer supported in Expo Go for Android',
    severity: 'moderate',
    solution: [
      'Use development builds for testing push notifications',
      'Set up proper push notification configuration',
      'Follow push notification setup guide'
    ]
  },
  {
    title: 'Android Package Name Deep Linking',
    description: 'Android package name is no longer automatically added as a linking scheme',
    severity: 'minor',
    solution: [
      'Manually add to app.json if needed:',
      '{ "android": { "scheme": ["your.package.name"] } }'
    ]
  },
  {
    title: 'expo-router/babel Plugin Deprecated',
    description: 'The expo-router/babel plugin is deprecated in SDK 50+ and should be removed from babel.config.js',
    severity: 'minor',
    affectedPackages: ['expo-router'],
    solution: [
      'Remove "expo-router/babel" from plugins array in babel.config.js',
      'The plugin is now automatically included in babel-preset-expo',
      'Keeping it causes deprecation warnings during bundling'
    ],
    codeExample: {
      before: `// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'expo-router/babel',  // ❌ Remove this
      'react-native-reanimated/plugin'
    ]
  };
};`,
      after: `// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // expo-router/babel removed (now in babel-preset-expo)
      'react-native-reanimated/plugin'  // ✅ Must be last
    ]
  };
};`
    }
  }
];

export const PACKAGE_SPECIFIC_ISSUES: Record<string, BreakingChange> = {
  'babel-plugin-module-resolver': {
    title: 'Missing Babel Plugin Module Resolver',
    description: 'SDK 53 requires babel-plugin-module-resolver but it may not be installed automatically',
    severity: 'critical',
    solution: [
      'Install as dev dependency: npm install --save-dev babel-plugin-module-resolver',
      'Or with yarn: yarn add -D babel-plugin-module-resolver',
      'This is required for path aliasing in babel.config.js'
    ]
  },
  '@supabase/supabase-js': {
    title: 'Supabase WebSocket Issues',
    description: 'Supabase attempts to import Node standard library modules (events, stream)',
    severity: 'critical',
    solution: [
      'Update to @supabase/supabase-js@2.49.5 or later',
      'Or disable package exports in metro.config.js',
      'config.resolver.unstable_enablePackageExports = false'
    ]
  },
  'axios': {
    title: 'Axios Node Crypto Module',
    description: 'Axios attempts to import Node standard library module "crypto"',
    severity: 'major',
    solution: [
      'Disable package exports in metro.config.js',
      'Or configure Metro to use browser version',
      'Update to latest axios version'
    ]
  },
  'socket.io-client': {
    title: 'Socket.io WebSocket Issues',
    description: 'Socket.io uses ws which imports Node modules',
    severity: 'major',
    solution: [
      'Disable package exports in metro.config.js',
      'Or use a React Native compatible WebSocket library'
    ]
  },
  '@stripe/stripe-react-native': {
    title: 'Stripe New Architecture',
    description: 'Stripe does not yet fully support the New Architecture',
    severity: 'moderate',
    solution: [
      'Update to @stripe/react-native@0.45.0 or later',
      'Or disable New Architecture if issues persist'
    ]
  }
};

export const FIREBASE_MIGRATION_EXAMPLES = {
  authentication: {
    before: `import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
await signInWithEmailAndPassword(auth, email, password);
await sendEmailVerification(user);`,
    after: `import auth from '@react-native-firebase/auth';
await auth().signInWithEmailAndPassword(email, password);
await user.sendEmailVerification();`
  },
  firestore: {
    before: `import { doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
const userDocRef = doc(firestore, 'users', uid);
const userDoc = await getDoc(userDocRef);
await setDoc(userDocRef, data, { merge: true });`,
    after: `import firestore from '@react-native-firebase/firestore';
const userDocRef = firestore().collection('users').doc(uid);
const userDoc = await userDocRef.get();
await userDocRef.set(data, { merge: true });`
  },
  timestamp: {
    before: `serverTimestamp()`,
    after: `firestore.FieldValue.serverTimestamp()`
  }
};

export const SDK53_UPGRADE_CHECKLIST = [
  'Update Expo CLI: npm i -g eas-cli',
  'Update SDK: npx expo install expo@^53.0.0 --fix',
  'Clean builds: rm -rf node_modules ios android',
  'Reinstall: npm install',
  'Prebuild: npx expo prebuild --clean',
  'Update TypeScript to ~5.8.3',
  'Run expo-doctor: npx expo-doctor@latest',
  'Update Xcode to 16.2+ for iOS builds',
  'Handle React peer dependencies',
  'Migrate Firebase if using Firebase JS SDK',
  'Update config plugins for Swift AppDelegate',
  'Test New Architecture or opt out',
  'Update audio/video from expo-av to expo-audio/expo-video'
];

export function getBreakingChangeForPackage(packageName: string): BreakingChange | undefined {
  return PACKAGE_SPECIFIC_ISSUES[packageName];
}

export function getAllCriticalChanges(): BreakingChange[] {
  return SDK53_MAJOR_BREAKING_CHANGES.filter(change => change.severity === 'critical');
}

export function getMetroConfigFix(): string {
  return `// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for Supabase, Firebase, and other package.json:exports issues
config.resolver.unstable_enablePackageExports = false;

// Alternative: Use browser version for specific packages
// config.resolver.resolveRequest = function(context, moduleImport, platform) {
//   if (moduleImport === '@supabase/supabase-js' || moduleImport.startsWith('@supabase/')) {
//     return context.resolveRequest(
//       { ...context, unstable_conditionNames: ['browser'] },
//       moduleImport,
//       platform
//     );
//   }
//   return context.resolveRequest(context, moduleImport, platform);
// };

module.exports = config;`;
}
