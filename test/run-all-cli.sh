#!/bin/bash

# Zypin CLI Test Script
# Tests all CLI commands and writes output to separate files for each command

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get absolute path to project root (go up 2 levels from test directory)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Create test directories
mkdir -p "$PROJECT_ROOT/zypin-core/test/results"
mkdir -p "$PROJECT_ROOT/zypin-core/test/results/global-mode"
mkdir -p "$PROJECT_ROOT/zypin-core/test/results/template-mode"
mkdir -p "$PROJECT_ROOT/zypin-core/test/results/error-cases"

# Summary file
SUMMARY_FILE="$PROJECT_ROOT/zypin-core/test/results/test-summary.txt"

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

# Function to run command and capture output to separate file
run_command() {
    local cmd="$1"
    local description="$2"
    local category="$3"  # global-mode, template-mode, error-cases
    local filename="$4"  # specific filename for the test
    local timeout="${5:-10}"  # timeout in seconds, default 10
    local is_long_running="${6:-false}"  # whether this is a long-running command
    
    print_status "Running: $description (timeout: ${timeout}s)"
    
    # Create output file path
    local output_file="$PROJECT_ROOT/zypin-core/test/results/$category/$filename.txt"
    
    # Write header to output file
    echo "Zypin CLI Test Result" > "$output_file"
    echo "Command: $description" >> "$output_file"
    echo "Timestamp: $(date)" >> "$output_file"
    echo "Category: $category" >> "$output_file"
    echo "Timeout: ${timeout}s" >> "$output_file"
    echo "Long-running: $is_long_running" >> "$output_file"
    echo "===========================================" >> "$output_file"
    echo "" >> "$output_file"
    
    if [ "$is_long_running" = "true" ]; then
        # For long-running commands, use timeout and background process
        print_status "Starting long-running command: $description"
        
        # Start command in background
        eval "$cmd" >> "$output_file" 2>&1 &
        local cmd_pid=$!
        
        # Wait for timeout or command completion
        local elapsed=0
        while [ $elapsed -lt $timeout ]; do
            if ! kill -0 $cmd_pid 2>/dev/null; then
                # Command completed
                wait $cmd_pid
                local exit_code=$?
                if [ $exit_code -eq 0 ]; then
        print_success "✓ $description completed successfully"
                    echo "SUCCESS: Command completed with exit code 0" >> "$output_file"
                    echo "SUCCESS,$description,$category,$filename" >> "$SUMMARY_FILE"
                else
                    print_error "✗ $description failed (exit code: $exit_code)"
                    echo "ERROR: Command failed with exit code $exit_code" >> "$output_file"
                    echo "FAILED,$description,$category,$filename" >> "$SUMMARY_FILE"
                fi
                break
            fi
            sleep 1
            elapsed=$((elapsed + 1))
        done
        
        # If still running after timeout, kill it
        if kill -0 $cmd_pid 2>/dev/null; then
            print_warning "⚠ $description timed out after ${timeout}s, killing process"
            kill -TERM $cmd_pid 2>/dev/null
            sleep 2
            kill -KILL $cmd_pid 2>/dev/null
            echo "TIMEOUT: Command timed out after ${timeout} seconds" >> "$output_file"
            echo "TIMEOUT,$description,$category,$filename" >> "$SUMMARY_FILE"
        fi
        
        # Cleanup any remaining processes
        cleanup_processes
        
    else
        # For regular commands, use background process with timeout (macOS compatible)
        print_status "Starting regular command: $description"
        
        # Start command in background
        eval "$cmd" >> "$output_file" 2>&1 &
        local cmd_pid=$!
        
        # Wait for timeout or command completion
        local elapsed=0
        while [ $elapsed -lt $timeout ]; do
            if ! kill -0 $cmd_pid 2>/dev/null; then
                # Command completed
                wait $cmd_pid
                local exit_code=$?
                if [ $exit_code -eq 0 ]; then
                    print_success "✓ $description completed successfully"
                    echo "SUCCESS: Command completed with exit code 0" >> "$output_file"
                    echo "SUCCESS,$description,$category,$filename" >> "$SUMMARY_FILE"
                else
                    print_error "✗ $description failed (exit code: $exit_code)"
                    echo "ERROR: Command failed with exit code $exit_code" >> "$output_file"
                    echo "FAILED,$description,$category,$filename" >> "$SUMMARY_FILE"
                fi
                break
            fi
            sleep 1
            elapsed=$((elapsed + 1))
        done
        
        # If still running after timeout, kill it
        if kill -0 $cmd_pid 2>/dev/null; then
            print_warning "⚠ $description timed out after ${timeout}s, killing process"
            kill -TERM $cmd_pid 2>/dev/null
            sleep 2
            kill -KILL $cmd_pid 2>/dev/null
            echo "TIMEOUT: Command timed out after ${timeout} seconds" >> "$output_file"
            echo "TIMEOUT,$description,$category,$filename" >> "$SUMMARY_FILE"
        fi
    fi
    
    echo "" >> "$output_file"
    echo "===========================================" >> "$output_file"
    echo "End of test: $(date)" >> "$output_file"
}

