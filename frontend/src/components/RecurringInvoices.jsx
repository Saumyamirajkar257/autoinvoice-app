import React, { useState, useEffect, useMemo } from 'react';
import {
  Repeat,
  Plus,
  Search,
  Play,
  Pause,
  Trash2,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  ArrowRight,
  X
} from 'lucide-react';
import { api } from '../api';
import { formatCurrency } from '../utils/currency';

export default function RecurringInvoices({ userProfile, clients = [], showToast, onRefresh }) {
  const [recurringList, setRecurringList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Schedule Form State
  const [selectedClient, setSelectedClient] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [tax, setTax] = useState(18);
  const [submitting, setSubmitting] = useState(false);

  const formatMoney = (val) => formatCurrency(val, userProfile?.currency || 'INR - Indian Rupee');

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await api.getRecurringInvoices();
      setRecurringList(list);
    } catch (e) {
      console.warn('Error fetching recurring:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (item) => {
    const newStatus = item.status === 'active' ? 'paused' : 'active';
    try {
      await api.updateRecurringInvoice(item.id, { status: newStatus });
      setRecurringList(prev => prev.map(r => r.id === item.id ? { ...r, status: newStatus } : r));
      showToast(`Schedule ${item.id} is now ${newStatus}`, 'success');
    } catch (err) {
      showToast('Failed to update schedule status', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Are you sure you want to delete recurring schedule "${id}"?`)) return;
    try {
      await api.deleteRecurringInvoice(id);
      setRecurringList(prev => prev.filter(r => r.id !== id));
      showToast('Recurring schedule deleted', 'success');
    } catch (err) {
      showToast('Failed to delete schedule', 'error');
    }
  };

  const handleGenerateNow = async (item) => {
    try {
      showToast(`Generating invoice for ${item.client}...`, 'info');
      const clientObj = clients.find(c => c.company === item.client);
      const today = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);

      const newInv = await api.createInvoice({
        client: item.client,
        clientEmail: item.clientEmail || clientObj?.email || '',
        description: item.description || 'Recurring Subscription Service',
        amount: Number(item.amount),
        tax: Number(item.tax) || 0,
        currency: item.currency || userProfile?.currency || 'INR - Indian Rupee',
        due: dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        items: item.items || [{
          description: item.description || 'Recurring Service',
          quantity: 1,
          rate: Number(item.amount),
          amount: Number(item.amount)
        }]
      });

      showToast(`Invoice ${newInv.id} generated successfully!`, 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Failed to generate invoice', 'error');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) {
      showToast('Please select a client', 'error');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const clientObj = clients.find(c => c.company === selectedClient);
      const nextDate = new Date(startDate);
      if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
      else if (frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
      else if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

      const newSchedule = await api.createRecurringInvoice({
        client: selectedClient,
        clientEmail: clientObj?.email || '',
        description: description || 'Monthly Retainer Service',
        amount: Number(amount),
        tax: Number(tax),
        frequency,
        startDate,
        nextDate: nextDate.toISOString().split('T')[0],
        currency: userProfile?.currency || 'INR - Indian Rupee',
        items: [{
          description: description || 'Monthly Retainer Service',
          quantity: 1,
          rate: Number(amount),
          amount: Number(amount),
          hsnSac: '998314'
        }]
      });

      setRecurringList(prev => [newSchedule, ...prev]);
      setShowCreateModal(false);
      showToast('Recurring schedule created successfully!', 'success');
      setDescription('');
      setAmount('');
    } catch (err) {
      showToast(err.message || 'Failed to create schedule', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const activeSchedules = recurringList.filter(r => r.status === 'active');
  const mrr = activeSchedules.reduce((acc, curr) => {
    const amt = Number(curr.amount) || 0;
    if (curr.frequency === 'weekly') return acc + amt * 4.33;
    if (curr.frequency === 'quarterly') return acc + amt / 3;
    if (curr.frequency === 'yearly') return acc + amt / 12;
    return acc + amt;
  }, 0);

  // Filtered List
  const filtered = useMemo(() => {
    return recurringList.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      const q = searchTerm.toLowerCase();
      return (
        (item.client || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.id || '').toLowerCase().includes(q)
      );
    });
  }, [recurringList, statusFilter, searchTerm]);

  return (
    <div className="content-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Recurring Invoices</h1>
          <p className="page-subtitle">Automate ongoing client billing, retainers, and subscriptions.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> New Schedule
        </button>
      </div>

      {/* KPI Cards */}
      <div className="metrics-grid" style={{ marginBottom: '24px' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Schedules</span>
            <div className="metric-icon blue"><Repeat size={18} /></div>
          </div>
          <div className="metric-value">{activeSchedules.length}</div>
          <span className="metric-subtext">Currently generating invoices</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Est. Monthly MRR</span>
            <div className="metric-icon green"><DollarSign size={18} /></div>
          </div>
          <div className="metric-value">{formatMoney(mrr)}</div>
          <span className="metric-subtext">Predictable monthly revenue</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Paused Schedules</span>
            <div className="metric-icon orange"><Pause size={18} /></div>
          </div>
          <div className="metric-value">{recurringList.length - activeSchedules.length}</div>
          <span className="metric-subtext">On temporary hold</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Profiles</span>
            <div className="metric-icon purple"><Clock size={18} /></div>
          </div>
          <div className="metric-value">{recurringList.length}</div>
          <span className="metric-subtext">All recurring arrangements</span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="search-card">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search recurring by client, description, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'active', 'paused'].map(status => (
            <button
              key={status}
              className={`tab-btn ${statusFilter === status ? 'active' : ''}`}
              style={{ textTransform: 'capitalize', padding: '6px 14px' }}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Schedule</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Frequency</th>
                <th>Next Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                    <Repeat size={36} style={{ margin: '0 auto 12px auto', display: 'block', opacity: 0.5 }} />
                    <p style={{ fontWeight: 600 }}>No recurring schedules found.</p>
                    <button className="btn-primary btn-sm" onClick={() => setShowCreateModal(true)} style={{ marginTop: '8px' }}>
                      <Plus size={14} /> Create Your First Schedule
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{item.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.client}</div>
                      <span className="table-subtext">{item.description}</span>
                    </td>
                    <td>
                      <div className="table-amount">{formatMoney(item.amount)}</div>
                      {item.tax > 0 && <span className="table-subtext">+{item.tax}% tax</span>}
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '13px' }}>
                        {item.frequency}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <Calendar size={13} color="var(--text-muted)" />
                        {item.nextDate || 'Upcoming'}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${item.status === 'active' ? 'paid' : 'draft'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="icon-action-btn"
                          title="Generate Invoice Now"
                          onClick={() => handleGenerateNow(item)}
                        >
                          <Play size={15} color="#16a34a" />
                        </button>
                        <button
                          className="icon-action-btn"
                          title={item.status === 'active' ? 'Pause Schedule' : 'Resume Schedule'}
                          onClick={() => handleToggleStatus(item)}
                        >
                          {item.status === 'active' ? <Pause size={15} color="#f59e0b" /> : <Play size={15} color="#2563eb" />}
                        </button>
                        <button
                          className="icon-action-btn delete"
                          title="Delete Schedule"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Recurring Schedule Modal */}
      {showCreateModal && (
        <div className="custom-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="custom-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Create Recurring Schedule</h3>
              <button className="icon-action-btn" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="custom-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Client <span className="req">*</span></label>
                  <select
                    className="form-select"
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    required
                  >
                    <option value="">-- Select Client --</option>
                    {clients.map(c => (
                      <option key={c.id || c.company} value={c.company}>
                        {c.company} {c.contact ? `(${c.contact})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Service</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Monthly Website Maintenance & Support"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Amount <span className="req">*</span></label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 5000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Billing Frequency</label>
                    <select
                      className="form-select"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly (3 Months)</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tax Rate (%)</label>
                    <select
                      className="form-select"
                      value={tax}
                      onChange={(e) => setTax(Number(e.target.value))}
                    >
                      <option value={0}>0% (Exempt)</option>
                      <option value={5}>5% GST</option>
                      <option value={12}>12% GST</option>
                      <option value={18}>18% GST (Standard)</option>
                      <option value={28}>28% GST</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="custom-modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Start Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
