/**
 * Built-in HTTP server for Zypin Framework
 * Provides API endpoints for remote package management
 * 
 * TODO:
 * - Create Express server with health and stop endpoints
 * - Integrate with existing process-manager for package operations
 * - Handle server lifecycle (start/stop/status)
 * - Provide HTTP interface for CLI commands
 * - Add error handling and logging
 */

const express = require('express');
const processManager = require('./process-manager');
const winston = require('winston');
const config = require('./config');

// Setup logger
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class ZypinServer {
  constructor() {
    this.app = null;
    this.server = null;
    this.port = 8421;
    this.isRunning = false;
  }

  createServer() {
    if (this.app) {
      return this.app;
    }

    this.app = express();

    // Middleware
    this.app.use(express.json());

    // Health endpoint
    this.app.get('/api/health', (req, res) => {
      try {
        const status = processManager.getStatus();
        res.json(status);
      } catch (error) {
        logger.error(`Health endpoint error: ${error.message}`);
        res.status(500).json({
          success: false,
          error: 'Failed to get health status'
        });
      }
    });


    return this.app;
  }

  startServer() {
    if (this.isRunning) {
      logger.info('Server is already running');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.createServer();

        this.server = this.app.listen(this.port, (error) => {
          if (error) {
            logger.error(`Failed to start server: ${error.message}`);
            reject(error);
            return;
          }

          this.isRunning = true;
          logger.info(`Zypin server running on port ${this.port}`);
          resolve();
        });
      } catch (error) {
        logger.error(`Server startup error: ${error.message}`);
        reject(error);
      }
    });
  }

  stopServer() {
    if (!this.isRunning || !this.server) {
      logger.info('Server is not running');
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.server.close((error) => {
        if (error) {
          logger.error(`Error stopping server: ${error.message}`);
        } else {
          logger.info('Server stopped');
        }

        this.isRunning = false;
        this.server = null;
        resolve();
      });
    });
  }

  getServerPort() {
    return this.port;
  }

  async status(serverUrl = `http://localhost:${this.port}`) {
    try {
      const response = await fetch(`${serverUrl}/api/health`, {
        method: 'GET'
      });

      return {
        isRunning: response.ok,
        url: serverUrl,
        status: response.status
      };
    } catch (error) {
      return {
        isRunning: false,
        url: serverUrl,
        error: error.message
      };
    }
  }
}

module.exports = new ZypinServer();
