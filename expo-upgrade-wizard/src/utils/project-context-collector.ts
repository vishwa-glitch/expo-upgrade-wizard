import * as fs from 'fs';
import * as path from 'path';
import { ProjectContext } from '../types/project';
import { log } from './logger';
import { execSync } from 'child_process';

export class ProjectContextCollector {
  private projectRoot: string;
  private logger: typeof log;
  
  constructor(projectRoot: string, logger: typeof log) {
    this.projectRoot = projectRoot;
    this.logger = logger;
  }
  
  async collect(fromSdk: string, toSdk: string, doctorOutput?: string): Promise<ProjectContext> {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const context: ProjectContext = {
      // Package information
      installedPackages: this.getAllPackages(packageJson),
      expoPackages: this.getExpoPackages(packageJson),
      thirdPartyPackages: this.getThirdPartyPackages(packageJson),
      
      // Version info
      fromSdk: fromSdk,
      toSdk: toSdk,
      reactVersion: packageJson.dependencies?.react || '',
      reactNativeVersion: packageJson.dependencies?.['react-native'] || '',
      
      // Code patterns
      usesReactNativePaper: this.hasPackage(packageJson, 'react-native-paper'),
      usesVectorIcons: this.hasPackage(packageJson, 'react-native-vector-icons') || 
                        this.scanForImports('react-native-vector-icons'),
      usesExpoRouter: this.hasPackage(packageJson, 'expo-router'),
      usesReanimated: this.hasPackage(packageJson, 'react-native-reanimated'),
      usesGestureHandler: this.hasPackage(packageJson, 'react-native-gesture-handler'),
      
      // Config files
      hasBabelConfig: fs.existsSync(path.join(this.projectRoot, 'babel.config.js')),
      hasMetroConfig: fs.existsSync(path.join(this.projectRoot, 'metro.config.js')),
      hasCustomNativeCode: fs.existsSync(path.join(this.projectRoot, 'ios')) || 
                           fs.existsSync(path.join(this.projectRoot, 'android')),
      hasTypeScript: fs.existsSync(path.join(this.projectRoot, 'tsconfig.json')),
      
      // Build info
      packageManager: this.detectPackageManager(),
      hasLockFile: this.checkLockFiles().hasLockFile,
      multipleLockFiles: this.checkLockFiles().multipleLockFiles,
      
      // Errors and warnings
      doctorWarnings: this.parseDoctorWarnings(doctorOutput || ''),
      buildErrors: [],
      
      // File patterns
      fileExtensions: this.getFileExtensions(),
      mainEntry: this.findMainEntry(packageJson),
    };
    
    return context;
  }
  
  private getAllPackages(packageJson: any): string[] {
    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};
    return [...Object.keys(deps), ...Object.keys(devDeps)];
  }
  
  private getExpoPackages(packageJson: any): string[] {
    const allPackages = this.getAllPackages(packageJson);
    return allPackages.filter(pkg => pkg.startsWith('expo') || pkg.startsWith('@expo'));
  }
  
  private getThirdPartyPackages(packageJson: any): string[] {
    const allPackages = this.getAllPackages(packageJson);
    return allPackages.filter(pkg => 
      !pkg.startsWith('expo') && 
      !pkg.startsWith('@expo') && 
      !pkg.startsWith('react-native') &&
      !pkg.startsWith('@react-native')
    );
  }
  
  private hasPackage(packageJson: any, packageName: string): boolean {
    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};
    return packageName in deps || packageName in devDeps;
  }
  
  private scanForImports(packageName: string): boolean {
    try {
      const srcDir = path.join(this.projectRoot, 'src');
      const appDir = path.join(this.projectRoot, 'app');
      const searchDirs = [];
      
      if (fs.existsSync(srcDir)) searchDirs.push(srcDir);
      if (fs.existsSync(appDir)) searchDirs.push(appDir);
      if (searchDirs.length === 0) searchDirs.push(this.projectRoot);
      
      for (const dir of searchDirs) {
        const files = this.getAllFiles(dir, ['.js', '.jsx', '.ts', '.tsx']);
        for (const file of files) {
          const content = fs.readFileSync(file, 'utf8');
          if (content.includes(`'${packageName}'`) || 
              content.includes(`"${packageName}"`) ||
              content.includes(`\`${packageName}\``)) {
            return true;
          }
        }
      }
    } catch (error) {
      this.logger.debug(`Error scanning for imports: ${error}`);
    }
    return false;
  }
  
  private getAllFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...this.getAllFiles(fullPath, extensions));
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Silently ignore permission errors
    }
    return files;
  }
  
  private detectPackageManager(): 'npm' | 'yarn' | 'pnpm' | 'bun' {
    if (fs.existsSync(path.join(this.projectRoot, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(this.projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(this.projectRoot, 'bun.lockb'))) return 'bun';
    return 'npm';
  }
  
  private checkLockFiles(): { hasLockFile: boolean; multipleLockFiles: boolean } {
    const lockFiles = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'bun.lockb'
    ];
    
    const existingLockFiles = lockFiles.filter(file => 
      fs.existsSync(path.join(this.projectRoot, file))
    );
    
    return {
      hasLockFile: existingLockFiles.length > 0,
      multipleLockFiles: existingLockFiles.length > 1
    };
  }
  
  private parseDoctorWarnings(doctorOutput: string): string[] {
    const warnings: string[] = [];
    const lines = doctorOutput.split('\n');
    
    for (const line of lines) {
      if (line.includes('⚠') || line.includes('warning') || line.includes('Warning')) {
        warnings.push(line.trim());
      }
    }
    
    return warnings;
  }
  
  private getFileExtensions(): Set<string> {
    const extensions = new Set<string>();
    
    try {
      const srcDir = path.join(this.projectRoot, 'src');
      const appDir = path.join(this.projectRoot, 'app');
      const searchDirs = [];
      
      if (fs.existsSync(srcDir)) searchDirs.push(srcDir);
      if (fs.existsSync(appDir)) searchDirs.push(appDir);
      
      for (const dir of searchDirs) {
        this.collectExtensions(dir, extensions);
      }
    } catch (error) {
      this.logger.debug(`Error collecting file extensions: ${error}`);
    }
    
    return extensions;
  }
  
  private collectExtensions(dir: string, extensions: Set<string>): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (ext) extensions.add(ext);
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          this.collectExtensions(path.join(dir, entry.name), extensions);
        }
      }
    } catch (error) {
      // Silently ignore
    }
  }
  
  private findMainEntry(packageJson: any): string {
    return packageJson.main || 'index.js';
  }
}
