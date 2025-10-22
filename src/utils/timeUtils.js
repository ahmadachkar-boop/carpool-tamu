/**
 * Time formatting utilities for consistent time display across the application
 */

/**
 * Format date to time string (e.g., "2:30 PM")
 * @param {Date} date - Date object to format
 * @returns {string} - Formatted time string
 */
export const formatTime = (date) => {
  if (!date) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/**
 * Format date to datetime string (e.g., "Jan 15, 2:30 PM")
 * @param {Date} date - Date object to format
 * @returns {string} - Formatted datetime string
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

/**
 * Calculate wait time in minutes
 * @param {Date} requestedAt - When the ride was requested
 * @param {Date} currentTime - Current time (defaults to now)
 * @returns {number} - Wait time in minutes
 */
export const calculateWaitTime = (requestedAt, currentTime = new Date()) => {
  if (!requestedAt) return 0;
  const diffMs = currentTime - requestedAt;
  return Math.floor(diffMs / (1000 * 60));
};

/**
 * Format wait time for display (e.g., "5 mins", "<1 min")
 * @param {number} minutes - Number of minutes
 * @returns {string} - Formatted wait time string
 */
export const formatWaitTime = (minutes) => {
  if (minutes < 1) return '<1 min';
  if (minutes === 1) return '1 min';
  return `${minutes} mins`;
};

/**
 * Check if wait time is concerning
 * @param {number} minutes - Number of minutes
 * @param {number} threshold - Threshold in minutes (default 15)
 * @returns {boolean} - Whether wait time exceeds threshold
 */
export const isLongWait = (minutes, threshold = 15) => minutes >= threshold;
