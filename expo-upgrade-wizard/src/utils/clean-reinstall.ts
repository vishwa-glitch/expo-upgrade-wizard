import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export interface CleanReinstallOptions {
  clearMetroCache?: boolean;
  clearExpoCache?: boolean;
  verbose?: boolean;
}

export class CleanReinstaller {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Performs a clean reinstall of dependencies
   */
  async cleanReinstall(options: CleanReinstallOptions = {}): Promise<boolean> {
    const { clearMetroCache = true, clearExpoCache = true, verbose = false } = options;

    try {
      console.log(chalk.bold('\n🧹 Starting Clean Reinstall Process\n'));

      // Step 1: Remove node_modules
      await this.removeNodeModules(verbose);

      // Step 2: Remove lock files
      await this.removeLockFiles(verbose);

      // Step 3: Clear Metro cache
      if (clearMetroCache) {
        await this.clearMetroCache(verbose);
      }

      // Step 4: Clear Expo cache
      if (clearExpoCache) {
        await this.clearExpoCache(verbose);
      }

      // Step 5: Reinstall dependencies
      await this.reinstallDependencies(verbose);

      console.log(chalk.green('\n✓ Clean reinstall completed successfully!\n'));
      return true;
    } catch (error) {
      console.error(chalk.red('\n❌ Clean reinstall failed:'), error);
      return false;
    }
  }

  private async removeNodeModules(verbose: boolean): Promise<void> {
    const spinner = ora('Removing node_modules...').start();
    const nodeModulesPath = path.join(this.projectRoot, 'node_modules');

    try {
      if (fs.existsSync(nodeModulesPath)) {
        if (process.platform === 'win32') {
          execSync(`rmdir /s /q "${nodeModulesPath}"`, { cwd: this.projectRoot, stdio: verbose ? 'inherit' : 'pipe' });
        } else {
          execSync(`rm -rf "${nodeModulesPath}"`, { cwd: this.projectRoot, stdio: verbose ? 'inherit' : 'pipe' });
        }
        spinner.succeed('Removed node_modules');
      } else {
        spinner.info('node_modules not found, skipping');
      }
    } catch (error) {
      spinner.fail('Failed to remove node_modules');
      throw error;
    }
  }

  private async removeLockFiles(verbose: boolean): Promise<void> {
    const spinner = ora('Removing lock files...').start();
    const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    let removed = 0;

    try {
      for (const lockFile of lockFiles) {
        const lockFilePath = path.join(this.projectRoot, lockFile);
        if (fs.existsSync(lockFilePath)) {
          fs.unlinkSync(lockFilePath);
          removed++;
          if (verbose) {
            console.log(chalk.gray(`  Removed ${lockFile}`));
          }
        }
      }

      if (removed > 0) {
        spinner.succeed(`Removed ${removed} lock file(s)`);
      } else {
        spinner.info('No lock files found');
      }
    } catch (error) {
      spinner.fail('Failed to remove lock files');
      throw error;
    }
  }

  private async clearMetroCache(verbose: boolean): Promise<void> {
    const spinner = ora('Clearing Metro cache...').start();

    try {
      // Try multiple methods to clear Metro cache
      const metroCachePaths = [
        path.join(this.projectRoot, '.metro'),
        path.join(this.projectRoot, 'node_modules', '.cache', 'metro'),
      ];

      let cleared = false;
      for (const cachePath of metroCachePaths) {
        if (fs.existsSync(cachePath)) {
          if (process.platform === 'win32') {
            execSync(`rmdir /s /q "${cachePath}"`, { cwd: this.projectRoot, stdio: verbose ? 'inherit' : 'pipe' });
          } else {
            execSync(`rm -rf "${cachePath}"`, { cwd: this.projectRoot, stdio: verbose ? 'inherit' : 'pipe' });
          }
          cleared = true;
        }
      }

      // Also try npx expo start --clear (just the cache clear part)
      try {
        execSync('npx expo start --clear --non-interactive', {
          cwd: this.projectRoot,
          timeout: 5000,
          stdio: 'pipe'
        });
      } catch {
        // This might fail if expo isn't installed yet, that's okay
      }

      if (cleared) {
        spinner.succeed('Cleared Metro cache');
      } else {
        spinner.info('Metro cache not found or already cleared');
      }
    } catch (error) {
      spinner.warn('Could not clear Metro cache (non-critical)');
    }
  }

