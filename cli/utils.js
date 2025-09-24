/**
 * Shared utilities and helper functions for Zypin CLI
 * Provides common functionality used across global and template commands
 * 
 * TODO:
 * - Implement help display functions for all command types
 * - Add version management and display utilities
 * - Create template guide discovery and display functions
 * - Add common error handling and user feedback utilities
 * - Implement shared configuration and validation helpers
 * - Add consistent formatting and styling utilities
 */

const chalk = require('chalk');
const path = require('path');
const pluginLoader = require('../core/plugin-loader');
const templateScanner = require('../core/template-scanner');

// Helper function to get current versions
async function getCurrentVersions() {
  const versions = [];
  
  // Get core package version
  try {
    const corePackage = require('../package.json');
    versions.push({ name: 'zypin-core', version: corePackage.version });
  } catch (error) {
    versions.push({ name: 'zypin-core', version: 'unknown' });
  }
  
  // Get @zypin package versions
  const availablePlugins = pluginLoader.getPlugins();
  for (const plugin of availablePlugins) {
    try {
      const pluginPackage = require(path.join(plugin.path, 'package.json'));
      versions.push({ name: `@zypin/${plugin.name}`, version: pluginPackage.version });
    } catch (error) {
      versions.push({ name: `@zypin/${plugin.name}`, version: 'unknown' });
    }
  }
  
  // Check for zypin-mcp package
  try {
    const zypinMcpPath = require.resolve('zypin-mcp');
    const { execSync } = require('child_process');
    const mcpVersion = execSync(`node ${zypinMcpPath} --version`, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      timeout: 10000 // 10 second timeout
    });
    // If we get here, the command succeeded
    const version = mcpVersion.trim();
    versions.push({ name: 'zypin-mcp', version: version || 'available' });
  } catch (error) {
    // zypin-mcp not available
    // This is expected and not an error condition
  }
  
  return versions;
}

// Helper function to show start help
function showStartHelp() {
  console.log(chalk.blue('🚀 Zypin Package Starter'));
  console.log(chalk.gray('='.repeat(30)));
  console.log(chalk.gray('Start testing packages and their services'));
  console.log('');

  // Show available packages
  const availablePlugins = pluginLoader.getPlugins();

  console.log(chalk.blue('📦 Available Packages:'));
  console.log(chalk.gray('='.repeat(25)));

  if (availablePlugins.length === 0) {
    console.log(chalk.yellow('No packages found in node_modules/@zypin/'));
  } else {
    availablePlugins.forEach(plugin => {
      const capabilities = [];
      if (plugin.hasStart) capabilities.push('start');
      if (plugin.hasRun) capabilities.push('run');
      if (plugin.hasHealth) capabilities.push('health');

      console.log(`  ${chalk.green('●')} ${chalk.bold(plugin.name)}`);
      console.log(`    ${chalk.gray(`Capabilities: ${capabilities.join(', ')}`)}`);
      if (plugin.templates.length > 0) {
        console.log(`    ${chalk.gray(`Templates: ${plugin.templates.join(', ')}`)}`);
      }
    });
  }

  console.log('');
  
  // Only show usage examples when packages are available
  if (availablePlugins.length > 0) {
    console.log(chalk.blue('💡 Usage Examples:'));
    console.log(chalk.gray('='.repeat(20)));
    const firstPackage = availablePlugins[0].name;
    console.log(chalk.gray(`  zypin start --packages ${firstPackage}`));
    if (availablePlugins.length > 1) {
      console.log(chalk.gray(`  zypin start --packages ${firstPackage},${availablePlugins[1].name}`));
    }
    console.log('');
  }

  console.log(chalk.blue('🔧 Options:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  --packages <packages>  Comma-separated list of packages to start'));
  console.log(chalk.gray('  --force               Force restart server even if already running'));
  console.log('');

  console.log(chalk.blue('📚 Next Steps:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  1. Start packages:  zypin start --packages <package>'));
  console.log(chalk.gray('  2. Check health:    zypin health --server http://localhost:8421'));
  console.log(chalk.gray('  3. Run tests:       cd <project> && zypin run --input <files>'));
  console.log('');

  console.log(chalk.gray('For more help: zypin --help'));
}

