/**
 * Main CLI entry point for Zypin Testing Framework
 * Handles command parsing and routing using Commander.js with plugin architecture
 * 
 * TODO:
 * - Update to use plugin-loader instead of package-loader
 * - Add template-scanner for namespaced templates
 * - Add package-installer for missing packages
 * - Update command routing to work with plugin interface
 * - Add plugin discovery and validation
 * - Implement auto-help when no arguments provided
 */

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const pluginLoader = require('./core/plugin-loader');
const templateScanner = require('./core/template-scanner');
const packageInstaller = require('./core/package-installer');
const processManager = require('./core/process-manager');
const zypinServer = require('./core/server');
const templateManager = require('./core/template-manager');

const program = new Command();

// Helper function to get current versions
async function getCurrentVersions() {
  const versions = [];
  
  // Get core package version
  try {
    const corePackage = require('./package.json');
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

program
  .name('zypin')
  .description('Tool-agnostic testing framework')
  .version('0.1.0')
  .option('--server <url>', 'Zypin server URL (e.g., http://server:8421)')
  .option('--debug', 'Enable debug mode to show detailed output');

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
    console.log(chalk.gray('Install packages with: npm install -g https://github.com/zypin-testing/zypin-selenium'));
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
  console.log(chalk.blue('💡 Usage Examples:'));
  console.log(chalk.gray('='.repeat(20)));
  console.log(chalk.gray('  zypin start --packages selenium'));
  console.log('');

  console.log(chalk.blue('🔧 Options:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  --packages <packages>  Comma-separated list of packages to start'));
  console.log('');

  console.log(chalk.blue('📚 Next Steps:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  1. Start packages:  zypin start --packages selenium'));
  console.log(chalk.gray('  2. Check health:    zypin health --server http://localhost:8421'));
  console.log(chalk.gray('  3. Run tests:       zypin run --input <test-files>'));
  console.log('');

  console.log(chalk.gray('For more help: zypin --help'));
}

// Start command
const startCommand = program
  .command('start')
  .description('Start testing packages')
  .option('--packages <packages>', 'Comma-separated list of packages to start');

// Override the help function to show custom help
startCommand.helpInformation = function() {
  showStartHelp();
  return '';
};

startCommand.action(async (options) => {
    // Set debug mode if global flag is provided
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    const serverUrl = program.opts().server;

    if (serverUrl) {
      try {
        const url = new URL(serverUrl);
        console.log(chalk.yellow('Remote start not supported. Please SSH to server:'));
        console.log(chalk.gray(`ssh user@${url.hostname}`));
        console.log(chalk.gray(`zypin start --packages ${options.packages || 'selenium'}`));
      } catch (error) {
        console.log(chalk.red('Invalid server URL provided:'), serverUrl);
        console.log(chalk.gray('Please provide a valid URL (e.g., http://server:8421)'));
      }
      return;
    }

    // Check if server is already running
    const serverStatus = await zypinServer.status();
    if (serverStatus.isRunning) {
      console.log(chalk.yellow('Zypin server is already running'));
      console.log(chalk.gray(`Server running on ${serverStatus.url}`));
      return;
    }

    // Start server immediately when start command begins
    try {
      console.log(chalk.blue('Starting Zypin server...'));
      await zypinServer.startServer();
      console.log(chalk.green(`✓ Server running on port ${zypinServer.getServerPort()}`));
    } catch (error) {
      console.log(chalk.red('Failed to start server:', error.message));
      console.log(chalk.red('Aborting start command'));
      return;
    }

    if (!options.packages) {
      showStartHelp();
      // Stop server when no packages specified
      console.log(chalk.gray('\nNo packages specified. Stopping server.'));
      await zypinServer.stopServer();
      return;
    }

    const packageNames = options.packages.split(',').map(name => name.trim());
    let startedCount = 0;

    for (const packageName of packageNames) {
      const plugin = pluginLoader.getPlugin(packageName);

      if (!plugin) {
        console.log(chalk.red(`Package '${packageName}' not found`));
        packageInstaller.showInstallationInstructions(packageName);
        continue;
      }

      if (!plugin.hasStart) {
        console.log(chalk.red(`Package '${packageName}' does not support start functionality`));
        continue;
      }

      const started = await processManager.startPackage(packageName, plugin);
      if (started) startedCount++;
    }

    console.log(chalk.green(`Started ${startedCount} of ${packageNames.length} packages`));
  });

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
    console.log(chalk.gray('Install packages with templates: npm install -g https://github.com/zypin-testing/zypin-selenium'));
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
  console.log(chalk.gray('  zypin create-project my-tests --template selenium/basic-webdriver'));
  console.log(chalk.gray('  zypin create-project api-tests --template selenium/cucumber-bdd'));
  console.log(chalk.gray('  zypin create-project ui-tests --template selenium/cucumber-bdd'));
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
  console.log(chalk.gray('  3. Start servers:  zypin start --packages selenium'));
  console.log(chalk.gray('  4. Run tests:      zypin run --input <test-files>'));
  console.log('');

  console.log(chalk.gray('For more help: zypin --help'));
}

