import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Download,
  Mail,
  Trash2,
  BellRing,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Receipt,
  QrCode,
  CheckCircle,
  Clock,
  ShieldCheck,
  Eye,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { generateInvoicePDF, previewInvoicePDF } from './pdfGenerator';
import { generateReceiptPDF } from './receiptGenerator';
import { formatCurrency } from '../utils/currency';
import PaymentModal from './PaymentModal';
import ActivityTimeline from './ActivityTimeline';

export default function Invoices({ invoices = [], onRefresh, showToast, userProfile, clients = [] }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingEmail, setSendingEmail] = useState(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);
  const [selectedDetailInvoice, setSelectedDetailInvoice] = useState(null);
  const [detailTemplate, setDetailTemplate] = useState('modern');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const formatMoney = (val, invCurrency) => formatCurrency(val, invCurrency || userProfile?.currency || 'INR - Indian Rupee');

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.updateInvoiceStatus(id, newStatus);
      showToast(`Invoice ${id} marked as ${newStatus}`, 'success');
      if (onRefresh) onRefresh();
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
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to delete invoice', 'error');
    }
  };

  const handleDownloadPDF = (invoice, templateOverride) => {
    const clientObj = clients.find(c => c.company === invoice.client);
    const lang = invoice.language || userProfile?.language || 'English';
    const curr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
    const tmpl = templateOverride || invoice.template || userProfile?.defaultTemplate || 'modern';
    generateInvoicePDF(invoice, userProfile, clientObj, lang, curr, tmpl);
    showToast(`Downloaded ${invoice.id}_${tmpl}.pdf`, 'info');
  };

  const handlePreviewPDF = (invoice, templateOverride) => {
    const clientObj = clients.find(c => c.company === invoice.client);
    const lang = invoice.language || userProfile?.language || 'English';
    const curr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
    const tmpl = templateOverride || invoice.template || userProfile?.defaultTemplate || 'modern';
    previewInvoicePDF(invoice, userProfile, clientObj, lang, curr, tmpl);
    showToast(`Opening live preview in ${tmpl.toUpperCase()} format...`, 'info');
  };

  const handleDownloadReceipt = (invoice) => {
    const clientObj = clients.find(c => c.company === invoice.client);
    generateReceiptPDF(invoice, userProfile, clientObj);
    showToast(`Downloaded Receipt for ${invoice.id}`, 'success');
  };

  const handleSendReceipt = async (invoice) => {
    try {
      showToast(`Sending receipt to ${invoice.clientEmail || 'client'}...`, 'info');
      const res = await api.sendPaymentReceipt(invoice.id);
      showToast(res?.message || 'Payment receipt dispatched successfully!', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to dispatch receipt', 'error');
    }
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
      showToast(`Sending invoice email to ${email}...`, 'info');
      const result = await api.sendInvoiceEmail(invoice.id);
      if (result?.success) {
        showToast(`Invoice email sent to ${email}!`, 'success');
      } else {
        showToast(result?.message || `Invoice email dispatched to ${email}`, 'success');
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Unable to send email. Please check your email settings.', 'error');
    } finally {
      setSendingEmail(null);
    }
  };

  const handleSendOverdueReminders = async () => {
    const overdueInvoices = invoices.filter(i => {
      const st = (i.status || '').toLowerCase();
      return st === 'overdue' || st === 'sent';
    });
    if (overdueInvoices.length === 0) {
      showToast('No pending or overdue invoices found to remind.', 'info');
      return;
    }

    showToast(`Sending payment reminders for ${overdueInvoices.length} invoices...`, 'info');
    let sentCount = 0;
    for (const inv of overdueInvoices) {
      try {
        const reminderType = (inv.status || '').toLowerCase() === 'overdue' ? 'overdue' : 'upcoming';
        await api.sendPaymentReminder(inv.id, reminderType);
        sentCount++;
      } catch (e) {
        console.warn('Reminder error for', inv.id, e);
      }
    }
    showToast(`Payment reminders sent for ${sentCount} invoices!`, 'success');
    if (onRefresh) onRefresh();
  };

  const handleExportCSV = () => {
    api.exportToCSV('invoices', filteredInvoices);
    showToast('Invoices exported to CSV successfully!', 'success');
  };

  // Filter logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (activeTab !== 'all' && (inv.status || 'sent').toLowerCase() !== activeTab.toLowerCase()) {
        return false;
      }
      const q = searchTerm.toLowerCase();
      return (
        (inv.id || '').toLowerCase().includes(q) ||
        (inv.client || '').toLowerCase().includes(q) ||
        (inv.description || '').toLowerCase().includes(q) ||
        String(inv.amount || '').includes(q)
      );
    });
  }, [invoices, activeTab, searchTerm]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  return (
    <div className="content-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Manage, email, download invoices, and track payments.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={handleExportCSV} title="Export current list to CSV">
            <FileSpreadsheet size={16} color="#16a34a" />
            Export CSV
          </button>
          <button className="btn-secondary" onClick={handleSendOverdueReminders}>
            <BellRing size={16} color="#d97706" />
            Send Reminders
          </button>
          <button className="btn-primary" onClick={() => navigate('/invoices/create')}>
            <Plus size={16} />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {['all', 'draft', 'sent', 'pending_verification', 'paid', 'overdue'].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab);
              setCurrentPage(1);
            }}
            style={{ textTransform: 'capitalize' }}
          >
            {tab === 'pending_verification' ? 'Pending' : tab}
            {tab === 'all' && ` (${invoices.length})`}
          </button>
        ))}
      </div>

      {/* Search Bar & Controls Card */}
      <div className="search-card">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by invoice number, client, or amount..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Per page:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '8px 12px', fontSize: '13px' }}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Invoices Table Card */}
      <div className="table-container">
        <div className="table-header-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>All Invoices ({filteredInvoices.length})</span>
          <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>
            Page {currentPage} of {totalPages}
          </span>
        </div>
        <div className="table-responsive">
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
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Receipt size={36} color="var(--text-muted)" />
                      <strong>No invoices found matching your criteria.</strong>
                      <button className="btn-primary btn-sm" onClick={() => navigate('/invoices/create')}>
                        <Plus size={14} /> Create Your First Invoice
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => {
                  const clientObj = clients.find(c => c.company === inv.client);
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{inv.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.client}</div>
                        <span className="table-subtext">
                          {clientObj?.contact || inv.clientEmail || 'Client'}
                        </span>
                      </td>
                      <td>
                        <div className="table-amount">{formatMoney(inv.amount, inv.currency)}</div>
                        {inv.taxAmount > 0 && (
                          <span className="table-subtext">+{formatMoney(inv.taxAmount, inv.currency)} tax</span>
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
                            title="View Activity & Details"
                            onClick={() => setSelectedDetailInvoice(inv)}
                          >
                            <Eye size={15} color="#64748b" />
                          </button>
                          <button
                            className="icon-action-btn"
                            title="Payment Gateway & QR Code"
                            onClick={() => setPaymentModalInvoice(inv)}
                          >
                            <QrCode size={15} color="#16a34a" />
                          </button>
                          <button
                            className="icon-action-btn"
                            title="Download PDF"
                            onClick={() => handleDownloadPDF(inv)}
                          >
                            <Download size={15} />
                          </button>
                          {inv.status === 'paid' && (
                            <button
                              className="icon-action-btn"
                              title="Download Payment Receipt"
                              onClick={() => handleDownloadReceipt(inv)}
                            >
                              <Receipt size={15} color="#16a34a" />
                            </button>
                          )}
                          <button
                            className="icon-action-btn"
                            title="Email Invoice"
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
                          {inv.status === 'pending_verification' && (
                            <button
                              className="icon-action-btn"
                              title="Verify Payment"
                              onClick={async () => {
                                try {
                                  await api.verifyPayment(inv.id);
                                  showToast(`Payment verified for ${inv.id}!`, 'success');
                                  if (onRefresh) onRefresh();
                                } catch (err) {
                                  showToast('Unable to verify payment', 'error');
                                }
                              }}
                            >
                              <ShieldCheck size={15} color="#16a34a" />
                            </button>
                          )}
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

        {/* Pagination Footer */}
        {filteredInvoices.length > 0 && (
          <div className="pagination-footer">
            <div className="pagination-info">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredInvoices.length)} of {filteredInvoices.length} invoices
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                return (
                  <button
                    key={pageNum}
                    className={`pagination-num ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Gateway & QR Code Modal */}
      {paymentModalInvoice && (
        <PaymentModal
          invoice={paymentModalInvoice}
          userProfile={userProfile}
          onClose={() => setPaymentModalInvoice(null)}
          onRefresh={onRefresh}
          showToast={showToast}
        />
      )}

      {/* Invoice Details & Activity Timeline Modal */}
      {selectedDetailInvoice && (
        <div className="custom-modal-backdrop" onClick={() => setSelectedDetailInvoice(null)}>
          <div className="custom-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="custom-modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                    Invoice {selectedDetailInvoice.id}
                  </h3>
                  <span className={`status-badge ${selectedDetailInvoice.status || 'sent'}`}>
                    {selectedDetailInvoice.status || 'sent'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Client: {selectedDetailInvoice.client} {selectedDetailInvoice.clientEmail ? `(${selectedDetailInvoice.clientEmail})` : ''}
                </p>
              </div>
              <button
                className="icon-action-btn"
                onClick={() => setSelectedDetailInvoice(null)}
                style={{ padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="custom-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Financial & Meta Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ background: 'var(--bg-card-subtle)', padding: '12px 14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Amount Due</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {formatMoney(selectedDetailInvoice.amount, selectedDetailInvoice.currency)}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card-subtle)', padding: '12px 14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Issue Date</span>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {selectedDetailInvoice.created || 'N/A'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card-subtle)', padding: '12px 14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Due Date</span>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {selectedDetailInvoice.due || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Payment Details if available */}
              {selectedDetailInvoice.payment && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Payment Record</span>
                    <span className={`status-badge ${selectedDetailInvoice.payment.status || 'verified'}`}>
                      {selectedDetailInvoice.payment.status || 'verified'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Method: </span>
                      <strong>{(selectedDetailInvoice.payment.method || 'UPI').toUpperCase()}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Ref / UTR: </span>
                      <code style={{ background: 'var(--bg-card-subtle)', padding: '1px 5px', borderRadius: '4px' }}>
                        {selectedDetailInvoice.payment.transactionId || 'N/A'}
                      </code>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Timeline Card */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Audit & Event Timeline
                </h4>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <ActivityTimeline activity={selectedDetailInvoice.activity || [
                    { event: 'created', timestamp: new Date().toISOString(), actor: 'owner' }
                  ]} />
                </div>
              </div>
            </div>

            <div className="custom-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Template:</span>
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '30px', fontWeight: 600 }}
                  value={detailTemplate}
                  onChange={(e) => setDetailTemplate(e.target.value)}
                >
                  <option value="modern">Modern Clean</option>
                  <option value="classic">Classic Corporate</option>
                  <option value="minimal">Minimalist</option>
                  <option value="gst_pro">Executive Pro</option>
                </select>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => handlePreviewPDF(selectedDetailInvoice, detailTemplate)}
                  title="Preview PDF in this template"
                >
                  <Eye size={13} /> Preview
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => handleDownloadPDF(selectedDetailInvoice, detailTemplate)}
                  title="Download PDF in this template"
                >
                  <Download size={13} /> Download
                </button>
              </div>
              {selectedDetailInvoice.status === 'paid' && (
                <>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => handleDownloadReceipt(selectedDetailInvoice)}
                  >
                    <Receipt size={14} color="#16a34a" /> Download Receipt
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => handleSendReceipt(selectedDetailInvoice)}
                  >
                    <Mail size={14} /> Email Receipt
                  </button>
                </>
              )}
              {selectedDetailInvoice.status === 'pending_verification' && (
                <button
                  className="btn-primary btn-sm"
                  style={{ background: '#16a34a' }}
                  onClick={async () => {
                    try {
                      await api.verifyPayment(selectedDetailInvoice.id);
                      showToast(`Payment verified for ${selectedDetailInvoice.id}!`, 'success');
                      setSelectedDetailInvoice(null);
                      if (onRefresh) onRefresh();
                    } catch (e) {
                      showToast('Unable to verify payment', 'error');
                    }
                  }}
                >
                  <ShieldCheck size={14} /> Verify & Mark Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
