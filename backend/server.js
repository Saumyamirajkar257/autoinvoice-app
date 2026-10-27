// Set production environment by default to disable debug/stack disclosure
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { sanitizeInput } = require('./middleware/sanitize');

const app = express();
const PORT = process.env.PORT || 5000;

// Security: Disable X-Powered-By header to prevent technology fingerprinting
app.disable('x-powered-by');

// Security: Apply HTTP security headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https:", "http:"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Security: Strict CORS Configuration with Whitelisting
const rawOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://autoinvoice-frontend.saumyamir25.workers.dev',
  process.env.FRONTEND_URL
].filter(Boolean).map(url => url.replace(/\/$/, '').toLowerCase());

// Deduplicate origins
const allowedOrigins = [...new Set(rawOrigins)];

app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser requests (mobile apps, server-to-server, curl) or same-origin
    if (!origin) return callback(null, true);
    
    const normalized = origin.replace(/\/$/, '').toLowerCase();
    if (allowedOrigins.includes(normalized) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    return callback(new Error(`Blocked by CORS policy: Origin '${origin}' is not authorized`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parser with 2MB limit (prevents payload-based DoS attacks)
app.use(express.json({ limit: '2mb' }));

// Input sanitization against XSS, prototype pollution, and HTML injection
app.use(sanitizeInput);

// Global API rate limiting (300 requests per 15 min per IP)
app.use('/api', apiLimiter);

// Secure Cache-Control header for API endpoints
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// API Routes
app.use('/api', routes);

// Root health check route (safe, non-leaking status)
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'AutoInvoice Backend API is secure and operational',
    version: '2.0.0',
    environment: process.env.NODE_ENV === 'development' ? 'development' : 'production'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler - Zero Information Leakage in Production
app.use((err, req, res, next) => {
  console.error('Handled application error:', err.message);
  
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'Access denied', 
      message: 'CORS policy violation: unauthorized origin' 
    });
  }

  res.status(err.status || 500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred while processing your request.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🛡️  AutoInvoice Backend Hardened on port ${PORT}`);
  console.log(`📍 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV}`);
  console.log(`📧 Email Provider: ${process.env.EMAIL_PROVIDER || 'smtp'}`);
  console.log(`=============================================`);
});
