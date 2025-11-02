import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { log } from '../utils/logger';
import { BreakingChange } from '../data/breaking-changes';

export interface FixResult {
  successful: number;
  failed: number;
  files: string[];
  errors: string[];
}

export class CodeFixer {
  private projectPath: string;
  private fixedFiles: Set<string>;

  constructor(projectPath?: string) {
    this.projectPath = projectPath || process.cwd();
    this.fixedFiles = new Set();
  }

  public async applyFixes(
    breakingChanges: BreakingChange[],
    dryRun = false
  ): Promise<FixResult> {
    const result: FixResult = {
      successful: 0,
      failed: 0,
      files: [],
      errors: []
    };

    // Note: Auto-fix capability for breaking changes has been removed
    // Breaking changes now require manual fixes following the provided steps
    // This method is kept for backward compatibility but does nothing
    log.debug('Auto-fix for breaking changes is not available - manual fixes required');

    return result;
  }

  // Removed: applyCodePatterns method - auto-fix capability no longer supported
  // Breaking changes now require manual fixes following the provided steps

  private async findSourceFiles(extensions: string[]): Promise<string[]> {
    const patterns = extensions.map(ext => `**/*${ext}`);
    
    const files = await glob(patterns, {
      cwd: this.projectPath,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.expo/**',
        '**/coverage/**'
      ],
      absolute: true
    });

    return files;
  }

  private async applyPatternToFile(
    filePath: string,
    pattern: RegExp,
    replacement: string,
    dryRun: boolean
  ): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check if pattern matches
      if (!pattern.test(content)) {
        return false;
      }

      // Apply replacement
      const newContent = content.replace(pattern, replacement);

      if (newContent === content) {
        return false;
      }

      if (!dryRun) {
        await fs.writeFile(filePath, newContent, 'utf-8');
      }

      log.debug(`Fixed: ${path.relative(this.projectPath, filePath)}`);
      return true;

    } catch (error) {
      log.warn(`Failed to process ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Generate instructions for breaking changes that can't be auto-fixed
   * (AST transformations removed from MVP - manual instructions only)
   */
  public getManualInstructions(fromSdk: string, toSdk: string): string[] {
    const instructions: string[] = [];

    // Camera API changes (SDK 49 -> 50)
    if (parseInt(fromSdk) <= 49 && parseInt(toSdk) >= 50) {
      instructions.push(
        'Camera.Constants.Type → Use CameraType from expo-camera instead',
        'Example: Replace Camera.Constants.Type.back with CameraType.back'
      );
    }

    // Location API changes (SDK 50 -> 51)
    if (parseInt(fromSdk) <= 50 && parseInt(toSdk) >= 51) {
      instructions.push(
        'Location.requestPermissionsAsync() → Location.requestForegroundPermissionsAsync()',
        'Location.getPermissionsAsync() → Location.getForegroundPermissionsAsync()'
      );
    }

    return instructions;
  }

  public async fixImports(
    filePath: string,
    importChanges: Map<string, string>,
    dryRun = false
  ): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      let newContent = content;
      let modified = false;

      for (const [oldImport, newImport] of importChanges) {
        const importRegex = new RegExp(
          `(import\\s+(?:{[^}]*}|\\*\\s+as\\s+\\w+|\\w+)\\s+from\\s+['"])${oldImport}(['"])`,
          'g'
        );

        if (importRegex.test(newContent)) {
          newContent = newContent.replace(importRegex, `$1${newImport}$2`);
          modified = true;
        }
      }

      if (modified && !dryRun) {
        await fs.writeFile(filePath, newContent, 'utf-8');
        log.debug(`Fixed imports in: ${path.relative(this.projectPath, filePath)}`);
      }

      return modified;

    } catch (error) {
      log.warn(`Failed to fix imports in ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Fix babel.config.js to ensure Reanimated plugin is last and remove deprecated plugins
   * CRITICAL: Reanimated plugin MUST be last or animations break
   * SDK 50+: expo-router/babel is deprecated (now included in babel-preset-expo)
   */
  public async fixBabelConfig(dryRun = false): Promise<boolean> {
    const babelConfigPath = path.join(this.projectPath, 'babel.config.js');
    
    // If no babel.config.js exists, nothing to fix
    if (!await fs.pathExists(babelConfigPath)) {
      log.debug('No babel.config.js found');
      return false;
    }

    try {
      const content = await fs.readFile(babelConfigPath, 'utf-8');
      const fixes: string[] = [];
      
      // Parse the plugins array
      const pluginsMatch = content.match(/plugins:\s*\[([\s\S]*?)\]/);
      
      if (!pluginsMatch) {
        log.debug('Could not parse plugins array in babel.config.js');
        return false;
      }

      const pluginsContent = pluginsMatch[1];
      
      // Split by commas (simple approach - works for most cases)
      const pluginLines = pluginsContent
        .split(',')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Step 1: Remove deprecated plugins
      const deprecatedPlugins = [
        { name: 'expo-router/babel', reason: 'now included in babel-preset-expo (SDK 50+)' },
        // Add more deprecated plugins here as needed
      ];

      const originalLength = pluginLines.length;
      
      for (const deprecated of deprecatedPlugins) {
        const deprecatedIndex = pluginLines.findIndex(line => 
          line.includes(deprecated.name)
        );
        
        if (deprecatedIndex !== -1) {
          pluginLines.splice(deprecatedIndex, 1);
          fixes.push(`Removed deprecated ${deprecated.name} plugin (${deprecated.reason})`);
        }
      }

      // Step 2: Ensure Reanimated plugin is last (if it exists)
      const reanimatedIndex = pluginLines.findIndex(line => 
        line.includes('react-native-reanimated/plugin')
      );

      if (reanimatedIndex !== -1) {
        const lastPluginIndex = pluginLines.length - 1;
        
        if (reanimatedIndex !== lastPluginIndex) {
          // Need to move Reanimated to last position
          const reanimatedPlugin = pluginLines[reanimatedIndex];
          pluginLines.splice(reanimatedIndex, 1);
          pluginLines.push(reanimatedPlugin);
          fixes.push('Moved Reanimated plugin to last position (CRITICAL for animations)');
          log.info('Reanimated plugin is not last - this will break animations!');
        }
      }

      // Check if any fixes were applied
      if (fixes.length === 0) {
        log.debug('babel.config.js is already up to date');
        return false;
      }

      // Reconstruct the plugins array
      const newPluginsContent = pluginLines.length > 0 
        ? pluginLines.join(',\n    ')
        : '';
      
      const newContent = content.replace(
        /plugins:\s*\[([\s\S]*?)\]/,
        pluginLines.length > 0 
          ? `plugins: [\n    ${newPluginsContent}\n  ]`
          : `plugins: []`
      );

      if (newContent === content) {
        return false;
      }

      if (!dryRun) {
        await fs.writeFile(babelConfigPath, newContent, 'utf-8');
        this.fixedFiles.add(babelConfigPath);
      }

      log.success(`✅ Fixed babel.config.js (${fixes.length} issue${fixes.length > 1 ? 's' : ''})`);
      fixes.forEach(fix => log.bullet(fix));
      
      return true;

    } catch (error) {
      log.warn('Failed to fix babel.config.js:', error);
      return false;
    }
  }

  /**
   * Detect babel.config.js issues without fixing them
   * Returns array of detected issues
   */
  public async detectBabelConfigIssues(): Promise<string[]> {
    const babelConfigPath = path.join(this.projectPath, 'babel.config.js');
    const issues: string[] = [];
    
    if (!await fs.pathExists(babelConfigPath)) {
      return issues;
    }

    try {
      const content = await fs.readFile(babelConfigPath, 'utf-8');

      // Parse the plugins array
      const pluginsMatch = content.match(/plugins:\s*\[([\s\S]*?)\]/);
      
      if (!pluginsMatch) {
        issues.push('Could not parse plugins array - manual check needed');
        return issues;
      }

      const pluginsContent = pluginsMatch[1];
      const pluginLines = pluginsContent
        .split(',')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Check for deprecated plugins
      const deprecatedPlugins = [
        { name: 'expo-router/babel', reason: 'now included in babel-preset-expo (SDK 50+)' },
      ];

      for (const deprecated of deprecatedPlugins) {
        if (pluginLines.some(line => line.includes(deprecated.name))) {
          issues.push(
            `Deprecated plugin detected: ${deprecated.name} (${deprecated.reason})`
          );
        }
      }

      // Check if Reanimated plugin exists and is last
      const reanimatedIndex = pluginLines.findIndex(line => 
        line.includes('react-native-reanimated/plugin')
      );

      if (reanimatedIndex !== -1) {
        const lastPluginIndex = pluginLines.length - 1;
        
        if (reanimatedIndex !== lastPluginIndex) {
          issues.push(
            'Reanimated plugin is not last in plugins array - WILL BREAK ANIMATIONS! ' +
            `(currently at position ${reanimatedIndex + 1} of ${pluginLines.length})`
          );
        }
      }

    } catch (error) {
      log.warn('Failed to detect babel.config.js issues:', error);
    }

    return issues;
  }

  /**
   * Comprehensive metro.config.js fixes for SDK 46+
   * Fix #1: Old import path (@expo/metro-config → expo/metro-config)
   * Fix #2: Missing __dirname in getDefaultConfig()
   * Fix #3: Deprecated options (assetPlugins, minifierPath)
   */
  public async fixMetroConfig(dryRun = false): Promise<boolean> {
    const metroConfigPath = path.join(this.projectPath, 'metro.config.js');
    
    // If no metro.config.js exists, nothing to fix (using defaults)
    if (!await fs.pathExists(metroConfigPath)) {
      log.debug('No metro.config.js found - using defaults');
      return false;
    }

    try {
      let content = await fs.readFile(metroConfigPath, 'utf-8');
      const originalContent = content;
      const fixes: string[] = [];

      // Fix #1: Old import path
      if (content.includes('@expo/metro-config')) {
        content = content.replace(
          /require\(['"]@expo\/metro-config['"]\)/g,
          "require('expo/metro-config')"
        );
        fixes.push('Updated import: @expo/metro-config → expo/metro-config');
      }

      // Fix #2: Missing __dirname in getDefaultConfig()
      // Match: getDefaultConfig() but not getDefaultConfig(__dirname)
      if (/getDefaultConfig\(\s*\)/.test(content)) {
        content = content.replace(
          /getDefaultConfig\(\s*\)/g,
          'getDefaultConfig(__dirname)'
        );
        fixes.push('Added missing __dirname parameter to getDefaultConfig()');
      }

      // Fix #3: Remove deprecated assetPlugins
      if (content.includes('assetPlugins')) {
        // Remove lines with assetPlugins
        content = content.replace(
          /.*config\.transformer\.assetPlugins.*\n?/g,
          ''
        );
        fixes.push('Removed deprecated assetPlugins option');
      }

      // Fix #4: Remove deprecated minifierPath (unless it's custom)
      if (content.includes('minifierPath') && !content.includes('custom-minifier')) {
        const minifierMatch = content.match(/config\.transformer\.minifierPath\s*=\s*['"]([^'"]+)['"]/);
        if (minifierMatch && minifierMatch[1].includes('metro')) {
          // Only remove if it's the default metro minifier
          content = content.replace(
            /.*config\.transformer\.minifierPath.*\n?/g,
            ''
          );
          fixes.push('Removed deprecated default minifierPath');
        }
      }

      // Check if any fixes were applied
      if (content === originalContent) {
        log.debug('metro.config.js is already up to date');
        return false;
      }

      if (!dryRun) {
        await fs.writeFile(metroConfigPath, content, 'utf-8');
        this.fixedFiles.add(metroConfigPath);
      }

      log.success(`✅ Fixed metro.config.js (${fixes.length} issue${fixes.length > 1 ? 's' : ''})`);
      fixes.forEach(fix => log.bullet(fix));
      
      return true;

    } catch (error) {
      log.warn('Failed to fix metro.config.js:', error);
      return false;
    }
  }

  /**
   * Detect metro.config.js issues without fixing them
   * Returns array of detected issues
   */
  public async detectMetroConfigIssues(): Promise<string[]> {
    const metroConfigPath = path.join(this.projectPath, 'metro.config.js');
    const issues: string[] = [];
    
    if (!await fs.pathExists(metroConfigPath)) {
      return issues;
    }

    try {
      const content = await fs.readFile(metroConfigPath, 'utf-8');

      // Issue #1: Old import path
      if (content.includes("require('@expo/metro-config')")) {
        issues.push('Old import path: @expo/metro-config (should be expo/metro-config)');
      }

      // Issue #2: Missing __dirname
      if (/getDefaultConfig\(\s*\)/.test(content)) {
        issues.push('Missing __dirname parameter in getDefaultConfig() - will cause build failures in SDK 50+');
      }

      // Issue #3: Deprecated assetPlugins
      if (content.includes('assetPlugins')) {
        issues.push('Deprecated assetPlugins option detected');
      }

      // Issue #4: Deprecated minifierPath
      if (content.includes('minifierPath') && !content.includes('custom-minifier')) {
        const minifierMatch = content.match(/config\.transformer\.minifierPath\s*=\s*['"]([^'"]+)['"]/);
        if (minifierMatch && minifierMatch[1].includes('metro')) {
          issues.push('Deprecated default minifierPath option detected');
        }
      }

      // Issue #5: Old module.exports pattern (direct export)
      if (/module\.exports\s*=\s*getDefaultConfig/.test(content)) {
        issues.push('Direct module.exports pattern detected (consider using IIFE pattern for SDK 50+)');
      }

    } catch (error) {
      log.warn('Failed to detect metro.config.js issues:', error);
    }

    return issues;
  }

  public async generateFixReport(): Promise<string> {
    const report: string[] = [
      '# Simple Code Fix Report',
      '',
      `Total files fixed: ${this.fixedFiles.size}`,
      '',
      '## Files Modified (via regex replacement):',
      ''
    ];

    for (const file of this.fixedFiles) {
      report.push(`- ${path.relative(this.projectPath, file)}`);
    }

    report.push('');
    report.push('## Note:');
    report.push('Complex code transformations require manual fixes.');
    report.push('See breaking changes documentation for detailed instructions.');

    return report.join('\n');
  }
}
