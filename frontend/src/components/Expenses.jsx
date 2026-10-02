import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Plus,
  Search,
  FileSpreadsheet,
  Trash2,
  Edit2,
  Calendar,
  Tag,
  DollarSign,
  TrendingDown,
  X
} from 'lucide-react';
import { api } from '../api';
import { formatCurrency } from '../utils/currency';

const CATEGORIES = [
  { id: 'software', label: 'Software & Tools' },
  { id: 'services', label: 'Services & Subcontracting' },
  { id: 'office', label: 'Office & Workspace' },
  { id: 'travel', label: 'Travel & Meals' },
  { id: 'marketing', label: 'Marketing & Ads' },
  { id: 'utilities', label: 'Utilities & Internet' },
  { id: 'other', label: 'Other Operating Expenses' }
];

export default function Expenses({ userProfile, showToast, onRefresh }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('software');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const formatMoney = (val) => formatCurrency(val, userProfile?.currency || 'INR - Indian Rupee');

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await api.getExpenses();
      setExpenses(data);
    } catch (err) {
      console.warn('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const openCreateModal = () => {
    setEditingExpense(null);
    setTitle('');
    setCategory('software');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('card');
    setNotes('');
    setShowModal(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setTitle(exp.title || '');
    setCategory(exp.category || 'software');
    setAmount(exp.amount || '');
    setDate(exp.date ? new Date(exp.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setPaymentMethod(exp.paymentMethod || 'card');
    setNotes(exp.notes || '');
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await api.deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      showToast('Expense deleted successfully', 'success');
      if (onRefresh) onRefresh();
    } catch (e) {
      showToast('Failed to delete expense', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !amount || Number(amount) <= 0) {
      showToast('Please provide a valid title and amount', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        amount: Number(amount),
        currency: userProfile?.currency || 'INR - Indian Rupee',
        date,
        paymentMethod,
        notes: notes.trim()
      };

      if (editingExpense) {
        await api.updateExpense(editingExpense.id, payload);
        setExpenses(prev => prev.map(exp => exp.id === editingExpense.id ? { ...exp, ...payload } : exp));
        showToast('Expense updated successfully!', 'success');
      } else {
        const created = await api.createExpense(payload);
        setExpenses(prev => [created, ...prev]);
        showToast('Expense recorded successfully!', 'success');
      }

      setShowModal(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Error saving expense', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    api.exportToCSV('expenses', filteredExpenses);
    showToast('Expenses exported to CSV successfully!', 'success');
  };

  // KPIs
  const totalExpenseAmt = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthExpenses = expenses.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Top category
  const categoryTotals = expenses.reduce((acc, curr) => {
    const cat = curr.category || 'other';
    acc[cat] = (acc[cat] || 0) + (Number(curr.amount) || 0);
    return acc;
  }, {});
  let topCategoryName = 'None';
  let topCategoryMax = 0;
  Object.entries(categoryTotals).forEach(([cat, val]) => {
    if (val > topCategoryMax) {
      topCategoryMax = val;
      const found = CATEGORIES.find(c => c.id === cat);
      topCategoryName = found ? found.label : cat;
    }
  });

  // Filter
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
      const q = searchTerm.toLowerCase();
      return (
        (exp.title || '').toLowerCase().includes(q) ||
        (exp.notes || '').toLowerCase().includes(q) ||
        (exp.category || '').toLowerCase().includes(q)
      );
    });
  }, [expenses, categoryFilter, searchTerm]);

  return (
    <div className="content-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses Tracking</h1>
          <p className="page-subtitle">Track operational costs, tooling, and calculate accurate net profits.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={handleExportCSV}>
            <FileSpreadsheet size={16} color="#16a34a" /> Export CSV
          </button>
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Record Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metrics-grid" style={{ marginBottom: '24px' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Expenses</span>
            <div className="metric-icon red"><TrendingDown size={18} /></div>
          </div>
          <div className="metric-value">{formatMoney(totalExpenseAmt)}</div>
          <span className="metric-subtext">{expenses.length} recorded items</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">This Month</span>
            <div className="metric-icon orange"><Calendar size={18} /></div>
          </div>
          <div className="metric-value">{formatMoney(thisMonthExpenses)}</div>
          <span className="metric-subtext">Current billing cycle</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Top Expense Category</span>
            <div className="metric-icon purple"><Tag size={18} /></div>
          </div>
          <div className="metric-value" style={{ fontSize: '18px' }}>{topCategoryName}</div>
          <span className="metric-subtext">{formatMoney(topCategoryMax)} spend</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Average Expense</span>
            <div className="metric-icon blue"><Wallet size={18} /></div>
          </div>
          <div className="metric-value">
            {expenses.length > 0 ? formatMoney(totalExpenseAmt / expenses.length) : formatMoney(0)}
          </div>
          <span className="metric-subtext">Per transaction average</span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="search-card">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search expenses by title, notes, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button
            className={`tab-btn ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`tab-btn ${categoryFilter === cat.id ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat.id)}
            >
              {cat.label.split(' ')[0]}
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
                <th>Expense Item</th>
                <th>Category</th>
                <th>Date</th>
                <th>Payment Mode</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                    <Wallet size={36} style={{ margin: '0 auto 12px auto', display: 'block', opacity: 0.5 }} />
                    <p style={{ fontWeight: 600 }}>No expenses found.</p>
                    <button className="btn-primary btn-sm" onClick={openCreateModal} style={{ marginTop: '8px' }}>
                      <Plus size={14} /> Record Your First Expense
                    </button>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exp.title}</div>
                      {exp.notes && <span className="table-subtext">{exp.notes}</span>}
                    </td>
                    <td>
                      <span className={`category-badge ${exp.category || 'other'}`}>
                        {CATEGORIES.find(c => c.id === exp.category)?.label || exp.category}
                      </span>
                    </td>
                    <td>{exp.date}</td>
                    <td>
                      <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '12px' }}>
                        {exp.paymentMethod || 'card'}
                      </span>
                    </td>
                    <td>
                      <div className="table-amount" style={{ color: '#dc2626' }}>
                        -{formatMoney(exp.amount)}
                      </div>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="icon-action-btn"
                          title="Edit Expense"
                          onClick={() => openEditModal(exp)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="icon-action-btn delete"
                          title="Delete Expense"
                          onClick={() => handleDelete(exp.id)}
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

      {/* Add / Edit Expense Modal */}
      {showModal && (
        <div className="custom-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="custom-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {editingExpense ? 'Edit Expense Record' : 'Record Business Expense'}
              </h3>
              <button className="icon-action-btn" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="custom-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Expense Title / Description <span className="req">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. AWS Cloud Server Bill, Office Rent, Adobe CC"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount <span className="req">*</span></label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 2500"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      min="1"
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select
                      className="form-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="card">Credit / Debit Card</option>
                      <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="bank_transfer">Net Banking / NEFT</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes / Receipt Reference</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Optional details, invoice receipt number, or vendor contact..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <div className="custom-modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingExpense ? 'Update Expense' : 'Save Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
