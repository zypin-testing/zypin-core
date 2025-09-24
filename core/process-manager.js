/**
 * Process management system for Zypin Framework
 * Handles spawning, tracking, and health checking of testing processes
 * 
 * TODO:
 * - Track spawned processes with PIDs
 * - Implement process cleanup on exit
 * - Basic health check functionality
 * - Process start/stop/status methods
 * - Add process logging and monitoring
 * - Implement graceful shutdown handling
 */

const winston = require('winston');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

// Setup logger
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class ProcessManager {
  constructor() {
    this.stateFile = path.join(__dirname, '..', '.zypin-processes.json');
    this.processes = new Map();
    this.loadState();
    this.setupExitHandlers();
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const state = fs.readJsonSync(this.stateFile);
        for (const [name, proc] of Object.entries(state)) {
          // For Phase 1, we'll trust the state file for simulated processes
          this.processes.set(name, proc);
        }
      }
    } catch (error) {
      // Ignore errors during state loading for Phase 1
    }
  }

  saveState() {
    try {
      const state = Object.fromEntries(this.processes);
      fs.writeJsonSync(this.stateFile, state, { spaces: 2 });
    } catch (error) {
      logger.error(`Failed to save process state: ${error.message}`);
    }
  }

  setupExitHandlers() {
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  // Helper method to check if process exists and kill it by PID
  killProcessByPid(pid) {
    try {
      // Check if process exists
      process.kill(pid, 0); // Signal 0 just checks if process exists
      
      // Process exists, kill it
      process.kill(pid, 'SIGTERM');
      return true;
    } catch (error) {
      // Process doesn't exist or already dead
      return false;
    }
  }

  async startPackage(packageName, plugin) {
    if (this.processes.has(packageName)) {
      const proc = this.processes.get(packageName);
      // Check if process is actually alive
      try {
        process.kill(proc.pid, 0); // Signal 0 just checks if process exists
        logger.info(`Package ${packageName} is already running`);
        return false;
      } catch (error) {
        // Process is dead, remove from state and continue
        logger.info(`Package ${packageName} was running but process is dead, cleaning up...`);
        this.processes.delete(packageName);
        this.saveState();
      }
    }

    if (!plugin.hasStart) {
      logger.error(`Package ${packageName} does not have start capability`);
      return false;
    }

    logger.info(`Starting ${packageName}...`);
    
    try {
      // Call plugin start function
      const process = await plugin.interface.start(this, {});
      
      if (process && process.pid) {
        // Store only essential process info (no process object to prevent memory leak)
        const processInfo = {
          name: packageName,
          pid: process.pid,
          startTime: new Date().toISOString()
        };
        
        this.processes.set(packageName, processInfo);
        this.saveState();
        logger.info(`${packageName} started (PID: ${process.pid})`);
        return true;
      } else {
        logger.error(`Failed to start ${packageName}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error starting ${packageName}: ${error.message}`);
      return false;
    }
  }


  getStatus() {
    const running = Array.from(this.processes.values());
    return {
      running: running.length,
      packages: running
    };
  }

  cleanup() {
    if (this.processes.size > 0) {
      logger.info('Cleaning up processes...');
      
      // Kill all running processes by PID
      for (const [name, proc] of this.processes) {
        logger.info(`Stopping ${name} (PID: ${proc.pid})...`);
        const killed = this.killProcessByPid(proc.pid);
        if (!killed) {
          logger.warn(`Process ${name} (PID: ${proc.pid}) was already dead or doesn't exist`);
        }
      }
      
      this.processes.clear();
      this.saveState();
    }
  }
}

module.exports = new ProcessManager();
