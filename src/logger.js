/**
 * Enhanced logger with colors and timestamps
 *
 * Environment Variables:
 * - LOG_LEVEL: error, warn, info, debug (default: info)
 * - LOG_COLORS: true/false (default: true in Node.js)
 * - LOG_TIMESTAMPS: true/false (default: false)
 */

export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const LOG_LEVEL_NAMES = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG,
};

// ANSI color codes for terminal output
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// Browser CSS styles for console output
const BROWSER_STYLES = {
  timestamp: 'color: #6b7280; font-size: 11px;',
  context: 'color: #3b82f6; font-weight: 600;',
  reset: 'color: inherit; font-weight: inherit;',
  levels: {
    ERROR:
      'background: #ef4444; color: white; font-weight: bold; padding: 1px 6px; border-radius: 3px;',
    WARN: 'background: #f59e0b; color: white; font-weight: bold; padding: 1px 6px; border-radius: 3px;',
    INFO: 'background: #3b82f6; color: white; font-weight: bold; padding: 1px 6px; border-radius: 3px;',
    DEBUG:
      'background: #8b5cf6; color: white; font-weight: bold; padding: 1px 6px; border-radius: 3px;',
  },
};

// Environment detection
const isBrowser = typeof window !== 'undefined';

// Configuration state
let currentLogLevel = LogLevel.INFO;

// Get environment variable safely
function getEnvVar(name) {
  if (isBrowser) return undefined;
  try {
    return process?.env?.[name];
  } catch {
    return undefined;
  }
}

// Initialize configuration from environment variables
let colorsEnabled = !isBrowser && getEnvVar('LOG_COLORS') !== 'false';
let timestampsEnabled = getEnvVar('LOG_TIMESTAMPS') === 'true';

// Initialize log level from environment variable
const envLogLevel = getEnvVar('LOG_LEVEL')?.toLowerCase();
if (envLogLevel && LOG_LEVEL_NAMES[envLogLevel] !== undefined) {
  currentLogLevel = LOG_LEVEL_NAMES[envLogLevel];
}

/**
 * Format ISO timestamp
 */
function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Format short time for browser (HH:mm:ss.SSS)
 */
function formatShortTime() {
  return new Date().toISOString().split('T')[1].slice(0, 12);
}

/**
 * Format a log line for Node.js terminal output
 */
function formatNodeLog(level, context, levelColor) {
  const parts = [];

  if (timestampsEnabled) {
    parts.push(colorsEnabled ? `${ANSI.gray}${formatTimestamp()}${ANSI.reset}` : formatTimestamp());
  }

  const levelPadded = level.padEnd(5);
  parts.push(colorsEnabled ? `${levelColor}${levelPadded}${ANSI.reset}` : levelPadded);
  parts.push(colorsEnabled ? `${ANSI.blue}[${context}]${ANSI.reset}` : `[${context}]`);

  return parts.join(' ');
}

/**
 * Create a logger instance with a context prefix
 * @param {string} context
 * @returns {Logger}
 */
export function createLogger(context) {
  if (isBrowser) {
    // Browser implementation with CSS styling
    return {
      error: (...args) => {
        if (currentLogLevel >= LogLevel.ERROR) {
          console.error(
            `%cERROR%c %c${formatShortTime()}%c %c[${context}]%c`,
            BROWSER_STYLES.levels.ERROR,
            BROWSER_STYLES.reset,
            BROWSER_STYLES.timestamp,
            BROWSER_STYLES.reset,
            BROWSER_STYLES.context,
            BROWSER_STYLES.reset,
            ...args
          );
        }
      },

      warn: (...args) => {
        if (currentLogLevel >= LogLevel.WARN) {
          console.warn(
            `%cWARN%c %c${formatShortTime()}%c %c[${context}]%c`,
            BROWSER_STYLES.levels.WARN,
            BROWSER_STYLES.reset,
            BROWSER_STYLES.timestamp,
            BROWSER_STYLES.reset,
            BROWSER_STYLES.context,
            BROWSER_STYLES.reset,
            ...args
          );
        }
      },

      info: (...args) => {
        if (currentLogLevel >= LogLevel.INFO) {
          console.log(
            `%cINFO%c %c${formatShortTime()}%c %c[${context}]%c`,
            BROWSER_STYLES.levels.INFO,
            BROWSER_STYLES.reset,
            BROWSER_STYLES.timestamp,
            BROWSER_STYLES.reset,
            BROWSER_STYLES.context,
            BROWSER_STYLES.reset,
            ...args
          );
        }
      },

      debug: (...args) => {
        if (currentLogLevel >= LogLevel.DEBUG) {
          console.log(
            `%cDEBUG%c %c${formatShortTime()}%c %c[${context}]%c`,
            BROWSER_STYLES.levels.DEBUG,
            BROWSER_STYLES.reset,
            BROWSER_STYLES.timestamp,
            BROWSER_STYLES.reset,
            BROWSER_STYLES.context,
            BROWSER_STYLES.reset,
            ...args
          );
        }
      },
    };
  }

  // Node.js implementation with ANSI colors
  return {
    error: (...args) => {
      if (currentLogLevel >= LogLevel.ERROR) {
        console.error(formatNodeLog('ERROR', context, ANSI.red), ...args);
      }
    },

    warn: (...args) => {
      if (currentLogLevel >= LogLevel.WARN) {
        console.log(formatNodeLog('WARN', context, ANSI.yellow), ...args);
      }
    },

    info: (...args) => {
      if (currentLogLevel >= LogLevel.INFO) {
        console.log(formatNodeLog('INFO', context, ANSI.cyan), ...args);
      }
    },

    debug: (...args) => {
      if (currentLogLevel >= LogLevel.DEBUG) {
        console.log(formatNodeLog('DEBUG', context, ANSI.magenta), ...args);
      }
    },
  };
}

/**
 * Get the current log level
 */
export function getLogLevel() {
  return currentLogLevel;
}

/**
 * Set the log level programmatically (useful for testing)
 * @param {LogLevel} level
 */
export function setLogLevel(level) {
  currentLogLevel = level;
}

/**
 * Enable or disable colored output
 * @param {boolean} enabled
 */
export function setColorsEnabled(enabled) {
  colorsEnabled = enabled;
}

/**
 * Enable or disable timestamps in output
 * @param {boolean} enabled
 */
export function setTimestampsEnabled(enabled) {
  timestampsEnabled = enabled;
}