# Function to cleanup processes
cleanup_processes() {
    # Kill any remaining zypin processes
    pkill -f "zypin" 2>/dev/null || true
    pkill -f "node.*cli/index.js" 2>/dev/null || true
    pkill -f "selenium" 2>/dev/null || true
    pkill -f "chromedriver" 2>/dev/null || true
    pkill -f "geckodriver" 2>/dev/null || true
    
    # Kill any processes using port 8421
    lsof -ti:8421 | xargs kill -9 2>/dev/null || true
    
    # Clean up process file
    rm -f "$PROJECT_ROOT/.zypin-processes.json" 2>/dev/null || true
    rm -f "$PROJECT_ROOT/zypin-core/.zypin-processes.json" 2>/dev/null || true
    
    sleep 1
}

# Initialize summary file
echo "Zypin CLI Test Summary" > "$SUMMARY_FILE"
echo "Generated on: $(date)" >> "$SUMMARY_FILE"
echo "Status,Description,Category,Filename" >> "$SUMMARY_FILE"
echo "===========================================" >> "$SUMMARY_FILE"

print_status "Starting Zypin CLI tests..."
print_status "Output will be written to separate files in: $PROJECT_ROOT/zypin-core/test/results/"

# Change to zypin-core directory
cd "$PROJECT_ROOT/zypin-core"

# Test Global Mode Commands
print_status "Testing Global Mode Commands..."

# 1. Main help
run_command "node cli/index.js" "zypin (main help)" "global-mode" "01-main-help"

# 2. Start command help
run_command "node cli/index.js start --help" "zypin start --help" "global-mode" "02-start-help"

# 3. Start command without packages (should show help)
run_command "node cli/index.js start" "zypin start (no packages)" "global-mode" "03-start-no-packages"

# 4. Start command with invalid package
run_command "node cli/index.js start --packages invalid-package" "zypin start --packages invalid-package" "global-mode" "04-start-invalid-package"

# 5. Start command with valid package (long-running)
run_command "node cli/index.js start --packages selenium" "zypin start --packages selenium" "global-mode" "05-start-valid-package" "15" "true"

# 6. Start command with remote server
run_command "node cli/index.js start --server http://remote:8421" "zypin start --server http://remote:8421" "global-mode" "06-start-remote-server" "10" "false"

# 7. Create-project command help
run_command "node cli/index.js create-project --help" "zypin create-project --help" "global-mode" "07-create-project-help"

# 8. Create-project without name (should show help)
run_command "node cli/index.js create-project" "zypin create-project (no name)" "global-mode" "08-create-project-no-name"

# 9. Create-project with name but no template (should show help)
run_command "node cli/index.js create-project test-project" "zypin create-project test-project (no template)" "global-mode" "09-create-project-no-template"

# 10. Create-project with invalid template
run_command "node cli/index.js create-project test-project --template invalid/template" "zypin create-project test-project --template invalid/template" "global-mode" "10-create-project-invalid-template"

# 11. Create-project with valid template
run_command "node cli/index.js create-project test-project --template selenium/cucumber-bdd" "zypin create-project test-project --template selenium/cucumber-bdd" "global-mode" "11-create-project-valid-template"

# 12. Create-project with force option
run_command "node cli/index.js create-project test-project --template selenium/cucumber-bdd --force" "zypin create-project test-project --template selenium/cucumber-bdd --force" "global-mode" "12-create-project-with-force"

# 13. Update command help
run_command "node cli/index.js update --help" "zypin update --help" "global-mode" "13-update-help"

# 14. Update command execution
run_command "node cli/index.js update" "zypin update" "global-mode" "14-update-execution"

# 15. MCP command help
run_command "node cli/index.js mcp --help" "zypin mcp --help" "global-mode" "15-mcp-help"

# 16. MCP command with default options (long-running)
run_command "node cli/index.js mcp" "zypin mcp (default options)" "global-mode" "16-mcp-default" "10" "true"

# 17. MCP command with browser option (long-running)
run_command "node cli/index.js mcp --browser firefox" "zypin mcp --browser firefox" "global-mode" "17-mcp-browser" "10" "true"

