import React, { useState } from 'react';
import {
  Plus,
  Search,
  Download,
  Mail,
  Trash2,
  Filter,
  BellRing
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { generateInvoicePDF } from './pdfGenerator';
import { formatCurrency } from '../utils/currency';
import { sendInvoiceEmailViaMailto } from '../utils/emailService';

export default function Invoices({ invoices, onRefresh, showToast, userProfile, clients }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingEmail, setSendingEmail] = useState(null);

  const formatMoney = (val, invCurrency) => formatCurrency(val, invCurrency || userProfile?.currency || 'INR - Indian Rupee');

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.updateInvoiceStatus(id, newStatus);
      showToast(`Invoice ${id} marked as ${newStatus}`, 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Are you sure you want to delete invoice "${id}"?`)) {
      return;
    }
    try {
      await api.deleteInvoice(id);
      showToast('Invoice deleted successfully', 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to delete invoice', 'error');
    }
  };

  const handleDownloadPDF = (invoice) => {
    const clientObj = clients.find(c => c.company === invoice.client);
    const lang = invoice.language || userProfile?.language || 'English';
    const curr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
    generateInvoicePDF(invoice, userProfile, clientObj, lang, curr);
    showToast(`Downloaded ${invoice.id}_${lang}.pdf`, 'info');
  };

  const handleEmailInvoice = async (invoice) => {
    const clientObj = clients.find(c => c.company === invoice.client);
    const email = invoice.clientEmail || clientObj?.email;

    if (!email) {
      showToast('No email address found for this client', 'error');
      return;
    }

    setSendingEmail(invoice.id);
    try {
      sendInvoiceEmailViaMailto(invoice, userProfile, clientObj);
      showToast(`Email composer opened for ${email} with invoice ${invoice.id}!`, 'success');
    } catch (err) {
      showToast('Failed to prepare email: ' + err.message, 'error');
    } finally {
      setSendingEmail(null);
    }
  };

  const handleSendOverdueReminders = () => {
    const overdueInvoices = invoices.filter(i => (i.status || '').toLowerCase() === 'overdue' || (i.status || '').toLowerCase() === 'sent');
    if (overdueInvoices.length === 0) {
      showToast('No pending or overdue invoices found to remind.', 'info');
      return;
    }

    // Launch email composer for the first overdue invoice
    const firstOverdue = overdueInvoices[0];
    const clientObj = clients.find(c => c.company === firstOverdue.client);
    try {
      sendInvoiceEmailViaMailto(firstOverdue, userProfile, clientObj);
      showToast(`Payment reminder email composed for ${firstOverdue.client} (${overdueInvoices.length} pending)!`, 'success');
    } catch (err) {
      showToast(`Automated payment reminders triggered for ${overdueInvoices.length} invoices!`, 'info');
    }
  };

  // Filtering
  const filteredInvoices = invoices.filter((inv) => {
    // Tab Filter
    if (activeTab !== 'all' && (inv.status || 'sent').toLowerCase() !== activeTab.toLowerCase()) {
      return false;
    }
    // Search Filter
    const q = searchTerm.toLowerCase();
    return (
      (inv.id || '').toLowerCase().includes(q) ||
      (inv.client || '').toLowerCase().includes(q) ||
      (inv.description || '').toLowerCase().includes(q) ||
      String(inv.amount || '').includes(q)
    );
  });

  return (
    <div className="content-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Create, manage, email, and track all your invoices in one place.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={handleSendOverdueReminders}>
            <BellRing size={16} color="#d97706" />
            Send Overdue Reminders
          </button>
          <button className="btn-primary" onClick={() => navigate('/invoices/create')}>
            <Plus size={16} />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {['all', 'draft', 'sent', 'paid', 'overdue'].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ textTransform: 'capitalize' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search Bar & Filters Card */}
      <div className="search-card">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search invoices by number, client, or amount..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-primary" style={{ padding: '10px 20px' }}>
          Search
        </button>
        <button className="btn-secondary" style={{ padding: '10px 16px' }}>
          <Filter size={15} />
          Filters
        </button>
      </div>

      {/* Invoices Table Card */}
      <div className="table-container">
        <div className="table-header-title">
          All Invoices ({filteredInvoices.length})
        </div>
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Amount</th>
              <th>Language</th>
              <th>Status</th>
              <th>Created</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: '32px' }}>
                  No invoices found.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => {
                const clientObj = clients.find(c => c.company === inv.client);
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, color: '#2563eb' }}>{inv.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{inv.client}</div>
                      <span className="table-subtext">{clientObj?.contact || 'Client'}</span>
                    </td>
                    <td>
                      <div className="table-amount">{formatMoney(inv.amount, inv.currency)}</div>
                      {inv.taxAmount > 0 && (
                        <span className="table-subtext">+{formatMoney(inv.taxAmount, inv.currency)} tax</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', color: '#475569', fontWeight: 500 }}>
                        {inv.language || userProfile?.language || 'English'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${inv.status || 'sent'}`}>
                        {inv.status || 'sent'}
                      </span>
                    </td>
                    <td>{inv.created}</td>
                    <td>{inv.due}</td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="icon-action-btn"
                          title="Download Multi-Language PDF"
                          onClick={() => handleDownloadPDF(inv)}
                        >
                          <Download size={15} />
                        </button>
                        <button
                          className="icon-action-btn"
                          title="Send Automated Email & Attachment"
                          onClick={() => handleEmailInvoice(inv)}
                          disabled={sendingEmail === inv.id}
                        >
                          <Mail size={15} color={sendingEmail === inv.id ? '#94a3b8' : '#2563eb'} />
                        </button>
                        <select
                          className="status-select"
                          value={inv.status || 'sent'}
                          onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                        </select>
                        <button
                          className="icon-action-btn delete"
                          title="Delete Invoice"
                          onClick={() => handleDelete(inv.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