  private async clearExpoCache(verbose: boolean): Promise<void> {
    const spinner = ora('Clearing Expo cache...').start();

    try {
      const expoCachePaths = [
        path.join(this.projectRoot, '.expo'),
        path.join(this.projectRoot, 'node_modules', '.cache', 'expo'),
      ];

      // NEVER remove the wizard directory - it contains state backups!
      const wizardDir = path.join(this.projectRoot, '.expo-upgrade-wizard');
      
      console.log(chalk.cyan(`[CLEAN-REINSTALL-DEBUG] Checking Expo cache paths...`));
      console.log(chalk.cyan(`[CLEAN-REINSTALL-DEBUG] Wizard dir: ${wizardDir}`));
      console.log(chalk.cyan(`[CLEAN-REINSTALL-DEBUG] Wizard exists: ${fs.existsSync(wizardDir)}`));

      let cleared = false;
      for (const cachePath of expoCachePaths) {
        console.log(chalk.cyan(`[CLEAN-REINSTALL-DEBUG] Checking: ${cachePath}`));
        console.log(chalk.cyan(`[CLEAN-REINSTALL-DEBUG] Path exists: ${fs.existsSync(cachePath)}`));
        console.log(chalk.cyan(`[CLEAN-REINSTALL-DEBUG] Is wizard: ${cachePath === wizardDir}`));
        
        // Skip if this is the wizard directory
        if (cachePath === wizardDir || cachePath.startsWith(wizardDir + path.sep)) {
          console.log(chalk.yellow(`[CLEAN-REINSTALL-DEBUG] ⚠️  Skipping wizard directory!`));
          if (verbose) {
            console.log(chalk.gray(`  Skipped ${cachePath} (contains state backup)`));
          }
          continue;
        }

        if (fs.existsSync(cachePath)) {
          console.log(chalk.red(`[CLEAN-REINSTALL-DEBUG] ⚠️  About to remove: ${cachePath}`));
          if (process.platform === 'win32') {
            execSync(`rmdir /s /q "${cachePath}"`, { cwd: this.projectRoot, stdio: verbose ? 'inherit' : 'pipe' });
          } else {
            execSync(`rm -rf "${cachePath}"`, { cwd: this.projectRoot, stdio: verbose ? 'inherit' : 'pipe' });
          }
          cleared = true;
          console.log(chalk.green(`[CLEAN-REINSTALL-DEBUG] ✓ Removed: ${cachePath}`));
        }
      }

      if (cleared) {
        spinner.succeed('Cleared Expo cache');
      } else {
        spinner.info('Expo cache not found or already cleared');
      }
    } catch (error) {
      spinner.warn('Could not clear Expo cache (non-critical)');
    }
  }

  private async reinstallDependencies(verbose: boolean): Promise<void> {
    const spinner = ora('Reinstalling dependencies...').start();

    try {
      // Detect package manager
      const packageManager = this.detectPackageManager();
      spinner.text = `Reinstalling dependencies with ${packageManager}...`;

      const installCommand = packageManager === 'yarn' ? 'yarn install' : 
                            packageManager === 'pnpm' ? 'pnpm install' : 
                            'npm install';

      execSync(installCommand, {
        cwd: this.projectRoot,
        stdio: verbose ? 'inherit' : 'pipe',
        encoding: 'utf-8'
      });

      spinner.succeed('Dependencies reinstalled successfully');
    } catch (error) {
      spinner.fail('Failed to reinstall dependencies');
      throw error;
    }
  }

  private detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
    if (fs.existsSync(path.join(this.projectRoot, 'yarn.lock'))) {
      return 'yarn';
    }
    if (fs.existsSync(path.join(this.projectRoot, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    return 'npm';
  }
}
