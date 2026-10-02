import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate
} from 'react-router-dom';
import {
  FileText,
  Home,
  Users,
  Files,
  User,
  Settings as SettingsIcon,
  Plus,
  Bell,
  LogOut,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { api } from './api';

// Lazy load route components for code splitting
const Auth = lazy(() => import('./components/Auth'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Clients = lazy(() => import('./components/Clients'));
const Invoices = lazy(() => import('./components/Invoices'));
const CreateInvoice = lazy(() => import('./components/CreateInvoice'));
const Profile = lazy(() => import('./components/Profile'));
const Settings = lazy(() => import('./components/Settings'));
const PublicPay = lazy(() => import('./components/PublicPay'));

// Lightweight loading fallback
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)', fontSize: '14px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="spinner-dot" /> Loading...
    </div>
  </div>
);

export default function App() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dark mode theme state
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('autoinvoice_theme');
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  // Apply theme class and data attribute to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('autoinvoice_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const isLoggedOut = localStorage.getItem('autoinvoice_logged_out') === 'true';
      if (isLoggedOut) return null;
      const s = localStorage.getItem('autoinvoice_session_user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [userProfile, setUserProfile] = useState({});
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Prevent body scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      const isLoggedOut = localStorage.getItem('autoinvoice_logged_out') === 'true';
      if (fbUser && !isLoggedOut) {
        const userObj = {
          fullName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          email: fbUser.email,
          photoURL: fbUser.photoURL || ''
        };
        setCurrentUser(userObj);
        localStorage.setItem('autoinvoice_session_user', JSON.stringify(userObj));
      } else if (!currentUser) {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Stable toast notification helper
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Fetch all data from cloud Firestore / backend
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashStats, clientsData, invoicesData, profileData] = await Promise.all([
        api.getDashboard().catch(() => null),
        api.getClients().catch(() => []),
        api.getInvoices().catch(() => []),
        api.getProfile().catch(() => ({}))
      ]);

      if (dashStats) setStats(dashStats);
      if (clientsData) setClients(clientsData);
      if (invoicesData) setInvoices(invoicesData);
      if (profileData) {
        setUserProfile(profileData);
        if (profileData.fullName) {
          setCurrentUser((prev) => (prev ? { ...prev, fullName: profileData.fullName } : prev));
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      showToast('Could not load data from cloud database', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, loadData]);

  const handleLoginSuccess = useCallback((user) => {
    localStorage.removeItem('autoinvoice_logged_out');
    localStorage.setItem('autoinvoice_session_user', JSON.stringify(user));
    setCurrentUser(user);
    navigate('/dashboard');
    showToast(`Welcome back, ${user.fullName || 'User'}!`, 'success');
  }, [navigate, showToast]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Signout note:', e.message);
    }
    localStorage.setItem('autoinvoice_logged_out', 'true');
    localStorage.removeItem('autoinvoice_session_user');
    localStorage.removeItem('autoinvoice_user');
    setCurrentUser(null);
    setUserProfile({});
    showToast('Logged out successfully', 'info');
  }, [showToast]);

  const handleGlobalCurrencyChange = useCallback(async (e) => {
    const newCurrency = e.target.value;
    const updatedProfile = { ...userProfile, currency: newCurrency };
    setUserProfile(updatedProfile);
    try {
      await api.updateProfile({ currency: newCurrency });
      showToast(`Active Currency set to ${newCurrency}`, 'success');
      loadData();
    } catch (err) {
      console.error('Failed to update currency:', err);
    }
  }, [userProfile, showToast, loadData]);

  // If current URL is a public payment route (/pay or /pay/:invId), show PublicPay page directly
  const isPayRoute = window.location.pathname.startsWith('/pay') || window.location.hash.includes('/pay');

  if (isPayRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/pay/:invId" element={<PublicPay />} />
          <Route path="/pay" element={<PublicPay />} />
          <Route path="*" element={<PublicPay />} />
        </Routes>
      </Suspense>
    );
  }

  // If user is not logged in, show Auth component
  if (!currentUser) {
    return (
      <>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/pay/:invId" element={<PublicPay />} />
            <Route path="/pay" element={<PublicPay />} />
            <Route path="*" element={<Auth onLoginSuccess={handleLoginSuccess} />} />
          </Routes>
        </Suspense>
        <div className="toast-container" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
      </>
    );
  }

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="app-layout">
      {/* Mobile Backdrop Overlay */}
      <div
        className={`sidebar-overlay ${mobileMenuOpen ? 'open' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="brand">
          <div className="brand-icon">
            <FileText size={18} />
          </div>
          <strong>AutoInvoice</strong>
        </div>

        <button
          className="sidebar-create-btn"
          onClick={() => {
            closeMobileMenu();
            navigate('/invoices/create');
          }}
        >
          <Plus size={16} />
          Create Invoice
        </button>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Home size={18} />
            Dashboard
          </NavLink>

          <NavLink
            to="/clients"
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Users size={18} />
            Clients
          </NavLink>

          <NavLink
            to="/invoices"
            end
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Files size={18} />
            Invoices
          </NavLink>

          <NavLink
            to="/profile"
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <User size={18} />
            Profile
          </NavLink>

          <NavLink
            to="/settings"
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <SettingsIcon size={18} />
            Settings
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button
            className="nav-item"
            style={{ color: '#ef4444' }}
            onClick={() => {
              closeMobileMenu();
              handleLogout();
            }}
            title="Sign Out"
          >
            <LogOut size={18} />
            Log Out
          </button>
          <div className="sidebar-version">AutoInvoice Pro • Cloud Synced</div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="main-wrapper">
        {/* Top Header */}
        <header className="topbar">
          <button
            className="mobile-menu-btn"
            aria-label="Toggle Navigation Menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
            <label htmlFor="topbar-currency" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Currency:
            </label>
            <select
              id="topbar-currency"
              className="form-select topbar-currency-select"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '13px', height: '34px', borderRadius: '6px', fontWeight: 500 }}
              value={userProfile?.currency || 'INR - Indian Rupee'}
              onChange={handleGlobalCurrencyChange}
            >
              <option value="INR - Indian Rupee">INR - Indian Rupee (₹) [Default]</option>
              <option value="USD - US Dollar">USD - US Dollar ($)</option>
              <option value="EUR - Euro">EUR - Euro (€)</option>
              <option value="GBP - British Pound">GBP - British Pound (£)</option>
              <option value="CAD - Canadian Dollar">CAD - Canadian Dollar (CA$)</option>
              <option value="AUD - Australian Dollar">AUD - Australian Dollar (A$)</option>
            </select>
          </div>

          {/* Dark Mode Toggle Button */}
          <button
            className="topbar-icon-btn theme-toggle-btn"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Dark Mode"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} color="#f59e0b" /> : <Moon size={18} color="#64748b" />}
          </button>

          <button
            className="topbar-icon-btn"
            title="Notifications"
            aria-label="Notifications"
            onClick={() => showToast('No new notifications', 'info')}
          >
            <Bell size={18} />
          </button>

          <div
            className="user-pill"
            onClick={() => navigate('/profile')}
            title="View Profile"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/profile')}
          >
            <div className="avatar">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt=""
                  width={34}
                  height={34}
                  style={{ borderRadius: '50%', objectFit: 'cover' }}
                  loading="lazy"
                />
              ) : (
                getInitials(userProfile?.fullName || currentUser?.fullName)
              )}
            </div>
            <span className="user-name">
              {userProfile?.fullName || currentUser?.fullName || currentUser?.email || 'User'}
            </span>
          </div>
        </header>

        {/* Dynamic Page Routes */}
        <main>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <Dashboard
                    stats={stats}
                    userProfile={userProfile}
                  />
                }
              />
              <Route
                path="/clients"
                element={
                  <Clients
                    clients={clients}
                    onRefresh={loadData}
                    showToast={showToast}
                  />
                }
              />
              <Route
                path="/invoices"
                element={
                  <Invoices
                    invoices={invoices}
                    clients={clients}
                    userProfile={userProfile}
                    onRefresh={loadData}
                    showToast={showToast}
                  />
                }
              />
              <Route
                path="/invoices/create"
                element={
                  <CreateInvoice
                    clients={clients}
                    userProfile={userProfile}
                    onRefresh={loadData}
                    showToast={showToast}
                  />
                }
              />
              <Route
                path="/profile"
                element={
                  <Profile
                    userProfile={userProfile}
                    onRefresh={loadData}
                    showToast={showToast}
                    currentTheme={theme}
                    onThemeChange={setTheme}
                  />
                }
              />
              <Route
                path="/settings"
                element={
                  <Settings
                    onRefresh={loadData}
                    onLogout={handleLogout}
                    showToast={showToast}
                  />
                }
              />
              <Route path="/pay/:invId" element={<PublicPay />} />
              <Route path="/pay" element={<PublicPay />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Toast Notification Container */}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
