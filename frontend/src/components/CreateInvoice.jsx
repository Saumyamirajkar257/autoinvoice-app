import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  Send,
  Save,
  RefreshCw,
  DollarSign,
  LayoutTemplate,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  Calendar,
  Building,
  Mail,
  FileText,
  Percent,
  Sparkles,
  CreditCard,
  Truck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { api } from '../api';
import { generateInvoicePDF, previewInvoicePDF, getInvoicePDFBase64 } from './pdfGenerator';
import { formatCurrency, getCurrencySymbol, convertCurrency, getCurrencyCode } from '../utils/currency';
import { amountInWords } from '../utils/numberToWords';
import { GST_STATES, getStateCodeByName } from '../utils/gstStates';

const COMMON_PRESET_ITEMS = [
  { description: 'Full-Stack Web Application Development', rate: 45000, hsnSac: '998314', unit: 'Hrs' },
  { description: 'UI/UX Design & Interactive Prototyping', rate: 28000, hsnSac: '998314', unit: 'Sets' },
  { description: 'Cloud Infrastructure & DevOps Setup', rate: 35000, hsnSac: '998313', unit: 'Units' },
  { description: 'Monthly Retainer & Technical Support', rate: 20000, hsnSac: '998319', unit: 'Months' },
  { description: 'Database Architecture & Performance Optimization', rate: 25000, hsnSac: '998315', unit: 'Hrs' },
  { description: 'Cybersecurity Audit & Vulnerability Assessment', rate: 30000, hsnSac: '998316', unit: 'Units' }
];

