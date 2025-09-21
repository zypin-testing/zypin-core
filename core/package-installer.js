/**
 * Package installation system for Zypin Framework
 * Shows installation instructions for missing @zypin/* packages
 * 
 * TODO:
 * - Detect missing packages when commands are run
 * - Show installation instructions for missing packages
 * - Support both global and local installation
 * - Provide package-specific installation commands
 * - Handle package discovery and validation
 * - Add support for automatic installation (future)
 */

const chalk = require('chalk');
const pluginLoader = require('./plugin-loader');

class PackageInstaller {
  constructor() {
    this.availablePackages = [
      {
        name: 'selenium',
        fullName: '@zypin/selenium',
        description: 'Selenium Grid integration for web testing',
        installCommand: 'npm install -g https://github.com/zypin-testing/zypin-selenium'
      }
      // Future packages can be added here
    ];
  }

  checkPackage(packageName) {
    const plugin = pluginLoader.getPlugin(packageName);
    return plugin !== undefined;
  }

  showInstallationInstructions(packageName) {
    const packageInfo = this.availablePackages.find(pkg => pkg.name === packageName);
    
    if (!packageInfo) {
      console.log(chalk.red(`❌ Unknown package: ${packageName}`));
      console.log(chalk.gray('Available packages:'));
      this.availablePackages.forEach(pkg => {
        console.log(chalk.gray(`  • ${pkg.name} - ${pkg.description}`));
      });
      return;
    }

    console.log(chalk.yellow(`📦 Package '${packageName}' is not installed`));
    console.log(chalk.gray('='.repeat(50)));
    console.log(chalk.blue(`Package: ${packageInfo.fullName}`));
    console.log(chalk.blue(`Description: ${packageInfo.description}`));
    console.log('');
    console.log(chalk.green('💡 Installation Instructions:'));
    console.log(chalk.gray('='.repeat(30)));
    console.log(chalk.white(`  ${packageInfo.installCommand}`));
    console.log('');
    console.log(chalk.blue('📚 After installation:'));
    console.log(chalk.gray('  1. Verify installation: zypin start --packages selenium'));
    console.log(chalk.gray('  2. Check health: zypin health --server http://localhost:8421'));
    console.log(chalk.gray('  3. Create project: zypin create-project my-tests --template selenium/basic-webdriver'));
    console.log('');
  }

  showMissingPackageError(packageName, command) {
    console.log(chalk.red(`❌ Cannot run '${command}' - package '${packageName}' is not installed`));
    console.log('');
    this.showInstallationInstructions(packageName);
  }

  getAvailablePackages() {
    return this.availablePackages;
  }

  addPackage(packageInfo) {
    this.availablePackages.push(packageInfo);
  }
}

module.exports = new PackageInstaller();
