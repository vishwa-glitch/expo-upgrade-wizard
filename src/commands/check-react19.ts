import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { log } from '../utils/logger';
import { 
  REACT_19_COMPAT, 
  checkReact19Compatibility,
  fixReact19Compatibility 
} from '../data/package-compatibility';
import inquirer from 'inquirer';
import Table from 'cli-table3';

interface CheckReact19Options {
  fix?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Check and optionally fix React 19 compatibility issues
 * Based on actual peer dependencies from npm registry
 */
export async function checkReact19Command(options: CheckReact19Options = {}): Promise<void> {
  try {
    log.section('🔍 Checking React 19 Compatibility');
    
    const projectRoot = process.cwd();
    const packageJsonPath = path.join(projectRoot, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) {
      log.error('No package.json found in current directory');
      process.exit(1);
    }
    
    const packageJson = await fs.readJson(packageJsonPath);
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    const reactVersion = allDeps.react;
    
    if (!reactVersion) {
      log.error('React not found in dependencies');
      process.exit(1);
    }
    
    // Check if using React 19
    const isReact19 = reactVersion.match(/^(\^|~)?19\./);
    
    if (!isReact19) {
      log.info(`Current React version: ${chalk.cyan(reactVersion)}`);
      log.success('✅ Not using React 19 - no compatibility checks needed');
      return;
    }
    
    log.info(`Current React version: ${chalk.cyan(reactVersion)}`);
    log.info('Checking for packages that require updates for React 19...\n');
    
    // Check all installed packages against React 19 compatibility matrix
    const issues: Array<{
      package: string;
      currentVersion: string;
      requiredVersion: string;
      reason: string;
      peerDependency: string;
    }> = [];
    
    for (const compat of REACT_19_COMPAT) {
      const currentVersion = allDeps[compat.package];
      
      if (currentVersion) {
        const check = checkReact19Compatibility(compat.package, currentVersion, reactVersion);
        
        if (check && !check.compatible) {
          issues.push({
            package: compat.package,
            currentVersion: currentVersion,
            requiredVersion: check.requiredVersion!,
            reason: check.reason!,
            peerDependency: compat.peerDependency
          });
        }
      }
    }
    
    if (issues.length === 0) {
      log.success('✅ All packages are compatible with React 19!');
      
      if (options.verbose) {
        log.section('📦 Checked Packages');
        const checkedPackages = REACT_19_COMPAT
          .filter(c => allDeps[c.package])
          .map(c => `${c.package}@${allDeps[c.package]}`);
        
        if (checkedPackages.length > 0) {
          checkedPackages.forEach(pkg => log.bullet(chalk.green(pkg)));
        } else {
          log.info('No React 19 sensitive packages found in your project');
        }
      }
      
      return;
    }
    
    // Display issues
    log.section(`⚠️  Found ${issues.length} Incompatible Package${issues.length > 1 ? 's' : ''}`);
    
    const table = new Table({
      head: ['Package', 'Current', 'Required', 'Reason'],
      style: { head: ['cyan'] },
      colWidths: [30, 15, 15, 50]
    });
    
    issues.forEach(issue => {
      table.push([
        chalk.yellow(issue.package),
        chalk.red(issue.currentVersion),
        chalk.green(issue.requiredVersion),
        issue.reason
      ]);
    });
    
    console.log(table.toString());
    console.log();
    
    // Show peer dependency info in verbose mode
    if (options.verbose) {
      log.section('📋 Peer Dependency Details');
      issues.forEach(issue => {
        console.log(chalk.yellow(`${issue.package}:`));
        console.log(`  ${issue.peerDependency}`);
      });
      console.log();
    }
    
    // Show why this matters
    log.section('❗ Why This Matters');
    console.log(chalk.yellow('These packages explicitly declare peer dependencies that exclude React 19.'));
    console.log(chalk.yellow('npm/yarn will block installation or show peer dependency errors.'));
    console.log(chalk.yellow('The required versions add React 19 to their peer dependency ranges.\n'));
    
    // Offer to fix
    if (options.fix || !options.dryRun) {
      const { shouldFix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldFix',
          message: 'Would you like to automatically update these packages?',
          default: true
        }
      ]);
      
      if (shouldFix) {
        await applyReact19Fixes(packageJson, packageJsonPath, issues, options);
      } else {
        log.info('\nTo fix manually, update your package.json:');
        issues.forEach(issue => {
          console.log(chalk.cyan(`  "${issue.package}": "${issue.requiredVersion}"`));
        });
      }
    } else {
      log.info('\nRun with --fix to automatically update package.json');
    }
    
  } catch (error) {
    log.error('Failed to check React 19 compatibility:', error);
    process.exit(1);
  }
}