export default function CreateInvoice({ clients = [], onRefresh, showToast, userProfile }) {
  const navigate = useNavigate();

  // Invoice identifiers
  const [invoiceNumber, setInvoiceNumber] = useState(() => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    return `INV-${new Date().getFullYear()}-${randomSuffix}`;
  });

  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('30'); // '0' (Due on receipt), '15', '30', '60'
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Client Selection
  const [selectedClient, setSelectedClient] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientGstin, setClientGstin] = useState('');

  // Localization and theme
  const [language, setLanguage] = useState(userProfile?.language || 'English');
  const [currency, setCurrency] = useState(userProfile?.currency || 'INR - Indian Rupee');
  const [template, setTemplate] = useState(userProfile?.defaultTemplate || 'gst_pro');

  // Line Items
  const [items, setItems] = useState([
    { id: 1, description: 'Software Development & SaaS Engineering', hsnSac: '998314', quantity: 1, unit: 'Nos', rate: 25000 }
  ]);

  // Adjustments & Taxes
  const [discountType, setDiscountType] = useState('percentage'); // 'percentage' | 'flat'
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(18); // Default 18% GST in India
  const [shippingCharges, setShippingCharges] = useState(0);
  const [autoRoundOff, setAutoRoundOff] = useState(true);

  // Indian GST Details
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstExpanded, setGstExpanded] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState(userProfile?.stateName || 'Maharashtra');
  const [reverseCharge, setReverseCharge] = useState(false);
  const [notes, setNotes] = useState(userProfile?.defaultTerms || 'Payment is appreciated within the due period via Bank Transfer or UPI.');

  // UI state
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false); // Mobile / desktop sheet toggle
  const [quickClientModal, setQuickClientModal] = useState(false);
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientGstin, setNewClientGstin] = useState('');

  // Auto-update due date when payment terms change
  useEffect(() => {
    if (paymentTerms !== 'custom') {
      const days = Number(paymentTerms);
      const base = issueDate ? new Date(issueDate) : new Date();
      base.setDate(base.getDate() + days);
      setDueDate(base.toISOString().split('T')[0]);
    }
  }, [paymentTerms, issueDate]);

  // Set default client if available
  useEffect(() => {
    if (clients.length > 0 && !selectedClient) {
      const first = clients[0];
      handleClientSelect(first.company);
    }
  }, [clients]);

  // Sync client details on select
  const handleClientSelect = (company) => {
    setSelectedClient(company);
    const clientObj = clients.find(c => c.company === company);
    if (clientObj) {
      setClientEmail(clientObj.email || '');
      setClientAddress(clientObj.address || '');
      setClientGstin(clientObj.gstin || '');
      if (clientObj.stateName) {
        setPlaceOfSupply(clientObj.stateName);
      }
    }
  };

  // Determine GST type (Intra vs Inter) based on Place of Supply matching Business State
  const businessState = (userProfile?.stateName || 'Maharashtra').trim().toLowerCase();
  const customerState = (placeOfSupply || 'Maharashtra').trim().toLowerCase();
  const isIntraState = businessState === customerState;
  const gstType = isIntraState ? 'intra' : 'inter';

  // Subtotal calculation
  const subtotal = items.reduce((sum, item) => {
    const q = Number(item.quantity) || 0;
    const r = Number(item.rate) || 0;
    return sum + (q * r);
  }, 0);

  // Discount calculation
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * (Number(discountValue) || 0)) / 100;
  } else {
    discountAmount = Math.min(subtotal, Number(discountValue) || 0);
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const calculatedTax = (taxableAmount * (Number(taxRate) || 0)) / 100;

  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

  if (gstEnabled && taxRate > 0) {
    if (gstType === 'intra') {
      cgstRate = taxRate / 2;
      sgstRate = taxRate / 2;
      cgstAmount = (taxableAmount * cgstRate) / 100;
      sgstAmount = (taxableAmount * sgstRate) / 100;
    } else {
      igstRate = taxRate;
      igstAmount = (taxableAmount * igstRate) / 100;
    }
  }

  const rawTotal = taxableAmount + calculatedTax + Number(shippingCharges || 0);
  const finalTotal = autoRoundOff ? Math.round(rawTotal) : Number(rawTotal.toFixed(2));
  const roundOffDifference = Number((finalTotal - rawTotal).toFixed(2));

  const activeCurrency = currency || 'INR - Indian Rupee';
  const formatMoney = (val) => formatCurrency(val, activeCurrency);
  const currencySymbol = getCurrencySymbol(activeCurrency);
  const currencyCode = getCurrencyCode(activeCurrency);
  const amountWords = amountInWords(finalTotal, activeCurrency);

  // Currency conversions
  const fxConversions = ['INR', 'USD', 'EUR', 'GBP']
    .filter(c => c !== currencyCode)
    .map(c => convertCurrency(finalTotal, activeCurrency, c));

  // Item helpers
  const addItemRow = (preset = null) => {
    setItems([
      ...items,
      {
        id: Date.now(),
        description: preset ? preset.description : '',
        hsnSac: preset ? preset.hsnSac : '998314',
        quantity: 1,
        unit: preset ? preset.unit : 'Nos',
        rate: preset ? preset.rate : 0
      }
    ]);
  };

  const duplicateItemRow = (id) => {
    const target = items.find(i => i.id === id);
    if (!target) return;
    setItems([
      ...items,
      { ...target, id: Date.now() }
    ]);
    showToast('Item duplicated', 'info');
  };

  const removeItemRow = (id) => {
    if (items.length <= 1) {
      showToast('Invoice must have at least one line item', 'info');
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Build model for preview & PDF
  const buildCurrentInvoiceModel = (status = 'sent') => {
    const validItems = items.filter(i => (i.description || '').trim() !== '');
    const clientObj = clients.find(c => c.company === selectedClient);

    return {
      id: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-4)}`,
      client: selectedClient || 'Customer Organization',
      clientEmail: clientEmail || clientObj?.email || '',
      clientAddress: clientAddress || clientObj?.address || '',
      clientGstin: clientGstin || clientObj?.gstin || '',
      created: issueDate ? new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today',
      due: dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Upon Receipt',
      language,
      currency: activeCurrency,
      template,
      description: validItems[0]?.description || 'Professional Consultation Services',
      items: validItems.length > 0 ? validItems.map((item, idx) => ({
        sNo: idx + 1,
        description: item.description,
        hsnSac: item.hsnSac || '998314',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'Nos',
        rate: Number(item.rate) || 0,
        amount: (Number(item.quantity) || 1) * (Number(item.rate) || 0)
      })) : [{ sNo: 1, description: 'Consulting Services', hsnSac: '998314', quantity: 1, unit: 'Nos', rate: subtotal || 1000, amount: subtotal || 1000 }],
      quantity: Number(validItems[0]?.quantity) || 1,
      rate: Number(validItems[0]?.rate) || 0,
      discount: Number(discountValue) || 0,
      discountType,
      discountAmount: Number(discountAmount.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(taxRate) || 0,
      taxAmount: Number(calculatedTax.toFixed(2)),
      shippingCharges: Number(shippingCharges || 0),
      roundOff: roundOffDifference,
      amount: finalTotal,
      balanceDue: finalTotal,
      amountPaid: 0,
      notes: notes.trim(),
      status,
      gstEnabled,
      gstType,
      placeOfSupply,
      reverseCharge,
      cgstRate,
      sgstRate,
      igstRate,
      cgstAmount: Number(cgstAmount.toFixed(2)),
      sgstAmount: Number(sgstAmount.toFixed(2)),
      igstAmount: Number(igstAmount.toFixed(2))
    };
  };

  const handlePreviewPDF = () => {
    try {
      const mock = buildCurrentInvoiceModel('draft');
      const clientObj = clients.find(c => c.company === selectedClient);
      previewInvoicePDF(mock, userProfile, clientObj, language, activeCurrency, template);
      showToast(`Opening live PDF preview (${template.toUpperCase()})...`, 'info');
    } catch (err) {
      showToast('Could not preview PDF: ' + err.message, 'error');
    }
  };

  const handleDownloadSamplePDF = () => {
    try {
      const mock = buildCurrentInvoiceModel('draft');
      const clientObj = clients.find(c => c.company === selectedClient);
      generateInvoicePDF(mock, userProfile, clientObj, language, activeCurrency, template);
      showToast(`Sample PDF downloaded!`, 'success');
    } catch (err) {
      showToast('Could not download sample PDF: ' + err.message, 'error');
    }
  };

  // Add quick client
  const handleQuickAddClient = async (e) => {
    e.preventDefault();
    if (!newClientCompany.trim()) {
      showToast('Client company name is required', 'error');
      return;
    }
    try {
      const newC = await api.addClient({
        company: newClientCompany.trim(),
        email: newClientEmail.trim(),
        gstin: newClientGstin.trim()
      });
      showToast(`Client "${newClientCompany}" added!`, 'success');
      setSelectedClient(newC.company);
      setClientEmail(newC.email);
      setClientGstin(newC.gstin);
      setQuickClientModal(false);
      setNewClientCompany('');
      setNewClientEmail('');
      setNewClientGstin('');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Failed to add client', 'error');
    }
  };

  // Submit Invoice
  const handleSubmit = async (status = 'sent') => {
    if (!selectedClient) {
      showToast('Please select a client', 'error');
      return;
    }

    const validItems = items.filter(item => item.description.trim() !== '');
    if (validItems.length === 0) {
      showToast('Please enter at least one item description', 'error');
      return;
    }

    const clientObj = clients.find(c => c.company === selectedClient);
    const recipientEmail = (clientEmail || clientObj?.email || '').trim();

    if (status === 'sent' && !recipientEmail) {
      showToast('Please provide a client email address to send the invoice', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = buildCurrentInvoiceModel(status);
      const createdInvoice = await api.addInvoice(payload);

      // Trigger Confetti Celebratory Effect!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      if (onRefresh) onRefresh();

      if (status === 'sent') {
        // Auto-download PDF
        try {
          generateInvoicePDF(createdInvoice, userProfile, clientObj, language, activeCurrency, template);
        } catch (pdfErr) {
          console.warn('PDF auto-download note:', pdfErr);
        }

        // Direct email dispatch
        if (recipientEmail) {
          try {
            let pdfBase64 = null;
            try {
              pdfBase64 = getInvoicePDFBase64(createdInvoice, userProfile, clientObj, language, activeCurrency, template);
            } catch (err) {}

            await api.sendInvoiceEmail(createdInvoice.id, {
              recipientEmail,
              pdfBase64
            });
            showToast(`Invoice ${createdInvoice.id} created, downloaded & dispatched to ${recipientEmail}!`, 'success');
          } catch (e) {
            showToast(`Invoice ${createdInvoice.id} created & downloaded! (Email: ${e.message || 'Check recipient'})`, 'info');
          }
        } else {
          showToast(`Invoice ${createdInvoice.id} created & downloaded!`, 'success');
        }
      } else {
        showToast(`Invoice ${createdInvoice.id} saved as draft!`, 'success');
      }

      navigate('/invoices');
    } catch (err) {
      showToast(err.message || 'Failed to save invoice', 'error');
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
            <h1 className="page-title">Create Tax Invoice</h1>
            <p className="page-subtitle">Configure line items, automatic GST calculations, templates, and instant dispatch.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPreviewMode(!previewMode)}
            title="Toggle Live Visual Sheet Preview"
          >
            <Eye size={16} />
            {previewMode ? 'Edit Form' : 'Live Document Preview'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handlePreviewPDF}
            title="Open High-Resolution PDF"
          >
            <FileText size={16} color="var(--accent-primary)" />
            Preview PDF
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleDownloadSamplePDF}
            title="Download PDF Sample"
          >
            <Download size={16} />
            Download Sample
          </button>
        </div>
      </div>

      {/* Main Grid: Form on Left, Live Financial Summary & Preview on Right */}
      <div className="create-invoice-grid">
        {/* Left Column: Form Sections */}
        <div style={{ display: previewMode ? 'none' : 'block' }}>
          {/* Card 1: Primary Document Metadata */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Invoice Information</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Template:</span>
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '4px 10px', fontSize: '12px', height: '32px', fontWeight: 600 }}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  <option value="gst_pro">Executive GST Pro</option>
                  <option value="modern">Modern Clean</option>
                  <option value="classic">Classic Corporate</option>
                  <option value="minimal">Minimalist Elegance</option>
                </select>
              </div>
            </div>

            <div className="form-row-3" style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Invoice Number <span className="req">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2025-001"
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Issue Date <span className="req">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Due Date <span className="req">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    setPaymentTerms('custom');
                  }}
                  required
                />
              </div>
            </div>

            {/* Quick Payment Term Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Payment Terms:</span>
              {[
                { label: 'Due on Receipt', val: '0' },
                { label: 'Net 15', val: '15' },
                { label: 'Net 30', val: '30' },
                { label: 'Net 60', val: '60' }
              ].map(term => (
                <button
                  type="button"
                  key={term.val}
                  className={`btn-sm ${paymentTerms === term.val ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '3px 9px', fontSize: '11px' }}
                  onClick={() => setPaymentTerms(term.val)}
                >
                  {term.label}
                </button>
              ))}
            </div>
          </div>

          {/* Card 2: Client & Receiver Details */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={18} color="var(--accent-primary)" />
                <h3 className="card-title" style={{ margin: 0 }}>Client & Receiver Details</h3>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setQuickClientModal(true)}
              >
                <Plus size={14} /> Quick Add Client
              </button>
            </div>

            <div className="form-row-2" style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Select Client <span className="req">*</span></label>
                <select
                  className="form-select"
                  value={selectedClient}
                  onChange={(e) => handleClientSelect(e.target.value)}
                >
                  <option value="">Choose a registered client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.company}>
                      {c.company} {c.contact ? `(${c.contact})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Client Email Address <span className="req">*</span></label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="accounts@client.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Client GSTIN / Tax ID (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 27AABCU9603R1ZM"
                  value={clientGstin}
                  onChange={(e) => setClientGstin(e.target.value.toUpperCase())}
                  maxLength={15}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Invoice Currency</label>
                <select
                  className="form-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
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
          </div>

          {/* Card 3: Indian GST & Statutory Billing Settings */}
          <div className="card">
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setGstExpanded(!gstExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Percent size={18} color="#16a34a" />
                <div>
                  <h3 className="card-title" style={{ margin: 0 }}>Tax & Statutory GST Rules</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                    {gstEnabled
                      ? `Active: ${gstType === 'intra' ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'} • Supply: ${placeOfSupply}`
                      : 'Standard flat tax rate'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`gst-badge ${gstType}`}>
                  {gstType === 'intra' ? 'INTRA-STATE' : 'INTER-STATE'}
                </span>
                {gstExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {/* Quick Tax Rate Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tax Rate:</span>
              {[0, 5, 12, 18, 28].map(rate => (
                <button
                  type="button"
                  key={rate}
                  className={`btn-sm ${taxRate === rate ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '3px 10px', fontSize: '12px' }}
                  onClick={() => setTaxRate(rate)}
                >
                  {rate}%
                </button>
              ))}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="form-input"
                  style={{ width: '70px', padding: '4px 6px', textAlign: 'right', height: '30px', fontSize: '12px' }}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                />
                <span style={{ fontSize: '12px' }}>%</span>
              </div>
            </div>

            {gstExpanded && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div className="form-row-2" style={{ marginBottom: '14px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Place of Supply (State / UT)</label>
                    <select
                      className="form-select"
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                    >
                      {GST_STATES.map(s => (
                        <option key={s.code} value={s.name}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">GST Tax Treatment</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div
                        className={`gst-type-btn ${gstType === 'intra' ? 'active' : ''}`}
                        style={{ padding: '8px' }}
                      >
                        <strong>CGST + SGST</strong>
                        <span>Intra-State (50% / 50%)</span>
                      </div>
                      <div
                        className={`gst-type-btn ${gstType === 'inter' ? 'active' : ''}`}
                        style={{ padding: '8px' }}
                      >
                        <strong>IGST</strong>
                        <span>Inter-State (100%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={reverseCharge}
                      onChange={(e) => setReverseCharge(e.target.checked)}
                      style={{ width: '15px', height: '15px' }}
                    />
                    Reverse Charge Applicable (RCM)
                  </label>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={gstEnabled}
                      onChange={(e) => setGstEnabled(e.target.checked)}
                      style={{ width: '15px', height: '15px' }}
                    />
                    Print Statutory GST Breakdown on Invoice
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: Line Items Table with Presets */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0 }}>Itemized Goods & Services</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Add products or services with HSN/SAC codes, quantity, and unit rates.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => addItemRow()}
                >
                  <Plus size={14} /> Add Line Item
                </button>
              </div>
            </div>

            {/* Quick Preset Services */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <Sparkles size={12} style={{ display: 'inline', marginRight: '4px' }} /> Quick Add:
              </span>
              {COMMON_PRESET_ITEMS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '3px 8px', whiteSpace: 'nowrap' }}
                  onClick={() => addItemRow(preset)}
                >
                  + {preset.description.split(' ')[0]} {preset.description.split(' ')[1]}
                </button>
              ))}
            </div>

            <div className="table-responsive">
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: '42%' }}>ITEM / SERVICE DESCRIPTION</th>
                    <th style={{ width: '15%' }}>HSN / SAC</th>
                    <th style={{ width: '10%' }}>QTY</th>
                    <th style={{ width: '12%' }}>UNIT</th>
                    <th style={{ width: '18%' }}>RATE ({currencySymbol})</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ width: '8%', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const lineTotal = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
                    return (
                      <tr key={item.id}>
                        <td>
                          <input
                            type="text"
                            className="item-input"
                            placeholder="e.g. Enterprise Cloud Hosting & API Consulting"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="item-input"
                            placeholder="e.g. 998314"
                            value={item.hsnSac || ''}
                            onChange={(e) => updateItem(item.id, 'hsnSac', e.target.value)}
                            maxLength={8}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="item-input"
                            style={{ textAlign: 'center' }}
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="item-input"
                            value={item.unit || 'Nos'}
                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                          >
                            <option value="Nos">Nos</option>
                            <option value="Hrs">Hrs</option>
                            <option value="Days">Days</option>
                            <option value="Sets">Sets</option>
                            <option value="Units">Units</option>
                            <option value="Months">Months</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="item-input"
                            style={{ textAlign: 'right' }}
                            value={item.rate}
                            onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatMoney(lineTotal)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="icon-action-btn"
                              title="Duplicate Item"
                              onClick={() => duplicateItemRow(item.id)}
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-action-btn delete"
                              title="Remove Item"
                              onClick={() => removeItemRow(item.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 5: Terms, Notes & Banking Info */}
          <div className="card">
            <h3 className="card-title">Payment Instructions & Terms</h3>
            <div className="form-group" style={{ margin: 0 }}>
              <textarea
                className="form-textarea"
                placeholder="Payment terms, delivery details, thank you note, bank details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
              <span className="form-help">
                Bank account number and UPI ID from your Business Profile will be automatically rendered on the final invoice.
              </span>
            </div>
          </div>
        </div>

        {/* Live Sheet Document Preview (When Toggled) */}
        {previewMode && (
          <div className="card" style={{ padding: '32px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  TAX INVOICE
                </h2>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  #{invoiceNumber} • Date: {issueDate} • Due: {dueDate}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {userProfile?.businessName || userProfile?.fullName || 'AutoInvoice Business'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {userProfile?.email} {userProfile?.phone ? '| ' + userProfile?.phone : ''}
                </div>
                {userProfile?.businessGstin && (
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>GSTIN: {userProfile.businessGstin}</div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-card-subtle)', padding: '14px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Billed To:</span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {selectedClient || 'Select a Client'}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{clientEmail}</div>
                {clientGstin && <div style={{ fontSize: '12px', fontWeight: 600 }}>GSTIN: {clientGstin}</div>}
              </div>

              <div style={{ background: 'var(--bg-card-subtle)', padding: '14px', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Supply Details:</span>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Place of Supply: <strong>{placeOfSupply}</strong> ({getStateCodeByName(placeOfSupply) || '27'})
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Tax Mechanism: <strong>{gstType === 'intra' ? 'CGST + SGST (Intra-State)' : 'IGST (Inter-State)'}</strong>
                </div>
              </div>
            </div>

            <div className="table-responsive" style={{ marginBottom: '20px' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>HSN/SAC</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.description || 'Item'}</td>
                      <td>{item.hsnSac || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity} {item.unit}</td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(item.rate)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {formatMoney((Number(item.quantity) || 1) * (Number(item.rate) || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ maxWidth: '340px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>AMOUNT IN WORDS:</span>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {amountWords}
                </div>
                {notes && (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <strong>Terms:</strong> {notes}
                  </div>
                )}
              </div>

              <div style={{ minWidth: '240px' }}>
                <div className="summary-row" style={{ padding: '4px 0' }}>
                  <span>Gross Subtotal:</span>
                  <strong>{formatMoney(subtotal)}</strong>
                </div>
                {discountAmount > 0 && (
                  <div className="summary-row" style={{ color: '#16a34a', padding: '4px 0' }}>
                    <span>Discount:</span>
                    <span>-{formatMoney(discountAmount)}</span>
                  </div>
                )}
                {gstType === 'intra' ? (
                  <>
                    <div className="summary-row" style={{ padding: '4px 0', fontSize: '12.5px' }}>
                      <span>CGST ({cgstRate}%):</span>
                      <span>+{formatMoney(cgstAmount)}</span>
                    </div>
                    <div className="summary-row" style={{ padding: '4px 0', fontSize: '12.5px' }}>
                      <span>SGST ({sgstRate}%):</span>
                      <span>+{formatMoney(sgstAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="summary-row" style={{ padding: '4px 0', fontSize: '12.5px' }}>
                    <span>IGST ({igstRate}%):</span>
                    <span>+{formatMoney(igstAmount)}</span>
                  </div>
                )}
                {shippingCharges > 0 && (
                  <div className="summary-row" style={{ padding: '4px 0' }}>
                    <span>Shipping:</span>
                    <span>+{formatMoney(shippingCharges)}</span>
                  </div>
                )}
                <div className="summary-row total-row" style={{ marginTop: '8px' }}>
                  <span>Total Due:</span>
                  <span className="summary-total-val">{formatMoney(finalTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Invoice Calculation Engine Card */}
        <div>
          <div className="summary-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Calculation Breakdown</h3>
              <div className="summary-badge">
                <CheckCircle2 size={13} />
                {template.toUpperCase()}
              </div>
            </div>

            <div className="summary-row">
              <span>Gross Subtotal:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatMoney(subtotal)}</strong>
            </div>

            {/* Discount Inputs */}
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Discount:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    style={{ width: '70px', padding: '4px 8px', textAlign: 'right', height: '30px', fontSize: '12px' }}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                  />
                  <select
                    className="form-select"
                    style={{ width: 'auto', padding: '4px', height: '30px', fontSize: '12px' }}
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                  >
                    <option value="percentage">%</option>
                    <option value="flat">{currencySymbol}</option>
                  </select>
                </div>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#16a34a' }}>
                  <span>Discount Applied:</span>
                  <span>-{formatMoney(discountAmount)}</span>
                </div>
              )}
            </div>

            <div className="summary-row">
              <span>Taxable Value:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatMoney(taxableAmount)}</strong>
            </div>

            {/* Taxes */}
            {taxRate > 0 && (
              <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                {gstType === 'intra' ? (
                  <>
                    <div className="summary-row" style={{ fontSize: '12.5px', padding: '2px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>CGST ({cgstRate}%):</span>
                      <span>+{formatMoney(cgstAmount)}</span>
                    </div>
                    <div className="summary-row" style={{ fontSize: '12.5px', padding: '2px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>SGST ({sgstRate}%):</span>
                      <span>+{formatMoney(sgstAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="summary-row" style={{ fontSize: '12.5px', padding: '2px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>IGST ({igstRate}%):</span>
                    <span>+{formatMoney(igstAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Shipping & Handling */}
            <div className="summary-row" style={{ padding: '8px 0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Truck size={14} color="var(--text-muted)" /> Shipping / Charges:
              </span>
              <input
                type="number"
                min="0"
                className="form-input"
                style={{ width: '80px', padding: '4px 8px', textAlign: 'right', height: '30px', fontSize: '12px' }}
                value={shippingCharges}
                onChange={(e) => setShippingCharges(Number(e.target.value))}
              />
            </div>

            {/* Round off toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoRoundOff}
                  onChange={(e) => setAutoRoundOff(e.target.checked)}
                />
                Auto Round Off (Nearest Rupee)
              </label>
              {autoRoundOff && (
                <span>{(roundOffDifference >= 0 ? '+' : '') + formatMoney(roundOffDifference)}</span>
              )}
            </div>

            {/* Final Total */}
            <div className="summary-row total-row">
              <span>Total Amount ({currencyCode}):</span>
              <span className="summary-total-val">{formatMoney(finalTotal)}</span>
            </div>

            {/* Amount in words badge */}
            <div style={{
              background: 'var(--bg-card-subtle)',
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: '11.5px',
              color: 'var(--text-secondary)',
              marginTop: '10px',
              lineHeight: 1.4
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>In Words:</strong> {amountWords}
            </div>

            {/* Live FX Widget */}
            <div className="fx-converter-card">
              <div style={{ fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={13} />
                Live Multi-Currency Estimates:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {fxConversions.map(fx => (
                  <div key={fx.code} className="fx-pill">
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fx.code}</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fx.formatted}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="summary-actions">
              <button
                type="button"
                className="btn-primary btn-full"
                onClick={() => handleSubmit('sent')}
                disabled={saving}
                style={{ padding: '12px 16px', fontSize: '14.5px' }}
              >
                <Send size={16} />
                {saving ? 'Generating & Dispatched...' : 'Create, Download & Email Invoice'}
              </button>

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
                className="btn-secondary btn-full"
                onClick={handlePreviewPDF}
              >
                <Eye size={16} />
                Preview Full PDF Document
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Client Modal */}
      {quickClientModal && (
        <div className="custom-modal-backdrop" onClick={() => setQuickClientModal(false)}>
          <div className="custom-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="custom-modal-header">
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Quick Add Client</h3>
            </div>
            <form onSubmit={handleQuickAddClient}>
              <div className="custom-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Company Name <span className="req">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Acme Corporation"
                    value={newClientCompany}
                    onChange={(e) => setNewClientCompany(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Email Address <span className="req">*</span></label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="billing@acme.com"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Client GSTIN (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    value={newClientGstin}
                    onChange={(e) => setNewClientGstin(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <div className="custom-modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setQuickClientModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
