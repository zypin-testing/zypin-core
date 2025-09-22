/**
 * Template/Project commands for Zypin Testing Framework
 * Handles project-specific operations when in a zypin project directory
 * 
 * TODO:
 * - Implement run command with template detection and execution
 * - Implement guide command for template documentation
 * - Add project context validation and error handling
 * - Integrate with plugin-loader for package execution
 * - Support template-specific configuration and options
 * - Add proper error messages for missing dependencies
 */

const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const pluginLoader = require('../core/plugin-loader');
const packageInstaller = require('../core/package-installer');
const templateScanner = require('../core/template-scanner');
const utils = require('./utils');

function setupCommands(program) {
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

  runCommand.helpInformation = function() {
    utils.showRunHelp();
    return '';
  };

  runCommand.action(async (options) => {
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    if (!options.input) {
      utils.showRunHelp();
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
    if (!fs.existsSync(packageJsonPath)) {
      console.log(chalk.red('No package.json found. Make sure you are in a Zypin project directory.'));
      console.log(chalk.gray('Use "zypin create-project" to create a new project first.'));
      return;
    }

    const userPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
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

  // Guide command
  const guideCommand = program
    .command('guide')
    .description('View usage guides and documentation for templates')
    .option('--template <template>', 'Template to use (e.g., selenium/cucumber-bdd)')
    .option('--list', 'List all available guides');

  guideCommand.helpInformation = function() {
    utils.showGuideHelp();
    return '';
  };

  guideCommand.action(async (options) => {
    if (program.opts().debug) {
      console.log(chalk.gray('Debug mode enabled'));
    }

    if (options.list) {
      const guidesWithGuides = utils.getGuidesWithManuals();
      
      console.log(chalk.blue('📚 Available Guides:'));
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
      utils.showGuideHelp();
      return;
    }

    // Find template (support both short and full names)
    let template = templateScanner.getTemplate(options.template);
    if (!template) {
      const templates = templateScanner.getTemplates() || [];
      template = templates.find(t => t.name === options.template);
    }

    if (!template) {
      console.log(chalk.red(`Template '${options.template}' not found`));
      console.log(chalk.gray('Available templates:'));
      const templates = templateScanner.getTemplates() || [];
      templates.forEach(t => {
        console.log(chalk.gray(`  • ${t.namespacedName}`));
      });
      return;
    }

    let guidePath = path.join(template.path, 'USER_MANUAL.md');
    
    // If not found in installed package, try source directory
    if (!fs.existsSync(guidePath)) {
      const sourcePath = path.join(__dirname, '..', '..', '..', 'zypin-selenium', 'templates', template.name, 'USER_MANUAL.md');
      if (fs.existsSync(sourcePath)) {
        guidePath = sourcePath;
      }
    }
    
    if (!fs.existsSync(guidePath)) {
      console.log(chalk.red(`No guide found for template: ${template.namespacedName}`));
      console.log(chalk.gray('Available guides:'));
      const guidesWithGuides = utils.getGuidesWithManuals();
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
}

module.exports = {
  setupCommands
};
