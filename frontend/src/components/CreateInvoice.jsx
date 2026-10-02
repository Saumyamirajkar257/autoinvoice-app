import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Send, Save, RefreshCw, DollarSign, LayoutTemplate, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { generateInvoicePDF } from './pdfGenerator';
import { formatCurrency, getCurrencySymbol, convertCurrency, getCurrencyCode } from '../utils/currency';

export default function CreateInvoice({ clients = [], onRefresh, showToast, userProfile }) {
  const navigate = useNavigate();

  // Form state
  const [selectedClient, setSelectedClient] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [language, setLanguage] = useState(userProfile?.language || 'English');
  const [currency, setCurrency] = useState(userProfile?.currency || 'INR - Indian Rupee');
  const [template, setTemplate] = useState(userProfile?.defaultTemplate || 'modern');

  const [items, setItems] = useState([
    { id: 1, description: '', quantity: 1, rate: 0 }
  ]);
  const [discount, setDiscount] = useState(0);

  // Optional flat Tax rate
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [userSelectedCurrency, setUserSelectedCurrency] = useState(false);

  // GST fields
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstExpanded, setGstExpanded] = useState(false);
  const [gstType, setGstType] = useState('intra'); // 'intra' (CGST+SGST) or 'inter' (IGST)
  const [hsnSac, setHsnSac] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState(userProfile?.stateName || '');
  const [reverseCharge, setReverseCharge] = useState(false);

  // Set default client if available
  useEffect(() => {
    if (clients.length > 0 && !selectedClient) {
      setSelectedClient(clients[0].company);
    }
  }, [clients, selectedClient]);

  // Sync client selection
  const handleClientSelect = (company) => {
    setSelectedClient(company);
  };

  // Sync user profile currency & template default on initial load if not manually changed
  useEffect(() => {
    if (userProfile?.currency && !userSelectedCurrency) {
      setCurrency(userProfile.currency);
    }
    if (userProfile?.defaultTemplate) {
      setTemplate(userProfile.defaultTemplate);
    }
  }, [userProfile, userSelectedCurrency]);

  // Subtotal & Tax Calculations
  const subtotal = items.reduce((sum, item) => {
    const q = Number(item.quantity) || 0;
    const r = Number(item.rate) || 0;
    return sum + (q * r);
  }, 0);

  const discountAmount = (subtotal * (Number(discount) || 0)) / 100;
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxable * (Number(taxRate) || 0)) / 100;

  // GST breakdown
  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
  if (gstEnabled && taxRate > 0) {
    if (gstType === 'intra') {
      cgstRate = taxRate / 2;
      sgstRate = taxRate / 2;
      cgstAmount = (taxable * cgstRate) / 100;
      sgstAmount = (taxable * sgstRate) / 100;
    } else {
      igstRate = taxRate;
      igstAmount = (taxable * igstRate) / 100;
    }
  }

  const total = taxable + taxAmount;

  const activeCurrency = currency || 'INR - Indian Rupee';
  const formatMoney = (val) => formatCurrency(val, activeCurrency);
  const currencySymbol = getCurrencySymbol(activeCurrency);
  const currencyCode = getCurrencyCode(activeCurrency);

  // Live FX Conversions
  const fxConversions = ['INR', 'USD', 'EUR', 'GBP', 'CAD']
    .filter(c => c !== currencyCode)
    .map(c => convertCurrency(total, activeCurrency, c));

  // Item operations
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
        currency: activeCurrency,
        template: template,
        description: validItems[0].description,
        items: validItems.map(item => ({
          description: item.description,
          hsnSac: hsnSac || '',
          quantity: Number(item.quantity) || 1,
          rate: Number(item.rate) || 0,
          amount: (Number(item.quantity) || 1) * (Number(item.rate) || 0)
        })),
        quantity: Number(validItems[0].quantity) || 1,
        rate: Number(validItems[0].rate) || 0,
        discount: Number(discount) || 0,
        tax: Number(taxRate) || 0,
        subtotal: Number(subtotal.toFixed(2)),
        discountAmount: Number(discountAmount.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        amount: Number(total.toFixed(2)),
        notes: notes.trim(),
        status: status,
        // GST fields
        gstEnabled,
        gstType,
        hsnSac,
        placeOfSupply,
        reverseCharge,
        gstin: userProfile?.gstin || '',
        clientGstin: clientObj?.gstin || '',
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount: Number(cgstAmount.toFixed(2)),
        sgstAmount: Number(sgstAmount.toFixed(2)),
        igstAmount: Number(igstAmount.toFixed(2))
      };

      const createdInvoice = await api.addInvoice(payload);
      if (onRefresh) onRefresh();

      // Automatic PDF Download with selected template
      generateInvoicePDF(createdInvoice, userProfile, clientObj, language, activeCurrency, template);

      // Backend Email Delivery (if status is 'sent')
      if (status === 'sent') {
        try {
          await api.sendInvoiceEmail(createdInvoice.id);
          showToast(`Invoice ${createdInvoice.id} created, PDF downloaded & emailed!`, 'success');
        } catch (emailErr) {
          showToast(`Invoice ${createdInvoice.id} created & PDF downloaded! (Email delivery requires backend setup)`, 'success');
        }
      } else {
        showToast(`Invoice ${createdInvoice.id} saved as draft & PDF downloaded!`, 'success');
      }

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
            <p className="page-subtitle">Generate custom PDF invoices with currency options & templates.</p>
          </div>
        </div>
      </div>

      {/* Grid: Form on Left, Summary on Right */}
      <div className="create-invoice-grid">
        {/* Left Side: Form Details */}
        <div>
          {/* Card 1: Client & Invoice Info */}
          <div className="card">
            <h3 className="card-title">Client & Billing Information</h3>
            <div className="form-row-2" style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Select Client <span className="req">*</span>
                </label>
                <select
                  className="form-select"
                  value={selectedClient}
                  onChange={(e) => handleClientSelect(e.target.value)}
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

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <DollarSign size={14} color="#16a34a" />
                Invoice Currency
              </label>
              <select
                className="form-select"
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  setUserSelectedCurrency(true);
                }}
              >
                <option value="INR - Indian Rupee">INR - Indian Rupee (₹) [Default]</option>
                <option value="USD - US Dollar">USD - US Dollar ($)</option>
                <option value="EUR - Euro">EUR - Euro (€)</option>
                <option value="GBP - British Pound">GBP - British Pound (£)</option>
                <option value="CAD - Canadian Dollar">CAD - Canadian Dollar (CA$)</option>
                <option value="AUD - Australian Dollar">AUD - Australian Dollar (A$)</option>
              </select>
            </div>
          </div>

          {/* Card 2: PDF Template Selector */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <LayoutTemplate size={18} color="var(--accent-primary)" />
              <h3 className="card-title" style={{ margin: 0 }}>Select PDF Template</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }} className="template-grid">
              {[
                { id: 'modern', name: 'Modern Clean', desc: 'Vibrant & Modern' },
                { id: 'classic', name: 'Classic Corporate', desc: 'Formal Boxed' },
                { id: 'minimal', name: 'Minimalist', desc: 'Airy & Sleek' },
                { id: 'gst_pro', name: 'Executive Pro', desc: 'Formal Structured' }
              ].map(tmpl => (
                <div
                  key={tmpl.id}
                  className={`template-card ${template === tmpl.id ? 'active' : ''}`}
                  onClick={() => setTemplate(tmpl.id)}
                >
                  <LayoutTemplate size={18} />
                  <strong>{tmpl.name}</strong>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{tmpl.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: GST Settings (Optional, Collapsible) */}
          <div className="card">
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setGstExpanded(!gstExpanded)}
            >
              <h3 className="card-title" style={{ margin: 0 }}>Tax / GST Settings (Optional)</h3>
              {gstExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tax Rate (%):</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="form-input"
                style={{ width: '90px', padding: '6px 8px', textAlign: 'right' }}
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>%</span>
            </div>

            {gstExpanded && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={gstEnabled}
                      onChange={(e) => setGstEnabled(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    Enable Indian GST Breakdown
                  </label>
                </div>

                {gstEnabled && (
                  <>
                    <div className="form-row-2" style={{ marginBottom: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">GST Type</label>
                        <select
                          className="form-select"
                          value={gstType}
                          onChange={(e) => setGstType(e.target.value)}
                        >
                          <option value="intra">Intra-State (CGST + SGST)</option>
                          <option value="inter">Inter-State (IGST)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">HSN / SAC Code</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 998314"
                          value={hsnSac}
                          onChange={(e) => setHsnSac(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-row-2" style={{ marginBottom: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Place of Supply</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Maharashtra"
                          value={placeOfSupply}
                          onChange={(e) => setPlaceOfSupply(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="checkbox"
                            checked={reverseCharge}
                            onChange={(e) => setReverseCharge(e.target.checked)}
                            style={{ width: '14px', height: '14px' }}
                          />
                          Reverse Charge Applicable
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Card 4: Invoice Items */}
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

            <div className="table-responsive">
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: '50%' }}>DESCRIPTION</th>
                    <th style={{ width: '15%' }}>QTY</th>
                    <th style={{ width: '20%' }}>RATE ({currencySymbol})</th>
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
                            placeholder="Service or product description"
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
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
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
          </div>

          {/* Card 5: Notes & Terms */}
          <div className="card">
            <h3 className="card-title">Notes & Terms</h3>
            <div className="form-group" style={{ margin: 0 }}>
              <textarea
                className="form-textarea"
                placeholder="Payment terms, delivery details, notes..."
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
              Template: {template.toUpperCase()}
            </div>

            <div className="summary-row">
              <span>Subtotal:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatMoney(subtotal)}</strong>
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
              <span>Taxable Value:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatMoney(taxable)}</strong>
            </div>

            {Number(taxRate) > 0 && (
              <div className="summary-row">
                <span>Tax ({taxRate}%):</span>
                <strong style={{ color: 'var(--text-primary)' }}>+{formatMoney(taxAmount)}</strong>
              </div>
            )}

            {gstEnabled && Number(taxRate) > 0 && (
              <div style={{ fontSize: '12px', padding: '8px 0', borderTop: '1px dashed var(--border-color)', marginTop: '4px' }}>
                {gstType === 'intra' ? (
                  <>
                    <div className="summary-row" style={{ fontSize: '12px', padding: '2px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>CGST ({cgstRate}%):</span>
                      <span>{formatMoney(cgstAmount)}</span>
                    </div>
                    <div className="summary-row" style={{ fontSize: '12px', padding: '2px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>SGST ({sgstRate}%):</span>
                      <span>{formatMoney(sgstAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="summary-row" style={{ fontSize: '12px', padding: '2px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>IGST ({igstRate}%):</span>
                    <span>{formatMoney(igstAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Live Exchange Rate Converter Widget */}
            <div className="fx-converter-card">
              <div style={{ fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} />
                Live FX Estimates:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {fxConversions.slice(0, 4).map(fx => (
                  <div key={fx.code} className="fx-pill">
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fx.code}</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fx.formatted}</div>
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
                {saving ? 'Generating PDF...' : `Create & Download (${template.toUpperCase()} PDF)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