# 18. MCP command with headed option (long-running)
run_command "node cli/index.js mcp --headed" "zypin mcp --headed" "global-mode" "18-mcp-headed" "10" "true"

# 19. MCP command with size options (long-running)
run_command "node cli/index.js mcp --width 1920 --height 1080" "zypin mcp --width 1920 --height 1080" "global-mode" "19-mcp-size" "10" "true"

# 20. MCP command with timeout option (long-running)
run_command "node cli/index.js mcp --timeout 60000" "zypin mcp --timeout 60000" "global-mode" "20-mcp-timeout" "10" "true"

# 21. Health command help
run_command "node cli/index.js health --help" "zypin health --help" "global-mode" "21-health-help"

# 22. Health command without server (should show help)
run_command "node cli/index.js health" "zypin health (no server)" "global-mode" "22-health-no-server"

# 23. Health command with valid server
run_command "node cli/index.js health --server http://localhost:8421" "zypin health --server http://localhost:8421" "global-mode" "23-health-valid-server"

# 24. Health command with invalid server
run_command "node cli/index.js health --server http://invalid:8421" "zypin health --server http://invalid:8421" "global-mode" "24-health-invalid-server"

# 25. Global options - debug mode
run_command "node cli/index.js --debug" "zypin --debug" "global-mode" "25-global-debug"

# 26. Global options - server option
run_command "node cli/index.js --server http://remote:8421" "zypin --server http://remote:8421" "global-mode" "26-global-server"

# 27. Version display
run_command "node cli/index.js --version" "zypin --version" "global-mode" "27-version"

# Test Template Mode Commands
print_status "Testing Template Mode Commands..."

# Change to template directory for template mode commands
cd "$PROJECT_ROOT/zypin-selenium/templates/cucumber-bdd"

# 28. Main zypin command (template mode - should show template mode help)
run_command "node ../../../zypin-core/cli/index.js" "zypin (template mode - main help)" "template-mode" "28-template-main-help"

# 29. Run command help (template mode)
run_command "node ../../../zypin-core/cli/index.js run --help" "zypin run --help (template mode)" "template-mode" "29-template-run-help"

# 30. Run command without input (should show help)
run_command "node ../../../zypin-core/cli/index.js run" "zypin run (no input)" "template-mode" "30-template-run-no-input"

# 31. Run command with input files (long-running)
run_command "node ../../../zypin-core/cli/index.js run --input test/features/step-definitions-test.feature" "zypin run --input test/features/step-definitions-test.feature" "template-mode" "31-template-run-with-input" "30" "true"

# 32. Run command with browser option (long-running)
run_command "node ../../../zypin-core/cli/index.js run --input test/features/step-definitions-test.feature --browser chrome" "zypin run --input test/features/step-definitions-test.feature --browser chrome" "template-mode" "32-template-run-browser" "30" "true"

# 33. Run command with headless option (long-running)
run_command "node ../../../zypin-core/cli/index.js run --input test/features/step-definitions-test.feature --headless" "zypin run --input test/features/step-definitions-test.feature --headless" "template-mode" "33-template-run-headless" "30" "true"

# 34. Run command with timeout option (long-running)
run_command "node ../../../zypin-core/cli/index.js run --input test/features/step-definitions-test.feature --timeout 30000" "zypin run --input test/features/step-definitions-test.feature --timeout 30000" "template-mode" "34-template-run-timeout" "30" "true"

# 35. Run command with parallel option (long-running)
run_command "node ../../../zypin-core/cli/index.js run --input test/features/step-definitions-test.feature --parallel 2" "zypin run --input test/features/step-definitions-test.feature --parallel 2" "template-mode" "35-template-run-parallel" "30" "true"

# 36. Run command with retries option (long-running)
run_command "node ../../../zypin-core/cli/index.js run --input test/features/step-definitions-test.feature --retries 3" "zypin run --input test/features/step-definitions-test.feature --retries 3" "template-mode" "36-template-run-retries" "30" "true"

# 37. Run command with window size option (long-running)
run_command "node ../../../zypin-core/cli/index.js run --input test/features/step-definitions-test.feature --window-size 1920x1080" "zypin run --input test/features/step-definitions-test.feature --window-size 1920x1080" "template-mode" "37-template-run-window-size" "30" "true"

# 38. Guide command help (template mode)
run_command "node ../../../zypin-core/cli/index.js guide --help" "zypin guide --help (template mode)" "template-mode" "38-template-guide-help"

# 39. Guide command without options (should show help)
run_command "node ../../../zypin-core/cli/index.js guide" "zypin guide (no options)" "template-mode" "39-template-guide-no-options"

