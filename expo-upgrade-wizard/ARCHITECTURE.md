# Architecture

This document describes the architecture and design decisions of Expo Upgrade Wizard.

## Overview

Expo Upgrade Wizard is a CLI tool built with Node.js and TypeScript that automates Expo SDK upgrades through intelligent analysis, dependency management, and code transformations.

## Core Principles

1. **Safety First**: Always create backups before making changes
2. **Transparency**: Show users what's happening and why
3. **Flexibility**: Support multiple upgrade strategies and workflows
4. **Intelligence**: Use AI and pattern matching to detect issues
5. **Community-Driven**: Learn from real-world upgrade experiences

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                            │
│  (Commander.js - Command parsing and routing)                │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    Command Layer                             │
│  - upgrade          - check          - doctor                │
│  - fix-deprecated   - check-react19  - guide-sdk50           │
│  - state rollback   - test-ai        - community             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    Core Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Analyzer   │  │   Upgrader   │  │  Code Fixer  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ State Manager│  │ Git Manager  │  │ AI Analyzer  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    Data Layer                                │
│  - SDK Versions    - Breaking Changes  - Package Compat     │
│  - Known Issues    - Community Fixes   - Version Overrides  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  External Services                           │
│  - npm Registry   - OpenRouter API    - GitHub API          │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### CLI Layer

**Technology**: Commander.js

**Responsibilities**:
- Parse command-line arguments
- Route to appropriate command handlers
- Handle global options (--help, --version)
- Display help text and usage information

**Key Files**:
- `src/index.ts` - Entry point and command registration

### Command Layer

**Responsibilities**:
- Implement command-specific logic
- Validate inputs and preconditions
- Orchestrate service calls
- Handle user interactions (prompts, confirmations)
- Display results and next steps

**Key Commands**:
- `upgrade` - Main upgrade workflow
- `check` - Compatibility checking
- `fix-deprecated` - Deprecated package fixes
- `check-react19` - React 19 compatibility
- `state rollback` - Rollback to previous state

**Key Files**:
- `src/commands/upgrade.ts`
- `src/commands/check-improved.ts`
- `src/commands/fix-deprecated.ts`
- `src/commands/fix-sdk53.ts`

### Core Services

#### Analyzer

**Responsibilities**:
- Analyze project structure and configuration
- Detect current SDK version
- Identify installed packages
- Check for breaking changes
- Validate project state

**Key Files**:
- `src/utils/analyzer.ts`

#### Upgrader

**Responsibilities**:
- Update package.json dependencies
- Run npm/yarn install with appropriate strategy
- Handle installation errors
- Verify package versions after install

**Key Files**:
- `src/utils/upgrade-helpers.ts`

#### Code Fixer

**Responsibilities**:
- Parse and transform code using AST
- Apply regex-based fixes
- Fix configuration files (app.json, babel.config.js, metro.config.js)
- Handle breaking change migrations

**Key Files**:
- `src/upgraders/code-fixer.ts`
- `src/utils/app-json-fixer.ts`
- `src/utils/babel-config-fixer.ts`
- `src/utils/metro-config-fixer.ts`

#### State Manager

**Responsibilities**:
- Create and manage backups
- Store project state snapshots
- Handle rollback operations
- Manage backup history

**Key Files**:
- `src/utils/state-manager.ts`

#### Git Manager

**Responsibilities**:
- Check git status
- Create backup branches
- Commit changes
- Handle git operations

**Key Files**:
- `src/utils/git.ts`

#### AI Analyzer

**Responsibilities**:
- Analyze code for breaking changes
- Generate personalized upgrade guides
- Provide fix recommendations
- Estimate fix times

**Key Files**:
- `src/utils/ai-analyzer.ts`
- `src/utils/post-upgrade-guide-enhanced.ts`
- `src/utils/sdk52-guide-generator.ts`

### Data Layer

**Responsibilities**:
- Store SDK version information
- Maintain breaking changes database
- Track package compatibility
- Store known issues and fixes

**Key Files**:
- `src/data/sdk-versions.ts`
- `src/data/breaking-changes.ts`
- `src/data/package-compatibility.ts`
- `src/data/sdk53-breaking-changes.ts`
- `src/data/sdk53-known-issues.ts`

## Data Flow

### Upgrade Flow