// Helper function to show create-project help
function showCreateProjectHelp() {
  console.log(chalk.blue('🚀 Zypin Project Creator'));
  console.log(chalk.gray('='.repeat(40)));
  console.log(chalk.gray('Create a new test project from available templates'));
  console.log('');

  // Show available templates
  const availableTemplates = templateScanner.getTemplates();

  console.log(chalk.blue('📋 Available Templates:'));
  console.log(chalk.gray('='.repeat(25)));

  if (availableTemplates.length === 0) {
    console.log(chalk.yellow('No templates found'));
  } else {
    availableTemplates.forEach(template => {
      console.log(`  ${chalk.green('●')} ${chalk.bold(template.namespacedName)}`);
      console.log(`    ${chalk.gray(`Package: ${template.plugin} | Template: ${template.name}`)}`);
      console.log(`    ${chalk.gray(template.description)}`);
    });
  }

  console.log('');
  console.log(chalk.blue('💡 Usage Examples:'));
  console.log(chalk.gray('='.repeat(20)));
  
  // Get first template for example
  const firstTemplate = availableTemplates.length > 0 ? availableTemplates[0].namespacedName : '<package>/<template>';
  console.log(chalk.gray(`  zypin create-project my-tests --template ${firstTemplate}`));
  console.log('');

  console.log(chalk.blue('🔧 Options:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  --template <template>  Template to use (required)'));
  console.log(chalk.gray('  --force               Overwrite existing directory'));
  console.log('');

  console.log(chalk.blue('📚 Next Steps:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  1. Create project: zypin create-project <name> --template <template>'));
  console.log(chalk.gray('  2. Install deps:   cd <project> && npm install'));
  console.log(chalk.gray('  3. Learn to run:   zypin run --help'));
  console.log(chalk.gray('  4. View guides:    zypin guide --help'));
  console.log('');

  console.log(chalk.gray('For more help: zypin --help'));
}

