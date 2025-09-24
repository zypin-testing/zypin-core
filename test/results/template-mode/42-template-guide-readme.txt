Zypin CLI Test Result
Command: zypin guide --readme
Timestamp: Wed Sep 24 07:54:23 +07 2025
Category: template-mode
Timeout: 10s
Long-running: false
===========================================

# Cucumber BDD Template

A BDD (Behavior-Driven Development) test project created with the Zypin Testing Framework using Cucumber and Selenium WebDriver.

## Getting Started

### Prerequisites
- Node.js 16+
- Java 11+ (for Selenium Grid)
- Zypin Framework

### Installation

1. Create a new project from this template:
```bash
zypin create-project my-bdd-tests --template selenium/cucumber-bdd
cd my-bdd-tests
```

2. Install dependencies:
```bash
npm install
```

3. Start Selenium Grid:
```bash
zypin start --packages selenium
```

4. Run tests:
```bash
zypin run --input features/
```

## Usage

### Basic Commands

```bash
# Run all feature files
zypin run --input features/

# Run specific feature file
zypin run --input features/demo.feature

# Run in headless mode
zypin run --input features/ --headless

# Run with different browser
zypin run --input features/ --browser firefox

# Run with custom timeout
zypin run --input features/ --timeout 60000

# Run with tags
zypin run --input features/ --tags @smoke
```

### Configuration

Zypin uses a 3-tier configuration system (CLI parameters override user config, which overrides defaults):

1. **Package defaults** (built into the framework)
2. **User project config** (in your `package.json`)
3. **CLI parameters** (highest priority)

Configure your tests in `package.json`:

```json
{
  "zypin": {
    "config": {
      "browser": "chrome",
      "headless": false,
      "timeout": 30000,
      "parallel": 1,
      "retries": 0,
      "windowSize": "1920x1080"
    }
  }
}
```

## Project Structure

```
├── features/              # Gherkin feature files
│   └── demo.feature      # Example feature file
├── step-definitions/      # Step implementation files
│   └── index.js          # Step definitions
├── support/              # Test setup and configuration
│   └── index.js          # World setup and hooks
├── package.json          # Dependencies and config
└── README.md             # This file
```

## Test Example

The included test demonstrates:
- BDD scenario structure with Given-When-Then
- WebDriver integration with Cucumber
- Page navigation and element interaction
- Test verification and cleanup

## Troubleshooting

**Java not found:**
- Install Java 11+ from [Adoptium](https://adoptium.net/)

**Grid not running:**
- Run `zypin start --packages selenium`

**Debug mode:**
```bash
zypin run --input features/ --debug
```

**Step definition not found:**
- Check step definition files are in `step-definitions/` directory

## Next Steps

- Add more feature files
- Implement page object pattern
- Add data-driven tests with scenario outlines
- Set up CI/CD integration
- Add custom reporting

SUCCESS: Command completed with exit code 0

===========================================
End of test: Wed Sep 24 07:54:24 +07 2025
