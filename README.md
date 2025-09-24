# Zypin Core

Tool-agnostic testing framework with plugin architecture and MCP integration.

## Installation

```bash
npm install -g https://github.com/zypin-testing/zypin-core
```

## Quick Start

```bash
# Create project
zypin create-project my-tests --template selenium/basic-webdriver
cd my-tests && npm install

# Start services
zypin start --packages selenium

# Run tests
zypin run --input test.js
```

## Commands

- `zypin start` - Start testing packages
- `zypin run` - Run tests
- `zypin create-project` - Create test project from template
- `zypin mcp` - Start MCP server for testing automation
- `zypin health` - Check service health
- `zypin update` - Update framework and packages

## MCP Integration

Testing automation via Model Context Protocol.

### MCP Client Configuration

Add to your MCP client config:

```json
{
  "mcpServers": {
    "zypin-browser": {
      "command": "zypin",
      "args": ["mcp"]
    }
  }
}
```

Available tools: navigate, click, type, screenshot, etc.

## License

MIT
