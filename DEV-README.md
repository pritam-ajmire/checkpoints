# Checkpoints Extension - Developer Guide

This guide is for developers who want to understand, modify, contribute to, or debug the Checkpoints VS Code extension.

## 📋 Table of Contents

- [Project Structure](#project-structure)
- [Code Architecture](#code-architecture)
- [Development Setup](#development-setup)
- [Configuration Files](#configuration-files)
- [Testing](#testing)
- [Debugging](#debugging)
- [Building & Packaging](#building--packaging)
- [CI/CD Pipeline](#cicd-pipeline)
- [Contributing](#contributing)

## 📁 Project Structure

```
checkpoints-extension/
├── src/
│   └── extension.ts              # Main extension code
├── test/                         # Test files (root level)
│   ├── runTest.ts               # Test runner entry point
│   └── suite/                   # Test suites
│       ├── index.ts             # Test loader
│       ├── extension.test.ts    # Extension integration tests
│       ├── checkpointManager.test.ts  # Core functionality tests
│       └── integration.test.ts  # End-to-end tests
├── .github/
│   └── workflows/
│       └── test.yml             # GitHub Actions CI/CD
├── out/                         # Compiled JavaScript (generated)
├── .vscode-test/               # VS Code test environment (generated)
├── node_modules/               # Dependencies (generated)
├── package.json                # Extension manifest & dependencies
├── tsconfig.json               # TypeScript configuration
├── .eslintrc.json              # Code quality rules
├── .mocharc.json               # Test framework config
├── .nycrc.json                 # Coverage reporting config
├── test.sh                     # Local test automation script
├── README.md                   # User documentation
├── DEV-README.md              # This developer guide
├── PACKAGE_INFO.md            # Package details
└── LICENSE                     # MIT license
```

## 🏗️ Code Architecture

### Core Components

#### 1. **CheckpointManager Class** (`src/extension.ts` lines 55-242)
The heart of the extension - handles all checkpoint operations:

```typescript
class CheckpointManager {
    private workspaceRoot: string;
    private checkpointDir: string;
    private metadataFile: string;
    
    // Core methods:
    saveCheckpoint(name: string, description: string): boolean
    restoreCheckpoint(name: string): boolean
    listCheckpoints(): CheckpointsData
    deleteCheckpoint(name: string): boolean
    cleanOldCheckpoints(days: number): number
}
```

**Key Features:**
- **File-system based**: No external dependencies
- **Atomic operations**: All-or-nothing checkpoint creation
- **Metadata tracking**: JSON-based checkpoint information
- **Exclusion patterns**: Ignores `.git`, `node_modules`, etc.
- **Auto-backup**: Creates backup before restore operations

#### 2. **Extension Activation** (`src/extension.ts` lines 15-53)
VS Code extension lifecycle management:

```typescript
export function activate(context: vscode.ExtensionContext) {
    // Register commands
    // Create status bar item
    // Set up context
    // Show welcome message
}
```

#### 3. **Command Handlers** (`src/extension.ts` lines 259-444)
Six main commands exposed to users:

- `checkpoints.save` - Named checkpoint creation
- `checkpoints.saveQuick` - Timestamped checkpoint
- `checkpoints.list` - Display all checkpoints
- `checkpoints.restore` - Restore from checkpoint
- `checkpoints.check` - Code quality placeholder
- `checkpoints.clean` - Remove old checkpoints

### Data Structures

#### CheckpointMetadata Interface
```typescript
interface CheckpointMetadata {
    timestamp: string;    // ISO format: "2024-01-01T12-00-00"
    description: string;  // User-provided description
    fileCount: number;    // Number of files in checkpoint
}

interface CheckpointsData {
    [name: string]: CheckpointMetadata;
}
```

#### File System Layout
```
.vscode/checkpoints/
├── metadata.json           # CheckpointsData JSON
├── checkpoint_name_1/      # Full project copy
│   ├── src/
│   ├── package.json
│   └── ...
└── auto_backup_timestamp/  # Automatic backups
```

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: 16.x, 18.x, or 20.x
- **npm**: Latest version
- **VS Code**: 1.103.0 or higher
- **Git**: For version control

### Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd checkpoints-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
./test.sh

# Start development
code .
```

### Development Workflow
1. **Code**: Edit `src/extension.ts`
2. **Compile**: `npm run compile` (or use VS Code tasks)
3. **Test**: `npm test` for integration tests
4. **Debug**: Press F5 in VS Code to launch Extension Development Host
5. **Package**: `npm run package` when ready

## ⚙️ Configuration Files

### `package.json` - Extension Manifest
Key sections:
```json
{
  "contributes": {
    "commands": [...],        // Command definitions
    "keybindings": [...],     // Keyboard shortcuts
    "menus": {...}            // UI integration
  },
  "scripts": {
    "compile": "tsc -p ./",   // TypeScript compilation
    "test": "node ./out/test/runTest.js",
    "lint": "eslint src --ext ts"
  }
}
```

### `tsconfig.json` - TypeScript Config
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "out",
    "rootDir": ".",           // Include both src/ and test/
    "strict": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

### `.eslintrc.json` - Code Quality
```json
{
  "rules": {
    "curly": "warn",          // Require braces for if statements
    "eqeqeq": "warn",        // Require === instead of ==
    "@typescript-eslint/semi": "warn"
  }
}
```

## 🧪 Testing

### Test Architecture

#### Test Levels
1. **Unit Tests**: `checkpointManager.test.ts`
   - Tests CheckpointManager class in isolation
   - Uses temporary file system
   - 9 test cases covering core functionality

2. **Integration Tests**: `extension.test.ts`
   - Tests VS Code extension integration
   - Command registration and activation
   - 8 test cases

3. **End-to-End Tests**: `integration.test.ts`
   - Tests real-world scenarios
   - File operations and workspace handling

#### Test Runner: `test/runTest.ts`
```typescript
// Downloads VS Code, installs extension, runs tests
await runTests({ 
    extensionDevelopmentPath, 
    extensionTestsPath 
});
```

#### Test Suite Loader: `test/suite/index.ts`
```typescript
// Finds and loads all *.test.js files
// Uses fs instead of glob to avoid dependency conflicts
const findTestFiles = (dir: string): string[] => { ... }
```

### Running Tests

#### Local Testing
```bash
# Full test suite
./test.sh

# Individual test types
npm run compile     # TypeScript compilation
npm run lint       # Code quality
npm test           # VS Code integration tests

# Watch mode
npm run test:watch
```

#### Test Configuration
- **Framework**: Mocha with TDD interface
- **Timeout**: 10 seconds per test
- **Coverage**: nyc with 80% thresholds
- **Environment**: Isolated VS Code instance

### Test Data Management
```typescript
// Tests use temporary directories
testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'checkpoint-test-'));

// Cleanup in teardown
fs.rmSync(testWorkspace, { recursive: true, force: true });
```

## 🐛 Debugging

### VS Code Debugging
1. **Open**: `src/extension.ts`
2. **Set breakpoints**: Click in gutter
3. **Press F5**: Launches Extension Development Host
4. **Test commands**: Use Cmd+Shift+P in development window

### Debug Configuration (`.vscode/launch.json`)
```json
{
  "type": "extensionHost",
  "request": "launch",
  "name": "Launch Extension",
  "runtimeExecutable": "${execPath}",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
  "outFiles": ["${workspaceFolder}/out/**/*.js"]
}
```

### Logging & Diagnostics
```typescript
// Extension logs
console.log('Checkpoints extension is now active!');

// Error handling
try {
    // checkpoint operation
} catch (error) {
    console.error('Error saving checkpoint:', error);
    vscode.window.showErrorMessage(`Failed: ${error}`);
}
```

### Common Debug Scenarios
1. **Command not found**: Check `package.json` contributes section
2. **File operations fail**: Check permissions and paths
3. **Tests fail**: Verify test workspace cleanup
4. **Extension not loading**: Check VS Code compatibility

## 📦 Building & Packaging

### Compilation Process
```bash
# TypeScript to JavaScript
npm run compile
# Creates: out/src/extension.js, out/test/**/*.js

npm install -g @vscode/vsce

# Include in package
vsce package
# Creates: checkpoints-1.0.0.vsix
```

### Package Contents
The `.vsix` file includes:
- `package.json` - Extension manifest
- `out/` - Compiled JavaScript
- `README.md` - User documentation
- `LICENSE` - MIT license
- Other static assets

### Version Management
```bash
# Update version
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# Package with new version
vsce package
```

### Distribution Options
1. **Manual**: Share `.vsix` file directly
2. **Marketplace**: Publish to VS Code marketplace
3. **Private**: Internal distribution systems

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/test.yml`)

#### Matrix Testing
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [16.x, 18.x, 20.x]
```

#### Pipeline Steps
1. **Setup**: Checkout code, install Node.js
2. **Dependencies**: `npm ci`
3. **Quality**: `npm run lint`
4. **Build**: `npm run compile`
5. **Test**: Platform-specific test execution
6. **Coverage**: Generate and upload coverage reports
7. **Package**: Create `.vsix` artifact

#### Platform-Specific Testing
```yaml
# Linux: Requires display server
- name: Run tests on Linux
  run: |
    export DISPLAY=:99
    xvfb-run -a npm test

# macOS/Windows: Direct execution
- name: Run tests on macOS/Windows
  run: npm test
```

### Automated Quality Checks
- **ESLint**: Code style and quality
- **TypeScript**: Type checking and compilation
- **Tests**: Automated test execution
- **Coverage**: Code coverage reporting
- **Packaging**: Artifact generation

## 🤝 Contributing

### Development Guidelines

#### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Follow configured rules
- **Naming**: Use camelCase for variables, PascalCase for classes
- **Error Handling**: Always handle errors gracefully

#### Git Workflow
```bash
# Create feature branch
git checkout -b feature/new-functionality

# Make changes
# ... code changes ...

# Test thoroughly
./test.sh

# Commit with descriptive message
git commit -m "feat: add new checkpoint validation"

# Push and create PR
git push origin feature/new-functionality
```

#### Testing Requirements
- **New features**: Must include tests
- **Bug fixes**: Add regression tests
- **Coverage**: Maintain 80%+ coverage
- **Cross-platform**: Test on multiple OS

#### Pull Request Process
1. **Fork** the repository
2. **Create** feature branch
3. **Implement** changes with tests
4. **Verify** all tests pass locally
5. **Submit** pull request with description
6. **Address** review feedback

### Architecture Decisions

#### Why TypeScript?
- **Type Safety**: Catch errors at compile time
- **VS Code Integration**: Excellent tooling support
- **Maintainability**: Better code organization

#### Why No External Dependencies?
- **Lightweight**: Faster installation and startup
- **Reliability**: No dependency conflicts
- **Security**: Smaller attack surface

#### Why File-System Based?
- **Simplicity**: No database or external storage
- **Performance**: Direct file operations
- **Portability**: Works everywhere

### Performance Considerations
- **Lazy Loading**: Load checkpoints only when needed
- **Streaming**: Use streams for large file operations
- **Exclusions**: Skip unnecessary files (node_modules, .git)
- **Async Operations**: Non-blocking UI operations

---

## 📞 Support & Resources

- **Issues**: Report bugs and feature requests
- **Discussions**: Ask questions and share ideas
- **Documentation**: Keep this guide updated
- **Testing**: Always run tests before submitting

**Happy coding! 🚀**
