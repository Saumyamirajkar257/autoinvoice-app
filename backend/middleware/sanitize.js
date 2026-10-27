/**
 * Input sanitization middleware to protect against XSS, HTML injection,
 * and Prototype Pollution attacks.
 */

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  // Remove null bytes
  let clean = str.replace(/\0/g, '');
  // Disarm dangerous script tags and executable embeddings
  clean = clean
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/javascript:[^"'>]*/gi, '')
    .replace(/data:text\/html[^"'>]*/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^"'\s>]+/gi, '');
  return clean;
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  const cleanObj = {};
  for (const [key, value] of Object.entries(obj)) {
    // Prevent Prototype Pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    // Sanitize key name as well
    const cleanKey = sanitizeString(key);
    cleanObj[cleanKey] = sanitizeObject(value);
  }
  return cleanObj;
}

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeInput
};
