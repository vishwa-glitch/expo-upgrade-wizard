#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf8' });
    if (!silent) {
      console.log(output);
    }
    return output;
  } catch (error) {
    log(`Error executing: ${command}`, colors.red);
    throw error;
  }
}

async function publish() {
  log('\n🚀 Publishing Expo Upgrade Wizard\n', colors.bright + colors.cyan);

  // Step 1: Check for uncommitted changes
  log('1. Checking for uncommitted changes...', colors.yellow);
  try {
    exec('git diff-index --quiet HEAD --');
    log('   ✓ Working directory clean', colors.green);
  } catch {
    log('   ✗ Uncommitted changes detected!', colors.red);
    log('   Please commit or stash your changes before publishing.', colors.red);
    process.exit(1);
  }

  // Step 2: Run tests (if they exist)
  log('\n2. Running tests...', colors.yellow);
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (packageJson.scripts && packageJson.scripts.test && packageJson.scripts.test !== 'echo "Error: no test specified" && exit 1') {
    try {
      exec('npm test');
      log('   ✓ Tests passed', colors.green);
    } catch {
      log('   ✗ Tests failed!', colors.red);
      process.exit(1);
    }
  } else {
    log('   ⚠ No tests configured', colors.yellow);
  }

  // Step 3: Build the project
  log('\n3. Building project...', colors.yellow);
  try {
    exec('npm run build');
    log('   ✓ Build successful', colors.green);
  } catch {
    log('   ✗ Build failed!', colors.red);
    process.exit(1);
  }

  // Step 4: Check if dist folder exists
  log('\n4. Verifying build output...', colors.yellow);
  if (fs.existsSync('dist')) {
    const files = fs.readdirSync('dist');
    log(`   ✓ Found ${files.length} files in dist/`, colors.green);
  } else {
    log('   ✗ dist/ folder not found!', colors.red);
    process.exit(1);
  }

  // Step 5: Update version
  log('\n5. Current version: ' + packageJson.version, colors.cyan);
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const getNewVersion = () => new Promise((resolve) => {
    readline.question('   Enter new version (or press enter to keep current): ', (version) => {
      readline.close();
      resolve(version);
    });
  });

  const newVersion = await getNewVersion();
  
  if (newVersion && newVersion !== packageJson.version) {
    packageJson.version = newVersion;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
    log(`   ✓ Version updated to ${newVersion}`, colors.green);
    
    // Commit version change
    exec(`git add package.json`);
    exec(`git commit -m "chore: bump version to ${newVersion}"`);
    exec(`git tag v${newVersion}`);
    log(`   ✓ Git tag v${newVersion} created`, colors.green);
  }

  // Step 6: Check npm login
  log('\n6. Checking npm authentication...', colors.yellow);
  try {
    const user = exec('npm whoami', true).trim();
    log(`   ✓ Logged in as ${user}`, colors.green);
  } catch {
    log('   ✗ Not logged in to npm!', colors.red);
    log('   Run: npm login', colors.yellow);
    process.exit(1);
  }

  // Step 7: Dry run
  log('\n7. Running npm publish dry-run...', colors.yellow);
  try {
    exec('npm publish --dry-run');
    log('   ✓ Dry run successful', colors.green);
  } catch {
    log('   ✗ Dry run failed!', colors.red);
    process.exit(1);
  }

  // Step 8: Confirm publication
  log('\n' + colors.bright + colors.cyan + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('Ready to publish to npm!', colors.bright + colors.green);
  log('Package: ' + packageJson.name, colors.cyan);
  log('Version: ' + packageJson.version, colors.cyan);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);

  const rl2 = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const confirm = () => new Promise((resolve) => {
    rl2.question('\nPublish to npm? (yes/no): ', (answer) => {
      rl2.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });

  const shouldPublish = await confirm();

  if (shouldPublish) {
    // Step 9: Publish to npm
    log('\n9. Publishing to npm...', colors.yellow);
    try {
      exec('npm publish');
      log('\n   ✓ Successfully published!', colors.bright + colors.green);
      log(`\n   Install with: npm install -g ${packageJson.name}`, colors.cyan);
      log(`   Or use with: npx ${packageJson.name}`, colors.cyan);
      
      // Push to git
      log('\n10. Pushing to git...', colors.yellow);
      exec('git push');
      exec('git push --tags');
      log('   ✓ Pushed to git', colors.green);
      
    } catch (error) {
      log('   ✗ Publish failed!', colors.red);
      console.error(error);
      process.exit(1);
    }
  } else {
    log('\n   Publication cancelled', colors.yellow);
  }

  log('\n✨ Done!\n', colors.bright + colors.green);
}

// Run the publish script
publish().catch(error => {
  log('\n❌ Publish script failed:', colors.red);
  console.error(error);
  process.exit(1);
});