// Create-project command
const createProjectCommand = program
  .command('create-project')
  .description('Create a new test project from a template')
  .argument('[project-name]', 'Name of the project to create')
  .option('--template <template>', 'Template to use (e.g., selenium/basic-webdriver)')
  .option('--force', 'Overwrite existing directory');

// Override the help function to show custom help
createProjectCommand.helpInformation = function() {
  showCreateProjectHelp();
  return '';
};

createProjectCommand.action(async (projectName, options) => {
    // Set debug mode if global flag is provided
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    // Show help if no project name provided
    if (!projectName) {
      showCreateProjectHelp();
      return;
    }

    if (!options.template) {
      // Show available templates when no template specified
      const availableTemplates = templateScanner.getTemplates();

      console.log(chalk.blue('Available templates:'));
      console.log(chalk.gray('='.repeat(30)));

      if (availableTemplates.length === 0) {
        console.log(chalk.yellow('No templates found'));
        console.log(chalk.gray('Install packages with templates: npm install -g https://github.com/zypin-testing/zypin-selenium'));
      } else {
        availableTemplates.forEach(template => {
          console.log(`  ${chalk.green('●')} ${chalk.bold(template.namespacedName)}`);
        });

        console.log(chalk.gray('\nUsage: zypin create-project <name> --template <template>'));
        console.log(chalk.gray('Example: zypin create-project my-tests --template selenium/basic-webdriver'));
      }
      return;
    }

    // Validate template exists
    const template = templateScanner.getTemplate(options.template);
    if (!template) {
      const availableTemplates = templateScanner.getTemplates();
      console.log(chalk.red(`Template not found: ${options.template}`));
      if (availableTemplates.length > 0) {
        console.log(chalk.yellow('Available templates:'));
        availableTemplates.forEach(t => {
          console.log(`  ${chalk.gray('•')} ${t.namespacedName}`);
        });
      }
      return;
    }

    // Create project
    const success = await templateManager.createProject(
      projectName,
      options.template,
      projectName, // Use project name as directory name
      { force: options.force }
    );

    if (!success) {
      process.exit(1);
    }
  });

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
    console.log(chalk.gray('  zypin create-project my-tests --template selenium/basic-webdriver'));
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
    console.log(chalk.gray('  zypin create-project my-tests --template selenium/basic-webdriver'));
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
  
  // Show template-specific examples
  if (templateName === 'cucumber-bdd') {
    console.log(chalk.gray('  zypin run --input features/'));
    console.log(chalk.gray('  zypin run --input features/demo.feature'));
    console.log(chalk.gray('  zypin run --input features/login.feature,features/checkout.feature'));
  } else {
    console.log(chalk.gray('  zypin run --input test.js'));
    console.log(chalk.gray('  zypin run --input tests/'));
    console.log(chalk.gray('  zypin run --input test1.js,test2.js'));
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
  console.log(chalk.gray('  1. Start servers:  zypin start --packages selenium'));
  
  // Show template-specific next steps
  if (templateName === 'cucumber-bdd') {
    console.log(chalk.gray('  2. Run tests:      zypin run --input features/'));
    console.log(chalk.gray('  3. Run with options: zypin run --input features/ --browser firefox --headless'));
  } else {
    console.log(chalk.gray('  2. Run tests:      zypin run --input test.js'));
    console.log(chalk.gray('  3. Run with options: zypin run --input test.js --browser firefox --headless'));
  }
  console.log('');

  console.log(chalk.gray('For more help: zypin --help'));
}

// Run command
const runCommand = program
  .command('run')
  .description('Run tests using detected template')
  .option('--input <files>', 'Test files or directories to run (required)')
  .option('--browser <browser>', 'Browser to use (chrome, firefox, safari, edge)')
  .option('--headless', 'Run in headless mode')
  .option('--timeout <ms>', 'Test timeout in milliseconds')
  .option('--parallel <number>', 'Number of parallel test executions')
  .option('--retries <number>', 'Number of retries for failed tests')
  .option('--window-size <size>', 'Browser window size (WIDTHxHEIGHT)');

