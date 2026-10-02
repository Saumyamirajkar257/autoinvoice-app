import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Search,
  Download,
  ShieldCheck,
  Receipt,
  FileSpreadsheet,
  Clock,
  ArrowUpRight,
  Smartphone,
  Landmark,
  Banknote
} from 'lucide-react';
import { api } from '../api';
import { formatCurrency } from '../utils/currency';
import { generateReceiptPDF } from './receiptGenerator';

export default function Payments({ userProfile, showToast, onRefresh }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const formatMoney = (val, curr) => formatCurrency(val, curr || userProfile?.currency || 'INR - Indian Rupee');

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await api.getPayments();
      setPayments(data);
    } catch (err) {
      console.warn('Error loading payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleVerify = async (invoiceId) => {
    try {
      await api.verifyPayment(invoiceId);
      showToast(`Payment verified for invoice ${invoiceId}!`, 'success');
      loadPayments();
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Unable to verify payment', 'error');
    }
  };

  const handleDownloadReceipt = (payment) => {
    const inv = payment.invoice || {
      id: payment.invoiceId || 'INV-001',
      client: payment.client || 'Client',
      clientEmail: payment.clientEmail || '',
      amount: payment.amount || 0,
      currency: payment.currency || userProfile?.currency || 'INR - Indian Rupee',
      created: payment.date || 'Recent',
      payment: {
        method: payment.method || 'upi',
        transactionId: payment.transactionId || 'DIRECT_TRANSFER',
        paidAt: payment.date || new Date().toISOString()
      }
    };
    generateReceiptPDF(inv, userProfile, { company: payment.client, email: payment.clientEmail });
    showToast(`Receipt downloaded for ${payment.invoiceId || 'payment'}`, 'success');
  };

  const handleExportCSV = () => {
    api.exportToCSV('payments', filteredPayments);
    showToast('Payments ledger exported to CSV successfully!', 'success');
  };

  // KPIs
  const verifiedPayments = payments.filter(p => p.status === 'verified');
  const pendingPayments = payments.filter(p => p.status === 'pending_verification');
  const totalCollected = verifiedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Method Icon
  const getMethodIcon = (method) => {
    const m = (method || '').toLowerCase();
    if (m === 'upi') return <Smartphone size={14} color="#16a34a" />;
    if (m === 'bank_transfer') return <Landmark size={14} color="#2563eb" />;
    if (m === 'cash') return <Banknote size={14} color="#d97706" />;
    return <CreditCard size={14} color="#9333ea" />;
  };

  // Filter
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      const q = searchTerm.toLowerCase();
      return (
        (p.id || '').toLowerCase().includes(q) ||
        (p.invoiceId || '').toLowerCase().includes(q) ||
        (p.client || '').toLowerCase().includes(q) ||
        (p.transactionId || '').toLowerCase().includes(q)
      );
    });
  }, [payments, statusFilter, searchTerm]);

  return (
    <div className="content-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments Ledger</h1>
          <p className="page-subtitle">Unified audit trail of client collections, UPI transfers, and verifications.</p>
        </div>
        <button className="btn-secondary" onClick={handleExportCSV}>
          <FileSpreadsheet size={16} color="#16a34a" /> Export Payments CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="metrics-grid" style={{ marginBottom: '24px' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Collected</span>
            <div className="metric-icon green"><ShieldCheck size={18} /></div>
          </div>
          <div className="metric-value">{formatMoney(totalCollected)}</div>
          <span className="metric-subtext">{verifiedPayments.length} verified transactions</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Pending Verification</span>
            <div className="metric-icon orange"><Clock size={18} /></div>
          </div>
          <div className="metric-value">{formatMoney(pendingAmount)}</div>
          <span className="metric-subtext">{pendingPayments.length} payments awaiting approval</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Payments</span>
            <div className="metric-icon blue"><CreditCard size={18} /></div>
          </div>
          <div className="metric-value">{payments.length}</div>
          <span className="metric-subtext">All time transaction records</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Primary Gateway</span>
            <div className="metric-icon purple"><Smartphone size={18} /></div>
          </div>
          <div className="metric-value" style={{ fontSize: '20px' }}>UPI & Direct</div>
          <span className="metric-subtext">Instant zero-fee settlement</span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="search-card">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by transaction reference, invoice #, or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'verified', 'pending_verification'].map(st => (
            <button
              key={st}
              className={`tab-btn ${statusFilter === st ? 'active' : ''}`}
              style={{ textTransform: 'capitalize', padding: '6px 14px' }}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'pending_verification' ? 'Pending' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-header-title">
          <span>Transactions ({filteredPayments.length})</span>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Transaction Ref</th>
                <th>Invoice #</th>
                <th>Client / Payer</th>
                <th>Amount</th>
                <th>Payment Mode</th>
                <th>Date</th>
                <th>Status</th>
                <th>Receipt / Verify</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                    <CreditCard size={36} style={{ margin: '0 auto 12px auto', display: 'block', opacity: 0.5 }} />
                    <p style={{ fontWeight: 600 }}>No payment transactions found.</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map(p => (
                  <tr key={p.id + p.invoiceId}>
                    <td>
                      <code style={{ fontSize: '12px', background: 'var(--bg-card-subtle)', padding: '3px 7px', borderRadius: '4px' }}>
                        {p.transactionId}
                      </code>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {p.invoiceId}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.client}</div>
                      {p.payerEmail && <span className="table-subtext">{p.payerEmail}</span>}
                    </td>
                    <td>
                      <div className="table-amount" style={{ color: '#16a34a' }}>
                        +{formatMoney(p.amount, p.currency)}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        {getMethodIcon(p.method)}
                        <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{p.method}</span>
                      </div>
                    </td>
                    <td>{p.date}</td>
                    <td>
                      <span className={`status-badge ${p.status === 'verified' ? 'paid' : 'pending_verification'}`}>
                        {p.status === 'verified' ? 'Verified' : 'Pending Verification'}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        {p.status === 'verified' ? (
                          <button
                            className="icon-action-btn"
                            title="Download Receipt"
                            onClick={() => handleDownloadReceipt(p)}
                          >
                            <Receipt size={15} color="#16a34a" />
                          </button>
                        ) : (
                          <button
                            className="btn-primary btn-sm"
                            style={{ background: '#16a34a', padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => handleVerify(p.invoiceId)}
                          >
                            <ShieldCheck size={13} /> Verify
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
