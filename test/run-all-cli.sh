#!/bin/bash

# Zypin CLI Test Script
# Tests all CLI commands and writes output to test/cli-test-results.txt

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get absolute path to project root (go up 2 levels from test directory)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Create test directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/zypin-core/test"

# Output file
OUTPUT_FILE="$PROJECT_ROOT/zypin-core/test/cli-test-results.txt"

# Function to print colored output
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

# Function to run command and capture output
run_command() {
    local cmd="$1"
    local description="$2"
    
    print_status "Running: $description"
    
    echo "" >> "$OUTPUT_FILE"
    echo "===========================================" >> "$OUTPUT_FILE"
    echo "COMMAND: $description" >> "$OUTPUT_FILE"
    echo "TIMESTAMP: $(date)" >> "$OUTPUT_FILE"
    echo "===========================================" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    if eval "$cmd" >> "$OUTPUT_FILE" 2>&1; then
        print_success "✓ $description completed successfully"
    else
        print_error "✗ $description failed (exit code: $?)"
        echo "ERROR: Command failed" >> "$OUTPUT_FILE"
    fi
    
    echo "" >> "$OUTPUT_FILE"
    echo "===========================================" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
}

# Clear output file and add header
echo "Zypin CLI Test Results" > "$OUTPUT_FILE"
echo "Generated on: $(date)" >> "$OUTPUT_FILE"
echo "===========================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

print_status "Starting Zypin CLI tests..."
print_status "Output will be written to: $OUTPUT_FILE"

# Change to zypin-core directory
cd "$PROJECT_ROOT/zypin-core"

# Test Global Mode Commands
print_status "Testing Global Mode Commands..."

# 1. Main help
run_command "node cli/index.js" "zypin (main help)"

# 2. Start command help
run_command "node cli/index.js start --help" "zypin start --help"

# 3. Create-project command help
run_command "node cli/index.js create-project --help" "zypin create-project --help"

# 4. Update command help
run_command "node cli/index.js update --help" "zypin update --help"

# 5. MCP command help
run_command "node cli/index.js mcp --help" "zypin mcp --help"

# 6. Health command help
run_command "node cli/index.js health --help" "zypin health --help"

# Test Template Mode Commands
print_status "Testing Template Mode Commands..."

# Change to template directory for template mode commands
cd "$PROJECT_ROOT/zypin-selenium/templates/cucumber-bdd"

# 7. Main zypin command (template mode - should show template mode help)
run_command "node ../../../zypin-core/cli/index.js" "zypin (template mode - main help)"

# 8. Run command help (template mode)
run_command "node ../../../zypin-core/cli/index.js run --help" "zypin run --help (template mode)"

# 9. Guide command help (template mode)
run_command "node ../../../zypin-core/cli/index.js guide --help" "zypin guide --help (template mode)"

# Return to project root
cd "$PROJECT_ROOT"

# Test completed
print_success "All CLI tests completed!"
print_status "Results written to: $OUTPUT_FILE"

# Show file size and line count
if [ -f "$OUTPUT_FILE" ]; then
    lines=$(wc -l < "$OUTPUT_FILE")
    size=$(du -h "$OUTPUT_FILE" | cut -f1)
    print_status "Output file contains $lines lines ($size)"
    
    echo ""
    print_status "To view the results:"
    echo "  cat zypin-core/test/cli-test-results.txt"
    echo "  less zypin-core/test/cli-test-results.txt"
    echo "  code zypin-core/test/cli-test-results.txt"
fi

echo ""
print_success "Script completed successfully!"