// Override the help function to show custom help
runCommand.helpInformation = function() {
  showRunHelp();
  return '';
};

runCommand.action(async (options) => {
    // Set debug mode if global flag is provided
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    if (!options.input) {
      showRunHelp();
      return;
    }

    // Parse input files
    const inputFiles = options.input.split(',').map(file => file.trim());

    // Build CLI parameters object
    const cliParams = {};
    if (options.browser) cliParams.browser = options.browser;
    if (options.headless) cliParams.headless = true;
    if (options.timeout) cliParams.timeout = parseInt(options.timeout);
    if (options.parallel) cliParams.parallel = parseInt(options.parallel);
    if (options.retries) cliParams.retries = parseInt(options.retries);
    if (options.windowSize) cliParams.windowSize = options.windowSize;

    // Get package from current directory
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!require('fs').existsSync(packageJsonPath)) {
      console.log(chalk.red('No package.json found. Make sure you are in a Zypin project directory.'));
      console.log(chalk.gray('Use "zypin create-project" to create a new project first.'));
      return;
    }

    const userPackageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf8'));
    const packageName = userPackageJson.zypin?.package;

    if (!packageName) {
      console.log(chalk.red('No zypin package configuration found in package.json.'));
      console.log(chalk.gray('Make sure you created this project with "zypin create-project".'));
      return;
    }

    // Load package run function
    const plugin = pluginLoader.getPlugin(packageName);
    if (!plugin || !plugin.hasRun) {
      console.log(chalk.red(`Package '${packageName}' does not support test execution.`));
      if (!plugin) {
        packageInstaller.showInstallationInstructions(packageName);
      }
      return;
    }

    try {
      const result = await plugin.interface.run(inputFiles, cliParams);

      if (result.success) {
        console.log(chalk.green(`\n✅ ${result.message}`));
        process.exit(0);
      } else {
        console.log(chalk.red(`\n❌ ${result.message}`));
        process.exit(1);
      }
    } catch (error) {
      console.log(chalk.red(`\n❌ Test execution failed: ${error.message}`));
      process.exit(1);
    }
  });

// Update command
program
  .command('update')
  .description('Update zypin framework and all @zypin packages to latest versions')
  .action(async () => {
    // Set debug mode if global flag is provided
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    console.log(chalk.blue('🔄 Updating Zypin Framework...'));
    console.log(chalk.gray('='.repeat(40)));

    // Get current versions
    const currentVersions = await getCurrentVersions();
    console.log(chalk.blue('📋 Current versions:'));
    currentVersions.forEach(pkg => {
      console.log(chalk.gray(`  • ${pkg.name}: ${pkg.version}`));
    });
    console.log('');

    // Update core package (dependencies will be updated automatically)
    console.log(chalk.blue('📦 Updating core package and dependencies...'));
    try {
      const { execSync } = require('child_process');
      execSync('npm install -g https://github.com/zypin-testing/zypin-core.git', { stdio: 'inherit' });
      console.log(chalk.green('  ✓ Core package and dependencies updated'));
    } catch (error) {
      console.log(chalk.red('  ❌ Failed to update core package'));
      return;
    }

    // Get new versions after update
    console.log('');
    console.log(chalk.blue('📋 New versions:'));
    const newVersions = await getCurrentVersions();
    newVersions.forEach(pkg => {
      console.log(chalk.gray(`  • ${pkg.name}: ${pkg.version}`));
    });

    console.log('');
    console.log(chalk.green('✅ Update complete! Core package and dependencies updated successfully.'));
    console.log('');
    console.log(chalk.blue('💡 Next steps:'));
    console.log(chalk.gray('  - Restart any running services: zypin start --packages selenium'));
    console.log(chalk.gray('  - Start MCP server: zypin mcp'));
    console.log(chalk.gray('  - Check health: zypin health --server http://localhost:8421'));
  });

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

// MCP command
const mcpCommand = program
  .command('mcp')
  .description('Start MCP server for browser automation')
  .option('-b, --browser <browser>', 'Browser to use (chromium, firefox, webkit)', 'chromium')
  .option('--headed', 'Run browser in headed mode')
  .option('-w, --width <width>', 'Viewport width', '1280')
  .option('-l, --height <height>', 'Viewport height', '720')
  .option('-t, --timeout <timeout>', 'Default timeout in milliseconds', '30000');

