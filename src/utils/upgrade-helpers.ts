// Helper functions for upgrade command
import { getSdkInfo } from '../data/sdk-versions';
import * as path from 'path';
import * as fs from 'fs-extra';
import { log } from './logger';

/**
 * @deprecated Use SmartInstaller from install-strategies.ts instead
 * This function is kept for backward compatibility only
 */
export async function installDependencies(packageManager: string): Promise<void> {
  const { SmartInstaller } = await import('./install-strategies');
  const installer = new SmartInstaller(process.cwd(), packageManager, '');
  const result = await installer.install('expo');
  
  if (!result.success) {
    throw new Error(`Installation failed: ${result.errors.join(', ')}`);
  }
}

export async function verifyInstallation(analysis: any, targetSdk: string): Promise<boolean> {
  try {
    // Check if node_modules/expo/package.json matches expected version
    const expoModulePath = path.join(process.cwd(), 'node_modules/expo/package.json');
    
    if (!await fs.pathExists(expoModulePath)) {
      log.error('Expo package not found in node_modules after installation');
      return false;
    }
    
    const installedExpoPkg = await fs.readJson(expoModulePath);
    const sdkInfo = getSdkInfo(targetSdk);
    
    if (!sdkInfo) {
      log.warn('Could not verify installation - SDK info not found');
      return true; // Don't fail if we can't verify
    }
    
    const expectedVersion = sdkInfo.expoPackageVersion.replace(/[~^]/g, '');
    const installedVersion = installedExpoPkg.version;
    
    // Check if major version matches
    const expectedMajor = expectedVersion.split('.')[0];
    const installedMajor = installedVersion.split('.')[0];
    
    if (installedMajor !== expectedMajor) {
      log.error(`Expo version mismatch! Expected SDK ${targetSdk} (expo ${expectedVersion}), got expo ${installedVersion}`);
      return false;
    }
    
    log.success(`Verified expo@${installedVersion} is installed (SDK ${targetSdk})`);
    
    // Also verify React Native
    const rnModulePath = path.join(process.cwd(), 'node_modules/react-native/package.json');
    
    if (await fs.pathExists(rnModulePath)) {
      const installedRN = await fs.readJson(rnModulePath);
      const expectedRN = sdkInfo.reactNativeVersion;
      const expectedRNMinor = expectedRN.split('.').slice(0, 2).join('.');
      const installedRNMinor = installedRN.version.split('.').slice(0, 2).join('.');
      
      if (installedRNMinor !== expectedRNMinor) {
        log.error(`React Native version mismatch! Expected ${expectedRN}, got ${installedRN.version}`);
        return false;
      }
      
      log.success(`Verified react-native@${installedRN.version} is installed`);
    }
    
    return true;
  } catch (error) {
    log.error('Failed to verify installation:', error);
    return false;
  }
}
