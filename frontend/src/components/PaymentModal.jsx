import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  QrCode,
  Smartphone,
  CreditCard,
  ShieldCheck,
  ExternalLink,
  Clock,
  AlertTriangle,
  Receipt,
  Download,
  DollarSign,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { api } from '../api';
import { generateReceiptPDF } from './receiptGenerator';

export default function PaymentModal({ invoice, userProfile, onClose, onRefresh, showToast, clients = [] }) {
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [lastPaymentRecord, setLastPaymentRecord] = useState(null);
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'qr' | 'history' | 'demo'

  if (!invoice) return null;

  const currencyStr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
  const formatMoney = (val) => formatCurrency(val, currencyStr);
  const currencySymbol = getCurrencySymbol(currencyStr);

  const totalInvoiceAmt = Number(invoice.amount || 0);
  const existingPayments = Array.isArray(invoice.payments)
    ? invoice.payments
    : (invoice.payment && invoice.payment.status === 'verified' ? [invoice.payment] : []);

  const totalPaidSoFar = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const currentBalance = invoice.balanceDue !== undefined
    ? Number(invoice.balanceDue)
    : Math.max(0, Number((totalInvoiceAmt - totalPaidSoFar).toFixed(2)));

  // Manual payment form fields
  const [paymentAmount, setPaymentAmount] = useState(currentBalance > 0 ? currentBalance : totalInvoiceAmt);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [manualTxnId, setManualTxnId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Payment link and QR
  const paymentUrl = `${window.location.origin}/#/pay/${encodeURIComponent(invoice.id)}`;
  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice';

  let qrCodeImgUrl = userProfile?.customQrUrl;
  if (!qrCodeImgUrl) {
    if (userProfile?.upiId) {
      const upiString = `upi://pay?pa=${encodeURIComponent(userProfile.upiId)}&pn=${encodeURIComponent(senderName)}&am=${currentBalance}&cu=INR&tn=Invoice%20${encodeURIComponent(invoice.id)}`;
      qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiString)}`;
    } else {
      qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(paymentUrl)}`;
    }
  }

  const clientObj = clients.find(c => c.company === invoice.client);

  // Record payment (partial or full)
  const handleRecordPayment = async () => {
    if (!manualTxnId.trim()) {
      showToast('Please enter a transaction ID or reference / UTR number', 'error');
      return;
    }

    const payAmt = Number(paymentAmount);
    if (isNaN(payAmt) || payAmt <= 0) {
      showToast('Please enter a valid positive payment amount', 'error');
      return;
    }

    if (payAmt > currentBalance && currentBalance > 0) {
      showToast(`Payment amount cannot exceed the remaining balance of ${formatMoney(currentBalance)}`, 'error');
      return;
    }

    // Check duplicate transaction ID
    const duplicate = existingPayments.some(
      p => p.transactionId && p.transactionId.trim().toLowerCase() === manualTxnId.trim().toLowerCase()
    );
    if (duplicate) {
      showToast('A payment with this exact transaction ID has already been recorded for this invoice.', 'error');
      return;
    }

    setProcessing(true);
    try {
      const res = await api.recordPayment(invoice.id, {
        transactionId: manualTxnId.trim(),
        method: paymentMethod,
        amount: payAmt,
        notes: paymentNotes.trim()
      });

      const newRec = res?.payment || {
        receiptNumber: `REC-${(invoice.id || '').replace(/^INV-?/i, '')}-${existingPayments.length + 1}`,
        amount: payAmt,
        previousPaid: totalPaidSoFar,
        totalPaidToDate: totalPaidSoFar + payAmt,
        remainingBalance: Math.max(0, currentBalance - payAmt),
        transactionId: manualTxnId.trim(),
        method: paymentMethod,
        paidAt: new Date().toISOString()
      };

      setLastPaymentRecord(newRec);
      setCompleted(true);

      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch (e) {}

      showToast(`Payment of ${formatMoney(payAmt)} recorded successfully!`, 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Unable to record payment. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadReceipt = (paymentRec = null) => {
    const targetPayment = paymentRec || lastPaymentRecord || (existingPayments.length > 0 ? existingPayments[existingPayments.length - 1] : invoice.payment);
    generateReceiptPDF(invoice, userProfile, clientObj, targetPayment);
    showToast(`Official Payment Receipt PDF downloaded!`, 'success');
  };

  // Demo payment simulation
  const handleDemoPayment = async () => {
    setProcessing(true);
    try {
      const generatedTxn = `DEMO-UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      const res = await api.recordPayment(invoice.id, {
        transactionId: generatedTxn,
        method: 'upi',
        amount: currentBalance > 0 ? currentBalance : totalInvoiceAmt,
        notes: 'Demo test payment settlement'
      });

      const newRec = res?.payment || {
        receiptNumber: `REC-${(invoice.id || '').replace(/^INV-?/i, '')}-${existingPayments.length + 1}`,
        amount: currentBalance > 0 ? currentBalance : totalInvoiceAmt,
        transactionId: generatedTxn,
        method: 'upi',
        paidAt: new Date().toISOString()
      };

      setLastPaymentRecord(newRec);
      setCompleted(true);
      showToast(`Demo payment simulated and recorded!`, 'info');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Error processing demo payment', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Verify pending client payment
  const handleVerifyPayment = async () => {
    setProcessing(true);
    try {
      await api.verifyPayment(invoice.id);
      setCompleted(true);
      showToast(`Payment verified for ${invoice.id}!`, 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Unable to verify payment', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const isPending = invoice.status === 'pending_verification' || invoice.payment?.status === 'pending_verification';

  return (
    <div className="custom-modal-backdrop" onClick={onClose}>
      <div className="custom-modal-content" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="custom-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              background: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Record Payment — {invoice.id}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Client: {invoice.client}
              </span>
            </div>
          </div>
          <button className="icon-action-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="custom-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Completed State */}
          {completed ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 14px' }} />
              <h3 style={{ color: '#16a34a', marginBottom: '6px', fontSize: '20px', fontWeight: 800 }}>
                Payment Successfully Recorded!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                Payment of <strong>{formatMoney(lastPaymentRecord?.amount || paymentAmount)}</strong> has been audited against invoice <strong>{invoice.id}</strong>.
              </p>

              {lastPaymentRecord?.remainingBalance > 0 ? (
                <div style={{
                  background: 'var(--bg-card-subtle)',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  display: 'inline-block',
                  marginBottom: '16px',
                  border: '1px solid var(--border-color)'
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Remaining Balance Due: </span>
                  <strong style={{ color: '#dc2626' }}>{formatMoney(lastPaymentRecord.remainingBalance)}</strong>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(22, 163, 74, 0.1)',
                  color: '#16a34a',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  display: 'inline-block',
                  marginBottom: '16px',
                  fontWeight: 700,
                  fontSize: '13px'
                }}>
                  ✓ Invoice is Fully Settled & Closed
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleDownloadReceipt()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Receipt size={16} />
                  Download Official Receipt (PDF)
                </button>
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          ) : isPending ? (
            /* Pending Verification State */
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Clock size={48} color="#d97706" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#d97706', marginBottom: '8px', fontSize: '18px', fontWeight: 700 }}>
                Client Payment Awaiting Verification
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                The client has submitted a transaction reference via the payment portal:
              </p>
              {invoice.payment?.transactionId && (
                <div style={{ background: 'var(--bg-card-subtle)', borderRadius: '8px', padding: '10px 16px', display: 'inline-block', marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Reference: </span>
                  <strong style={{ fontFamily: 'monospace', fontSize: '14px' }}>{invoice.payment.transactionId}</strong>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px' }}>
                <button className="btn-primary" onClick={handleVerifyPayment} disabled={processing}>
                  <ShieldCheck size={16} />
                  {processing ? 'Verifying...' : 'Verify & Mark as Settled'}
                </button>
                <button className="btn-secondary" onClick={onClose}>Later</button>
              </div>
            </div>
          ) : (
            /* Payment Recording & QR */
            <>
              {/* Financial Balance Summary Card */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                background: 'var(--bg-card-subtle)',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Billed</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{formatMoney(totalInvoiceAmt)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Paid to Date</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a' }}>{formatMoney(totalPaidSoFar)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Balance Due</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: currentBalance > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatMoney(currentBalance)}
                  </div>
                </div>
              </div>

              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card-subtle)', borderRadius: '8px', padding: '4px' }}>
                {[
                  { id: 'manual', label: 'Record Transaction', icon: <CreditCard size={14} /> },
                  { id: 'qr', label: 'UPI / Scan QR', icon: <QrCode size={14} /> },
                  { id: 'history', label: `History (${existingPayments.length})`, icon: <Receipt size={14} /> },
                  { id: 'demo', label: 'Demo Mode', icon: <AlertTriangle size={14} /> }
                ].map(tab => (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      border: 'none',
                      borderRadius: '6px',
                      background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                      color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: activeTab === tab.id ? 700 : 500,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      boxShadow: activeTab === tab.id ? 'var(--card-shadow)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Manual Payment Recording (Partial or Full) */}
              {activeTab === 'manual' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-row-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        Payment Amount ({currencySymbol}) <span className="req">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={currentBalance > 0 ? currentBalance : totalInvoiceAmt}
                        step="0.01"
                        className="form-input"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        required
                      />
                      <span className="form-help">
                        {Number(paymentAmount) < currentBalance
                          ? `Partial payment. Balance remaining: ${formatMoney(Math.max(0, currentBalance - Number(paymentAmount)))}`
                          : 'Full payment (settles remaining balance)'}
                      </span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Payment Method</label>
                      <select
                        className="form-select"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                        <option value="bank_transfer">Bank Transfer / NEFT / RTGS</option>
                        <option value="card">Credit / Debit Card</option>
                        <option value="cash">Cash</option>
                        <option value="cheque">Cheque</option>
                        <option value="other">Other Mode</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      Transaction ID / UTR / Reference <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 329048192842 or UTR12345678"
                      value={manualTxnId}
                      onChange={(e) => setManualTxnId(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Payment Notes / Remark</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Advance payment 50%, final payment, etc."
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-primary btn-full"
                    onClick={handleRecordPayment}
                    disabled={processing || !manualTxnId.trim() || Number(paymentAmount) <= 0}
                    style={{ padding: '11px', marginTop: '4px' }}
                  >
                    <CheckCircle size={16} />
                    {processing ? 'Recording Transaction...' : `Record Payment of ${formatMoney(paymentAmount)}`}
                  </button>
                </div>
              )}

              {/* Tab 2: QR Code & Scannable UPI */}
              {activeTab === 'qr' && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', display: 'inline-block', border: '1px solid var(--border-color)' }}>
                    <img src={qrCodeImgUrl} alt="Payment QR Code" width="190" height="190" style={{ borderRadius: '8px' }} />
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px' }}>
                    <Smartphone size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Scan using Google Pay, PhonePe, Paytm, or any UPI app
                  </p>
                  {userProfile?.upiId && (
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      UPI VPA: <strong>{userProfile.upiId}</strong>
                    </p>
                  )}
                  <div style={{ marginTop: '12px' }}>
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '13px', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}
                    >
                      <ExternalLink size={14} /> Open Customer Payment Portal
                    </a>
                  </div>
                </div>
              )}

              {/* Tab 3: Payment History Ledger */}
              {activeTab === 'history' && (
                <div>
                  {existingPayments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                      <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <p style={{ fontSize: '13px' }}>No payments recorded yet for this invoice.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {existingPayments.map((p, idx) => (
                        <div
                          key={p.id || idx}
                          style={{
                            background: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                              +{formatMoney(p.amount || invoice.amount)}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              Ref: {p.transactionId || 'DIRECT'} • {(p.method || 'upi').toUpperCase()}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => handleDownloadReceipt(p)}
                            title="Download Receipt for this transaction"
                          >
                            <Download size={13} /> Receipt
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Demo Mode Simulation */}
              {activeTab === 'demo' && (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginBottom: '4px' }}>
                      <AlertTriangle size={16} color="#92400e" />
                      <strong style={{ color: '#92400e', fontSize: '13px' }}>Simulation / Testing Mode</strong>
                    </div>
                    <p style={{ fontSize: '12px', color: '#78350f', margin: 0 }}>
                      Quickly test payment recording, status updates, and receipt generation with generated mock UTR references.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary btn-full"
                    onClick={handleDemoPayment}
                    disabled={processing}
                  >
                    {processing ? 'Processing Demo...' : `Simulate Payment of ${formatMoney(currentBalance > 0 ? currentBalance : totalInvoiceAmt)}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
