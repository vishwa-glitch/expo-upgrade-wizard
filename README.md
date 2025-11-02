# 🚀 Expo Upgrade Wizard

[![npm version](https://badge.fury.io/js/expo-upgrade-wizard.svg)](https://www.npmjs.com/package/expo-upgrade-wizard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/vishwa-glitch/expo-upgrade-wizard/workflows/CI/badge.svg)](https://github.com/vishwa-glitch/expo-upgrade-wizard/actions)
[![CodeQL](https://github.com/vishwa-glitch/expo-upgrade-wizard/workflows/CodeQL/badge.svg)](https://github.com/vishwa-glitch/expo-upgrade-wizard/security/code-scanning)
[![Node.js Version](https://img.shields.io/node/v/expo-upgrade-wizard.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A semi-automated CLI tool that streamlines Expo SDK upgrades. For simple to medium projects, it can reduce upgrade time from several hours to 1-3 hours with interactive guidance and automated fixes.

> **✨ FREE & OPEN SOURCE** | MIT Licensed - Free for everyone, personal and commercial use  
> **Enterprise-Ready** | Built for scale, maintained by the community

**Current Version:** 1.0.0 | [View Changelog](CHANGELOG.md)

---

## ✨ Features

- **Automated SDK Upgrades**: One-command upgrade with automatic backups
- **Interactive Auto-Fix System**: Preview, auto-fix, or skip with manual instructions
- **Breaking Changes Detection**: Clear guidance for manual changes
- **Configuration Auto-Fix**: app.json, metro.config.js, babel.config.js, tsconfig.json
- **Git Integration**: Automatic backups and .gitignore management
- **Simple Rollback**: One-command restoration if issues occur

## 🎯 Smart Breaking Change Detection

The wizard includes intelligent breaking change detection that provides **clear guidance** for your upgrade:

- **🎯 Version-Based Analysis**: Detects breaking changes based on SDK versions
- **📋 Actionable Steps**: Clear instructions for each breaking change
- **⏱️ Time Estimates**: Know how long each fix will take
- **📦 Package-Specific**: Only shows changes for packages you actually use

**No setup required** - works out of the box!

## 📦 Installation

```bash
npm install -g expo-upgrade-wizard
```

Or use directly with npx:

```bash
npx expo-upgrade-wizard
```

**100% free for everyone** - personal and commercial use!

## 🚀 Quick Start

### Basic Upgrade

```bash
npx expo-upgrade-wizard upgrade --target-sdk 53
```
i This will:

1. ✅ Update package.json
2. ✅ Run smart installation (Expo-first approach)
3. ✅ Automatically fix React 19 → 18.3.1
4. ✅ Verify all package versions
5. ✅ Show commands used for future reference
6. ✅ Display SDK-specific post-upgrade guide

[📖 See Quick Start Guide →](./QUICK_START.md)

### Command Line Options

```bash
# Check compatibility without upgrading
expo-upgrade-wizard check

# Dry run (preview changes without applying)
expo-upgrade-wizard upgrade --dry-run

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

### `check`

Check project compatibility with target SDK.

**Options:**

- `--detailed` - Show detailed compatibility report

### `state rollback`

Simple rollback to last backup state.

**Options:**

- `-y, --yes` - Skip confirmation prompt



## 📖 Quick Command Reference

| Command | Purpose |
|---------|---------|
| `upgrade` | Upgrade to a new SDK version |
| `check` | Check compatibility before upgrading |
| `state rollback` | Rollback if upgrade fails |

**Pro Tip:** Use `--dry-run` with any command to preview changes before applying!

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

The wizard detects breaking changes and provides clear guidance with an interactive 3-option pattern:

### Interactive Auto-Fix System

All auto-fixable issues follow a consistent pattern:

1. **Option 1: Auto-fix** - Apply fix automatically with backup
2. **Option 2: Preview** - Show detailed changes before applying
3. **Option 3: Skip** - Skip with manual fix instructions

### Auto-Fixable Changes

- Import path updates (Metro, Babel configs)
- Config file migrations (app.json, tsconfig.json)
- Package replacements (@react-native-community → official packages)
- Build configuration updates (Kotlin version, bundleCommand)
- Metro and Babel plugin configurations
- TypeScript moduleResolution settings
- .npmrc configuration

### Manual Changes (With Instructions)

- Camera API updates (Camera.Constants → CameraType)
- Location permission API changes
- Custom native module updates
- New Architecture compatibility
- Complex API migrations

**Note:** All auto-fixes create backups and show previews. Manual instructions provided for all non-trivial changes.

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

## 💾 Backup & Rollback

**Try the CLI risk-free!** Automatic backups are created before every upgrade, allowing you to rollback to your exact state before using the CLI.

```bash
# Rollback to pre-upgrade state (before you ran the CLI)
expo-upgrade-wizard state rollback

# Then reinstall dependencies
npm install
```

**What's backed up:** package.json, app.json, metro.config.js, babel.config.js, tsconfig.json, and Git state.

**Safe to test:** If anything goes wrong, one command restores everything to exactly how it was before you started.

## 🤝 Contributing

We welcome contributions from developers of all skill levels! This project follows enterprise-grade open source practices.

### Quick Start for Contributors

```bash
# Clone the repository
git clone https://github.com/vishwa-glitch/expo-upgrade-wizard.git
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

- 🐛 [Report bugs](https://github.com/vishwa-glitch/expo-upgrade-wizard/issues/new?template=bug_report.md)
- 💡 [Suggest features](https://github.com/vishwa-glitch/expo-upgrade-wizard/issues/new?template=feature_request.md)
- 📝 Improve documentation
- 🔧 Submit pull requests
- 💬 Help others in [Discussions](https://github.com/vishwa-glitch/expo-upgrade-wizard/discussions)
- ⭐ Star the project

See our [Contributing Guide](CONTRIBUTING.md) for detailed information.

## 📚 Documentation

- [Architecture](ARCHITECTURE.md) - System design and architecture
- [Quick Start Guide](QUICK_START.md) - Get started in 5 minutes
- [Changelog](CHANGELOG.md) - Version history
- [Security Policy](SECURITY.md) - Security and vulnerability reporting
- [Governance](GOVERNANCE.md) - Project governance and decision-making
- [Contributing Guide](CONTRIBUTING.md) - How to contribute

## 📄 License

**MIT License** - Free for everyone!

This project is licensed under the MIT License. You are free to:
- ✅ Use for personal projects
- ✅ Use for commercial projects
- ✅ Modify and distribute
- ✅ Use in proprietary software

**Attribution Requirement**: When showcasing this CLI tool publicly (blog posts, presentations, videos, tutorials, etc.), please provide credit to the original project.

Acceptable attribution examples:
- "Built with Expo Upgrade Wizard"
- "Powered by Expo Upgrade Wizard"
- Link to: https://github.com/vishwa-glitch/expo-upgrade-wizard

See [LICENSE](LICENSE) for full details.

## 🙏 Acknowledgments

- **Expo Team** - For creating the amazing Expo framework
- **React Native Community** - For the foundation we build upon
- **Contributors** - Everyone who has contributed code, documentation, or feedback
- **Users** - For trusting us with your upgrades and providing valuable feedback

## 📞 Support & Community

### Get Help

- 📖 [Documentation](https://github.com/vishwa-glitch/expo-upgrade-wizard#readme)
- 💬 [GitHub Discussions](https://github.com/vishwa-glitch/expo-upgrade-wizard/discussions)
- 🐛 [Report Issues](https://github.com/vishwa-glitch/expo-upgrade-wizard/issues)
- 📧 [Email Support](mailto:expo.upgrade.book@gmail.com)

### Support

Need help? Email: [expo.upgrade.book@gmail.com](mailto:expo.upgrade.book@gmail.com)

## 🌟 Star History

If this project helps you, please consider giving it a star! ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=vishwa-glitch/expo-upgrade-wizard&type=Date)](https://star-history.com/#vishwa-glitch/expo-upgrade-wizard&Date)

## 🔒 Security

We take security seriously. If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md).

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/vishwa-glitch/expo-upgrade-wizard?style=social)
![GitHub forks](https://img.shields.io/github/forks/vishwa-glitch/expo-upgrade-wizard?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/vishwa-glitch/expo-upgrade-wizard?style=social)
![GitHub contributors](https://img.shields.io/github/contributors/vishwa-glitch/expo-upgrade-wizard)
![GitHub issues](https://img.shields.io/github/issues/vishwa-glitch/expo-upgrade-wizard)
![GitHub pull requests](https://img.shields.io/github/issues-pr/vishwa-glitch/expo-upgrade-wizard)

---

<div align="center">

**Made with ❤️ by developers, for developers**

[⬆ Back to Top](#-expo-upgrade-wizard)

</div>
