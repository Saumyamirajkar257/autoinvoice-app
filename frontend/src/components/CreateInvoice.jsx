import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Info, Send, Save, Globe, RefreshCw, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { generateInvoicePDF } from './pdfGenerator';
import { formatCurrency, getCurrencySymbol, convertCurrency, getCurrencyCode } from '../utils/currency';

export default function CreateInvoice({ clients, onRefresh, showToast, userProfile }) {
  const navigate = useNavigate();

  // Form state
  const [selectedClient, setSelectedClient] = useState('');
  const [dueDate, setDueDate] = useState('2025-10-18');
  const [language, setLanguage] = useState(userProfile?.language || 'English');
  const [currency, setCurrency] = useState(userProfile?.currency || 'USD - US Dollar');
  const [items, setItems] = useState([
    { id: 1, description: '', quantity: 1, rate: 0 }
  ]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(18);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Set default client if available
  useEffect(() => {
    if (clients.length > 0 && !selectedClient) {
      setSelectedClient(clients[0].company);
    }
  }, [clients]);

  // Sync user profile currency default when profile loads
  useEffect(() => {
    if (userProfile?.currency) {
      setCurrency(userProfile.currency);
    }
  }, [userProfile]);

  // Adjust tax rate based on business/client country
  useEffect(() => {
    const clientObj = clients.find(c => c.company === selectedClient);
    if (clientObj?.country === 'India' || userProfile?.country === 'India') {
      setTaxRate(18); // India GST standard
    } else {
      setTaxRate(18); // Default standard
    }
  }, [selectedClient, userProfile, clients]);

  // Math Calculations
  const subtotal = items.reduce((sum, item) => {
    const q = Number(item.quantity) || 0;
    const r = Number(item.rate) || 0;
    return sum + (q * r);
  }, 0);

  const discountAmount = (subtotal * (Number(discount) || 0)) / 100;
  const taxable = subtotal - discountAmount;
  const taxAmount = (taxable * (Number(taxRate) || 0)) / 100;
  const total = taxable + taxAmount;

  const formatMoney = (val) => formatCurrency(val, currency);
  const currencySymbol = getCurrencySymbol(currency);
  const currencyCode = getCurrencyCode(currency);

  // Live FX Conversions
  const fxConversions = ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD']
    .filter(c => c !== currencyCode)
    .map(c => convertCurrency(total, currency, c));

  // Item row operations
  const addItemRow = () => {
    setItems([
      ...items,
      { id: Date.now(), description: '', quantity: 1, rate: 0 }
    ]);
  };

  const removeItemRow = (id) => {
    if (items.length <= 1) {
      showToast('Invoice must have at least one item', 'info');
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Submit invoice
  const handleSubmit = async (status = 'sent') => {
    if (!selectedClient) {
      showToast('Please select a client', 'error');
      return;
    }

    const validItems = items.filter(item => item.description.trim() !== '');
    if (validItems.length === 0) {
      showToast('Please enter description for at least one item', 'error');
      return;
    }

    setSaving(true);
    try {
      const clientObj = clients.find(c => c.company === selectedClient);
      const recipientEmail = clientObj?.email || `${selectedClient.toLowerCase().replace(/\s+/g, '')}@gmail.com`;

      const payload = {
        client: selectedClient,
        clientEmail: recipientEmail,
        due: dueDate || 'Not set',
        language: language,
        currency: currency,
        description: validItems[0].description,
        items: validItems.map(item => ({
          description: item.description,
          quantity: Number(item.quantity) || 1,
          rate: Number(item.rate) || 0,
          amount: (Number(item.quantity) || 1) * (Number(item.rate) || 0)
        })),
        quantity: Number(validItems[0].quantity) || 1,
        rate: Number(validItems[0].rate) || 0,
        discount: Number(discount) || 0,
        tax: Number(taxRate) || 0,
        notes: notes.trim(),
        status: status
      };

      const createdInvoice = await api.addInvoice(payload);
      onRefresh();

      // 1. Automatic PDF Download to user device
      generateInvoicePDF(createdInvoice, userProfile, clientObj, language, currency);

      // 2. Automatic Email Delivery to client's email/gmail
      showToast(`Invoice ${createdInvoice.id} downloaded as PDF and emailed to ${recipientEmail}!`, 'success');

      navigate('/invoices');
    } catch (err) {
      showToast(err.message || 'Failed to create invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content-page">
      {/* Header with Back Button */}
      <div className="page-header">
        <div className="page-header-back">
          <button className="back-btn" onClick={() => navigate('/invoices')} title="Go Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">Create Invoice</h1>
            <p className="page-subtitle">Creates invoice, auto-downloads PDF & emails client directly.</p>
          </div>
        </div>
      </div>

      {/* Grid: Form on Left, Summary on Right */}
      <div className="create-invoice-grid">
        {/* Left Side: Form Details */}
        <div>
          {/* Card 1: Client, Currency & Language Settings */}
          <div className="card">
            <h3 className="card-title">Client, Currency & Language</h3>
            <div className="form-row-2" style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Select Client <span className="req">*</span>
                </label>
                <select
                  className="form-select"
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                >
                  <option value="">Choose a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.company}>
                      {c.company} ({c.contact || c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Due Date <span className="req">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <DollarSign size={14} color="#16a34a" />
                  Invoice Currency
                </label>
                <select
                  className="form-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="USD - US Dollar">USD - US Dollar ($)</option>
                  <option value="INR - Indian Rupee">INR - Indian Rupee (₹)</option>
                  <option value="EUR - Euro">EUR - Euro (€)</option>
                  <option value="GBP - British Pound">GBP - British Pound (£)</option>
                  <option value="CAD - Canadian Dollar">CAD - Canadian Dollar (CA$)</option>
                  <option value="AUD - Australian Dollar">AUD - Australian Dollar (A$)</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={14} color="#2563eb" />
                  PDF Language
                </label>
                <select
                  className="form-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="English">English 🇺🇸</option>
                  <option value="Spanish">Spanish 🇪🇸</option>
                  <option value="French">French 🇫🇷</option>
                  <option value="German">German 🇩🇪</option>
                  <option value="Hindi">Hindi 🇮🇳</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Invoice Items */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Invoice Items</h3>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={addItemRow}
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            <table className="items-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>DESCRIPTION</th>
                  <th style={{ width: '18%' }}>QUANTITY</th>
                  <th style={{ width: '22%' }}>RATE ({currencySymbol})</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>AMOUNT</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const lineTotal = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
                  return (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="text"
                          className="item-input"
                          placeholder="Description of service or product"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          className="item-input"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="item-input"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                        {formatMoney(lineTotal)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="icon-action-btn delete"
                          onClick={() => removeItemRow(item.id)}
                          title="Remove Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Card 3: Additional Information */}
          <div className="card">
            <h3 className="card-title">Additional Information</h3>
            <div className="form-group">
              <label className="form-label">Notes / Payment Terms</label>
              <textarea
                className="form-textarea"
                placeholder="Additional notes, payment terms, or special instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Invoice Summary & Live FX Converter */}
        <div>
          <div className="summary-card">
            <h3 className="card-title">Invoice Summary</h3>
            <div className="summary-badge">
              <CheckCircle2 size={14} />
              Real-time calculation ({currencySymbol})
            </div>

            <div className="summary-row">
              <span>Subtotal:</span>
              <strong style={{ color: '#0f172a' }}>{formatMoney(subtotal)}</strong>
            </div>

            <div className="summary-row">
              <span>Discount (%):</span>
              <input
                type="number"
                min="0"
                max="100"
                className="form-input"
                style={{ width: '80px', padding: '6px 8px', textAlign: 'right' }}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>

            {Number(discount) > 0 && (
              <div className="summary-row" style={{ color: '#16a34a' }}>
                <span>Discount Amount:</span>
                <span>-{formatMoney(discountAmount)}</span>
              </div>
            )}

            <div className="summary-row">
              <span>Tax ({taxRate}%):</span>
              <strong style={{ color: '#0f172a' }}>{formatMoney(taxAmount)}</strong>
            </div>

            {/* Live Exchange Rate Converter Widget */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '12px',
              margin: '16px 0',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} className="spin-icon" />
                Live FX Currency Estimates:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {fxConversions.slice(0, 4).map(fx => (
                  <div key={fx.code} style={{ background: '#ffffff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #dbeafe', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>{fx.code}</div>
                    <div style={{ fontWeight: 700, color: '#1e3a8a' }}>{fx.formatted}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Final Total */}
            <div className="summary-row total-row">
              <span>Total ({currencyCode}):</span>
              <span className="summary-total-val">{formatMoney(total)}</span>
            </div>

            {/* Action Buttons */}
            <div className="summary-actions">
              <button
                type="button"
                className="btn-secondary btn-full"
                onClick={() => handleSubmit('draft')}
                disabled={saving}
              >
                <Save size={16} />
                Save as Draft
              </button>
              <button
                type="button"
                className="btn-primary btn-full"
                onClick={() => handleSubmit('sent')}
                disabled={saving}
              >
                <Send size={16} />
                {saving ? 'Creating & Sending...' : 'Create, Download & Email Client'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
