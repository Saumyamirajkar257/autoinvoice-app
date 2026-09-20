import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { api } from '../api';

export default function Settings({ onRefresh, onLogout, showToast }) {
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
          <p className="page-subtitle">Manage your account preferences.</p>
        </div>
      </div>

      {/* Account Management Card */}
      <div className="card" style={{ maxWidth: '800px' }}>
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
  );
}
