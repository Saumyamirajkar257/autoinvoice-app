import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Trash2,
  Mail,
  Send,
  Save,
  CheckCircle,
  HelpCircle,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';
import { getEmailSettings, saveEmailSettings, sendEmailJS, openGmailCompose } from '../utils/emailService';

export default function Settings({ onRefresh, onLogout, showToast, userProfile }) {
  const [emailSettings, setEmailSettings] = useState(getEmailSettings());
  const [defaultMethod, setDefaultMethod] = useState(emailSettings.defaultMethod || 'modal');
  const [serviceId, setServiceId] = useState(emailSettings.emailjs?.serviceId || '');
  const [templateId, setTemplateId] = useState(emailSettings.emailjs?.templateId || '');
  const [publicKey, setPublicKey] = useState(emailSettings.emailjs?.publicKey || '');
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const current = getEmailSettings();
    setEmailSettings(current);
    setDefaultMethod(current.defaultMethod || 'modal');
    setServiceId(current.emailjs?.serviceId || '');
    setTemplateId(current.emailjs?.templateId || '');
    setPublicKey(current.emailjs?.publicKey || '');
  }, []);

  const handleSaveEmailSettings = (e) => {
    if (e) e.preventDefault();
    setSavingEmail(true);
    try {
      const updated = {
        defaultMethod,
        emailjs: {
          serviceId: serviceId.trim(),
          templateId: templateId.trim(),
          publicKey: publicKey.trim()
        }
      };
      saveEmailSettings(updated);
      setEmailSettings(updated);
      showToast('Email preferences saved successfully!', 'success');
    } catch (err) {
      showToast('Failed to save email settings', 'error');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSendTestEmail = async () => {
    const targetEmail = userProfile?.email || 'Saumyamir25@gmail.com';

    if (defaultMethod === 'gmail') {
      openGmailCompose({
        to: targetEmail,
        subject: 'AutoInvoice Test Email (Gmail Web Composer)',
        body: `Hello ${userProfile?.fullName || 'User'},\n\nThis is a test email sent from AutoInvoice.\nYour Gmail composer is functioning properly!\n\nBest regards,\nAutoInvoice System`
      });
      showToast(`Draft test email opened in Gmail for ${targetEmail}!`, 'success');
      return;
    }

    if (!serviceId.trim() || !templateId.trim() || !publicKey.trim()) {
      showToast('Please enter your EmailJS Service ID, Template ID, and Public Key first', 'error');
      return;
    }

    setTestingEmail(true);
    try {
      await sendEmailJS({
        to: targetEmail,
        subject: 'AutoInvoice Cloud Delivery Test',
        message: `Hello ${userProfile?.fullName || 'User'},\n\nYour EmailJS cloud delivery is working perfectly!\nInvoices sent to clients will now be delivered automatically.\n\nTimestamp: ${new Date().toLocaleString()}`,
        invoiceData: { id: 'TEST-001', amount: '100.00', client: 'Test Recipient' },
        config: {
          serviceId: serviceId.trim(),
          templateId: templateId.trim(),
          publicKey: publicKey.trim()
        }
      });
      showToast(`Test email successfully sent to ${targetEmail}!`, 'success');
    } catch (err) {
      showToast(err.message || 'Test email failed. Please verify your EmailJS keys.', 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.confirm(
      'Are you absolutely sure you want to delete your account? All data (clients, invoices, profile) will be permanently cleared.'
    );
    if (!confirmation) return;

    try {
      await api.deleteAccount();
      showToast('Account data deleted successfully', 'info');
      if (onRefresh) onRefresh();
      if (onLogout) onLogout();
    } catch (err) {
      showToast(err.message || 'Error deleting account', 'error');
    }
  };

  return (
    <div className="content-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage client email delivery, notification preferences, and account controls.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '850px' }}>
        
        {/* Email Delivery Preferences Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Mail size={18} />
              </div>
              <div>
                <h3 className="card-title" style={{ margin: 0, fontSize: '16px' }}>
                  Client Email Delivery & Dispatch
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Configure how invoices, payment reminders, and receipts are sent to your clients.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setShowHelp(!showHelp)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <HelpCircle size={14} /> {showHelp ? 'Hide Guide' : 'Delivery Guide'}
            </button>
          </div>

          {/* Educational Guide Box */}
          {showHelp && (
            <div style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} color="#2563eb" /> Why Invoices Need Direct Dispatch:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>
                  <strong>Gmail Web Composer (100% Deliverability):</strong> Opens a pre-filled email draft directly in Gmail with line items, grand total, UPI scannable details, and your secure online payment link. Because it is sent from your actual email address, it never gets caught in spam filters or blocked by bots!
                </li>
                <li>
                  <strong>Default Mail Client:</strong> Launches Outlook, Apple Mail, or Thunderbird on your device.
                </li>
                <li>
                  <strong>Automated Cloud (EmailJS):</strong> Allows 1-click background delivery directly from the browser without opening any apps. Free 200 emails/month at <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>emailjs.com</a>.
                </li>
              </ul>
            </div>
          )}

          <form onSubmit={handleSaveEmailSettings}>
            {/* Preferred Dispatch Method */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                Default Action When Clicking "Email Invoice":
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                
                <label style={{
                  border: defaultMethod === 'modal' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: defaultMethod === 'modal' ? 'var(--accent-subtle)' : 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <input
                    type="radio"
                    name="defaultMethod"
                    value="modal"
                    checked={defaultMethod === 'modal'}
                    onChange={(e) => setDefaultMethod(e.target.value)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block' }}>
                      Always Show Send Dialog
                    </strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Preview invoice, verify recipient, and pick Gmail, Mailto, or Copy.
                    </span>
                  </div>
                </label>

                <label style={{
                  border: defaultMethod === 'gmail' ? '2px solid #2563eb' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: defaultMethod === 'gmail' ? '#eff6ff' : 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <input
                    type="radio"
                    name="defaultMethod"
                    value="gmail"
                    checked={defaultMethod === 'gmail'}
                    onChange={(e) => setDefaultMethod(e.target.value)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block' }}>
                      Gmail Web (1-Click)
                    </strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Instantly opens Gmail composer draft with payment link.
                    </span>
                  </div>
                </label>

                <label style={{
                  border: defaultMethod === 'emailjs' ? '2px solid #16a34a' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: defaultMethod === 'emailjs' ? '#f0fdf4' : 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <input
                    type="radio"
                    name="defaultMethod"
                    value="emailjs"
                    checked={defaultMethod === 'emailjs'}
                    onChange={(e) => setDefaultMethod(e.target.value)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block' }}>
                      Automated Cloud (EmailJS)
                    </strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Background delivery directly to client inbox via EmailJS.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* EmailJS Cloud Configuration Section */}
            <div style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '18px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Send size={16} color="#16a34a" />
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                    EmailJS Cloud Integration (Optional)
                  </strong>
                </div>
                <a
                  href="https://dashboard.emailjs.com/sign-up"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '12px',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                    fontWeight: 600
                  }}
                >
                  Get Free Keys <ExternalLink size={12} />
                </a>
              </div>
              <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Enables instant background email delivery without opening external apps. Provides 200 free emails per month.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11.5px' }}>Service ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. service_g4x8k1m"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11.5px' }}>Template ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. template_9f0a2x"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11.5px' }}>Public Key</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. user_or_public_key"
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Actions Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSendTestEmail}
                disabled={testingEmail}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {testingEmail ? <RefreshCw size={14} className="spin-animate" /> : <Send size={14} color="#16a34a" />}
                {testingEmail ? 'Sending Test...' : 'Send Test Email'}
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={savingEmail}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={15} />
                {savingEmail ? 'Saving...' : 'Save Email Preferences'}
              </button>
            </div>
          </form>
        </div>

        {/* Account Management Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Trash2 size={16} color="#dc2626" />
            <h3 className="card-title" style={{ margin: 0 }}>Account Management</h3>
          </div>

          {/* Danger Box */}
          <div className="danger-box">
            <div className="danger-title">
              <AlertTriangle size={18} />
              Delete Account
            </div>
            <p className="danger-text">
              Permanently delete your AutoInvoice account and all associated data. This action cannot be undone and will remove:
            </p>
            <ul className="danger-list">
              <li>Your business profile and logo</li>
              <li>All client information</li>
              <li>All invoices and invoice history</li>
              <li>All account settings and preferences</li>
            </ul>
            <button
              type="button"
              className="btn-danger"
              onClick={handleDeleteAccount}
            >
              <Trash2 size={16} />
              Delete My Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
