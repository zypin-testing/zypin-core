/**
 * Main CLI entry point for Zypin Testing Framework
 * Handles mode detection and command routing between global and template modes
 * 
 * TODO:
 * - Detect project context by checking for package.json with zypin section
 * - Route commands to global.js or template.js based on context
 * - Handle mode-specific help and error messages
 * - Maintain consistent command parsing and error handling
 * - Add debug mode support across both modes
 */

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const globalCommands = require('./global');
const templateCommands = require('./template');
const utils = require('./utils');

const program = new Command();

// Helper function to detect if we're in a zypin project
function isZypinProject() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.zypin && packageJson.zypin.package && packageJson.zypin.template;
  } catch (error) {
    return false;
  }
}

// Helper function to show mode-specific help
function showModeHelp(isProject) {
  if (isProject) {
    console.log(chalk.blue('🧪 Zypin Template Mode'));
    console.log(chalk.gray('='.repeat(30)));
    console.log(chalk.gray('You are in a Zypin project directory'));
    console.log('');
    console.log(chalk.blue('📋 Available Commands:'));
    console.log(chalk.gray('='.repeat(25)));
    console.log(chalk.gray('  run     Run tests using detected template'));
    console.log(chalk.gray('  guide   View template guides and documentation'));
    console.log('');
    console.log(chalk.gray('For more help: zypin <command> --help'));
  } else {
    console.log(chalk.blue('🚀 Zypin Global Mode'));
    console.log(chalk.gray('='.repeat(30)));
    console.log(chalk.gray('Zypin Testing Framework - Global Commands'));
    console.log('');
    console.log(chalk.blue('📋 Available Commands:'));
    console.log(chalk.gray('='.repeat(25)));
    console.log(chalk.gray('  start          Start testing packages and server'));
    console.log(chalk.gray('  create-project Create a new test project from template'));
    console.log(chalk.gray('  update         Update zypin framework and packages'));
    console.log(chalk.gray('  health         Check health status of running packages'));
    console.log(chalk.gray('  mcp            Start MCP server for testing automation'));
    console.log('');
    console.log(chalk.gray('For more help: zypin <command> --help'));
  }
}

// Setup main program
program
  .name('zypin')
  .description('Tool-agnostic testing framework')
  .version('0.1.0')
  .option('--debug', 'Enable debug mode to show detailed output');

// Auto-help behavior when no arguments provided
if (process.argv.length <= 2) {
  const isProject = isZypinProject();
  showModeHelp(isProject);
  process.exit(0);
}

// Route commands based on project context
const isProject = isZypinProject();

if (isProject) {
  // Template mode - load template commands
  templateCommands.setupCommands(program);
} else {
  // Global mode - load global commands
  globalCommands.setupCommands(program);
}

// Handle global options
program.on('option:debug', () => {
  process.env.ZYPIN_DEBUG = 'true';
  console.log(chalk.gray('Debug mode enabled'));
});

// Cleanup server on exit
process.on('SIGINT', async () => {
  const zypinServer = require('../core/server');
  await zypinServer.stopServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  const zypinServer = require('../core/server');
  await zypinServer.stopServer();
  process.exit(0);
});

program.parse(process.argv);
