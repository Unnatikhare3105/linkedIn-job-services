import { v4 as uuidv4 } from 'uuid';
import sanitizeHtml from 'sanitize-html';

export const validateUrl = (url) => {
  const urlPattern = /^(https):\/\/[^ "]+$/;
  return urlPattern.test(url);
};

export const sanitizeUserId = (userId) => {
  if (!userId) throw new Error('User ID is required');
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

export const sanitizeInput = (input) => {
  if (!input) return input;
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }
  if (typeof input !== 'object') {
    return input;
  }
  const sanitized = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
      });
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => sanitizeInput(item));
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export const validId = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export const generateSecureId = () => {
  return uuidv4();
};