// Helper function to show run help
function showRunHelp() {
  console.log(chalk.blue('🧪 Zypin Test Runner'));
  console.log(chalk.gray('='.repeat(30)));
  console.log(chalk.gray('Run tests using detected template from package.json'));
  console.log('');

  // Check if we're in a zypin project
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!require('fs').existsSync(packageJsonPath)) {
    console.log(chalk.red('❌ No package.json found in current directory'));
    console.log(chalk.gray('Make sure you are in a Zypin project directory'));
    console.log('');
    console.log(chalk.blue('💡 Create a project first:'));
    console.log(chalk.gray('  zypin create-project my-tests --template <package>/<template>'));
    console.log('');
    console.log(chalk.gray('For more help: zypin --help'));
    return;
  }

  const userPackageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf8'));
  const packageName = userPackageJson.zypin?.package;
  const templateName = userPackageJson.zypin?.template;

  if (!packageName || !templateName) {
    console.log(chalk.red('❌ No zypin configuration found in package.json'));
    console.log(chalk.gray('Make sure you created this project with "zypin create-project"'));
    console.log('');
    console.log(chalk.blue('💡 Create a project first:'));
    console.log(chalk.gray('  zypin create-project my-tests --template <package>/<template>'));
    console.log('');
    console.log(chalk.gray('For more help: zypin --help'));
    return;
  }

  console.log(chalk.blue('📋 Current Project:'));
  console.log(chalk.gray('='.repeat(20)));
  console.log(chalk.gray(`  Package: ${packageName}`));
  console.log(chalk.gray(`  Template: ${templateName}`));
  console.log('');

  console.log(chalk.blue('💡 Usage Examples:'));
  console.log(chalk.gray('='.repeat(20)));
  
  // Get template help configuration
  const template = templateScanner.getTemplate(`${packageName}/${templateName}`);
  const helpConfig = template?.help;
  
  if (helpConfig && helpConfig.examples && helpConfig.examples.length > 0) {
    // Show template-specific examples
    helpConfig.examples.forEach(example => {
      console.log(chalk.gray(`  ${example}`));
    });
  } else {
    // Show generic example
    console.log(chalk.gray('  zypin run --input <files>'));
  }
  console.log('');

  console.log(chalk.blue('🔧 Configuration Options:'));
  console.log(chalk.gray('='.repeat(25)));
  console.log(chalk.gray('  --input <files>        Test files or directories to run (required)'));
  console.log(chalk.gray('  --browser <browser>     Browser (chrome, firefox, safari, edge)'));
  console.log(chalk.gray('  --headless             Run in headless mode'));
  console.log(chalk.gray('  --timeout <ms>         Test timeout in milliseconds'));
  console.log(chalk.gray('  --parallel <number>    Number of parallel executions'));
  console.log(chalk.gray('  --retries <number>     Number of retries for failed tests'));
  console.log(chalk.gray('  --window-size <size>   Browser window size (WIDTHxHEIGHT)'));
  console.log('');

  console.log(chalk.blue('📚 Next Steps:'));
  console.log(chalk.gray('='.repeat(15)));
  
  if (helpConfig && helpConfig.nextSteps && helpConfig.nextSteps.length > 0) {
    // Show template-specific next steps
    helpConfig.nextSteps.forEach((step, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${step}`));
    });
  } else {
    // Show generic next steps
    console.log(chalk.gray('  1. Start servers:  zypin start --packages <package>'));
    console.log(chalk.gray('  2. Run tests:      zypin run --input <files>'));
  }
  console.log('');

  console.log(chalk.gray('For more help: zypin --help'));
}

// Helper function to show MCP help
function showMcpHelp() {
  console.log(chalk.blue('🤖 Zypin MCP Server'));
  console.log(chalk.gray('='.repeat(25)));
  console.log(chalk.gray('Start MCP server for browser automation via Model Context Protocol'));
  console.log('');

  console.log(chalk.blue('💡 Usage Examples:'));
  console.log(chalk.gray('='.repeat(20)));
  console.log(chalk.gray('  zypin mcp'));
  console.log(chalk.gray('  zypin mcp --browser firefox --headed'));
  console.log(chalk.gray('  zypin mcp --browser webkit --width 1920 --height 1080'));
  console.log(chalk.gray('  zypin mcp --timeout 60000'));
  console.log('');

  console.log(chalk.blue('🔧 Options:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  -b, --browser <browser>  Browser to use (chromium, firefox, webkit) [default: chromium]'));
  console.log(chalk.gray('  --headed                Run browser in headed mode (visible)'));
  console.log(chalk.gray('  -w, --width <width>     Viewport width [default: 1280]'));
  console.log(chalk.gray('  -l, --height <height>   Viewport height [default: 720]'));
  console.log(chalk.gray('  -t, --timeout <ms>      Default timeout in milliseconds [default: 30000]'));
  console.log('');

  console.log(chalk.blue('📚 Next Steps:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  1. Start MCP server: zypin mcp'));
  console.log(chalk.gray('  2. Connect AI tools: Use MCP protocol to connect'));
  console.log(chalk.gray('  3. Automate browser: Send commands via MCP'));
  console.log('');

  console.log(chalk.blue('🔍 What it does:'));
  console.log(chalk.gray('='.repeat(20)));
  console.log(chalk.gray('  • Starts Model Context Protocol server'));
  console.log(chalk.gray('  • Provides browser automation capabilities'));
  console.log(chalk.gray('  • Enables AI tools to control browsers'));
  console.log(chalk.gray('  • Supports multiple browsers and configurations'));
  console.log('');

  console.log(chalk.gray('For more help: zypin --help'));
}

// Helper function to show health help
function showHealthHelp() {
  console.log(chalk.blue('🏥 Zypin Health Checker'));
  console.log(chalk.gray('='.repeat(30)));
  console.log(chalk.gray('Check health status of running packages on remote server'));
  console.log('');

  console.log(chalk.blue('💡 Usage Examples:'));
  console.log(chalk.gray('='.repeat(20)));
  console.log(chalk.gray('  zypin health --server http://localhost:8421'));
  console.log(chalk.gray('  zypin health --server http://remote-server:8421'));
  console.log(chalk.gray('  zypin health --server http://192.168.1.100:8421'));
  console.log('');

  console.log(chalk.blue('🔧 Options:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  --server <url>        Zypin server URL (required)'));
  console.log(chalk.gray('  --debug               Enable debug mode'));
  console.log('');

  console.log(chalk.blue('📚 Next Steps:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  1. Start server:    zypin start --packages <package>'));
  console.log(chalk.gray('  2. Check health:    zypin health --server http://localhost:8421'));
  console.log('');

  console.log(chalk.blue('🔍 What it shows:'));
  console.log(chalk.gray('='.repeat(20)));
  console.log(chalk.gray('  • Number of running packages'));
  console.log(chalk.gray('  • Package names and PIDs'));
  console.log(chalk.gray('  • Start times and status'));
  console.log('');

  console.log(chalk.gray('For more help: zypin --help'));
}

// Helper function to show guide help
function showGuideHelp() {
  console.log(chalk.blue('📚 Zypin Guide Viewer'));
  console.log(chalk.gray('='.repeat(30)));
  console.log(chalk.gray('View usage guides and documentation for current template'));
  console.log('');
  
  console.log(chalk.blue('💡 Usage:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  zypin guide --write      # Show writing guide'));
  console.log(chalk.gray('  zypin guide --debugging  # Show debugging guide'));
  console.log(chalk.gray('  zypin guide --readme     # Show README'));
  console.log('');
  
  console.log(chalk.blue('📋 Available guides:'));
  console.log(chalk.gray('='.repeat(20)));
  console.log(chalk.gray('  • Writing Guide - How to write test code'));
  console.log(chalk.gray('  • Debugging Guide - How to debug and troubleshoot'));
  console.log(chalk.gray('  • README - Template overview and quick start'));
  console.log('');
  
  console.log(chalk.gray('For more help: zypin --help'));
}


module.exports = {
  getCurrentVersions,
  showStartHelp,
  showCreateProjectHelp,
  showRunHelp,
  showMcpHelp,
  showHealthHelp,
  showGuideHelp
};
