# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added
- **Interactive Auto-Fix System**: Consistent UX pattern for all auto-fixable issues
  - Option 1: Auto-fix with automatic backup
  - Option 2: Show detailed preview before applying
  - Option 3: Skip with manual fix instructions
- **Build Gradle Auto-Fix** (SDK 53): Fixes deprecated `bundleCommand = "export:embed"`
  - Detects "commands[command] is not a function" error
  - Interactive fix with preview and backup
  - Affects ~80% of projects upgrading from SDK 49 to SDK 53
- **Metro Package Exports Fix** (SDK 53): Configures package.json exports
  - Creates or updates metro.config.js
  - Adds `unstable_enablePackageExports = false`
  - Fixes "Cannot find module" errors for Axios, Supabase, Firebase
- **Android Kotlin Version Fix** (SDK 53): Updates to Kotlin 2.0.21
  - Fixes "Key 1.9.24 is missing in the map" error
  - Updates android/build.gradle
  - Warns about expo prebuild --clean resetting this
- **enableBundleCompression Fix** (SDK 53): Removes deprecated property
  - Removes from android/app/build.gradle
  - Fixes React Native 0.76.x build failures
- **expo-dev-client Removal** (SDK 53): Uninstalls incompatible package
  - Detects incompatibility with RN 0.76.x
  - Provides alternatives (preview/production builds)
- **TypeScript Config Fix** (SDK 53): Updates moduleResolution
  - Sets to "bundler" for Metro compatibility
  - Updates tsconfig.json
- **New Architecture Configuration** (SDK 53): Disables for compatibility
  - Sets newArchEnabled to false
  - Updates app.json for iOS and Android
- **.npmrc Configuration**: Adds legacy-peer-deps
  - Creates or updates .npmrc
  - Prevents peer dependency conflicts
- **Enhanced Metro Config Fix**: Now with interactive options
  - Preview changes before applying
  - Show full file with highlighted issues
  - Automatic backup creation
- **Enhanced Babel Config Fix**: Now with interactive options
  - Preview plugin reordering
  - Show current plugins array with annotations
  - Automatic backup creation
- **Enhanced fix-sdk53 Command**: Now with interactive pattern
  - babel-plugin-module-resolver installation with prompts
  - Metro package exports fix with preview
  - React version overrides with confirmation
  - expo-notifications plugin with details view

### Changed
- **All auto-fixes now use consistent interactive pattern** (both fix-deprecated and fix-sdk53)
- Improved error messages with clear impact descriptions
- Better preview of changes before applying fixes
- `fix-deprecated` command now handles 10+ different fixes
- `fix-sdk53` command now uses 3-option interactive pattern for all fixes
- Both commands create backups and show previews before applying changes

### Documentation
- Added `docs/BUNDLE_COMMAND_FIX.md` - Detailed guide for bundleCommand issue
- Added `docs/INTERACTIVE_FIXES.md` - Complete guide to interactive fix system
- Added `docs/TESTING_INTERACTIVE_FIXES.md` - Comprehensive testing guide
- Added `docs/COMMAND_COMPARISON.md` - Comparison of fix-sdk53 vs fix-deprecated
- Updated README with all new auto-fix features

## [1.0.0] - 2025-10-30

### Added
- Initial release
- Automated Expo SDK upgrades
- Breaking changes detection
- Smart dependency management
- Cloud storage detection and warnings
- app.json auto-fix capabilities
- Babel config auto-fix
- React 19 compatibility checker
- Metro config auto-fix
- Git integration with automatic backups
- AI-powered breaking change detection
- Beautiful CLI interface
- Simple rollback functionality
- SDK 50+ post-upgrade guides
- Community-driven solutions database

### Features
- Support for Expo SDK 49-53
- Multiple upgrade strategies (conservative/recommended/aggressive)
- Multiple installation strategies (expo/npm/legacy/force)
- Dry-run mode for previewing changes
- Interactive CLI with progress indicators
- Comprehensive error handling and recovery
- Detailed logging and diagnostics

### Documentation
- Comprehensive README
- Contributing guidelines
- Quick start guide
- Installation strategy guide
- React 19 compatibility guide
- Metro config auto-fix guide
- AI features documentation

## Release Notes Format

### Added
New features and capabilities

### Changed
Changes to existing functionality

### Deprecated
Features that will be removed in future versions

### Removed
Features that have been removed

### Fixed
Bug fixes

### Security
Security improvements and vulnerability fixes

---

For more details, see the [GitHub Releases](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/releases) page.
