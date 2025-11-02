<!-- Banner -->
<p align="center">
  <h1 align="center">🚀 Expo Upgrade Wizard</h1>
</p>

<p align="center">
  <b>Streamline your Expo SDK upgrades in minutes, not hours</b>
</p>

<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/expo-upgrade-wizard" target="_blank">
    <img alt="NPM version" src="https://img.shields.io/npm/v/expo-upgrade-wizard.svg?style=flat-square&labelColor=000000&color=4630EB" />
  </a>
  <a aria-label="License" href="https://github.com/vishwa-glitch/expo-upgrade-wizard/blob/main/LICENSE" target="_blank">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-success.svg?style=flat-square&color=33CC12" />
  </a>
</p>

<p align="center">
  <a aria-label="Install with npm" href="https://www.npmjs.com/package/expo-upgrade-wizard"><b>Install with npm</b></a>
  &ensp;•&ensp;
  <a aria-label="Documentation" href="#-quick-start">Quick Start Guide</a>
  &ensp;•&ensp;
  <a aria-label="Contributing" href="CONTRIBUTING.md">Contributing</a>
  &ensp;•&ensp;
  <a aria-label="Report issues" href="https://github.com/vishwa-glitch/expo-upgrade-wizard/issues">Report Issues</a>
</p>

---

## Introduction

Expo Upgrade Wizard is an open-source CLI tool that automates Expo SDK upgrades with intelligent breaking change detection and auto-fix capabilities. It reduces upgrade time by 70% while ensuring safety through automatic backups and one-command rollback.

This tool handles dependency updates, configuration migrations, and provides clear guidance for breaking changes - making SDK upgrades straightforward for both individual developers and teams.

## Table of Contents

- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [✨ Features](#-features)
- [📋 Command Reference](#-command-reference)
- [🎯 Upgrade Strategies](#-upgrade-strategies)
- [💾 Backup & Rollback](#-backup--rollback)
- [🗺 How It Works](#-how-it-works)
- [� Coentributing](#-contributing)
- [📚 Documentation](#-documentation)
- [❓ FAQ](#-faq)
- [License](#license)

## 📦 Installation

```bash
# Global installation
npm install -g expo-upgrade-wizard

# Or use with npx (no installation needed)
npx expo-upgrade-wizard
```

**Requirements:** Node.js >= 18.0.0

## 🚀 Quick Start

Upgrade your Expo project to the latest SDK:

```bash
npx expo-upgrade-wizard upgrade --target-sdk 53
```

This single command will:

- Update package.json dependencies
- Install packages using smart Expo-first strategy
- Fix React version conflicts
- Verify all package versions
- Display post-upgrade guide

**Preview changes before applying:**

```bash
npx expo-upgrade-wizard upgrade --target-sdk 53 --dry-run
```

**Check compatibility first:**

```bash
npx expo-upgrade-wizard check
```

Read the [full Quick Start guide](QUICK_START.md) for detailed instructions.

## ✨ Features

### Smart Automation

- ⚡ One-command SDK upgrades
- 🔍 Intelligent breaking change detection
- 🤖 Interactive auto-fix system
- 📊 Real-time progress tracking

### Safety First

- 💾 Automatic backups before changes
- 🔄 One-command rollback
- 👀 Dry-run mode for previews
- ✅ Validation at every step

### Configuration Management

- 📝 Auto-fix app.json
- 🔧 Update metro.config.js
- 🎨 Fix babel.config.js
- 📘 Adjust tsconfig.json

### Developer Experience

- 📋 Clear step-by-step guidance
- ⏱️ Time estimates for each fix
- 📦 Package-specific recommendations
- 🎓 Educational explanations

## 📋 Command Reference

### `upgrade` - Main Upgrade Command

Upgrade your Expo SDK with intelligent automation.

```bash
expo-upgrade-wizard upgrade [options]
```

**Options:**

| Option                      | Description                                            | Default     |
| --------------------------- | ------------------------------------------------------ | ----------- |
| `--target-sdk <version>`    | Target SDK version                                     | Latest      |
| `--strategy <type>`         | Upgrade strategy (conservative/recommended/aggressive) | recommended |
| `--install-strategy <type>` | Installation method (expo/npm/legacy/force)            | expo        |
| `--dry-run`                 | Preview without applying                               | false       |
| `--skip-backup`             | Skip backup creation                                   | false       |
| `--skip-install`            | Skip npm/yarn install                                  | false       |
| `--force`                   | Force with uncommitted changes                         | false       |

**Examples:**

```bash
# Upgrade to specific SDK version
expo-upgrade-wizard upgrade --target-sdk 52

# Preview changes without applying
expo-upgrade-wizard upgrade --dry-run

# Use conservative strategy for production apps
expo-upgrade-wizard upgrade --strategy conservative
```

### `check` - Compatibility Check

Check project compatibility with target SDK before upgrading.

```bash
expo-upgrade-wizard check [--detailed]
```

### `state rollback` - Rollback Changes

Rollback to last backup state if something goes wrong.

```bash
expo-upgrade-wizard state rollback [-y]
```

## 🎯 Upgrade Strategies

Choose the right strategy for your project:

### Conservative

```bash
--strategy conservative
```

- Only required packages
- Minimal changes
- Best for production apps

### Recommended (Default)

```bash
--strategy recommended
```

- Core package updates
- Recommended fixes
- Balanced approach for most projects

### Aggressive

```bash
--strategy aggressive
```

- Latest versions
- All auto-fixes
- Best for new projects

## 💾 Backup & Rollback

Automatic backups are created before every upgrade. If anything goes wrong, restore your project instantly:

```bash
# Rollback to pre-upgrade state
expo-upgrade-wizard state rollback

# Then reinstall dependencies
npm install
```

**What's backed up:** package.json, app.json, metro.config.js, babel.config.js, tsconfig.json, and Git state.

## 🗺 How It Works

The upgrade process follows these steps:

1. **Project Analysis** - Scans your project and dependencies
2. **Backup Creation** - Creates automatic backup (Git branch or zip)
3. **Dependency Update** - Updates packages to target SDK versions
4. **Config Updates** - Migrates configuration files
5. **Code Fixes** - Applies auto-fixes for breaking changes
6. **Validation** - Verifies all changes
7. **Report Generation** - Provides detailed upgrade report

### Breaking Changes Handling

The wizard detects breaking changes and provides clear guidance:

**Auto-fixable changes:**

- Import path updates
- Config file migrations
- Package replacements
- Build configuration updates
- Metro and Babel plugin configurations

**Manual changes (with instructions):**

- Camera API updates
- Location permission API changes
- Custom native module updates
- New Architecture compatibility

All auto-fixes create backups and show previews before applying.

## 👏 Contributing

We welcome contributions from developers of all skill levels! Check out our [contributing guide](CONTRIBUTING.md) to get started.

**Ways to contribute:**

- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve documentation
- 🔧 Submit pull requests
- ⭐ Star the project

**Quick start for contributors:**

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
```

## 📚 Documentation

- [Quick Start Guide](QUICK_START.md) - Get up and running in 5 minutes
- [Architecture](ARCHITECTURE.md) - Understand how it works
- [Changelog](CHANGELOG.md) - See what's new
- [Security Policy](SECURITY.md) - Report vulnerabilities
- [Governance](GOVERNANCE.md) - How decisions are made
- [Code of Conduct](CODE_OF_CONDUCT.md) - Community guidelines

## ❓ FAQ

**Q: Is this tool safe to use?**  
A: Yes! Automatic backups are created before every upgrade, and you can rollback with one command.

**Q: What if the upgrade fails?**  
A: Simply run `expo-upgrade-wizard state rollback` to restore your project to its pre-upgrade state.

**Q: Can I preview changes before applying?**  
A: Yes! Use the `--dry-run` flag to preview all changes without applying them.

**Q: Which installation strategy should I use?**  
A: The default `expo` strategy is recommended as it avoids Metro issues. Use `npm` for standard installs, or `legacy` if you encounter peer dependency conflicts.

For more questions, visit our [GitHub Issues](https://github.com/vishwa-glitch/expo-upgrade-wizard/issues) or [Discussions](https://github.com/vishwa-glitch/expo-upgrade-wizard/discussions).

## License

The Expo Upgrade Wizard source code is made available under the [MIT license](LICENSE).

---

<p align="center">
  <b>Made with ❤️ by developers, for developers</b>
</p>

<p align="center">
  <a href="https://github.com/vishwa-glitch/expo-upgrade-wizard">
    <img alt="Star the Expo Upgrade Wizard repo on GitHub" src="https://img.shields.io/github/stars/vishwa-glitch/expo-upgrade-wizard?style=social" />
  </a>
</p>
