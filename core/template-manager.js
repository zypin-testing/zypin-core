/**
 * Template management system for Zypin Framework
 * Handles copying templates to user projects and project creation with plugin architecture
 * 
 * TODO:
 * - Update to work with template-scanner for plugin-based templates
 * - Add copyTemplateFiles() with conflict handling
 * - Build updatePackageJson() for zypin config injection
 * - Add template validation and error handling
 * - Support --force flag for overwriting existing files
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const templateScanner = require('./template-scanner');

class TemplateManager {
  constructor() {
    // Templates are now discovered via template-scanner
  }

  /**
   * Create a new project from a template
   * @param {string} projectName - Name of the project to create
   * @param {string} templatePath - Template path (e.g., "selenium/basic-webdriver")
   * @param {string} targetDir - Target directory for the project
   * @param {Object} options - Options like force overwrite
   * @returns {Promise<boolean>} Success status
   */
  async createProject(projectName, templatePath, targetDir, options = {}) {
    try {
      console.log(chalk.blue('Creating project...'));

      // Get template from template scanner
      const template = templateScanner.getTemplate(templatePath);
      if (!template) {
        throw new Error(`Template not found: ${templatePath}`);
      }

      // Create target directory
      const fullTargetDir = path.resolve(targetDir);
      if (await fs.pathExists(fullTargetDir)) {
        if (!options.force) {
          throw new Error(`Directory already exists: ${fullTargetDir}. Use --force to overwrite.`);
        }
        console.log(chalk.yellow(`Overwriting existing directory: ${fullTargetDir}`));
        await fs.remove(fullTargetDir);
      }

      await fs.ensureDir(fullTargetDir);

      // Copy template files
      await this.copyTemplateFiles(template.path, fullTargetDir, projectName);

      // Update package.json with project name and zypin config
      await this.updatePackageJson(fullTargetDir, projectName, template.plugin, template.name);

      console.log(chalk.green(`✓ Project created successfully: ${projectName}`));
      console.log(chalk.gray(`Location: ${fullTargetDir}`));
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray(`  cd ${projectName}`));
      console.log(chalk.gray('  npm install'));
      
      // Show template-specific run command
      if (template.name === 'cucumber-bdd') {
        console.log(chalk.gray('  zypin run --input features/'));
      } else {
        console.log(chalk.gray('  zypin run --input test.js'));
      }
      
      // Check if template has a guide and suggest viewing it
      let guidePath = path.join(template.path, 'USER_MANUAL.md');
      
      // If not found in installed package, try source directory
      if (!await fs.pathExists(guidePath)) {
        const sourcePath = path.join(__dirname, '..', '..', 'zypin-selenium', 'templates', template.name, 'USER_MANUAL.md');
        if (await fs.pathExists(sourcePath)) {
          guidePath = sourcePath;
        }
      }
      
      if (await fs.pathExists(guidePath)) {
        console.log('');
        console.log(chalk.blue('📚 View the guide:'));
        console.log(chalk.gray(`  zypin guide --template ${template.namespacedName}`));
      }

      return true;
    } catch (error) {
      console.log(chalk.red(`Failed to create project: ${error.message}`));
      return false;
    }
  }

  /**
   * Copy template files to target directory
   * @param {string} templateDir - Source template directory
   * @param {string} targetDir - Target directory
   * @param {string} projectName - Project name for file content replacement
   */
  async copyTemplateFiles(templateDir, targetDir, projectName) {
    const files = await fs.readdir(templateDir);
    
    for (const file of files) {
      const sourcePath = path.join(templateDir, file);
      const targetPath = path.join(targetDir, file);
      
      // Skip runner.js (stays in framework)
      if (file === 'runner.js') {
        continue;
      }

      const stat = await fs.stat(sourcePath);
      if (stat.isDirectory()) {
        // Copy directories recursively
        await fs.copy(sourcePath, targetPath);
      } else {
        // Copy files with content replacement
        let content = await fs.readFile(sourcePath, 'utf8');
        
        // Replace template variables
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
        
        await fs.writeFile(targetPath, content);
      }
    }
  }

  /**
   * Update package.json with project name and zypin configuration
   * @param {string} targetDir - Target directory
   * @param {string} projectName - Project name
   * @param {string} packageName - Package name (e.g., "selenium")
   * @param {string} templateName - Template name (e.g., "basic-webdriver")
   */
  async updatePackageJson(targetDir, projectName, packageName, templateName) {
    const packageJsonPath = path.join(targetDir, 'package.json');
    
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      
      // Update project name
      packageJson.name = projectName;
      
      // Add zypin configuration
      packageJson.zypin = {
        package: packageName,
        template: templateName,
        config: template.metadata.zypin?.config || {
          browser: 'chrome',
          headless: false,
          timeout: 30000,
          parallel: 1,
          retries: 0,
          windowSize: '1920x1080'
        }
      };
      
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    }
  }

  /**
   * Get available templates
   * @returns {Array} List of available templates
   */
  async getAvailableTemplates() {
    try {
      const templates = templateScanner.getTemplates();
      return templates.map(template => template.namespacedName);
    } catch (error) {
      console.error('Error getting available templates:', error.message);
      return [];
    }
  }

  /**
   * Validate template path
   * @param {string} templatePath - Template path to validate
   * @returns {Promise<boolean>} Whether template exists
   */
  async validateTemplate(templatePath) {
    try {
      const template = templateScanner.getTemplate(templatePath);
      return template !== undefined;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new TemplateManager();
