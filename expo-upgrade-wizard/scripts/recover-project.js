#!/usr/bin/env node
/**
 * Recovery script for projects in broken state after failed upgrade
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

const projectPath = process.cwd();

console.log(chalk.bold('\n🔧 Project Recovery Tool\n'));
console.log('This will restore your project to a working state.\n');

// Check if we're in the right directory
if (!fs.existsSync(path.join(projectPath, 'package.json'))) {
  console.error(chalk.red('❌ No package.json found. Please run this from your project root.'));
  process.exit(1);
}

console.log(chalk.blue('📁 Project directory:'), projectPath);

// Step 1: Remove node_modules
console.log(chalk.yellow('\n1. Removing node_modules...'));
const nodeModulesPath = path.join(projectPath, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  try {
    if (process.platform === 'win32') {
      // Windows: use rmdir
      execSync(`rmdir /s /q "${nodeModulesPath}"`, { stdio: 'ignore' });
    } else {
      // Unix: use rm -rf
      execSync(`rm -rf "${nodeModulesPath}"`, { stdio: 'ignore' });
    }
    console.log(chalk.green('  ✓ node_modules removed'));
  } catch (e) {
    console.log(chalk.yellow('  ⚠ Could not remove node_modules, please remove manually'));
  }
} else {
  console.log(chalk.gray('  - node_modules not found (already clean)'));
}

// Step 2: Remove lock files
console.log(chalk.yellow('\n2. Removing lock files...'));
const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
lockFiles.forEach(lockFile => {
  const lockPath = path.join(projectPath, lockFile);
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
    console.log(chalk.green(`  ✓ ${lockFile} removed`));
  }
});

// Step 3: Check for backup branches
console.log(chalk.yellow('\n3. Looking for backups...'));
try {
  const branches = execSync('git branch -a', { encoding: 'utf-8' });
  const backupBranches = branches.split('\n')
    .filter(b => b.includes('backup/pre-sdk-upgrade'))
    .map(b => b.trim());
  
  if (backupBranches.length > 0) {
    console.log(chalk.green('  ✓ Found backup branches:'));
    backupBranches.forEach(b => console.log(`    - ${b}`));
    
    const latestBackup = backupBranches[backupBranches.length - 1]
      .replace('remotes/origin/', '')
      .trim();
    
    // Restore package.json from backup
    console.log(chalk.yellow(`\n4. Restoring package.json from ${latestBackup}...`));
    try {
      execSync(`git checkout ${latestBackup} -- package.json`, { stdio: 'ignore' });
      console.log(chalk.green('  ✓ package.json restored'));
      
      // Also restore app.json if it exists
      try {
        execSync(`git checkout ${latestBackup} -- app.json`, { stdio: 'ignore' });
        console.log(chalk.green('  ✓ app.json restored'));
      } catch (e) {
        // app.json might not exist or not be changed
      }
    } catch (e) {
      console.log(chalk.yellow('  ⚠ Could not restore from git backup'));
      console.log(chalk.gray('    Try manual restore: git checkout backup/[branch-name] -- package.json'));
    }
  } else {
    console.log(chalk.yellow('  ⚠ No git backups found'));
  }
} catch (e) {
  console.log(chalk.yellow('  ⚠ Git not available or not a git repository'));
}

// Step 4: Clear npm cache
console.log(chalk.yellow('\n5. Clearing npm cache...'));
try {
  execSync('npm cache clean --force', { stdio: 'ignore' });
  console.log(chalk.green('  ✓ npm cache cleared'));
} catch (e) {
  console.log(chalk.yellow('  ⚠ Could not clear npm cache'));
}

// Step 5: Reinstall dependencies
console.log(chalk.yellow('\n6. Installing dependencies...'));
console.log(chalk.gray('  This may take a few minutes...\n'));

try {
  // Detect package manager
  let installCommand = 'npm install';
  
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
  
  // Check if yarn is used
  if (fs.existsSync(path.join(projectPath, 'yarn.lock')) || 
      (packageJson.packageManager && packageJson.packageManager.includes('yarn'))) {
    installCommand = 'yarn install';
  }
  
  // Check if pnpm is used
  if (fs.existsSync(path.join(projectPath, 'pnpm-workspace.yaml')) ||
      (packageJson.packageManager && packageJson.packageManager.includes('pnpm'))) {
    installCommand = 'pnpm install';
  }
  
  console.log(chalk.blue(`  Running: ${installCommand}`));
  execSync(installCommand, { stdio: 'inherit' });
  
  console.log(chalk.green('\n✅ Dependencies installed successfully!'));
} catch (e) {
  console.log(chalk.red('\n❌ Installation failed'));
  console.log(chalk.yellow('\nTry running manually:'));
  console.log('  npm install --legacy-peer-deps');
  console.log('  or');
  console.log('  npm install --force');
}

// Final instructions
console.log(chalk.bold.green('\n✨ Recovery complete!\n'));
console.log('Next steps:');
console.log('1. Test your app: ' + chalk.cyan('npx expo start'));
console.log('2. If it works, commit your changes');
console.log('3. When ready to upgrade again:');
console.log('   - First: ' + chalk.cyan('cd ' + path.dirname(projectPath) + '/expo-upgrade-wizard'));
console.log('   - Build: ' + chalk.cyan('npm run build'));
console.log('   - Then: ' + chalk.cyan('npx expo-upgrade-wizard upgrade --clean-install'));

console.log(chalk.gray('\n💡 The --clean-install flag will ensure a clean upgrade'));
