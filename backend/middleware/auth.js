const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

// Secret for local JWT tokens
const JWT_SECRET = process.env.JWT_SECRET || 'autoinvoice_secure_jwt_secret_key_prod_2026';

// Initialize Firebase Admin SDK safely
let app = null;
let firestore = null;
const apps = admin.getApps ? admin.getApps() : (admin.apps || []);

if (!apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = require(path.resolve(serviceAccountPath));
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      const { getFirestore } = require('firebase-admin/firestore');
      firestore = getFirestore(app);
      console.log('🔥 Firebase Admin & Firestore initialized successfully');
    } catch (e) {
      console.warn('Firebase service account initialization failed:', e.message);
    }
  }
} else {
  app = apps[0];
  try {
    const { getFirestore } = require('firebase-admin/firestore');
    firestore = getFirestore(app);
  } catch (e) {}
}

/**
 * Mint a secure JWT token for authenticated user sessions.
 */
function generateToken(user) {
  const adminEmail = (process.env.ADMIN_EMAIL || 'saumyamir25@gmail.com').toLowerCase().trim();
  const isAdmin = (user.email && user.email.toLowerCase().trim() === adminEmail) || Boolean(user.admin);
  
  return jwt.sign(
    {
      uid: user.id || user.uid,
      email: user.email,
      name: user.fullName || user.name || 'User',
      admin: isAdmin
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Required auth middleware.
 * Verifies either a Firebase ID token or a local JWT token.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please sign in to access this resource.'
    });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Empty authorization token provided.'
    });
  }

  // 1. Try Firebase Admin ID token verification first if Firebase is configured
  if (app && admin && admin.auth) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
        admin: Boolean(decodedToken.admin)
      };
      return next();
    } catch (firebaseErr) {
      // If not a Firebase token, continue to JWT verification
    }
  }

  // 2. Try JWT verification
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email?.split('@')[0] || 'User',
      admin: Boolean(decoded.admin)
    };
    return next();
  } catch (jwtErr) {
    if (jwtErr.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Session expired',
        message: 'Your session has expired. Please sign in again.'
      });
    }

    return res.status(401).json({ 
      error: 'Invalid credentials',
      message: 'Unable to verify your identity. Please sign in again.'
    });
  }
}

/**
 * Optional auth middleware.
 * Attaches user info if token is present, but doesn't reject unauthenticated requests.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();
    
    // Try Firebase if configured
    if (app && admin && admin.auth) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
          admin: Boolean(decodedToken.admin)
        };
        return next();
      } catch (e) {}
    }

    // Try JWT
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name || decoded.email?.split('@')[0] || 'User',
        admin: Boolean(decoded.admin)
      };
      return next();
    } catch (e) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

/**
 * Admin auth middleware.
 * Verifies that the authenticated user has administrative privileges.
 */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.uid) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be signed in to access this admin resource.'
    });
  }

  const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'saumyamir25@gmail.com').toLowerCase().trim();
  const userEmail = (req.user.email || '').toLowerCase().trim();
  const isAdmin = req.user.admin === true || (userEmail && userEmail === configuredAdminEmail);

  if (!isAdmin) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Administrative privileges are required for this action.'
    });
  }

  req.user.isAdmin = true;
  next();
}

module.exports = { 
  requireAuth, 
  requireAdmin, 
  optionalAuth, 
  generateToken, 
  admin, 
  firestore 
};