// Override the help function to show custom help
mcpCommand.helpInformation = function() {
  showMcpHelp();
  return '';
};

mcpCommand.action(async (options) => {
    // Set debug mode if global flag is provided
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    console.log(chalk.blue('🚀 Starting Zypin MCP Server...'));
    console.log(chalk.gray('Browser automation via Model Context Protocol'));
    console.log('');

    try {
      // Build command arguments for zypin-mcp
      const args = [];
      
      if (options.browser) args.push('--browser', options.browser);
      if (options.headed) args.push('--headed');
      if (options.width) args.push('--width', options.width);
      if (options.height) args.push('--height', options.height);
      if (options.timeout) args.push('--timeout', options.timeout);

      // Execute zypin-mcp directly using require
      const zypinMcpPath = require.resolve('zypin-mcp');
      const { spawn } = require('child_process');
      const mcpProcess = spawn('node', [zypinMcpPath, ...args], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      // Handle process events
      mcpProcess.on('error', (error) => {
        console.log(chalk.red(`Failed to start MCP server: ${error.message}`));
        process.exit(1);
      });

      mcpProcess.on('exit', (code) => {
        if (code !== 0) {
          console.log(chalk.red(`MCP server exited with code ${code}`));
        }
        process.exit(code);
      });

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\nShutting down MCP server...'));
        mcpProcess.kill('SIGINT');
      });

      process.on('SIGTERM', () => {
        mcpProcess.kill('SIGTERM');
      });

    } catch (error) {
      console.log(chalk.red(`Error starting MCP server: ${error.message}`));
      process.exit(1);
    }
  });

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
  console.log(chalk.gray('  1. Start server:    zypin start --packages selenium'));
  console.log(chalk.gray('  2. Check health:    zypin health --server http://localhost:8421'));
  console.log(chalk.gray('  3. Run tests:       zypin run --input <test-files>'));
  console.log('');

  console.log(chalk.blue('🔍 What it shows:'));
  console.log(chalk.gray('='.repeat(20)));
  console.log(chalk.gray('  • Number of running packages'));
  console.log(chalk.gray('  • Package names and PIDs'));
  console.log(chalk.gray('  • Start times and status'));
  console.log('');

  console.log(chalk.gray('For more help: zypin --help'));
}

// Health command
const healthCommand = program
  .command('health')
  .description('Check health status of running packages');

// Override the help function to show custom help
healthCommand.helpInformation = function() {
  showHealthHelp();
  return '';
};

healthCommand.action(async () => {
    // Set debug mode if global flag is provided
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    const serverUrl = program.opts().server;

    if (!serverUrl) {
      showHealthHelp();
      return;
    }

    // Check if server is running, exit with message if not
    const serverStatus = await zypinServer.status(serverUrl);
    if (!serverStatus.isRunning) {
      console.log(chalk.yellow('Zypin server is not running'));
      console.log(chalk.gray('Use "zypin start" to start the server first'));
      return;
    }

    try {
      const response = await fetch(`${serverUrl}/api/health`);
      const status = await response.json();

      console.log(chalk.blue('Zypin Framework Status (Remote)'));
      console.log(chalk.gray('='.repeat(40)));

      if (status.running === 0) {
        console.log(chalk.yellow('No packages currently running on server'));
      } else {
        console.log(chalk.green(`${status.running} package(s) running on server:`));

        status.packages.forEach(proc => {
          console.log(`  ${chalk.green('●')} ${proc.name} (PID: ${proc.pid})`);
          console.log(`     Started: ${new Date(proc.startTime).toLocaleString()}`);
          console.log(`     Status: ${chalk.green(proc.status || 'running')}`);
        });
      }
    } catch (err) {
      console.log(chalk.red('Failed to connect to server:', err.message));
    }
  });

