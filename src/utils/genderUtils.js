/**
 * Gender utility functions for consistent gender handling across the application
 */

/**
 * Normalize gender string to standard format
 * @param {string} gender - Raw gender string
 * @returns {string|null} - 'male', 'female', or null
 */
export const normalizeGender = (gender) => {
  if (!gender) return null;
  const normalized = gender.toLowerCase().trim();
  if (['male', 'm', 'man'].includes(normalized)) return 'male';
  if (['female', 'f', 'woman'].includes(normalized)) return 'female';
  return null;
};

/**
 * Check if member is male
 * @param {Object} member - Member object with gender field
 * @returns {boolean}
 */
export const isMale = (member) => normalizeGender(member?.gender) === 'male';

/**
 * Check if member is female
 * @param {Object} member - Member object with gender field
 * @returns {boolean}
 */
export const isFemale = (member) => normalizeGender(member?.gender) === 'female';

/**
 * Get display label for gender
 * @param {string} gender - Raw gender string
 * @returns {string} - Display label
 */
export const getGenderLabel = (gender) => {
  const normalized = normalizeGender(gender);
  if (normalized === 'male') return 'Male';
  if (normalized === 'female') return 'Female';
  return 'Unknown';
};
