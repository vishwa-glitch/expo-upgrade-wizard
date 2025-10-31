# Quick Start Guide

Get started with Expo Upgrade Wizard in under 5 minutes!

## Installation

### Global Installation (Recommended)

```bash
npm install -g expo-upgrade-wizard
```

### One-Time Use (npx)

```bash
npx expo-upgrade-wizard
```

## Basic Usage

### 1. Simple Upgrade

Upgrade to the latest SDK:

```bash
expo-upgrade-wizard upgrade
```

Upgrade to a specific SDK:

```bash
expo-upgrade-wizard upgrade --target-sdk 53
```

### 2. Check Compatibility

Before upgrading, check what will change:

```bash
expo-upgrade-wizard check --target 53
```

### 3. Preview Changes (Dry Run)

See what would happen without making changes:

```bash
expo-upgrade-wizard upgrade --target-sdk 53 --dry-run
```

## Common Workflows

### Workflow 1: Safe Upgrade

```bash
# 1. Check compatibility
expo-upgrade-wizard check --target 53

# 2. Preview changes
expo-upgrade-wizard upgrade --target-sdk 53 --dry-run

# 3. Perform upgrade
expo-upgrade-wizard upgrade --target-sdk 53

# 4. Verify with expo-doctor
npx expo-doctor
```

### Workflow 2: Quick Upgrade

```bash
# One command upgrade (creates backup automatically)
expo-upgrade-wizard upgrade --target-sdk 53
```

### Workflow 3: Upgrade with AI Analysis

```bash
# Set up AI (one-time)
echo "OPENROUTER_API_KEY=your-key-here" > .env

# Upgrade with AI-powered guidance
expo-upgrade-wizard upgrade --target-sdk 53
```

## Common Commands

### Upgrade Commands

```bash
# Interactive upgrade
expo-upgrade-wizard

# Upgrade to specific SDK
expo-upgrade-wizard upgrade --target-sdk 53

# Conservative upgrade (minimal changes)
expo-upgrade-wizard upgrade --strategy conservative

# Aggressive upgrade (all updates)
expo-upgrade-wizard upgrade --strategy aggressive

# Skip backup (not recommended)
expo-upgrade-wizard upgrade --skip-backup

# Skip installation
expo-upgrade-wizard upgrade --skip-install
```

### Check Commands

```bash
# Check compatibility
expo-upgrade-wizard check

# Detailed compatibility report
expo-upgrade-wizard check --detailed

# Check React 19 compatibility
expo-upgrade-wizard check-react19

# Fix React 19 issues
expo-upgrade-wizard check-react19 --fix
```

### Fix Commands

```bash
# Fix deprecated packages
expo-upgrade-wizard fix-deprecated

# Preview deprecated fixes
expo-upgrade-wizard fix-deprecated --dry-run
```

### Guide Commands

```bash
# View SDK 50 breaking changes guide
expo-upgrade-wizard guide-sdk50
```

### Rollback Commands

```bash
# Rollback to previous state
expo-upgrade-wizard state rollback

# Rollback without confirmation
expo-upgrade-wizard state rollback -y
```

## Installation Strategies

Choose the right installation strategy for your project:

### Expo Strategy (Default, Recommended)

```bash
expo-upgrade-wizard upgrade --install-strategy expo
```

Best for most projects. Uses Expo-first approach to avoid Metro issues.

### NPM Strategy

```bash
expo-upgrade-wizard upgrade --install-strategy npm
```

Standard npm install. Use if you know your dependencies are compatible.

### Legacy Strategy

```bash
expo-upgrade-wizard upgrade --install-strategy legacy
```

Uses `--legacy-peer-deps`. May cause Metro version mismatches.

### Force Strategy

```bash
expo-upgrade-wizard upgrade --install-strategy force
```

Uses `--force` flag. Last resort for stubborn dependency conflicts.

## Upgrade Strategies

### Conservative

Minimal changes, safest option:

```bash
expo-upgrade-wizard upgrade --strategy conservative
```

### Recommended (Default)

Balanced approach:

