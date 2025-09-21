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

program
  .name('zypin')
  .description('Tool-agnostic testing framework')
  .version('0.1.0')
  .option('--server <url>', 'Zypin server URL (e.g., http://server:8421)')
  .option('--debug', 'Enable debug mode to show detailed output');

// Start command
program
  .command('start')
  .description('Start testing packages')
  .option('--packages <packages>', 'Comma-separated list of packages to start')
  .action(async (options) => {
    // Set debug mode if global flag is provided
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    const serverUrl = program.opts().server;

    if (serverUrl) {
      console.log(chalk.yellow('Remote start not supported. Please SSH to server:'));
      console.log(chalk.gray(`ssh user@${new URL(serverUrl).hostname}`));
      console.log(chalk.gray(`zypin start --packages ${options.packages || 'selenium'}`));
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
      // Show available packages when no packages specified
      const availablePlugins = pluginLoader.getPlugins();

      console.log(chalk.blue('Available packages:'));
      console.log(chalk.gray('='.repeat(20)));

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
          console.log(`    Capabilities: ${capabilities.join(', ')}`);
          if (plugin.templates.length > 0) {
            console.log(`    Templates: ${plugin.templates.join(', ')}`);
          }
        });

        console.log(chalk.gray('\nUsage: zypin start --packages <package1,package2,...>'));
        console.log(chalk.gray('Example: zypin start --packages selenium'));
      }

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

// Create-project command
program
  .command('create-project')
  .description('Create a new test project from a template')
  .argument('[project-name]', 'Name of the project to create')
  .option('--template <template>', 'Template to use (e.g., selenium/basic-webdriver)')
  .option('--force', 'Overwrite existing directory')
  .action(async (projectName, options) => {
    // Set debug mode if global flag is provided
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    // Show help if no project name provided
    if (!projectName) {
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
      console.log(chalk.gray('  zypin create-project ui-tests --template playwright/basic-playwright'));
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

// Run command
program
  .command('run')
  .description('Run tests using detected template')
  .option('--input <files>', 'Test files or directories to run (required)')
  .option('--browser <browser>', 'Browser to use (chrome, firefox, safari, edge)')
  .option('--headless', 'Run in headless mode')
  .option('--timeout <ms>', 'Test timeout in milliseconds')
  .option('--parallel <number>', 'Number of parallel test executions')
  .option('--retries <number>', 'Number of retries for failed tests')
  .option('--window-size <size>', 'Browser window size (WIDTHxHEIGHT)')
  .action(async (options) => {
    // Set debug mode if global flag is provided
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    if (!options.input) {
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
        return;
      }

      const userPackageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf8'));
      const packageName = userPackageJson.zypin?.package;
      const templateName = userPackageJson.zypin?.template;

      if (!packageName || !templateName) {
        console.log(chalk.red('❌ No zypin configuration found in package.json'));
        console.log(chalk.gray('Make sure you created this project with "zypin create-project"'));
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

// Health command
program
  .command('health')
  .description('Check health status of running packages')
  .action(async () => {
    // Set debug mode if global flag is provided
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    const serverUrl = program.opts().server;

    if (!serverUrl) {
      console.log(chalk.red('Server URL required. Use --server <url>'));
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
