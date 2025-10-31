import * as fs from 'fs-extra';
import * as path from 'path';
import { AutoFixIssue } from './interactive-auto-fix';
import { CodeFixer } from '../upgraders/code-fixer';

export async function collectAutoFixes(projectPath: string, targetSdk: string): Promise<AutoFixIssue[]> {
  const issues: AutoFixIssue[] = [];
  const fixer = new CodeFixer(projectPath);

  // 1. Check app.json for configuration issues
  const appJsonPath = path.join(projectPath, 'app.json');
  if (await fs.pathExists(appJsonPath)) {
    const { autoFixAppJson } = await import('./app-json-fixer');
    const appJson = await fs.readJson(appJsonPath);
    const { fixed, changes } = autoFixAppJson(appJson, parseInt(targetSdk));

    // Filter out warnings and only show actual fixes
    const actualFixes = changes.filter(c => c.type !== 'warning');
    
    if (actualFixes.length > 0) {
      // Group changes by severity
      const criticalChanges = actualFixes.filter(c => 
        c.category === 'Required Fields' || 
        c.field === 'expo.sdkVersion' ||
        c.category === 'iOS Configuration'
      );
      const otherChanges = actualFixes.filter(c => !criticalChanges.includes(c));

      // Create a single issue for all app.json fixes with detailed preview
      const previewBefore: string[] = [];
      const previewAfter: string[] = [];

      actualFixes.forEach(change => {
        if (change.type === 'removed') {
          // Show what's being removed
          if (change.field === 'expo.sdkVersion') {
            const sdkVer = appJson.expo.sdkVersion;
            previewBefore.push(`"sdkVersion": "${sdkVer}"`);
          } else if (change.field === 'expo.androidStatusBar') {
            previewBefore.push('"androidStatusBar": { ... }');
          } else if (change.field === 'expo.facebookScheme') {
            const scheme = appJson.expo.facebookScheme;
            previewBefore.push(`"facebookScheme": "${scheme}"`);
          } else {
            previewBefore.push(`"${change.field}": <removed>`);
          }
        } else if (change.type === 'added') {
          // Show what's being added
          if (change.field === 'expo.runtimeVersion') {
            previewAfter.push('"runtimeVersion": { "policy": "appVersion" }');
          } else if (change.field?.includes('expo-build-properties')) {
            previewAfter.push('"expo-build-properties": { "ios": { "deploymentTarget": "15.1" } }');
          } else if (change.field?.includes('infoPlist')) {
            const permission = change.field.split('.').pop();
            previewAfter.push(`"${permission}": "Allow app to access..."`);
          } else {
            previewAfter.push(`"${change.field}": <added>`);
          }
        } else if (change.type === 'fixed') {
          // Show what's being changed
          if (change.field === 'expo.splash') {
            previewBefore.push('"splash": "./path/to/splash.png"');
            previewAfter.push('"splash": { "image": "./path/to/splash.png", "resizeMode": "contain" }');
          } else if (change.field === 'expo.statusBar') {
            previewBefore.push('"androidStatusBar": { ... }');
            previewAfter.push('"statusBar": { ... }');
          } else {
            previewBefore.push(`"${change.field}": <old format>`);
            previewAfter.push(`"${change.field}": <new format>`);
          }
        }
      });

      const severity = criticalChanges.length > 0 ? 'critical' : 'warning';
      
      // Create a concise summary of changes
      const changeSummary = actualFixes.slice(0, 3).map(c => {
        if (c.type === 'removed') return `Remove ${c.field}`;
        if (c.type === 'added') return `Add ${c.field}`;
        return `Fix ${c.field}`;
      }).join(', ') + (actualFixes.length > 3 ? `, +${actualFixes.length - 3} more` : '');

      issues.push({
        severity,
        title: `app.json configuration needs ${actualFixes.length} fix${actualFixes.length > 1 ? 'es' : ''}`,
        file: 'app.json',
        issue: changeSummary,
        impact: criticalChanges.length > 0 
          ? 'Required for SDK compatibility and builds' 
          : 'Recommended for best practices',
        preview: {
          before: previewBefore.length > 0 ? previewBefore : ['Current configuration'],
          after: previewAfter.length > 0 ? previewAfter : ['Updated configuration']
        },
        fix: async () => {
          const backupPath = `${appJsonPath}.backup`;
          await fs.copy(appJsonPath, backupPath);
          await fs.writeJson(appJsonPath, fixed, { spaces: 2 });
          return true;
        }
      });
    }
  }

  // 2. Check android/app/build.gradle for deprecated bundleCommand
  const buildGradlePath = path.join(projectPath, 'android', 'app', 'build.gradle');
  if (await fs.pathExists(buildGradlePath)) {
    const content = await fs.readFile(buildGradlePath, 'utf-8');
    const hasBundleCommand = /bundleCommand\s*=\s*["']export:embed["']/.test(content);
    const hasCliFile = /cliFile\s*=\s*new File\(\["node",\s*"--print",\s*"require\.resolve\('@expo\/cli'\)"\]/.test(content);

    if (hasBundleCommand || hasCliFile) {
      issues.push({
        severity: 'critical',
        title: 'Deprecated bundleCommand detected',
        file: 'android/app/build.gradle',
        issue: 'SDK 53 removed \'export:embed\' command',
        impact: 'Metro bundler will fail to start',
        preview: {
          before: [
            'cliFile = new File(["node", "--print", "require.resolve(\'@expo/cli\')"]...)',
            'bundleCommand = "export:embed"'
          ],
          after: [
            '// Lines removed - SDK 53 uses default bundling'
          ]
        },
        fix: async () => {
          const backupPath = `${buildGradlePath}.backup`;
          await fs.copy(buildGradlePath, backupPath);
          
          let fixedContent = content;
          fixedContent = fixedContent.replace(
            /\s*cliFile\s*=\s*new File\(\["node",\s*"--print",\s*"require\.resolve\('@expo\/cli'\)"\]\.execute\(null,\s*rootDir\)\.text\.trim\(\)\)\s*\n?/g,
            ''
          );
          fixedContent = fixedContent.replace(
            /\s*bundleCommand\s*=\s*["']export:embed["']\s*\n?/g,
            ''
          );
          
          await fs.writeFile(buildGradlePath, fixedContent, 'utf-8');
          return true;
        }
      });
    }
  }

  // 3. Check metro.config.js issues
  const metroConfigPath = path.join(projectPath, 'metro.config.js');
  if (await fs.pathExists(metroConfigPath)) {
    const metroIssues = await fixer.detectMetroConfigIssues();
    
    if (metroIssues.length > 0) {
      const content = await fs.readFile(metroConfigPath, 'utf-8');
      const previewBefore: string[] = [];
      const previewAfter: string[] = [];

      metroIssues.forEach(issue => {
        if (issue.includes('@expo/metro-config')) {
          previewBefore.push('require(\'@expo/metro-config\')');
          previewAfter.push('require(\'expo/metro-config\')');
        }
        if (issue.includes('Missing __dirname')) {
          previewBefore.push('getDefaultConfig()');
          previewAfter.push('getDefaultConfig(__dirname)');
        }
      });

      issues.push({
        severity: 'critical',
        title: 'Metro config import path outdated',
        file: 'metro.config.js',
        issue: metroIssues.join(', '),
        impact: 'Build failures and module resolution errors',
        preview: {
          before: previewBefore,
          after: previewAfter
        },
        fix: async () => {
          const backupPath = `${metroConfigPath}.backup`;
          await fs.copy(metroConfigPath, backupPath);
          await fixer.fixMetroConfig(false);
          return true;
        }
      });
    }
  }

  // 4. Check babel.config.js for Reanimated plugin position
  const babelConfigPath = path.join(projectPath, 'babel.config.js');
  if (await fs.pathExists(babelConfigPath)) {
    const babelIssues = await fixer.detectBabelConfigIssues();
    
    if (babelIssues.length > 0) {
      issues.push({
        severity: 'critical',
        title: 'Reanimated plugin not in last position',
        file: 'babel.config.js',
        issue: 'Reanimated plugin MUST be last in plugins array',
        impact: 'Animations will break completely',
        preview: {
          before: ['react-native-reanimated/plugin (not last)'],
          after: ['react-native-reanimated/plugin (moved to last position)']
        },
        fix: async () => {
          const backupPath = `${babelConfigPath}.backup`;
          await fs.copy(babelConfigPath, backupPath);
          await fixer.fixBabelConfig(false);
          return true;
        }
      });
    }
  }

  // 5. Check for package exports configuration
  if (await fs.pathExists(metroConfigPath)) {
    const content = await fs.readFile(metroConfigPath, 'utf-8');
    if (!content.includes('unstable_enablePackageExports')) {
      issues.push({
        severity: 'critical',
        title: 'Metro package exports not configured',
        file: 'metro.config.js',
        issue: 'SDK 53 requires package exports to be disabled',
        impact: 'Will cause "Cannot find module" errors with Axios, Supabase, Firebase',
        preview: {
          before: [],
          after: ['config.resolver.unstable_enablePackageExports = false;']
        },
        fix: async () => {
          const backupPath = `${metroConfigPath}.backup`;
          await fs.copy(metroConfigPath, backupPath);
          
          let newContent = content;
          const configMatch = content.match(/(const config = getDefaultConfig\([^)]*\);?)/);
          if (configMatch) {
            const insertion = `\n\n// CRITICAL: Disable package exports to prevent Node.js module errors\nconfig.resolver.unstable_enablePackageExports = false;\n`;
            newContent = content.replace(configMatch[0], configMatch[0] + insertion);
          }
          
          await fs.writeFile(metroConfigPath, newContent, 'utf-8');
          return true;
        }
      });
    }
  }

  // 6. Check Android Kotlin version
  const androidBuildGradlePath = path.join(projectPath, 'android', 'build.gradle');
  if (await fs.pathExists(androidBuildGradlePath)) {
    const content = await fs.readFile(androidBuildGradlePath, 'utf-8');
    const kotlinMatch = content.match(/kotlinVersion\s*=\s*["']([^"']+)["']/);
    
    if (kotlinMatch && kotlinMatch[1] !== '2.0.21') {
      issues.push({
        severity: 'critical',
        title: 'Android Kotlin version incorrect',
        file: 'android/build.gradle',
        issue: `Current version: ${kotlinMatch[1]}, Required: 2.0.21`,
        impact: 'Builds will fail with "Key 1.9.24 is missing"',
        preview: {
          before: [`kotlinVersion = "${kotlinMatch[1]}"`],
          after: ['kotlinVersion = "2.0.21"']
        },
        fix: async () => {
          const backupPath = `${androidBuildGradlePath}.backup`;
          await fs.copy(androidBuildGradlePath, backupPath);
          
          const newContent = content.replace(
            /kotlinVersion\s*=\s*["'][^"']+["']/,
            'kotlinVersion = "2.0.21"'
          );
          
          await fs.writeFile(androidBuildGradlePath, newContent, 'utf-8');
          return true;
        }
      });
    }
  }

  // 7. Check TypeScript configuration
  const tsConfigPath = path.join(projectPath, 'tsconfig.json');
  if (await fs.pathExists(tsConfigPath)) {
    const tsConfig = await fs.readJson(tsConfigPath);
    const compilerOptions = tsConfig.compilerOptions || {};
    
    if (compilerOptions.moduleResolution !== 'bundler') {
      issues.push({
        severity: 'warning',
        title: 'TypeScript moduleResolution outdated',
        file: 'tsconfig.json',
        issue: 'SDK 53 requires moduleResolution: "bundler"',
        impact: 'May cause type resolution issues',
        preview: {
          before: [`"moduleResolution": "${compilerOptions.moduleResolution || 'node'}"`],
          after: ['"moduleResolution": "bundler"']
        },
        fix: async () => {
          const backupPath = `${tsConfigPath}.backup`;
          await fs.copy(tsConfigPath, backupPath);
          
          tsConfig.compilerOptions = tsConfig.compilerOptions || {};
          tsConfig.compilerOptions.moduleResolution = 'bundler';
          
          await fs.writeJson(tsConfigPath, tsConfig, { spaces: 2 });
          return true;
        }
      });
    }
  }

  return issues;
}
