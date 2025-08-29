import { v4 as uuidv4 } from 'uuid';
import sanitizeHtml from 'sanitize-html';

/**
 * Validates a URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateUrl = (url) => {
  const urlPattern = /^(https):\/\/[^ "]+$/;
  return urlPattern.test(url);
};

/**
 * Sanitizes user ID to ensure valid UUID v4 format
 * @param {string} userId - The user ID to sanitize
 * @returns {string} - Sanitized user ID
 */
export const sanitizeUserId = (userId) => {
  if (!userId) throw new Error('User ID is required');
  // Strip 'user-' prefix if present
  let cleanId = userId;
  if (userId.startsWith('user-')) {
    cleanId = userId.replace('user-', '');
    cleanId = cleanId.trim();
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(cleanId)) {
    throw new Error('Invalid user ID format');
  }
  return cleanId;
};
/**
 * Sanitizes input object by cleaning strings to prevent XSS
 * FIXED VERSION - Now properly handles arrays
 * @param {Object|Array} input - The input object or array to sanitize
 * @returns {Object|Array} - Sanitized input object or array
 */
export const sanitizeInput = (input) => {
  if (!input) return input;

  // Handle arrays - sanitize each element and return as array
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }

  // Handle non-object types
  if (typeof input !== 'object') {
    return input;
  }

  // Handle objects
  const sanitized = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
      });
    } else if (Array.isArray(value)) {
      // Handle arrays specifically - preserve array structure
      sanitized[key] = value.map(item => sanitizeInput(item));
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeInput(value); // Recursively sanitize nested objects
    } else {
      sanitized[key] = value; // Keep non-string values as-is
    }
  }
  return sanitized;
};

/**
 * Generates a secure UUID
 * @returns {string} - A UUID v4
 */
export const generateSecureId = () => {
  return uuidv4();
};