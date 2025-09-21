/**
 * Template discovery system for Zypin Framework
 * Scans @zypin/* packages for available templates
 * 
 * TODO:
 * - Scan all loaded plugins for templates in templates/ directory
 * - Return namespaced template names (package/template)
 * - Validate template structure (runner.js, package.json)
 * - Cache template information for performance
 * - Support template metadata and descriptions
 * - Handle template loading errors gracefully
 */

const fs = require('fs-extra');
const path = require('path');
const pluginLoader = require('./plugin-loader');

class TemplateScanner {
  constructor() {
    this.templates = new Map();
    this.scanTemplates();
  }

  scanTemplates() {
    try {
      const plugins = pluginLoader.getPlugins();
      
      plugins.forEach(plugin => {
        this.scanPluginTemplates(plugin);
      });
    } catch (error) {
      console.error('Error scanning templates:', error.message);
    }
  }

  scanPluginTemplates(plugin) {
    try {
      const templatesDir = path.join(plugin.path, 'templates');
      
      if (!fs.existsSync(templatesDir)) {
        return; // Plugin has no templates
      }

      const templateDirs = fs.readdirSync(templatesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      templateDirs.forEach(templateName => {
        const templatePath = path.join(templatesDir, templateName);
        this.loadTemplate(plugin.name, templateName, templatePath);
      });
    } catch (error) {
      console.error(`Error scanning templates for plugin ${plugin.name}:`, error.message);
    }
  }

  loadTemplate(pluginName, templateName, templatePath) {
    try {
      // Validate template structure
      if (!this.validateTemplate(templatePath)) {
        return;
      }

      const namespacedName = `${pluginName}/${templateName}`;
      
      // Load template metadata
      const packageJsonPath = path.join(templatePath, 'package.json');
      let metadata = {};
      
      if (fs.existsSync(packageJsonPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        } catch (error) {
          console.error(`Error reading template metadata for ${namespacedName}:`, error.message);
        }
      }

      const templateInfo = {
        name: templateName,
        plugin: pluginName,
        namespacedName: namespacedName,
        path: templatePath,
        metadata: metadata,
        hasRunner: fs.existsSync(path.join(templatePath, 'runner.js')),
        description: metadata.description || `${pluginName} ${templateName} template`
      };

      this.templates.set(namespacedName, templateInfo);
    } catch (error) {
      console.error(`Error loading template ${pluginName}/${templateName}:`, error.message);
    }
  }

  validateTemplate(templatePath) {
    // Check for required files
    const requiredFiles = ['package.json'];
    const hasRequiredFiles = requiredFiles.every(file => 
      fs.existsSync(path.join(templatePath, file))
    );

    if (!hasRequiredFiles) {
      return false;
    }

    // Check for runner.js (required for execution)
    const hasRunner = fs.existsSync(path.join(templatePath, 'runner.js'));
    
    return hasRunner;
  }

  getTemplates() {
    return Array.from(this.templates.values());
  }

  getTemplate(namespacedName) {
    return this.templates.get(namespacedName);
  }

  getTemplatesByPlugin(pluginName) {
    return this.getTemplates().filter(template => template.plugin === pluginName);
  }

  reload() {
    this.templates.clear();
    this.scanTemplates();
  }
}

module.exports = new TemplateScanner();
