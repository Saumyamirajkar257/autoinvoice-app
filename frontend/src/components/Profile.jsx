import React, { useState, useEffect } from 'react';
import { Camera, Trash2, Save } from 'lucide-react';
import { api } from '../api';

export default function Profile({ userProfile, onRefresh, showToast }) {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('India');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [taxId, setTaxId] = useState('');
  const [currency, setCurrency] = useState('USD - US Dollar');
  const [logo, setLogo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName || 'Zaid Shaikh');
      setBusinessName(userProfile.businessName || "Zaid Shaikh's Business");
      setAddress(userProfile.address || 'Please update your business address');
      setCountry(userProfile.country || 'India');
      setPhone(userProfile.phone || '9999999999');
      setWebsite(userProfile.website || 'https://google.com');
      setTaxId(userProfile.taxId || '');
      setCurrency(userProfile.currency || 'USD - US Dollar');
      setLogo(userProfile.logo || '');
    }
  }, [userProfile]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        fullName,
        businessName,
        address,
        country,
        phone,
        website,
        taxId,
        currency,
        logo
      });
      showToast('Profile saved successfully!', 'success');
      onRefresh();
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
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your business profile and personal information.</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="card" style={{ maxWidth: '960px' }}>
          <h3 className="card-title">Business Profile</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '-12px', marginBottom: '20px' }}>
            This information will appear on your invoices.
          </p>

          {/* Business Logo Upload */}
          <div className="form-group">
            <label className="form-label">Business Logo</label>
            <div className="logo-upload-container">
              <div className="logo-preview">
                {logo ? (
                  <img src={logo} alt="Business Logo" />
                ) : (
                  <Camera size={24} color="#94a3b8" />
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
            <p className="form-help">PNG, JPG, SVG up to 5MB</p>
          </div>

          {/* Full Name & Business Name */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">
                Full Name <span className="req">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Business Name <span className="req">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Business Address */}
          <div className="form-group">
            <label className="form-label">
              Business Address <span className="req">*</span>
            </label>
            <textarea
              className="form-textarea"
              placeholder="Enter your business address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          {/* Country & Phone */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">
                Business Country <span className="req">*</span>
              </label>
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
              <p className="form-help">This determines tax calculations for your invoices</p>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 9999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Website & Tax ID */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Website</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tax ID / GST Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your tax identification number"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
            </div>
          </div>

          {/* Default Currency */}
          <div className="form-group">
            <label className="form-label">Default Currency</label>
            <select
              className="form-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USD - US Dollar">USD - US Dollar ($)</option>
              <option value="INR - Indian Rupee">INR - Indian Rupee (₹)</option>
              <option value="EUR - Euro">EUR - Euro (€)</option>
              <option value="GBP - British Pound">GBP - British Pound (£)</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ marginTop: '12px' }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
