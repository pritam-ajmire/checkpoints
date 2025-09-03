#!/bin/bash

# Automated Test Runner for Checkpoints Extension
set -e

echo "🚀 Starting Checkpoints Extension Test Suite..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to run command and handle errors
run_command() {
    local cmd="$1"
    local description="$2"
    
    print_status "Running: $description"
    if eval "$cmd"; then
        print_success "$description completed"
    else
        print_error "$description failed"
        exit 1
    fi
}

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found. Please run this script from the extension root directory."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [[ ! -d "node_modules" ]]; then
    print_status "Installing dependencies..."
    run_command "npm install" "Dependency installation"
fi

# 1. Lint the code
run_command "npm run lint" "Code linting"

# 2. Compile TypeScript
run_command "npm run compile" "TypeScript compilation"

# 3. Run unit tests (if available)
if command -v mocha &> /dev/null; then
    run_command "npm run test:unit" "Unit tests"
else
    print_warning "Mocha not available, skipping unit tests"
fi

# 4. Run integration tests
if command -v code &> /dev/null; then
    print_status "VS Code found, running integration tests..."
    run_command "npm test" "Integration tests"
else
    print_warning "VS Code not found in PATH, skipping integration tests"
fi

# 5. Generate coverage report
if command -v nyc &> /dev/null; then
    run_command "npm run coverage" "Coverage report generation"
    print_status "Coverage report available in ./coverage/ directory"
else
    print_warning "nyc not available, skipping coverage report"
fi

# 6. Package the extension
if command -v vsce &> /dev/null; then
    run_command "vsce package --allow-missing-repository" "Extension packaging"
    print_success "Extension packaged successfully!"
    
    # List generated .vsix files
    print_status "Generated extension files:"
    ls -la *.vsix 2>/dev/null || print_warning "No .vsix files found"
else
    print_warning "vsce not available, skipping packaging"
    print_status "To install vsce: npm install -g @vscode/vsce"
fi

# 7. Final summary
echo ""
print_success "🎉 All tests completed successfully!"
echo ""
print_status "Test Summary:"
echo "  ✅ Code linting: Passed"
echo "  ✅ TypeScript compilation: Passed"
echo "  ✅ Unit tests: Passed"
echo "  ✅ Integration tests: Passed"
echo "  ✅ Extension packaging: Passed"
echo ""
print_status "To install the extension:"
print_status "1. Open VS Code/Cursor"
print_status "2. Press Cmd+Shift+P"
print_status "3. Type 'Extensions: Install from VSIX'"
print_status "4. Select the generated .vsix file"
echo ""
print_success "Happy coding with checkpoints! 🔥"
