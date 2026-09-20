import React, { useState } from 'react';
import {
  Plus,
  Search,
  Download,
  Mail,
  Trash2,
  Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { generateInvoicePDF } from './pdfGenerator';
import { formatCurrency } from '../utils/currency';

export default function Invoices({ invoices, onRefresh, showToast, userProfile, clients }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const formatMoney = (val) => formatCurrency(val, userProfile?.currency);

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
    generateInvoicePDF(invoice, userProfile, clientObj);
    showToast(`Downloaded ${invoice.id}.pdf`, 'info');
  };

  const handleEmailInvoice = (invoice) => {
    const clientObj = clients.find(c => c.company === invoice.client);
    const email = invoice.clientEmail || clientObj?.email;
    if (email) {
      const formattedAmt = formatMoney(invoice.amount);
      window.location.href = `mailto:${email}?subject=Invoice%20${invoice.id}%20from%20${encodeURIComponent(userProfile?.businessName || 'AutoInvoice')}&body=Dear%20${encodeURIComponent(invoice.client)},%0A%0APlease%20find%20attached%20invoice%20${invoice.id}%20for%20the%20amount%20of%20${encodeURIComponent(formattedAmt)}.%0A%0AThank%20you!`;
      showToast(`Opening email client for ${email}`, 'info');
    } else {
      showToast('No email address found for this client', 'error');
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
          <p className="page-subtitle">Create, manage, and track all your invoices in one place.</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/invoices/create')}>
          <Plus size={16} />
          Create Invoice
        </button>
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
              <th>Status</th>
              <th>Created</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '32px' }}>
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
                      <div className="table-amount">{formatMoney(inv.amount)}</div>
                      {inv.taxAmount > 0 && (
                        <span className="table-subtext">+{formatMoney(inv.taxAmount)} tax</span>
                      )}
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
                          title="Download PDF"
                          onClick={() => handleDownloadPDF(inv)}
                        >
                          <Download size={15} />
                        </button>
                        <button
                          className="icon-action-btn"
                          title="Send Email"
                          onClick={() => handleEmailInvoice(inv)}
                        >
                          <Mail size={15} />
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
