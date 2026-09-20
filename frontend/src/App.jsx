import React, { useState, useEffect } from 'react';
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
  LogOut
} from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { api } from './api';

import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Invoices from './components/Invoices';
import CreateInvoice from './components/CreateInvoice';
import Profile from './components/Profile';
import Settings from './components/Settings';

export default function App() {
  const navigate = useNavigate();

  // Initialize currentUser from persistent active session or null
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const isLoggedOut = localStorage.getItem('autoinvoice_logged_out') === 'true';
      if (isLoggedOut) return null;
      const s = localStorage.getItem('autoinvoice_session_user');
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  });

  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [userProfile, setUserProfile] = useState({});
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Toast notification helper
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Fetch all data from backend
  const loadData = async () => {
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
      showToast('Could not load data from backend server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const handleLoginSuccess = (user) => {
    localStorage.removeItem('autoinvoice_logged_out');
    localStorage.setItem('autoinvoice_session_user', JSON.stringify(user));
    setCurrentUser(user);
    navigate('/dashboard');
    showToast(`Welcome back, ${user.fullName || 'User'}!`, 'success');
  };

  const handleLogout = async () => {
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
  };

  const handleGlobalCurrencyChange = async (e) => {
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
  };

  // If user is not logged in, show Auth component
  if (!currentUser) {
    return (
      <>
        <Auth onLoginSuccess={handleLoginSuccess} />
        <div className="toast-container">
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

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <FileText size={18} />
          </div>
          <strong>AutoInvoice</strong>
        </div>

        <button
          className="sidebar-create-btn"
          onClick={() => navigate('/invoices/create')}
        >
          <Plus size={16} />
          Create Invoice
        </button>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Home size={18} />
            Dashboard
          </NavLink>

          <NavLink
            to="/clients"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Users size={18} />
            Clients
          </NavLink>

          <NavLink
            to="/invoices"
            end
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Files size={18} />
            Invoices
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <User size={18} />
            Profile
          </NavLink>

          <NavLink
            to="/settings"
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
            onClick={handleLogout}
            title="Sign Out"
          >
            <LogOut size={18} />
            Log Out
          </button>
          <div className="sidebar-version">AutoInvoice v1.0 (Firebase Auth)</div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="main-wrapper">
        {/* Top Header */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
              Currency:
            </span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '13px', height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 500 }}
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

          <button
            className="topbar-icon-btn"
            title="Notifications"
            onClick={() => showToast('No new notifications', 'info')}
          >
            <Bell size={18} />
          </button>

          <div
            className="user-pill"
            onClick={() => navigate('/profile')}
            title="View Profile"
          >
            <div className="avatar">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="User avatar"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
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
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
