/**
 * Global configuration management for Zypin Framework
 * Handles loading and validating framework-wide settings for plugin architecture
 * 
 * TODO:
 * - Update packagesDir to scan node_modules/@zypin/* for plugins
 * - Add plugin discovery configuration
 * - Add template scanning configuration
 * - Support both global and local node_modules scanning
 * - Add plugin installation configuration
 */

const path = require('path');

// Default framework configuration
const defaultConfig = {
  // Plugin discovery paths (scan local node_modules)
  pluginPaths: [
    path.join(__dirname, '..', 'node_modules', '@zypin'),
    path.join(__dirname, '..', '..', '@zypin')
  ],
  logLevel: 'info',
  timeout: 30000,
  // Plugin configuration
  plugins: {
    autoInstall: true,
    showInstallInstructions: true
  }
};

// Merge with environment variables
const config = {
  ...defaultConfig,
  logLevel: process.env.ZYPIN_LOG_LEVEL || defaultConfig.logLevel,
  timeout: parseInt(process.env.ZYPIN_TIMEOUT) || defaultConfig.timeout,
  plugins: {
    ...defaultConfig.plugins,
    autoInstall: process.env.ZYPIN_AUTO_INSTALL !== 'false'
  }
};

module.exports = config;
