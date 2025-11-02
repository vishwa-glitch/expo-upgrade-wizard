import * as path from 'path';
import * as os from 'os';

export interface CloudStorageDetection {
  isCloudStorage: boolean;
  provider?: 'OneDrive' | 'Dropbox' | 'Google Drive' | 'iCloud';
  projectPath: string;
  recommendedPath?: string;
}

/**
 * Detects if the project is located in a cloud storage folder
 * that might cause file locking issues during npm operations
 */
export class CloudStorageDetector {
  
  /**
   * Check if the project path is in a cloud storage location
   */
  public static detect(projectPath: string): CloudStorageDetection {
    const normalizedPath = path.normalize(projectPath).toLowerCase();
    
    // OneDrive detection
    if (normalizedPath.includes('onedrive')) {
      return {
        isCloudStorage: true,
        provider: 'OneDrive',
        projectPath,
        recommendedPath: this.getRecommendedPath(projectPath, 'onedrive')
      };
    }
    
    // Dropbox detection
    if (normalizedPath.includes('dropbox')) {
      return {
        isCloudStorage: true,
        provider: 'Dropbox',
        projectPath,
        recommendedPath: this.getRecommendedPath(projectPath, 'dropbox')
      };
    }
    
    // Google Drive detection
    if (normalizedPath.includes('google drive') || normalizedPath.includes('googledrive')) {
      return {
        isCloudStorage: true,
        provider: 'Google Drive',
        projectPath,
        recommendedPath: this.getRecommendedPath(projectPath, 'google drive')
      };
    }
    
    // iCloud detection (macOS)
    if (normalizedPath.includes('icloud') || 
        normalizedPath.includes('library/mobile documents') ||
        normalizedPath.includes('library\\mobile documents')) {
      return {
        isCloudStorage: true,
        provider: 'iCloud',
        projectPath,
        recommendedPath: this.getRecommendedPath(projectPath, 'icloud')
      };
    }
    
    return {
      isCloudStorage: false,
      projectPath
    };
  }
  
  /**
   * Generate a recommended alternative path outside cloud storage
   */
  private static getRecommendedPath(currentPath: string, cloudProvider: string): string {
    const projectName = path.basename(currentPath);
    const homeDir = os.homedir();
    
    // Platform-specific recommendations
    if (process.platform === 'win32') {
      // Windows: suggest C:\Users\username\Projects or Desktop
      const username = homeDir.split(path.sep).pop();
      return `C:\\Users\\${username}\\Projects\\${projectName}`;
    } else if (process.platform === 'darwin') {
      // macOS: suggest ~/Projects or ~/Documents
      return path.join(homeDir, 'Projects', projectName);
    } else {
      // Linux: suggest ~/projects
      return path.join(homeDir, 'projects', projectName);
    }
  }
  
  /**
   * Check if an error is likely caused by cloud storage file locking
   */
  public static isCloudStorageError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = typeof error === 'object' ? JSON.stringify(error) : errorMessage;
    
    // Check for EPERM errors (permission denied)
    if (errorString.includes('EPERM') || errorString.includes('operation not permitted')) {
      return true;
    }
    
    // Check for EBUSY errors (resource busy)
    if (errorString.includes('EBUSY') || errorString.includes('resource busy')) {
      return true;
    }
    
    // Check for specific npm cleanup warnings
    if (errorString.includes('npm warn cleanup Failed to remove')) {
      return true;
    }
    
    // Check for rmdir failures
    if (errorString.includes('rmdir') && errorString.includes('EPERM')) {
      return true;
    }
    
    return false;
  }
}