# 40. Guide command with write option
run_command "node ../../../zypin-core/cli/index.js guide --write" "zypin guide --write" "template-mode" "40-template-guide-write"

# 41. Guide command with debugging option
run_command "node ../../../zypin-core/cli/index.js guide --debugging" "zypin guide --debugging" "template-mode" "41-template-guide-debugging"

# 42. Guide command with readme option
run_command "node ../../../zypin-core/cli/index.js guide --readme" "zypin guide --readme" "template-mode" "42-template-guide-readme"

# 43. Template mode with debug option
run_command "node ../../../zypin-core/cli/index.js --debug" "zypin --debug (template mode)" "template-mode" "43-template-debug"

# 44. Template mode with server option
run_command "node ../../../zypin-core/cli/index.js --server http://remote:8421" "zypin --server http://remote:8421 (template mode)" "template-mode" "44-template-server"

# Test Error Cases and Edge Cases
print_status "Testing Error Cases and Edge Cases..."

# Return to project root
cd "$PROJECT_ROOT"

# 45. Invalid command in global mode
run_command "node zypin-core/cli/index.js invalid-command" "zypin invalid-command (global mode)" "error-cases" "45-invalid-command-global"

# 46. Invalid command in template mode
cd "$PROJECT_ROOT/zypin-selenium/templates/cucumber-bdd"
run_command "node ../../../zypin-core/cli/index.js invalid-command" "zypin invalid-command (template mode)" "error-cases" "46-invalid-command-template"

# 47. Commands run outside project directory (template mode)
cd "$PROJECT_ROOT"
run_command "node zypin-core/cli/index.js run --input test.feature" "zypin run outside project (template mode)" "error-cases" "47-run-outside-project"

# 48. Commands run without package.json (template mode)
mkdir -p "$PROJECT_ROOT/temp-no-package"
cd "$PROJECT_ROOT/temp-no-package"
run_command "node ../zypin-core/cli/index.js run --input test.feature" "zypin run without package.json" "error-cases" "48-run-no-package-json"

# 49. Commands run with invalid package.json (template mode)
echo '{"invalid": "json"' > package.json
run_command "node ../zypin-core/cli/index.js run --input test.feature" "zypin run with invalid package.json" "error-cases" "49-run-invalid-package-json"

# 50. Commands run with missing zypin config (template mode)
echo '{"name": "test", "version": "1.0.0"}' > package.json
run_command "node ../zypin-core/cli/index.js run --input test.feature" "zypin run without zypin config" "error-cases" "50-run-no-zypin-config"

# 51. Commands run with invalid template (template mode)
echo '{"name": "test", "version": "1.0.0", "zypin": {"package": "invalid", "template": "invalid"}}' > package.json
run_command "node ../zypin-core/cli/index.js run --input test.feature" "zypin run with invalid template" "error-cases" "51-run-invalid-template"

# Clean up temp directory
cd "$PROJECT_ROOT"
rm -rf "$PROJECT_ROOT/temp-no-package"

# Clean up test-project directory
print_status "Cleaning up test-project directory..."
rm -rf "$PROJECT_ROOT/test-project"
rm -rf "$PROJECT_ROOT/zypin-core/test-project"

# Test completed
print_success "All CLI tests completed!"
print_status "Results written to separate files in: $PROJECT_ROOT/zypin-core/test/results/"

# Show summary statistics
if [ -f "$SUMMARY_FILE" ]; then
    total_tests=$(tail -n +5 "$SUMMARY_FILE" | wc -l)
    success_tests=$(grep "SUCCESS" "$SUMMARY_FILE" | wc -l)
    failed_tests=$(grep "FAILED" "$SUMMARY_FILE" | wc -l)
    timeout_tests=$(grep "TIMEOUT" "$SUMMARY_FILE" | wc -l)
    
    print_status "Test Summary:"
    echo "  Total tests: $total_tests"
    echo "  Successful: $success_tests"
    echo "  Failed: $failed_tests"
    echo "  Timed out: $timeout_tests"
    
    echo ""
    print_status "To view the results:"
    echo "  Summary: cat zypin-core/test/results/test-summary.txt"
    echo "  Global mode: ls zypin-core/test/results/global-mode/"
    echo "  Template mode: ls zypin-core/test/results/template-mode/"
    echo "  Error cases: ls zypin-core/test/results/error-cases/"
    echo ""
    echo "  View specific test: cat zypin-core/test/results/global-mode/01-main-help.txt"
    echo "  View all results: find zypin-core/test/results/ -name '*.txt' -exec cat {} \\;"
fi

echo ""
print_success "Script completed successfully!"
