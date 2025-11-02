import { Command } from 'commander';
import chalk from 'chalk';
import { StateManager } from '../utils/state-manager';
import { logger } from '../utils/logger';
import * as path from 'path';

export function createStateCommand(): Command {
  const stateCommand = new Command('state');
  stateCommand.description('Simple rollback to last backup');

  // Rollback to last backup
  stateCommand
    .command('rollback')
    .alias('restore')
    .description('Rollback to last backup state')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const stateManager = new StateManager();
        const targetState = await stateManager.loadState('backup');
        
        if (!targetState) {
          logger.error('No backup state found. Backup is created automatically before upgrades.');
          process.exit(1);
        }

        // Show what will be restored
        console.log(chalk.yellow('⚠️  This will rollback your project to:'));
        console.log(`${chalk.gray('Backup Date:')} ${new Date(targetState.timestamp).toLocaleString()}`);
        console.log(`${chalk.gray('SDK Version:')} ${targetState.currentSdkVersion}`);
        console.log(`${chalk.gray('Git Commit:')} ${targetState.gitCommitHash.substring(0, 8)}`);

        if (!options.yes) {
          const inquirer = await import('inquirer');
          const { confirm } = await inquirer.default.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Are you sure you want to rollback to the last backup?',
              default: false
            }
          ]);

          if (!confirm) {
            logger.info('Rollback cancelled');
            return;
          }
        }

        await stateManager.restoreToState('backup');
        console.log(chalk.green('✓ Project rolled back successfully'));
        console.log(chalk.yellow('⚠️  Don\'t forget to run npm/yarn install to restore dependencies'));
      } catch (error) {
        logger.error('Failed to rollback:', error);
        process.exit(1);
      }
    });

  return stateCommand;
}
