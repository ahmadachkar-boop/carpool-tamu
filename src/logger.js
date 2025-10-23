/**
 * Logger utility for conditional logging based on environment
 * Reduces console spam in production while keeping helpful logs in development
 */

const isDevelopment = process.env.NODE_ENV === 'development';

// Enable/disable specific log categories
const DEBUG_CATEGORIES = {
  auth: isDevelopment,
  firebase: isDevelopment,
  navigation: isDevelopment,
  messages: false, // Disabled by default due to spam
  markers: false, // Disabled by default due to spam
  ndr: isDevelopment,
  offline: isDevelopment,
  haptics: isDevelopment,
  eta: false, // Disabled by default due to spam
  route: isDevelopment,
  location: false, // Disabled by default due to spam
};

class Logger {
  constructor(category = 'general') {
    this.category = category;
    this.enabled = DEBUG_CATEGORIES[category] !== undefined
      ? DEBUG_CATEGORIES[category]
      : isDevelopment;
  }

  log(...args) {
    if (this.enabled) {
      console.log(...args);
    }
  }

  info(...args) {
    if (this.enabled) {
      console.info(...args);
    }
  }

  warn(...args) {
    // Always show warnings
    console.warn(...args);
  }

  error(...args) {
    // Always show errors
    console.error(...args);
  }

  debug(...args) {
    if (this.enabled && isDevelopment) {
      console.debug(...args);
    }
  }
}

// Create category-specific loggers
export const authLogger = new Logger('auth');
export const firebaseLogger = new Logger('firebase');
export const navigationLogger = new Logger('navigation');
export const messagesLogger = new Logger('messages');
export const markersLogger = new Logger('markers');
export const ndrLogger = new Logger('ndr');
export const offlineLogger = new Logger('offline');
export const hapticsLogger = new Logger('haptics');
export const etaLogger = new Logger('eta');
export const routeLogger = new Logger('route');
export const locationLogger = new Logger('location');

// General logger
export const logger = new Logger('general');

export default logger;
