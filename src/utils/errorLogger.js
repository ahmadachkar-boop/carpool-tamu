/**
 * Error logging utility for consistent error handling across the application
 * Replaces console.error with structured logging
 */

/**
 * Log an error with context
 * @param {string} context - Context where error occurred (e.g., "assignCar", "cancelRide")
 * @param {Error|string} error - The error object or message
 * @param {Object} metadata - Additional metadata about the error
 */
export const logError = (context, error, metadata = {}) => {
  const errorMessage = error instanceof Error ? error.message : error;
  const timestamp = new Date().toISOString();

  // Structured error log
  const logEntry = {
    timestamp,
    context,
    message: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    metadata
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, errorMessage, metadata);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }

  // In production, you could send to error tracking service
  // e.g., Sentry, LogRocket, etc.
  // Example: Sentry.captureException(error, { contexts: { custom: logEntry } });

  return logEntry;
};

/**
 * Log a warning (less severe than error)
 * @param {string} context - Context where warning occurred
 * @param {string} message - Warning message
 * @param {Object} metadata - Additional metadata
 */
export const logWarning = (context, message, metadata = {}) => {
  const timestamp = new Date().toISOString();

  const logEntry = {
    timestamp,
    context,
    message,
    metadata,
    level: 'warning'
  };

  if (process.env.NODE_ENV === 'development') {
    console.warn(`[${context}]`, message, metadata);
  }

  return logEntry;
};

/**
 * Log info message
 * @param {string} context - Context
 * @param {string} message - Info message
 * @param {Object} metadata - Additional metadata
 */
export const logInfo = (context, message, metadata = {}) => {
  const timestamp = new Date().toISOString();

  const logEntry = {
    timestamp,
    context,
    message,
    metadata,
    level: 'info'
  };

  if (process.env.NODE_ENV === 'development') {
    console.info(`[${context}]`, message, metadata);
  }

  return logEntry;
};
