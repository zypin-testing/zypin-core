/**
 * Global commands for Zypin Testing Framework
 * Handles system-wide operations when not in a project directory
 * 
 * TODO:
 * - Implement start command with server and package management
 * - Implement create-project command with template selection
 * - Implement update command for framework packages
 * - Implement health command for remote server status
 * - Implement mcp command for browser automation server
 * - Add proper error handling and user feedback
 * - Integrate with existing core modules (plugin-loader, template-scanner, etc.)
 */

const chalk = require('chalk');
const path = require('path');
const pluginLoader = require('../core/plugin-loader');
const templateScanner = require('../core/template-scanner');
const packageInstaller = require('../core/package-installer');
const processManager = require('../core/process-manager');
const zypinServer = require('../core/server');
const templateManager = require('../core/template-manager');
const utils = require('./utils');

function setupCommands(program) {
  // Start command
  const startCommand = program
    .command('start')
    .description('Start testing packages and server')
    .option('--packages <packages>', 'Comma-separated list of packages to start')
    .option('--force', 'Force restart server even if already running');

  startCommand.helpInformation = function () {
    utils.showStartHelp();
    return '';
  };

  startCommand.action(async (options) => {
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
        console.log(chalk.gray(`zypin start --packages ${options.packages || '<package>'}`));
      } catch (error) {
        console.log(chalk.red('Invalid server URL provided:'), serverUrl);
        console.log(chalk.gray('Please provide a valid URL (e.g., http://server:8421)'));
      }
      return;
    }

    if (!options.packages) {
      utils.showStartHelp();
      return;
    }

    // Check if server is already running
    const serverStatus = await zypinServer.status();
    if (serverStatus.isRunning) {
      if (options.force) {
        console.log(chalk.yellow('Force restart requested. Stopping existing server...'));

        // Kill processes on port
        try {

          const { execSync } = require('child_process');
          const serverPort = zypinServer.getServerPort();
          const pids = execSync(`lsof -ti:${serverPort} -sTCP:LISTEN`, { encoding: 'utf8' })
            .split('\n')
            .map(pid => pid.trim())
            .filter(pid => pid);

          if (pids.length > 0) {
            // Kill all processes using the port
            pids.forEach(pid => {
              try {
                process.kill(pid, 'SIGTERM');
              } catch (killError) {
                // Process might already be dead
              }
            });
            console.log(chalk.green(`✓ Stopped ${pids.length} existing server process(es)`));
          }
        } catch (error) {
          // Ignore errors
        }

        // Simple wait
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(chalk.yellow('Zypin server is already running'));
        console.log(chalk.gray(`Server running on ${serverStatus.url}`));
        console.log(chalk.blue('💡 Tip: Use --force to restart the server'));
        return;
      }
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

    // Stop server if no packages were started
    if (startedCount === 0) {
      console.log(chalk.gray('No packages started. Stopping server.'));
      await zypinServer.stopServer();
    }
  });

  // Create-project command
  const createProjectCommand = program
    .command('create-project')
    .description('Create a new test project from a template')
    .argument('[project-name]', 'Name of the project to create')
    .option('--template <template>', 'Template to use (e.g., <package>/<template>)')
    .option('--force', 'Overwrite existing directory');

  createProjectCommand.helpInformation = function () {
    utils.showCreateProjectHelp();
    return '';
  };

  createProjectCommand.action(async (projectName, options) => {
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    // Show help if no project name provided
    if (!projectName) {
      utils.showCreateProjectHelp();
      return;
    }

    if (!options.template) {
      // Use the consolidated help function from utils
      utils.showCreateProjectHelp();
      return;
    }

    // Validate template exists
    const template = templateScanner.getTemplate(options.template);
    if (!template) {
      console.log(chalk.red(`Template not found: ${options.template}`));
      console.log('');
      // Show available templates using consolidated function
      utils.showCreateProjectHelp();
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

  // Update command
  program
    .command('update')
    .description('Update zypin framework and all @zypin packages to latest versions')
    .action(async () => {
      if (program.opts().debug) {
        process.env.ZYPIN_DEBUG = 'true';
        console.log(chalk.gray('Debug mode enabled'));
      }

      console.log(chalk.blue('🔄 Updating Zypin Framework...'));
      console.log(chalk.gray('='.repeat(40)));

      // Get current versions
      const currentVersions = await utils.getCurrentVersions();
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
      const newVersions = await utils.getCurrentVersions();
      newVersions.forEach(pkg => {
        console.log(chalk.gray(`  • ${pkg.name}: ${pkg.version}`));
      });

      console.log('');
      console.log(chalk.green('✅ Update complete! Core package and dependencies updated successfully.'));
      console.log('');
      console.log(chalk.blue('💡 Next steps:'));
      console.log(chalk.gray('  - Restart any running services: zypin start --packages <package>'));
      console.log(chalk.gray('  - Start MCP server: zypin mcp'));
      console.log(chalk.gray('  - Check health: zypin health --server http://localhost:8421'));
    });

  // MCP command
  const mcpCommand = program
    .command('mcp')
    .description('Start MCP server for browser automation')
    .option('-b, --browser <browser>', 'Browser to use (chromium, firefox, webkit)', 'chromium')
    .option('--headed', 'Run browser in headed mode')
    .option('-w, --width <width>', 'Viewport width', '1280')
    .option('-l, --height <height>', 'Viewport height', '720')
    .option('-t, --timeout <timeout>', 'Default timeout in milliseconds', '30000');

  mcpCommand.helpInformation = function () {
    utils.showMcpHelp();
    return '';
  };

  mcpCommand.action(async (options) => {
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
      console.log(chalk.blue('🚀 Starting Zypin MCP Server...'));
      console.log(chalk.gray('Browser automation via Model Context Protocol'));
      console.log('');
    }

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

  // Health command
  const healthCommand = program
    .command('health')
    .description('Check health status of running packages');

  healthCommand.helpInformation = function () {
    utils.showHealthHelp();
    return '';
  };

  healthCommand.action(async () => {
    if (program.opts().debug) {
      process.env.ZYPIN_DEBUG = 'true';
      console.log(chalk.gray('Debug mode enabled'));
    }

    const serverUrl = program.opts().server;

    if (!serverUrl) {
      utils.showHealthHelp();
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
}

module.exports = {
  setupCommands
};
