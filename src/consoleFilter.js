/**
 * Console filter to suppress spammy Firebase WebChannel errors
 * These errors are benign and occur during development due to React StrictMode
 * causing rapid component mounting/unmounting with Firestore listeners
 */

const originalError = console.error;
const originalWarn = console.warn;

// Track if we've already shown the suppression notice
let hasShownNotice = false;

// Patterns to suppress
const SUPPRESSED_PATTERNS = [
  // Firestore WebChannel termination errors
  /webchannel.*POST.*firestore\.googleapis\.com.*TYPE=terminate.*400/i,
  /Failed to fetch.*firestore\.googleapis\.com.*terminate/i,
  // Additional Firestore connection spam
  /firestore.*network.*error/i,
];

// Check if an error message should be suppressed
function shouldSuppress(args) {
  const message = args.join(' ');

  // Check against suppressed patterns
  for (const pattern of SUPPRESSED_PATTERNS) {
    if (pattern.test(message)) {
      // Show notice once to inform developer
      if (!hasShownNotice) {
        hasShownNotice = true;
        originalError.call(
          console,
          '%c[Console Filter]%c Suppressing Firebase WebChannel termination errors (common in dev mode with React StrictMode)',
          'color: #888; font-weight: bold',
          'color: #888'
        );
      }
      return true;
    }
  }

  return false;
}

// Override console.error
console.error = function(...args) {
  if (!shouldSuppress(args)) {
    originalError.apply(console, args);
  }
};

// Override console.warn (in case warnings are logged)
console.warn = function(...args) {
  if (!shouldSuppress(args)) {
    originalWarn.apply(console, args);
  }
};

// Export for potential cleanup
export const restoreConsole = () => {
  console.error = originalError;
  console.warn = originalWarn;
};

export default {
  restoreConsole
};
