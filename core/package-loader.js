/**
 * Package discovery system for Zypin Framework
 * Scans /packages/ directory and loads available testing packages
 * 
 * TODO:
 * - Scan packages/ directory for available packages
 * - Validate package structure (start.js, run.js, health.js exists)
 * - Load package metadata and configurations
 * - Export list of available packages
 * - Add package validation and error handling
 * - Support for package dependencies checking
 */

const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

class PackageLoader {
  constructor() {
    this.packages = new Map();
    this.loadPackages();
  }

  loadPackages() {
    try {
      if (!fs.existsSync(config.packagesDir)) {
        return;
      }

      const packageDirs = fs.readdirSync(config.packagesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      packageDirs.forEach(packageName => {
        const packagePath = path.join(config.packagesDir, packageName);
        const packageInfo = {
          name: packageName,
          path: packagePath,
          hasStart: fs.existsSync(path.join(packagePath, 'start.js')),
          hasRun: fs.existsSync(path.join(packagePath, 'run.js')),
          hasHealth: fs.existsSync(path.join(packagePath, 'health.js'))
        };

        this.packages.set(packageName, packageInfo);
      });
    } catch (error) {
      console.error('Error loading packages:', error.message);
    }
  }

  getPackages() {
    return Array.from(this.packages.values());
  }

  getPackage(name) {
    return this.packages.get(name);
  }
}

module.exports = new PackageLoader();
