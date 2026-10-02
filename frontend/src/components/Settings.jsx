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

export default function Settings({ onRefresh, onLogout, showToast, userProfile }) {
  const [testingEmail, setTestingEmail] = useState(false);

  const handleSendTestEmail = async () => {
    const targetEmail = userProfile?.email || 'Saumyamir25@gmail.com';
    setTestingEmail(true);
    showToast(`Sending test invoice to ${targetEmail}...`, 'info');
    try {
      await api.sendInvoiceEmail('INV-001', {
        recipientEmail: targetEmail
      });
      showToast(`Test invoice email successfully sent to ${targetEmail}!`, 'success');
    } catch (err) {
      showToast('Unable to send the test invoice. Please try again.', 'error');
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
        
        {/* Email Delivery Card */}
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
                  Automated Invoice Email System
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Deliver invoices, payment links, and receipts directly to client email inboxes with zero configuration required.
                </p>
              </div>
            </div>
            <span style={{
              background: '#dcfce7',
              color: '#15803d',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <ShieldCheck size={14} /> ACTIVE & READY
            </span>
          </div>

          <div style={{
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px'
          }}>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Delivery Flow</div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)', marginTop: '3px' }}>
                1-Tap Direct Dispatch
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Emails are sent directly to the client without opening Gmail or external apps.
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>PDF Attachment</div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)', marginTop: '3px' }}>
                Automatic Attachment
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Official INV-xxx.pdf attached in chosen template (Modern, Classic, Minimal, GST).
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Client Experience</div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)', marginTop: '3px' }}>
                No Login Required
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Clients view and pay online immediately without signing up.
              </div>
            </div>
          </div>

          {/* Test Email Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Send a sample test invoice to <strong>{userProfile?.email || 'your registered email'}</strong> to verify delivery.
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSendTestEmail}
              disabled={testingEmail}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px' }}
            >
              {testingEmail ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
              {testingEmail ? 'Sending Test Invoice...' : 'Send Test Invoice Email'}
            </button>
          </div>
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
