/**
 * Plugin discovery system for Zypin Framework
 * Scans node_modules/@zypin/* for available testing packages
 * 
 * TODO:
 * - Scan multiple node_modules paths for @zypin/* packages
 * - Load plugin interface from each package's index.js
 * - Validate plugin structure (start, run, health functions)
 * - Cache loaded plugins for performance
 * - Handle plugin loading errors gracefully
 */

const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

class PluginLoader {
  constructor() {
    this.plugins = new Map();
    this.loadPlugins();
  }

  loadPlugins() {
    try {
      // Scan all configured plugin paths
      config.pluginPaths.forEach(pluginPath => {
        if (fs.existsSync(pluginPath)) {
          this.scanPluginPath(pluginPath);
        }
      });
    } catch (error) {
      console.error('Error loading plugins:', error.message);
    }
  }

  scanPluginPath(pluginPath) {
    try {
      const pluginDirs = fs.readdirSync(pluginPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() || dirent.isSymbolicLink())
        .map(dirent => dirent.name);

      pluginDirs.forEach(pluginName => {
        const fullPluginPath = path.join(pluginPath, pluginName);
        this.loadPlugin(pluginName, fullPluginPath);
      });
    } catch (error) {
      // Silently ignore paths that don't exist or can't be read
    }
  }

  loadPlugin(pluginName, pluginPath) {
    try {
      const indexPath = path.join(pluginPath, 'index.js');
      
      if (!fs.existsSync(indexPath)) {
        return; // Skip plugins without index.js
      }

      // Load plugin interface
      const pluginInterface = require(indexPath);
      
      // Validate plugin interface
      if (!this.validatePluginInterface(pluginInterface, pluginName)) {
        return;
      }

      // Extract package name (remove @zypin/ prefix)
      const packageName = pluginName.replace('@zypin/', '');
      
      const pluginInfo = {
        name: packageName,
        fullName: pluginName,
        path: pluginPath,
        interface: pluginInterface,
        hasStart: typeof pluginInterface.start === 'function',
        hasRun: typeof pluginInterface.run === 'function',
        hasHealth: typeof pluginInterface.health === 'function',
        templates: pluginInterface.templates || []
      };

      this.plugins.set(packageName, pluginInfo);
    } catch (error) {
      console.error(`Error loading plugin ${pluginName}:`, error.message);
    }
  }

  validatePluginInterface(pluginInterface, pluginName) {
    // Check required properties
    if (!pluginInterface.name || !pluginInterface.version) {
      console.error(`Plugin ${pluginName} missing required properties (name, version)`);
      return false;
    }

    // Check for at least one capability
    const hasCapability = typeof pluginInterface.start === 'function' ||
                         typeof pluginInterface.run === 'function' ||
                         typeof pluginInterface.health === 'function';
    
    if (!hasCapability) {
      console.error(`Plugin ${pluginName} has no capabilities (start, run, or health)`);
      return false;
    }

    return true;
  }

  getPlugins() {
    return Array.from(this.plugins.values());
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  reload() {
    this.plugins.clear();
    this.loadPlugins();
  }
}

module.exports = new PluginLoader();
