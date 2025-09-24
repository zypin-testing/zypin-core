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
    const templateName = userPackageJson.zypin?.template;

    if (!packageName) {
      console.log(chalk.red('No zypin package configuration found in package.json.'));
      console.log(chalk.gray('Make sure you created this project with "zypin create-project".'));
      return;
    }

    if (!templateName) {
      console.log(chalk.red('No zypin template configuration found in package.json.'));
      console.log(chalk.gray('Make sure you created this project with "zypin create-project".'));
      return;
    }

    // Validate template exists
    const template = templateScanner.getTemplate(`${packageName}/${templateName}`);
    if (!template) {
      console.log(chalk.red(`Template '${packageName}/${templateName}' not found`));
      console.log(chalk.gray('Make sure the template exists and is properly configured.'));
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
    .option('--write', 'Show writing guide for current template')
    .option('--debugging', 'Show debugging guide for current template')
    .option('--readme', 'Show README for current template');

  guideCommand.helpInformation = function() {
    utils.showGuideHelp();
    return '';
  };

  guideCommand.action(async (options) => {
    if (program.opts().debug) {
      console.log(chalk.gray('Debug mode enabled'));
    }

    // Check if we're in a zypin project directory
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.log(chalk.red('No package.json found. Make sure you are in a Zypin project directory.'));
      console.log(chalk.gray('Use "zypin create-project" to create a new project first.'));
      return;
    }

    const userPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const templateName = userPackageJson.zypin?.template;

    if (!templateName) {
      console.log(chalk.red('No zypin template configuration found in package.json.'));
      console.log(chalk.gray('Make sure you created this project with "zypin create-project".'));
      return;
    }

    // Determine which guide to show
    let guideType = null;
    if (options.write) {
      guideType = 'write';
    } else if (options.debugging) {
      guideType = 'debug';
    } else if (options.readme) {
      guideType = 'readme';
    } else {
      utils.showGuideHelp();
      return;
    }

    // Find template
    let template = templateScanner.getTemplate(templateName);
    if (!template) {
      const templates = templateScanner.getTemplates() || [];
      template = templates.find(t => t.name === templateName);
    }

    if (!template) {
      console.log(chalk.red(`Template '${templateName}' not found`));
      return;
    }

    // Determine guide file name
    let guideFileName;
    let guideTypeName;
    if (guideType === 'write') {
      guideFileName = 'WRITE_GUIDE.md';
      guideTypeName = 'Writing';
    } else if (guideType === 'debug') {
      guideFileName = 'DEBUG_GUIDE.md';
      guideTypeName = 'Debugging';
    } else if (guideType === 'readme') {
      guideFileName = 'README.md';
      guideTypeName = 'README';
    }
    
    const guidePath = path.join(template.path, guideFileName);
    
    if (!fs.existsSync(guidePath)) {
      console.log(chalk.red(`${guideTypeName} guide not available for this template`));
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
