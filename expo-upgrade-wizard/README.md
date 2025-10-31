# 🚀 Expo Upgrade Wizard

[![npm version](https://badge.fury.io/js/expo-upgrade-wizard.svg)](https://www.npmjs.com/package/expo-upgrade-wizard)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![CI](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/workflows/CI/badge.svg)](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/actions)
[![CodeQL](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/workflows/CodeQL/badge.svg)](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/security/code-scanning)
[![Node.js Version](https://img.shields.io/node/v/expo-upgrade-wizard.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A professional CLI tool that automates Expo SDK upgrades, turning a 5-20 hour manual process into a 5-minute automated workflow.

> **⚠️ NON-COMMERCIAL LICENSE** | Free for personal use, requires license for commercial use  
> **Enterprise-Ready Open Source** | Built for scale, maintained by the community

---

## 🔒 License Notice

**This software is FREE for personal, educational, and non-profit use.**

**Commercial use requires a paid license.** See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for details.

- ✅ **FREE:** Personal projects, learning, open source
- 💼 **PAID:** Companies, agencies, freelancers, SaaS products

[Get Commercial License →](COMMERCIAL_LICENSE.md) | [Contact Sales →](mailto:expo.upgrade.book@gmail.com)

---

## ✨ Features (MVP)

- **Automated SDK Upgrades**: Upgrade your Expo SDK with confidence
- **Interactive Auto-Fix (NEW!)**: Fix issues **BEFORE** installation
  - 🎯 Detects critical issues before package installation
  - 💬 Interactive prompts for each fix with clear explanations
  - 👀 Preview changes before applying
  - ⚡ Fixes applied first, installation runs last (faster feedback)
  - 🔴 Shows severity (CRITICAL/WARNING/INFO), file, issue, and impact
  - ✅ Fixes: bundleCommand, metro config, babel config, Kotlin version, TypeScript config
- **Breaking Changes Detection**: Identifies breaking changes with clear manual instructions
- **Smart Dependency Management**: Updates all dependencies to compatible versions
- **Cloud Storage Detection**: Automatically detects OneDrive, Dropbox, Google Drive, and iCloud
  - ⚠️ Warns before upgrade if project is in cloud storage
  - 🔍 Detects EPERM file locking errors during installation
  - 💡 Provides specific recommendations and alternative paths
  - 🛡️ Prevents common installation failures
- **app.json Auto-Fix**: Comprehensive configuration fixes
  - ✅ Removes deprecated fields (sdkVersion, androidStatusBar, facebookScheme)
  - ✅ Adds required fields (runtimeVersion for SDK 50+)
  - ✅ Fixes configuration formats (splash screen string → object)
  - ✅ Configures plugins with default permission messages
  - ✅ Validates platform configurations
- **Babel Config Auto-Fix**: Ensures Reanimated plugin is last (critical for animations)
- **React 19 Compatibility Checker**: Detects and fixes packages incompatible with React 19
  - ✅ Based on actual peer dependencies from npm registry
  - ✅ Auto-fixes Redux Toolkit, react-redux, Reanimated, and more
  - ✅ Prevents installation failures
- **Metro Config Auto-Fix**: Automatically fixes critical metro.config.js issues (SDK 46+)
  - ✅ Updates deprecated import paths
  - ✅ Adds missing `__dirname` parameter (prevents SDK 50+ build failures)
  - ✅ Removes deprecated options (assetPlugins, minifierPath)
- **Build Gradle Auto-Fix**: Fixes deprecated bundleCommand in android/app/build.gradle (SDK 53)
  - ✅ Detects deprecated `export:embed` command
  - ✅ Prevents "commands[command] is not a function" error
  - ✅ Interactive fix with backup and preview options
  - ✅ Affects ~80% of projects upgrading from SDK 49 to SDK 53
- **Git Integration**: Automatic backups and version control
- **Beautiful CLI Interface**: Interactive prompts with progress indicators
- **Simple Rollback**: Easy restoration to last backup if issues occur

## 🎯 Smart Breaking Change Detection

The wizard includes intelligent breaking change detection that provides **clear guidance** for your upgrade:

- **🎯 Version-Based Analysis**: Detects breaking changes based on SDK versions
- **📋 Actionable Steps**: Clear instructions for each breaking change
- **⏱️ Time Estimates**: Know how long each fix will take
- **📦 Package-Specific**: Only shows changes for packages you actually use

**No setup required** - works out of the box!

## 📦 Installation

### For Personal/Non-Commercial Use (FREE)

```bash
npm install -g expo-upgrade-wizard
```

Or use directly with npx:

```bash
npx expo-upgrade-wizard
```

### For Commercial Use

1. [Purchase a commercial license](COMMERCIAL_LICENSE.md)
2. Install the package
3. Use your license key

**Using commercially without a license violates the terms and may result in legal action.**

## 🤖 AI Setup (Optional - Coming Soon)

**Note:** AI-powered analysis is currently in development and not yet available.

When available, you'll be able to enable AI-powered post-upgrade analysis by:

1. Getting a free API key from [OpenRouter.ai](https://openrouter.ai/)
2. Configuring it in your project

**The CLI works perfectly without any AI setup!** All core features (upgrade, check, fix, rollback) work out of the box.

## 🚀 Quick Start

### Basic Upgrade

```bash
npx expo-upgrade-wizard upgrade --target 53
```
i This will:

1. ✅ Update package.json
2. ✅ Run smart installation (Expo-first approach)
3. ✅ Automatically fix React 19 → 18.3.1
4. ✅ Verify all package versions
5. ✅ Show commands used for future reference
6. ✅ Display SDK-specific post-upgrade guide (SDK 50+)

[📖 See Quick Start Guide →](./QUICK_START.md)

### SDK 50 Breaking Changes Guide

If you're upgrading to SDK 50, the wizard automatically shows a comprehensive breaking changes guide. You can also view it anytime:

```bash
npx expo-upgrade-wizard guide-sdk50
```

This displays:
- 🔴 Critical fixes (expo-router/babel, Ionicons, Android config, etc.)
- 🟡 Recommended fixes (Sentry migration, cache clearing)
- 🟢 Optional improvements (expo-dev-client setup)
- 📋 Complete checklist with time estimates
- 🐛 Common issues and solutions

### Interactive Mode

```bash
expo-upgrade-wizard
```

Launches the interactive wizard that will guide you through the upgrade process.

### Command Line Options

```bash
# Upgrade to a specific SDK version
expo-upgrade-wizard upgrade --target-sdk 52

# Check compatibility without upgrading
expo-upgrade-wizard check

# Dry run (preview changes without applying)
expo-upgrade-wizard upgrade --dry-run

# Skip backup creation
expo-upgrade-wizard upgrade --skip-backup

# Rollback to last backup
expo-upgrade-wizard state rollback
```

## 📋 Commands

### `upgrade`

Main command to upgrade your Expo SDK.

**Options:**

- `--target-sdk <version>` - Target SDK version
- `--strategy <type>` - Upgrade strategy (conservative/recommended/aggressive)
- `--install-strategy <type>` - Installation strategy: `expo` (default), `npm`, `legacy`, `force`
- `--dry-run` - Preview changes without applying
- `--skip-backup` - Skip backup creation
- `--skip-install` - Skip npm/yarn install
- `--force` - Force upgrade with uncommitted changes

**Installation Strategies:**

- `expo` (default) - Hybrid Expo-first approach (recommended, avoids Metro issues)
- `npm` - Standard npm install
- `legacy` - Uses `--legacy-peer-deps` (may cause Metro mismatches)
- `force` - Uses `--force` flag (last resort)

[Learn more about installation strategies →](./INSTALLATION_STRATEGY.md)

### `check`

Check project compatibility with target SDK.

**Options:**

- `--target <version>` - Target SDK to check against
- `--detailed` - Show detailed compatibility report

### `state rollback`

Simple rollback to last backup state.

**Options:**

- `-y, --yes` - Skip confirmation prompt

### `check-react19`

Check and fix React 19 compatibility issues based on actual peer dependencies from npm registry.

**Options:**

- `--fix` - Automatically fix incompatible packages
- `--dry-run` - Preview changes without applying
- `-v, --verbose` - Show detailed peer dependency information

**Features:**

- Detects packages that block installation with React 19
- Based on actual peer dependencies (verifiable via `npm view`)
- Auto-fixes Redux Toolkit, react-redux, Reanimated, React Query, and more

### `guide-sdk50`

Display comprehensive SDK 50 breaking changes guide.

**Features:**

- 🔴 Critical fixes with code examples (expo-router/babel, Ionicons, Android config)
- 🟡 Recommended fixes (Sentry migration, cache clearing)
- 🟢 Optional improvements (expo-dev-client setup)
- 📋 Complete checklist with time estimates
- 🐛 Common issues and solutions
- 📚 Official resources and documentation links

**Example:**

```bash
npx expo-upgrade-wizard guide-sdk50
```

The guide is automatically shown when upgrading to SDK 50, but you can view it anytime with this command.

**Example:**

```bash
# Check compatibility
npx expo-upgrade-wizard check-react19

# Auto-fix issues
npx expo-upgrade-wizard check-react19 --fix

# Preview changes
npx expo-upgrade-wizard check-react19 --fix --dry-run
```

### `fix-sdk53`

Detect and fix common SDK 53 issues (Supabase, Firebase, React version, etc.)

**Options:**

- `--dry-run` - Preview changes without applying

**Features:**

- Detects SDK 53 specific issues
- Fixes Supabase compatibility
- Fixes Firebase compatibility
- Handles React version conflicts
- Provides migration guidance

**Example:**

```bash
# Check and fix SDK 53 issues
npx expo-upgrade-wizard fix-sdk53

# Preview changes
npx expo-upgrade-wizard fix-sdk53 --dry-run
```

### `validate-react`

Validate React module resolution and fix common issues.

**Options:**

- `--fix` - Automatically fix issues with clean reinstall
- `-v, --verbose` - Show detailed output

**Features:**

- Validates React module resolution
- Detects duplicate React installations
- Checks for version mismatches
- Offers clean reinstall to fix issues

**Example:**

```bash
# Validate React installation
npx expo-upgrade-wizard validate-react

# Auto-fix issues
npx expo-upgrade-wizard validate-react --fix
```

### `fix-deprecated`

Automatically detect and fix deprecated packages and configuration issues for SDK 53.

**Options:**

- `--dry-run` - Preview changes without applying

**Features:**

- Detects deprecated packages (@react-native-community/\*)
- Suggests official replacements
- Automatically uninstalls old and installs new packages
- Shows migration steps for import updates
- Identifies packages that will be removed in SDK 54
- **🔧 Metro Config Auto-Fix**: Detects and fixes critical metro.config.js issues
  - Old import path: `@expo/metro-config` → `expo/metro-config`
  - Missing `__dirname` in `getDefaultConfig()` (prevents SDK 50+ build failures)
  - Deprecated options: removes `assetPlugins` and `minifierPath`

[📖 Learn more about Metro Config Auto-Fix →](./METRO_CONFIG_AUTO_FIX.md)

**Note:** For comprehensive project diagnostics, use the official `npx expo-doctor@latest` command.

## 🎯 Upgrade Strategies

### Conservative

- Only updates required packages
- Minimal changes to your project
- Safest option for production apps

### Recommended (Default)

- Updates core packages to compatible versions
- Applies recommended fixes
- Best balance of safety and modernization

### Aggressive

- Updates all packages to latest compatible versions
- Applies all available auto-fixes
- Best for new projects or major refactors

## 🔄 Breaking Changes Handling

The wizard detects breaking changes and provides clear guidance:

### Simple Auto-Fixes (Regex-based)

- Simple import path updates
- Basic config file migrations
- Package name replacements

### Manual Changes (With Instructions)

- Camera API updates (Camera.Constants → CameraType)
- Location permission API changes
- Custom native module updates
- New Architecture compatibility
- Complex API migrations

**Note:** Complex AST transformations are not included in MVP. Manual instructions provided for all non-trivial changes.

## 📊 Upgrade Process

```
┌─────────────────────┐
│ 1. Project Analysis │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 2. Backup Creation  │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 3. Dependency Update│
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 4. Config Updates   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 5. Code Fixes       │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 6. Validation       │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 7. Report Generation│
└─────────────────────┘
```

## 🛡️ Safety Features

- **Automatic Backups**: Creates Git branch or zip backup before changes
- **Dry Run Mode**: Preview all changes before applying
- **Simple Rollback**: One-command restoration to last backup
- **Validation Guidance**: Reminds you to run `npx expo-doctor` after upgrade
- **Error Reporting**: Clear error messages with recovery steps

## 💾 Simple Backup & Rollback (MVP)

### How It Works

The CLI maintains a **simple backup system** with just two states: current and last backup. This enables quick rollback without complex state management.

### State Storage Structure

```
project-root/
├── .expo-upgrade-wizard/
│   ├── state/
│   │   ├── current.json    # Current project state
│   │   └── backup.json     # Last backup (before upgrade)
│   └── backups/
│       └── *.zip           # Full project zip backups
```

### What Gets Stored

Each state snapshot includes:

- **Dependencies**: Complete package.json dependencies
- **Configuration Files**: app.json, eas.json, metro.config.js, babel.config.js, tsconfig.json
- **Project Metadata**: SDK versions, React Native version, project type
- **Git Information**: Current branch, commit hash, working directory status

### Automatic Backup

Backup is automatically created:

- **Before upgrades**: Current state saved to `backup.json`
- **Git branch backup**: Creates backup branch (if git repo)
- **Zip backup**: Creates full project zip (if not git repo)

### Simple Rollback

```bash
# Rollback to last backup (with confirmation)
expo-upgrade-wizard state rollback

# Rollback without confirmation
expo-upgrade-wizard state rollback -y
```

### Rollback Process

When you rollback:

1. **File Restoration**: Restores package.json and all config files from backup
2. **Git Rollback**: Attempts to reset to the backup commit (if available)
3. **Dependency Notice**: Reminds you to run `npm install` to restore dependencies

```bash
# Example rollback workflow
expo-upgrade-wizard state rollback
# Confirm the rollback
# Files restored to backup state

npm install  # Restore dependencies
```

### Recovery Scenarios

**Scenario 1: Upgrade Failed**

```bash
# Simple rollback to pre-upgrade state
expo-upgrade-wizard state rollback
npm install
```

**Scenario 2: Want to Try Different Approach**

```bash
# Rollback and try different strategy
expo-upgrade-wizard state rollback
npm install
expo-upgrade-wizard upgrade --strategy conservative
```

**Note:** For advanced state management features (history, diff, export), see roadmap for v2.

## 📝 Configuration

Create a `.env` file in your project root:

```env
# Upgrade Configuration
DEFAULT_STRATEGY=recommended
AUTO_FIX_BREAKING_CHANGES=true
SKIP_VALIDATION=false

# Git Configuration
GIT_AUTO_COMMIT=false
GIT_BACKUP_BRANCH_PREFIX=backup/pre-sdk-upgrade

# Debug Configuration
DEBUG_MODE=false
LOG_LEVEL=info
```

## 🔧 Supported SDK Versions

| SDK Version | React Native | Status     |
| ----------- | ------------ | ---------- |
| 53          | 0.76.0       | Latest     |
| 52          | 0.76.0       | Stable     |
| 51          | 0.74.5       | Stable     |
| 50          | 0.73.6       | Stable     |
| 49          | 0.72.10      | Stable     |
| 48          | 0.71.14      | Deprecated |
| 47          | 0.70.8       | Deprecated |

## 📈 Performance

Average upgrade times:

- Simple project (no breaking changes): ~2 minutes
- Medium project (auto-fixable changes): ~5 minutes
- Complex project (manual fixes needed): ~10-20 minutes

Compare to manual upgrade: 5-20 hours

## 🐛 Troubleshooting

### Common Issues

**Issue**: Uncommitted changes detected

```bash
# Solution 1: Commit your changes
git add . && git commit -m "Pre-upgrade commit"

# Solution 2: Force upgrade (not recommended)
expo-upgrade-wizard upgrade --force
```

**Issue**: Package version conflicts

```bash
# Run official expo-doctor to diagnose
npx expo-doctor

# Check logs for details
cat .expo-upgrade-wizard/logs/upgrade-*.log
```

**Issue**: Build fails after upgrade

```bash
# Clear caches
npx expo start -c

# Reinstall dependencies
rm -rf node_modules
npm install
```

## 🤝 Contributing

We welcome contributions from developers of all skill levels! This project follows enterprise-grade open source practices.

### Quick Start for Contributors

```bash
# Clone the repository
git clone https://github.com/expo-upgrade-wizard/expo-upgrade-wizard.git
cd expo-upgrade-wizard

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run linting
npm run lint

# Format code
npm run format
```

### Ways to Contribute

- 🐛 [Report bugs](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/issues/new?template=bug_report.md)
- 💡 [Suggest features](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/issues/new?template=feature_request.md)
- 📝 Improve documentation
- 🔧 Submit pull requests
- 💬 Help others in [Discussions](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/discussions)
- ⭐ Star the project

See our [Contributing Guide](CONTRIBUTING.md) for detailed information.

## 📚 Documentation

- [Architecture](ARCHITECTURE.md) - System design and architecture
- [Roadmap](ROADMAP.md) - Future plans and features
- [Changelog](CHANGELOG.md) - Version history
- [Security Policy](SECURITY.md) - Security and vulnerability reporting
- [Governance](GOVERNANCE.md) - Project governance and decision-making
- [Contributors](CONTRIBUTORS.md) - Our amazing contributors

## 📄 License

**CC BY-NC-SA 4.0** (Creative Commons Attribution-NonCommercial-ShareAlike 4.0)

This project is licensed for **non-commercial use only**. You are free to:
- ✅ Use for personal projects
- ✅ Use for learning and education
- ✅ Modify and distribute (with attribution)
- ❌ **NOT for commercial use**

For commercial licensing, contact: **expo.upgrade.book@gmail.com**

See [LICENSE](LICENSE) for full details.

## 🙏 Acknowledgments

- **Expo Team** - For creating the amazing Expo framework
- **React Native Community** - For the foundation we build upon
- **Contributors** - Everyone who has contributed code, documentation, or feedback
- **Users** - For trusting us with your upgrades and providing valuable feedback

## 📞 Support & Community

### Get Help

- 📖 [Documentation](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard#readme)
- 💬 [GitHub Discussions](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/discussions)
- 🐛 [Report Issues](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/issues)
- 📧 [Email Support](mailto:expo.upgrade.book@gmail.com)

### Stay Connected

- **Twitter**: [@ExpoUpgradeWiz](https://twitter.com/ExpoUpgradeWiz)
- **Discord**: [Join our community](https://discord.gg/expo-upgrade-wizard) (coming soon)
- **Blog**: [Read our updates](https://expo-upgrade-wizard.dev/blog) (coming soon)

### Enterprise Support

Need priority support, custom integrations, or training?
- 📧 Email: [expo.upgrade.book@gmail.com](mailto:expo.upgrade.book@gmail.com)
- 💼 [Enterprise Plans](https://expo-upgrade-wizard.dev/enterprise) (coming soon)

## 🌟 Star History

If this project helps you, please consider giving it a star! ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=expo-upgrade-wizard/expo-upgrade-wizard&type=Date)](https://star-history.com/#expo-upgrade-wizard/expo-upgrade-wizard&Date)

## 🔒 Security

We take security seriously. If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md).

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/expo-upgrade-wizard/expo-upgrade-wizard?style=social)
![GitHub forks](https://img.shields.io/github/forks/expo-upgrade-wizard/expo-upgrade-wizard?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/expo-upgrade-wizard/expo-upgrade-wizard?style=social)
![GitHub contributors](https://img.shields.io/github/contributors/expo-upgrade-wizard/expo-upgrade-wizard)
![GitHub issues](https://img.shields.io/github/issues/expo-upgrade-wizard/expo-upgrade-wizard)
![GitHub pull requests](https://img.shields.io/github/issues-pr/expo-upgrade-wizard/expo-upgrade-wizard)

---

<div align="center">

**Made with ❤️ by developers, for developers**

[⬆ Back to Top](#-expo-upgrade-wizard)

</div>
