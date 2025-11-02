# Contributing to Expo Upgrade Wizard

Thank you for your interest in contributing to Expo Upgrade Wizard! This tool helps thousands of developers save time upgrading their Expo projects.

## 🤝 Code of Conduct

Be respectful, inclusive, and constructive in all interactions.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git
- An Expo project for testing

### Development Setup

1. **Fork and Clone**
```bash
git clone https://github.com/YOUR_USERNAME/expo-upgrade-wizard.git
cd expo-upgrade-wizard
```

2. **Install Dependencies**
```bash
npm install
```

3. **Build the Project**
```bash
npm run build
```

4. **Link for Local Testing**
```bash
npm link
# Now you can use 'expo-upgrade-wizard' command globally
```

5. **Development Mode**
```bash
npm run dev
# Watches for changes and auto-rebuilds
```

## 📁 Project Structure

```
src/
├── commands/       # CLI commands (upgrade, check, doctor)
├── data/          # SDK versions and breaking changes database
├── upgraders/     # Code that performs upgrades
├── utils/         # Utility functions
└── types/         # TypeScript type definitions
```

## 🔧 Key Areas for Contribution

### 1. SDK Version Updates
**File**: `src/data/sdk-versions.ts`

When a new Expo SDK is released:
```typescript
'54': {
  version: '54',
  reactNativeVersion: '0.77.0',
  releaseDate: '2025-01-15',
  minNodeVersion: '18.18.0',
  expoPackageVersion: '~54.0.0'
}
```

### 2. Breaking Changes Database
**File**: `src/data/breaking-changes.ts`

Document breaking changes between SDK versions:
```typescript
{
  id: 'new-breaking-change',
  package: 'expo-camera',
  fromVersion: '53',
  toVersion: '54',
  description: 'Camera API changed',
  changes: ['Old API deprecated'],
  autoFixable: true,
  codePatterns: [{
    pattern: /oldPattern/g,
    replacement: 'newPattern',
    fileTypes: ['.js', '.tsx']
  }]
}
```

### 3. Package Version Overrides
**File**: `src/data/sdk-versions.ts`

Update community package versions:
```typescript
PACKAGE_VERSION_OVERRIDES['54'] = {
  'react-native-reanimated': '~3.17.0',
  'react-native-gesture-handler': '~2.21.0',
  // ...
}
```

### 4. Code Fixers
**File**: `src/upgraders/code-fixer.ts`

Add AST transformations for automatic fixes:
```typescript
// Add new transform for SDK 54
if (parseInt(fromSdk) <= 53 && parseInt(toSdk) >= 54) {
  transforms.push((path: any) => {
    // AST transformation logic
  });
}
```

## 📝 Contribution Guidelines

### Reporting Issues

1. Check existing issues first
2. Use issue templates
3. Include:
   - Expo SDK version
   - Node.js version
   - Error messages
   - package.json (relevant parts)

### Submitting Pull Requests

1. **Create a Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make Your Changes**
- Follow existing code style
- Add comments for complex logic
- Update relevant documentation

3. **Test Your Changes**
```bash
# Build the project
npm run build

# Test on a real Expo project
cd /path/to/test-project
expo-upgrade-wizard --dry-run
```

4. **Commit with Conventional Commits**
```bash
git commit -m "feat: add support for SDK 54"
git commit -m "fix: handle missing expo package"
git commit -m "docs: update README"
```

5. **Push and Create PR**
```bash
git push origin feature/your-feature-name
```

### Commit Message Format

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Maintenance tasks

## 🧪 Testing

### Manual Testing Checklist

- [ ] Test upgrade from SDK N-1 to N
- [ ] Test upgrade from SDK N-2 to N
- [ ] Test with npm, yarn, pnpm
- [ ] Test with managed workflow
- [ ] Test with bare workflow
- [ ] Test dry-run mode
- [ ] Test with uncommitted changes
- [ ] Test doctor command
- [ ] Test check command

### Adding Test Cases

Document test scenarios in `TESTING.md`:
```markdown
### Scenario: SDK 54 Upgrade
**Setup**: Project with SDK 53
**Command**: `expo-upgrade-wizard --target-sdk 54`
**Expected**: Updates to RN 0.77.0, handles new breaking changes
**Result**: ✅ Success
```

## 🎯 Priority Areas

### High Priority
- Support for new SDK versions
- Critical bug fixes
- Breaking change auto-fixes

### Medium Priority
- Performance improvements
- Better error messages
- Additional package support

### Nice to Have
- UI improvements
- Additional commands
- Integration features

## 📚 Resources

- [Expo SDK Release Notes](https://expo.dev/changelog)
- [React Native Releases](https://github.com/facebook/react-native/releases)
- [Expo Documentation](https://docs.expo.dev)
- [AST Explorer](https://astexplorer.net/) - For code transformations

## 🏆 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Given credit in commit messages

## 💬 Getting Help

- Open a discussion for questions
- Join our Discord server (coming soon)
- Tag @expo-upgrade-wizard on Twitter

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for making Expo upgrades easier for everyone! 🚀