```bash
expo-upgrade-wizard upgrade --strategy recommended
```

### Aggressive

All updates, best for new projects:

```bash
expo-upgrade-wizard upgrade --strategy aggressive
```

## AI Features Setup

### 1. Get API Key

Visit [OpenRouter.ai](https://openrouter.ai/) and create a free account.

### 2. Enable Free Models

Go to [Privacy Settings](https://openrouter.ai/settings/privacy) and enable "Free model publication".

### 3. Configure

Create `.env` file:

```bash
echo "OPENROUTER_API_KEY=sk-or-v1-your-key-here" > .env
```

### 4. Use AI Features

AI analysis runs automatically after upgrades, or test it:

```bash
expo-upgrade-wizard test-ai
```

## Troubleshooting

### Issue: Uncommitted Changes

```bash
# Solution 1: Commit changes
git add .
git commit -m "Pre-upgrade commit"

# Solution 2: Force upgrade (not recommended)
expo-upgrade-wizard upgrade --force
```

### Issue: Installation Fails

```bash
# Try different installation strategy
expo-upgrade-wizard upgrade --install-strategy legacy

# Or force strategy
expo-upgrade-wizard upgrade --install-strategy force
```

### Issue: Build Fails After Upgrade

```bash
# Clear caches
npx expo start -c

# Reinstall dependencies
rm -rf node_modules
npm install

# Run expo-doctor
npx expo-doctor
```

### Issue: React 19 Compatibility

```bash
# Check and fix React 19 issues
expo-upgrade-wizard check-react19 --fix
```

### Issue: Metro Config Errors

```bash
# Fix deprecated packages (includes Metro fix)
expo-upgrade-wizard fix-deprecated
```

## Next Steps

After upgrading:

1. **Verify Installation**
   ```bash
   npx expo-doctor
   ```

2. **Test Your App**
   ```bash
   npx expo start
   ```

3. **Check Breaking Changes**
   - Review the post-upgrade guide
   - Check SDK-specific breaking changes
   - Test critical features

4. **Update Native Code** (if bare workflow)
   - iOS: Update Podfile and run `pod install`
   - Android: Update build.gradle files

5. **Test on Devices**
   - Test on iOS simulator/device
   - Test on Android emulator/device
   - Test production builds

## Best Practices

### Before Upgrading

- ✅ Commit all changes
- ✅ Create a backup branch
- ✅ Check compatibility first
- ✅ Read SDK release notes
- ✅ Plan for breaking changes

### During Upgrade

- ✅ Use dry-run first
- ✅ Review changes carefully
- ✅ Keep logs for reference
- ✅ Test incrementally

### After Upgrading

- ✅ Run expo-doctor
- ✅ Test all features
- ✅ Update documentation
- ✅ Deploy to staging first
- ✅ Monitor for issues

## Getting Help

- 📖 [Full Documentation](README.md)
- 💬 [GitHub Discussions](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/discussions)
- 🐛 [Report Issues](https://github.com/expo-upgrade-wizard/expo-upgrade-wizard/issues)
- 📧 [Email Support](mailto:expo.upgrade.book@gmail.com)

## Examples

### Example 1: First-Time User

```bash
# Install globally
npm install -g expo-upgrade-wizard

# Navigate to your project
cd my-expo-app

# Check current status
expo-upgrade-wizard check

# Upgrade to latest
expo-upgrade-wizard upgrade

# Verify
npx expo-doctor
```

### Example 2: Experienced User

```bash
# Quick upgrade with AI
npx expo-upgrade-wizard upgrade --target-sdk 53

# If issues, rollback
npx expo-upgrade-wizard state rollback

# Try different strategy
npx expo-upgrade-wizard upgrade --strategy conservative
```

### Example 3: CI/CD Integration

```bash
# Non-interactive upgrade
npx expo-upgrade-wizard upgrade \
  --target-sdk 53 \
  --skip-backup \
  --install-strategy expo \
  -y
```

---

**Ready to upgrade? Let's go! 🚀**

For more details, see the [full README](README.md).
