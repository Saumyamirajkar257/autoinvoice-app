const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Uses GOOGLE_APPLICATION_CREDENTIALS env var or falls back to project ID
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  
  if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  } else {
    // Fallback: initialize with just the project ID (works for Firestore access in trusted environments)
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'invoice-project-63aba'
    });
  }
}

const firestore = admin.firestore();

/**
 * Required auth middleware.
 * Rejects requests without a valid Firebase ID token.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please sign in to access this resource.'
    });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
    };
    next();
  } catch (error) {
    console.error('Auth verification failed:', error.code || error.message);
    
    if (error.code === 'auth/id-token-expired') {
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
 * Used for public endpoints that benefit from user context.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
      };
    } catch (error) {
      // Silently continue without auth for optional routes
      req.user = null;
    }
  } else {
    req.user = null;
  }
  
  next();
}

module.exports = { requireAuth, optionalAuth, admin, firestore };
