const rateLimit = require('express-rate-limit');

/**
 * Standard API rate limiter:
 * 300 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please wait a few minutes before trying again.'
  }
});

/**
 * Strict Auth rate limiter:
 * 20 attempts per 15 minutes per IP to prevent brute-force attacks.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts',
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

/**
 * Email dispatch rate limiter:
 * 30 emails per 15 minutes per IP to prevent spamming and quota exhaustion.
 */
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Email limit reached',
    message: 'Too many email requests sent. Please wait a few minutes before sending more invoices.'
  }
});

/**
 * AI Assistant rate limiter:
 * 30 queries per 15 minutes per IP.
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI query limit reached',
    message: 'You have reached the prompt rate limit. Please try again shortly.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  emailLimiter,
  aiLimiter
};
