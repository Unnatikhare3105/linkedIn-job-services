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
 * Sanitizes user ID by removing unsafe characters
 * @param {string} userId - The user ID to sanitize
 * @returns {string} - Sanitized user ID
 */
export const sanitizeUserId = (userId) => {
  if (typeof userId !== 'string') return '';
  return userId.replace(/[<>]/g, '');
};

/**
 * Sanitizes input object by cleaning strings to prevent XSS
 * @param {Object} input - The input object to sanitize
 * @returns {Object} - Sanitized input object
 */
export const sanitizeInput = (input) => {
  if (!input || typeof input !== 'object') return input;

  const sanitized = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
      });
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