```
1. User runs: expo-upgrade-wizard upgrade --target-sdk 53
                     ↓
2. CLI parses command and options
                     ↓
3. Analyzer checks project state
   - Current SDK version
   - Installed packages
   - Git status
   - Cloud storage detection
                     ↓
4. State Manager creates backup
   - Git branch or zip file
   - State snapshot
                     ↓
5. Upgrader updates dependencies
   - Update package.json
   - Run installation
   - Verify versions
                     ↓
6. Code Fixer applies fixes
   - app.json fixes
   - babel.config.js fixes
   - metro.config.js fixes
   - Breaking change migrations
                     ↓
7. AI Analyzer generates guide (optional)
   - Analyze code for breaking changes
   - Generate personalized recommendations
                     ↓
8. Display results and next steps
```

## Design Patterns

### Command Pattern

Each CLI command is implemented as a separate module with a consistent interface:

```typescript
export async function commandName(options: CommandOptions): Promise<void> {
  // 1. Validate inputs
  // 2. Check preconditions
  // 3. Execute command logic
  // 4. Handle errors
  // 5. Display results
}
```

### Strategy Pattern

Multiple upgrade strategies (conservative, recommended, aggressive) and installation strategies (expo, npm, legacy, force) allow users to choose their approach.

### Factory Pattern

Breaking change fixes are created dynamically based on SDK versions and detected issues.

### Observer Pattern

Progress indicators and logging provide real-time feedback during long operations.

## Error Handling

### Error Categories

1. **User Errors**: Invalid inputs, missing files
2. **System Errors**: File system, network issues
3. **Installation Errors**: npm/yarn failures
4. **Validation Errors**: Incompatible versions

### Error Recovery

- Clear error messages with context
- Suggested recovery actions
- Automatic rollback on critical failures
- Detailed logging for debugging

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Load data only when needed
2. **Caching**: Cache npm registry responses
3. **Parallel Operations**: Run independent tasks concurrently
4. **Minimal File I/O**: Batch file operations
5. **Smart Installation**: Use Expo-first strategy to avoid Metro issues

### Performance Targets

- Startup time: < 1 second
- Simple upgrade: < 3 minutes
- Complex upgrade: < 10 minutes
- Memory usage: < 500MB

## Security Considerations

### API Keys

- Stored in .env files (gitignored)
- Never logged or transmitted unnecessarily
- Validated before use

### File System

- All operations within project directory
- Backup before destructive changes
- Validate file paths to prevent traversal

### Network

- HTTPS only for API calls
- SSL certificate validation
- Rate limiting for API calls

## Testing Strategy

### Unit Tests

- Test individual functions and utilities
- Mock external dependencies
- Focus on business logic

### Integration Tests

- Test command workflows
- Use test fixtures
- Verify file system changes

### E2E Tests

- Test complete upgrade scenarios
- Use real Expo projects
- Verify final state

## Extensibility

### Plugin System (Future)

Allow community to add:
- Custom breaking change detectors
- Additional code transformations
- New installation strategies
- Custom validation rules

### Configuration

Support project-level configuration:
- `.expo-upgrade-wizard.config.js`
- Custom upgrade strategies
- Package version overrides
- Skip rules

## Monitoring and Analytics

### Metrics (Future)

- Upgrade success rate
- Common failure points
- Popular SDK versions
- Breaking change frequency

### Logging

- Structured logging with Winston
- Log levels (error, warn, info, debug)
- Separate log files per upgrade
- Rotation and cleanup

## Dependencies

### Core Dependencies

- **commander**: CLI framework
- **inquirer**: Interactive prompts
- **chalk**: Terminal colors
- **ora**: Spinners and progress
- **listr2**: Task lists
- **simple-git**: Git operations
- **axios**: HTTP requests
- **semver**: Version comparison

### Code Transformation

- **@babel/parser**: Parse JavaScript/TypeScript
- **@babel/traverse**: AST traversal
- **@babel/generator**: Generate code from AST
- **@babel/types**: AST node types

### Utilities

- **fs-extra**: Enhanced file system
- **glob**: File pattern matching
- **dotenv**: Environment variables
- **winston**: Logging

## Future Architecture

### Planned Improvements

1. **Microservices**: Separate AI analysis service
2. **Web Dashboard**: Visual upgrade management
3. **Database**: Store community fixes and analytics
4. **Queue System**: Handle long-running operations
5. **WebSocket**: Real-time progress updates

---

This architecture is designed to be maintainable, testable, and extensible as the project grows.

Last updated: October 30, 2025
