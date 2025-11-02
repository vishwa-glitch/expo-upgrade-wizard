import chalk from 'chalk';
import { ReactResolutionValidator } from '../utils/react-resolution-validator';
import { CleanReinstaller } from '../utils/clean-reinstall';
import inquirer from 'inquirer';

/**
 * Standalone command to validate React installation
 * Usage: npx expo-upgrade-wizard validate-react
 */
export async function validateReactCommand(options: { fix?: boolean; verbose?: boolean } = {}): Promise<void> {
  const projectRoot = process.cwd();

  console.log(chalk.bold.cyan('\n🔍 React Module Resolution Validator\n'));

  // Run validation
  const validator = new ReactResolutionValidator(projectRoot);
  const result = await validator.validate();
  
  validator.printResults(result);

  // If valid, we're done
  if (result.isValid) {
    console.log(chalk.green('✅ No issues detected. Your React installation is healthy!\n'));
    return;
  }

  // If issues found, offer to fix
  const criticalIssues = result.issues.filter(i => i.severity === 'critical');
  
  if (criticalIssues.length === 0) {
    console.log(chalk.yellow('\n⚠️  Some warnings detected, but no critical issues.\n'));
    return;
  }

  console.log(chalk.red(`\n❌ ${criticalIssues.length} critical issue(s) detected.\n`));

  // Auto-fix if --fix flag provided
  let shouldFix = options.fix || false;

  if (!shouldFix) {
    const { fix } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'fix',
        message: 'Run clean reinstall to fix these issues?',
        default: true
      }
    ]);
    shouldFix = fix;
  }

  if (!shouldFix) {
    console.log(chalk.yellow('\nSkipping fix. Run with --fix flag to automatically fix issues.\n'));
    console.log(chalk.gray('Manual fix steps:\n'));
    result.issues.forEach(issue => {
      console.log(chalk.gray(`  • ${issue.fix}`));
    });
    console.log();
    return;
  }

  // Run clean reinstall
  console.log(chalk.cyan('\n🧹 Running clean reinstall...\n'));
  
  const reinstaller = new CleanReinstaller(projectRoot);
  const success = await reinstaller.cleanReinstall({
    clearMetroCache: true,
    clearExpoCache: true,
    verbose: options.verbose
  });

  if (!success) {
    console.log(chalk.red('\n❌ Clean reinstall failed. Please check the errors above.\n'));
    process.exit(1);
  }

  // Re-validate
  console.log(chalk.cyan('\n🔍 Re-validating React installation...\n'));
  const revalidationResult = await validator.validate();
  validator.printResults(revalidationResult);

  if (revalidationResult.isValid) {
    console.log(chalk.green('\n✅ All issues fixed! Your React installation is now healthy.\n'));
  } else {
    console.log(chalk.yellow('\n⚠️  Some issues remain. Manual intervention may be required.\n'));
    console.log(chalk.gray('Remaining issues:\n'));
    revalidationResult.issues.forEach(issue => {
      console.log(chalk.gray(`  • ${issue.message}`));
      console.log(chalk.gray(`    Fix: ${issue.fix}\n`));
    });
  }
}
