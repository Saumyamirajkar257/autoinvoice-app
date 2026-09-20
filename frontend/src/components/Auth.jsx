import React, { useState } from 'react';
import { CheckCircle, FileText, Eye, EyeOff } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';
import { api } from '../api';

export default function Auth({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('zaid@example.com');
  const [password, setPassword] = useState('password123');
  const [confirmPassword, setConfirmPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatFirebaseError = (err) => {
    const code = err?.code || '';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Invalid email or password. Please check your credentials.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email address already exists.';
    }
    if (code === 'auth/weak-password') {
      return 'Password should be at least 6 characters long.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    return err.message || 'Authentication failed. Please try again.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Firebase Auth Create User
        let userCredential;
        try {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
          if (userCredential.user && fullName) {
            await updateProfile(userCredential.user, { displayName: fullName });
          }
        } catch (fbErr) {
          // If Firebase config fails in demo mode, fallback gracefully to backend API auth
          console.warn('Firebase auth notice:', fbErr.message);
          if (fbErr.code && fbErr.code.startsWith('auth/')) {
            throw fbErr;
          }
        }

        const res = await api.signup({ fullName, email, password });
        onLoginSuccess(res.user || { fullName, email });
      } else {
        // Firebase Auth Sign In User
        let userCredential;
        try {
          userCredential = await signInWithEmailAndPassword(auth, email, password);
        } catch (fbErr) {
          console.warn('Firebase auth notice:', fbErr.message);
          if (fbErr.code && fbErr.code.startsWith('auth/')) {
            throw fbErr;
          }
        }

        const user = userCredential?.user
          ? { fullName: userCredential.user.displayName || 'Zaid Shaikh', email: userCredential.user.email }
          : (await api.login({ email, password })).user;

        onLoginSuccess(user);
      }
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Left Form Panel */}
      <div className="auth-form-side">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <FileText size={18} />
          </div>
          <strong style={{ fontSize: '18px' }}>AutoInvoice</strong>
        </div>

        <div className="auth-header">
          <h1 className="auth-title">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="auth-switch-text">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <span
              className="auth-link"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
            >
              {isSignUp ? 'Sign in here' : 'Sign up for free'}
            </span>
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email"
              className="form-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter your password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          {!isSignUp && (
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <span className="auth-link" style={{ fontSize: '13px' }}>
                Forgot your password?
              </span>
            </div>
          )}

          {isSignUp && (
            <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '20px' }}>
              By creating an account, you agree to our Terms of Service and Privacy Policy. Secured by Firebase.
            </p>
          )}

          <button
            type="submit"
            className="btn-primary btn-full"
            disabled={loading}
            style={{ padding: '12px', fontSize: '15px' }}
          >
            {loading ? 'Authenticating with Firebase...' : (isSignUp ? 'Create account (Firebase)' : 'Sign in (Firebase)')}
          </button>
        </form>
      </div>

      {/* Right Banner Side */}
      {isSignUp ? (
        <div className="auth-banner-side green-bg">
          <div className="banner-icon-box">
            <CheckCircle size={32} color="#ffffff" />
          </div>
          <h2 className="banner-title">Start Your Journey</h2>
          <div className="banner-feature-list">
            <div className="banner-feature-item">
              <CheckCircle size={18} color="#ffffff" />
              <span>Firebase Authentication Security</span>
            </div>
            <div className="banner-feature-item">
              <CheckCircle size={18} color="#ffffff" />
              <span>Create professional invoices in minutes</span>
            </div>
            <div className="banner-feature-item">
              <CheckCircle size={18} color="#ffffff" />
              <span>Dynamic Multi-Currency Support</span>
            </div>
            <div className="banner-feature-item">
              <CheckCircle size={18} color="#ffffff" />
              <span>Real-time Tax and PDF Generation</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="auth-banner-side blue-bg">
          <div className="banner-icon-box">
            <FileText size={32} color="#ffffff" />
          </div>
          <h2 className="banner-title">Professional Invoicing Made Simple</h2>
          <p className="banner-subtitle">
            Create, manage, and send professional invoices in minutes. Powered by Firebase Auth.
          </p>
          <div className="banner-stats">
            <div>
              <div className="banner-stat-num">10k+</div>
              <div className="banner-stat-label">Invoices Generated</div>
            </div>
            <div>
              <div className="banner-stat-num">500+</div>
              <div className="banner-stat-label">Happy Users</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
