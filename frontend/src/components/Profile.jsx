import React, { useState, useEffect } from 'react';
import { Camera, Trash2, Save, Globe, ShieldCheck, Sun, Moon, LayoutTemplate } from 'lucide-react';
import { api } from '../api';

export default function Profile({ userProfile, onRefresh, showToast, currentTheme, onThemeChange }) {
  // Business Info
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('India');
  const [stateName, setStateName] = useState('Maharashtra');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [currency, setCurrency] = useState('INR - Indian Rupee');
  const [language, setLanguage] = useState('English');
  const [logo, setLogo] = useState('');
  const [upiId, setUpiId] = useState('');
  const [customQrUrl, setCustomQrUrl] = useState('');

  // Default Template
  const [defaultTemplate, setDefaultTemplate] = useState('modern');
  const [businessGstin, setBusinessGstin] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName || '');
      setBusinessName(userProfile.businessName || '');
      setAddress(userProfile.address || '');
      setCountry(userProfile.country || 'India');
      setStateName(userProfile.stateName || 'Maharashtra');
      setPhone(userProfile.phone || '');
      setWebsite(userProfile.website || '');
      setCurrency(userProfile.currency || 'INR - Indian Rupee');
      setLanguage(userProfile.language || 'English');
      setLogo(userProfile.logo || '');
      setUpiId(userProfile.upiId || '');
      setCustomQrUrl(userProfile.customQrUrl || '');
      setDefaultTemplate(userProfile.defaultTemplate || 'modern');
      setBusinessGstin(userProfile.businessGstin || '');
    }
  }, [userProfile]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Logo image must be under 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('QR Code image must be under 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setCustomQrUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        fullName,
        businessName,
        address,
        country,
        stateName,
        phone,
        website,
        currency,
        language,
        logo,
        upiId,
        customQrUrl,
        defaultTemplate,
        businessGstin
      };

      await api.updateProfile(payload);
      showToast('Profile and PDF preferences saved successfully!', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Error saving profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile & Invoice Settings</h1>
          <p className="page-subtitle">Configure business details and PDF template preferences.</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div style={{ maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card 1: Business Identity */}
          <div className="card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Business Identity</h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>
                <ShieldCheck size={14} /> Cloud Synchronized
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '20px' }}>
              This business information appears on all your invoices and PDF downloads.
            </p>

            {/* Business Logo Upload */}
            <div className="form-group">
              <label className="form-label">Business Logo</label>
              <div className="logo-upload-container">
                <div className="logo-preview">
                  {logo ? (
                    <img src={logo} alt="Business Logo" />
                  ) : (
                    <Camera size={24} color="var(--text-muted)" />
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label className="btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    <Camera size={14} />
                    Upload Logo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {logo && (
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => setLogo('')}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p className="form-help">PNG, JPG, SVG up to 2MB</p>
            </div>

            {/* Full Name & Business Name */}
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">
                  Proprietor / Full Name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Registered Business Name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme Tech Innovations Pvt Ltd"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Address */}
            <div className="form-group">
              <label className="form-label">Registered Address <span className="req">*</span></label>
              <textarea
                className="form-textarea"
                placeholder="Full address, city, state and PIN code"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            {/* Country, State, Phone, Website */}
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Country</label>
                <select
                  className="form-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                  <option value="Germany">Germany</option>
                  <option value="Singapore">Singapore</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">State / Province</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Maharashtra, Karnataka, Delhi"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Website</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://yourbusiness.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '4px' }}>
              <label className="form-label">
                Business GSTIN <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Optional - for Indian GST Invoicing)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 27AAAAA0000A1Z5 (15-character GSTIN)"
                value={businessGstin}
                onChange={(e) => setBusinessGstin(e.target.value.toUpperCase())}
                maxLength={15}
              />
            </div>
          </div>

          {/* Card: Payment & QR Code Settings */}
          <div className="card" style={{ margin: 0 }}>
            <h3 className="card-title">Payment Gateway & Scannable QR Code</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '20px' }}>
              Add your UPI ID or upload a custom payment QR code. This will be automatically embedded into invoice emails and PDF receipts.
            </p>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Merchant UPI ID / VPA</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. yourname@okicici or 9876543210@paytm"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
                <p className="form-help">Scans automatically trigger GPay, PhonePe, Paytm with invoice amount</p>
              </div>

              <div className="form-group">
                <label className="form-label">Custom Payment QR Code Image</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {customQrUrl ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <img src={customQrUrl} alt="Custom Payment QR Code" style={{ width: '64px', height: '64px', borderRadius: '8px', border: '1px solid var(--border-color)', objectFit: 'contain', background: '#fff' }} />
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => setCustomQrUrl('')}
                        style={{ marginTop: '6px', padding: '2px 8px', fontSize: '10px' }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                  <div>
                    <label className="btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      <Camera size={14} />
                      {customQrUrl ? 'Change QR Image' : 'Upload QR Image'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQrUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
                <p className="form-help">Upload PNG/JPG of your GPay/PhonePe/Paytm QR image</p>
              </div>
            </div>
          </div>

          {/* Card 2: Multi-Template Selection */}
          <div className="card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <LayoutTemplate size={18} color="var(--accent-primary)" />
              <h3 className="card-title" style={{ margin: 0 }}>Default PDF Template</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '16px' }}>
              Choose your default design layout for downloaded PDF invoices.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }} className="template-grid">
              {[
                { id: 'modern', name: 'Modern Clean', desc: 'Vibrant banner & modern typography' },
                { id: 'classic', name: 'Classic Corporate', desc: 'Structured formal boxed layout' },
                { id: 'minimal', name: 'Minimalist', desc: 'Airy whitespace & sleek lines' },
                { id: 'gst_pro', name: 'Executive Pro', desc: 'Formal structured grid layout' }
              ].map(tmpl => (
                <div
                  key={tmpl.id}
                  className={`template-card ${defaultTemplate === tmpl.id ? 'active' : ''}`}
                  onClick={() => setDefaultTemplate(tmpl.id)}
                >
                  <div className="template-preview-icon">
                    <LayoutTemplate size={20} />
                  </div>
                  <strong>{tmpl.name}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tmpl.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Currency & Preferences */}
          <div className="card" style={{ margin: 0 }}>
            <h3 className="card-title">Localization & Theme</h3>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Default Currency</label>
                <select
                  className="form-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="INR - Indian Rupee">INR - Indian Rupee (₹) [Default]</option>
                  <option value="USD - US Dollar">USD - US Dollar ($)</option>
                  <option value="EUR - Euro">EUR - Euro (€)</option>
                  <option value="GBP - British Pound">GBP - British Pound (£)</option>
                  <option value="CAD - Canadian Dollar">CAD - Canadian Dollar (CA$)</option>
                  <option value="AUD - Australian Dollar">AUD - Australian Dollar (A$)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={14} color="var(--accent-primary)" />
                  Language
                </label>
                <select
                  className="form-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="English">English 🇺🇸</option>
                  <option value="Spanish">Spanish 🇪🇸</option>
                  <option value="French">French 🇫🇷</option>
                  <option value="German">German 🇩🇪</option>
                  <option value="Hindi">Hindi 🇮🇳</option>
                </select>
              </div>
            </div>

            {onThemeChange && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Appearance</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn-secondary btn-sm ${currentTheme === 'light' ? 'btn-active-rate' : ''}`}
                    onClick={() => onThemeChange('light')}
                  >
                    <Sun size={14} /> Light Mode
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary btn-sm ${currentTheme === 'dark' ? 'btn-active-rate' : ''}`}
                    onClick={() => onThemeChange('dark')}
                  >
                    <Moon size={14} /> Dark Mode
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ alignSelf: 'flex-start', padding: '12px 24px', fontSize: '15px' }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Profile & Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
