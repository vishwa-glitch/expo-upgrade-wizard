import winston from 'winston';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

// Logs directory path (created lazily when first log is written)
const logsDir = path.join(process.cwd(), '.expo-upgrade-wizard-logs');
let logsDirCreated = false;

// Ensure logs directory exists (called lazily)
const ensureLogsDir = () => {
  if (!logsDirCreated) {
    fs.ensureDirSync(logsDir);
    logsDirCreated = true;
  }
};

// Custom format for console output
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const colorize = (text: string, level: string) => {
    switch (level) {
      case 'error':
        return chalk.red(text);
      case 'warn':
        return chalk.yellow(text);
      case 'info':
        return chalk.blue(text);
      case 'debug':
        return chalk.gray(text);
      case 'success':
        return chalk.green(text);
      default:
        return text;
    }
  };

  let output = colorize(String(message), level);
  
  if (Object.keys(meta).length > 0) {
    output += ' ' + chalk.gray(JSON.stringify(meta));
  }
  
  return output;
});

// Create Winston logger with lazy file transport initialization
const createFileTransports = () => {
  ensureLogsDir(); // Create logs directory only when transports are created
  return [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log')
    })
  ];
};

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [] // Start with no transports, add them lazily
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: process.env.DEBUG_MODE === 'true' ? 'debug' : 'info'
  }));
}

// Add custom success level
logger.levels = {
  ...winston.config.npm.levels,
  success: 2.5
};

// Initialize file logging (call this after git checks)
export const initializeFileLogging = () => {
  if (!logsDirCreated) {
    const fileTransports = createFileTransports();
    fileTransports.forEach(transport => logger.add(transport));
  }
};

// Helper methods for better DX
export const log = {
  error: (message: string, ...args: any[]) => logger.error(message, ...args),
  warn: (message: string, ...args: any[]) => logger.warn(message, ...args),
  info: (message: string, ...args: any[]) => logger.info(message, ...args),
  debug: (message: string, ...args: any[]) => logger.debug(message, ...args),
  success: (message: string, ...args: any[]) => logger.log('success', message, ...args),
  
  // Special methods for CLI output
  section: (title: string) => {
    console.log('\n' + chalk.bold.underline(title));
  },
  
  bullet: (message: string, icon: string = '•') => {
    console.log(`  ${chalk.gray(icon)} ${message}`);
  },
  
  table: (data: any) => {
    console.table(data);
  },
  
  newline: () => console.log(),
  
  // Progress indicator wrapper
  withSpinner: async <T>(
    message: string,
    task: () => Promise<T>
  ): Promise<T> => {
    const oraModule = await import('ora');
    const ora = 'default' in oraModule ? oraModule.default : oraModule;
    const spinner = ora(message).start();
    
    try {
      const result = await task();
      spinner.succeed();
      return result;
    } catch (error) {
      spinner.fail();
      throw error;
    }
  }
};

export { logger };