async function applyReact19Fixes(
  packageJson: any,
  packageJsonPath: string,
  issues: any[],
  options: CheckReact19Options
): Promise<void> {
  log.section('🔧 Applying Fixes');
  
  const fixes = fixReact19Compatibility(packageJson);
  
  if (fixes.length === 0) {
    log.warn('No fixes applied');
    return;
  }
  
  if (!options.dryRun) {
    // Backup original package.json
    const backupPath = packageJsonPath + '.react19-backup';
    await fs.copy(packageJsonPath, backupPath);
    log.info(`Backup created: ${chalk.gray(backupPath)}`);
    
    // Write updated package.json
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    log.success('✅ Updated package.json');
  } else {
    log.info('Dry run - no changes made');
  }
  
  // Show what was fixed
  log.section('📝 Changes Applied');
  fixes.forEach(fix => {
    log.bullet(chalk.green(fix));
  });
  
  console.log();
  
  // Next steps
  log.section('📋 Next Steps');
  console.log(chalk.cyan('1. Review the changes in package.json'));
  console.log(chalk.cyan('2. Run: npm install (or yarn/pnpm)'));
  console.log(chalk.cyan('3. Test your app to ensure everything works'));
  
  if (!options.dryRun) {
    console.log(chalk.gray(`\n💡 To restore: mv package.json.react19-backup package.json`));
  }
  
  // Show verification commands
  if (options.verbose) {
    log.section('🔍 Verify Peer Dependencies');
    console.log(chalk.gray('You can verify these changes with:'));
    issues.forEach(issue => {
      const compat = REACT_19_COMPAT.find(c => c.package === issue.package);
      if (compat) {
        console.log(chalk.gray(`  ${compat.verifyCommand}`));
      }
    });
  }
}

/**
 * Detect React 19 compatibility issues without prompting
 * Used internally by upgrade command
 */
export async function detectReact19Issues(projectPath: string): Promise<{
  hasIssues: boolean;
  issues: Array<{
    package: string;
    currentVersion: string;
    requiredVersion: string;
    reason: string;
  }>;
}> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  
  if (!await fs.pathExists(packageJsonPath)) {
    return { hasIssues: false, issues: [] };
  }
  
  const packageJson = await fs.readJson(packageJsonPath);
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  const reactVersion = allDeps.react;
  
  if (!reactVersion || !reactVersion.match(/^(\^|~)?19\./)) {
    return { hasIssues: false, issues: [] };
  }
  
  const issues: Array<{
    package: string;
    currentVersion: string;
    requiredVersion: string;
    reason: string;
  }> = [];
  
  for (const compat of REACT_19_COMPAT) {
    const currentVersion = allDeps[compat.package];
    
    if (currentVersion) {
      const check = checkReact19Compatibility(compat.package, currentVersion, reactVersion);
      
      if (check && !check.compatible) {
        issues.push({
          package: compat.package,
          currentVersion: currentVersion,
          requiredVersion: check.requiredVersion!,
          reason: check.reason!
        });
      }
    }
  }
  
  return {
    hasIssues: issues.length > 0,
    issues
  };
}

/**
 * Auto-fix React 19 compatibility issues
 * Used internally by upgrade command
 */
export async function autoFixReact19(projectPath: string): Promise<{
  fixed: boolean;
  fixes: string[];
}> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  
  if (!await fs.pathExists(packageJsonPath)) {
    return { fixed: false, fixes: [] };
  }
  
  const packageJson = await fs.readJson(packageJsonPath);
  const fixes = fixReact19Compatibility(packageJson);
  
  if (fixes.length > 0) {
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    return { fixed: true, fixes };
  }
  
  return { fixed: false, fixes: [] };
}