// Helper function to show guide help
function showGuideHelp() {
  console.log(chalk.blue('📚 Zypin Guide Viewer'));
  console.log(chalk.gray('='.repeat(30)));
  console.log(chalk.gray('View usage guides and documentation for templates'));
  console.log('');
  
  console.log(chalk.blue('💡 Usage:'));
  console.log(chalk.gray('='.repeat(15)));
  console.log(chalk.gray('  zypin guide --template <template>   # Show specific guide'));
  console.log(chalk.gray('  zypin guide --list             # List available guides'));
  console.log('');
  
  console.log(chalk.blue(' Available guides:'));
  console.log(chalk.gray('='.repeat(20)));
  const templates = templateScanner.getTemplates();
  const guidesWithGuides = templates.filter(t => {
    const fs = require('fs');
    const installedPath = path.join(t.path, 'USER_MANUAL.md');
    const sourcePath = path.join(__dirname, '..', 'zypin-selenium', 'templates', t.name, 'USER_MANUAL.md');
    return fs.existsSync(installedPath) || fs.existsSync(sourcePath);
  });
  
  if (guidesWithGuides.length === 0) {
    console.log(chalk.gray('  No guides available.'));
  } else {
    guidesWithGuides.forEach(template => {
      console.log(chalk.gray(`  • ${template.namespacedName}`));
    });
  }
  console.log('');
  
  console.log(chalk.gray('For more help: zypin --help'));
}

// Guide command
const guideCommand = program
  .command('guide')
  .description('View usage guides and documentation for templates')
  .option('--template <template>', 'Template to use (e.g., selenium/cucumber-bdd)')
  .option('--list', 'List all available guides');

// Override the help function to show custom help
guideCommand.helpInformation = function() {
  showGuideHelp();
  return '';
};

guideCommand.action(async (options) => {
  // Set debug mode if global flag is provided
  if (program.opts().debug) {
    console.log(chalk.gray('Debug mode enabled'));
  }

  if (options.list) {
    const templates = templateScanner.getTemplates();
    const guidesWithGuides = templates.filter(t => {
      const fs = require('fs');
      const installedPath = path.join(t.path, 'USER_MANUAL.md');
      const sourcePath = path.join(__dirname, '..', 'zypin-selenium', 'templates', t.name, 'USER_MANUAL.md');
      return fs.existsSync(installedPath) || fs.existsSync(sourcePath);
    });
    
    console.log(chalk.blue(' Available Guides:'));
    console.log(chalk.gray('='.repeat(25)));
    
    if (guidesWithGuides.length === 0) {
      console.log(chalk.gray('No guides available.'));
      return;
    }
    
    guidesWithGuides.forEach(template => {
      console.log(chalk.gray(`  • ${template.namespacedName}`));
      console.log(chalk.gray(`    ${template.description}`));
    });
    
    console.log('');
    console.log(chalk.gray('Usage: zypin guide --template <template>'));
    return;
  }

  if (!options.template) {
    showGuideHelp();
    return;
  }

  // Find template (support both short and full names)
  let template = templateScanner.getTemplate(options.template);
  if (!template) {
    const templates = templateScanner.getTemplates();
    template = templates.find(t => t.name === options.template);
  }

  if (!template) {
    console.log(chalk.red(`Template '${options.template}' not found`));
    console.log(chalk.gray('Available templates:'));
    const templates = templateScanner.getTemplates();
    templates.forEach(t => {
      console.log(chalk.gray(`  • ${t.namespacedName}`));
    });
    return;
  }

  const fs = require('fs');
  let guidePath = path.join(template.path, 'USER_MANUAL.md');
  
  // If not found in installed package, try source directory
  if (!fs.existsSync(guidePath)) {
    const sourcePath = path.join(__dirname, '..', 'zypin-selenium', 'templates', template.name, 'USER_MANUAL.md');
    if (fs.existsSync(sourcePath)) {
      guidePath = sourcePath;
    }
  }
  
  if (!fs.existsSync(guidePath)) {
    console.log(chalk.red(`No guide found for template: ${template.namespacedName}`));
    console.log(chalk.gray('Available guides:'));
    const templates = templateScanner.getTemplates();
    const guidesWithGuides = templates.filter(t => {
      const installedPath = path.join(t.path, 'USER_MANUAL.md');
      const sourcePath = path.join(__dirname, '..', 'zypin-selenium', 'templates', t.name, 'USER_MANUAL.md');
      return fs.existsSync(installedPath) || fs.existsSync(sourcePath);
    });
    guidesWithGuides.forEach(t => {
      console.log(chalk.gray(`  • ${t.namespacedName}`));
    });
    return;
  }

  // Display guide content
  try {
    const content = fs.readFileSync(guidePath, 'utf8');
    console.log(content);
  } catch (error) {
    console.log(chalk.red(`Error reading guide: ${error.message}`));
  }
});

// Auto-help behavior
if (process.argv.length <= 2) {
  program.help();
}

// Cleanup server on exit
process.on('SIGINT', async () => {
  await zypinServer.stopServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await zypinServer.stopServer();
  process.exit(0);
});

program.parse(process.argv);
