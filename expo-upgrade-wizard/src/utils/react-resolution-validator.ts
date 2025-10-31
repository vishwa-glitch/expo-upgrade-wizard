import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface ReactResolutionIssue {
  type: 'missing' | 'devOnly' | 'duplicate' | 'corrupted' | 'typesOnly';
  severity: 'critical' | 'warning';
  message: string;
  fix: string;
}

export interface ReactValidationResult {
  isValid: boolean;
  issues: ReactResolutionIssue[];
  reactVersion?: string;
  reactNativeVersion?: string;
}

export class ReactResolutionValidator {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Validates React installation and resolution
   */
  async validate(): Promise<ReactValidationResult> {
    const issues: ReactResolutionIssue[] = [];
    let reactVersion: string | undefined;
    let reactNativeVersion: string | undefined;

    // Check 1: Verify React exists in node_modules
    const reactPackageJsonPath = path.join(this.projectRoot, 'node_modules', 'react', 'package.json');
    if (!fs.existsSync(reactPackageJsonPath)) {
      issues.push({
        type: 'missing',
        severity: 'critical',
        message: 'React package not found in node_modules',
        fix: 'Run: npm install react'
      });
    } else {
      try {
        const reactPackageJson = JSON.parse(fs.readFileSync(reactPackageJsonPath, 'utf-8'));
        reactVersion = reactPackageJson.version;
      } catch (error) {
        issues.push({
          type: 'corrupted',
          severity: 'critical',
          message: 'React package.json is corrupted or unreadable',
          fix: 'Run: rm -rf node_modules && npm install'
        });
      }
    }

    // Check 2: Verify React is in dependencies (not just devDependencies)
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        const hasReactInDeps = packageJson.dependencies?.react;
        const hasReactInDevDeps = packageJson.devDependencies?.react;
        
        if (!hasReactInDeps && hasReactInDevDeps) {
          issues.push({
            type: 'devOnly',
            severity: 'critical',
            message: 'React is only in devDependencies, should be in dependencies',
            fix: 'Move React to dependencies in package.json'
          });
        } else if (!hasReactInDeps && !hasReactInDevDeps) {
          issues.push({
            type: 'missing',
            severity: 'critical',
            message: 'React not found in package.json dependencies',
            fix: 'Run: npm install react'
          });
        }

        // Check React Native as well
        if (packageJson.dependencies?.['react-native']) {
          reactNativeVersion = packageJson.dependencies['react-native'];
        }
      } catch (error) {
        // Package.json read error - non-critical for this check
      }
    }

    // Check 3: Detect duplicate React versions
    try {
      const npmLsOutput = execSync('npm ls react --depth=0 --json', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const npmLsData = JSON.parse(npmLsOutput);
      if (npmLsData.problems && npmLsData.problems.length > 0) {
        const duplicateProblems = npmLsData.problems.filter((p: string) => 
          p.includes('duplicate') || p.includes('extraneous')
        );
        
        if (duplicateProblems.length > 0) {
          issues.push({
            type: 'duplicate',
            severity: 'warning',
            message: 'Multiple React versions detected in dependency tree',
            fix: 'Run: npm dedupe or check for conflicting dependencies'
          });
        }
      }
    } catch (error) {
      // npm ls can fail for various reasons, not critical
    }

    // Check 4: Verify @types/react doesn't shadow react
    const typesReactPath = path.join(this.projectRoot, 'node_modules', '@types', 'react', 'package.json');
    if (fs.existsSync(typesReactPath) && !fs.existsSync(reactPackageJsonPath)) {
      issues.push({
        type: 'typesOnly',
        severity: 'critical',
        message: '@types/react exists but react package is missing - Metro will resolve incorrectly',
        fix: 'Run: npm install react'
      });
    }

    const isValid = issues.filter(i => i.severity === 'critical').length === 0;

    return {
      isValid,
      issues,
      reactVersion,
      reactNativeVersion
    };
  }

  /**
   * Prints validation results to console
   */
  printResults(result: ReactValidationResult): void {
    console.log(chalk.bold('\n🔍 React Resolution Validation\n'));

    if (result.reactVersion) {
      console.log(chalk.green(`✓ React version: ${result.reactVersion}`));
    }
    if (result.reactNativeVersion) {
      console.log(chalk.green(`✓ React Native version: ${result.reactNativeVersion}`));
    }

    if (result.issues.length === 0) {
      console.log(chalk.green('\n✓ All React resolution checks passed!\n'));
      return;
    }

    console.log(chalk.yellow(`\n⚠️  Found ${result.issues.length} issue(s):\n`));

    result.issues.forEach((issue, index) => {
      const icon = issue.severity === 'critical' ? '❌' : '⚠️';
      const color = issue.severity === 'critical' ? chalk.red : chalk.yellow;
      
      console.log(color(`${icon} ${issue.message}`));
      console.log(chalk.gray(`   Fix: ${issue.fix}\n`));
    });

    if (!result.isValid) {
      console.log(chalk.red('❌ Critical issues found. Please fix before building.\n'));
    }
  }
}
