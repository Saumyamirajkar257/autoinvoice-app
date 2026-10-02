import React, { useState } from 'react';
import { X, CheckCircle, QrCode, Smartphone, CreditCard, ShieldCheck, ExternalLink, Clock, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { api } from '../api';

export default function PaymentModal({ invoice, userProfile, onClose, onRefresh, showToast }) {
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [txnId, setTxnId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [manualTxnId, setManualTxnId] = useState('');
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' | 'manual' | 'demo'

  if (!invoice) return null;

  const currencyStr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);

  // Direct scannable payment URL
  const paymentUrl = `${window.location.origin}/#/pay/${encodeURIComponent(invoice.id)}`;
  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice';
  
  let qrCodeImgUrl = userProfile?.customQrUrl;
  if (!qrCodeImgUrl) {
    if (userProfile?.upiId) {
      const upiString = `upi://pay?pa=${encodeURIComponent(userProfile.upiId)}&pn=${encodeURIComponent(senderName)}&am=${invoice.amount}&cu=INR&tn=Invoice%20${encodeURIComponent(invoice.id)}`;
      qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiString)}`;
    } else {
      qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(paymentUrl)}`;
    }
  }

  // Record manual payment (business owner records a payment they've received)
  const handleRecordPayment = async () => {
    if (!manualTxnId.trim()) {
      showToast('Please enter a transaction ID or reference number', 'error');
      return;
    }
    setProcessing(true);
    try {
      await api.recordPayment(invoice.id, {
        transactionId: manualTxnId.trim(),
        method: paymentMethod,
        amount: invoice.amount
      });
      
      setTxnId(manualTxnId.trim());
      setCompleted(true);
      showToast(`Payment of ${formattedAmount} recorded for ${invoice.id}!`, 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Unable to record payment. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Demo payment simulation (clearly labeled)
  const handleDemoPayment = async () => {
    setProcessing(true);
    try {
      const generatedTxn = `DEMO-${Math.floor(1000000000 + Math.random() * 900000000)}`;
      
      await api.recordPayment(invoice.id, {
        transactionId: generatedTxn,
        method: 'demo',
        amount: invoice.amount,
        notes: 'Demo/test payment — not a real transaction'
      });

      setTxnId(generatedTxn);
      setCompleted(true);
      showToast(`Demo payment of ${formattedAmount} recorded! (Not a real payment)`, 'info');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Error processing demo payment', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Verify pending payment
  const handleVerifyPayment = async () => {
    setProcessing(true);
    try {
      await api.verifyPayment(invoice.id);
      setCompleted(true);
      setTxnId(invoice.payment?.transactionId || '');
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '540px', padding: '0', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} color="var(--accent-primary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Payment — {invoice.id}</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{invoice.client}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Success State */}
          {completed ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ color: '#16a34a', marginBottom: '8px' }}>Payment Recorded!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>
                Invoice <strong>{invoice.id}</strong> marked as <strong>Paid</strong>
              </p>
              {txnId && (
                <div style={{ background: 'var(--bg-card-subtle)', borderRadius: '8px', padding: '10px 16px', display: 'inline-block' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Transaction ID</span>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{txnId}</div>
                </div>
              )}
              <div style={{ marginTop: '20px' }}>
                <button className="btn-primary" onClick={onClose}>Done</button>
              </div>
            </div>
          ) : isPending ? (
            /* Pending Verification State */
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Clock size={48} color="#d97706" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#d97706', marginBottom: '8px' }}>Payment Awaiting Verification</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Client submitted a payment reference:
              </p>
              {invoice.payment?.transactionId && (
                <div style={{ background: 'var(--bg-card-subtle)', borderRadius: '8px', padding: '10px 16px', display: 'inline-block', marginBottom: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Reference: </span>
                  <strong style={{ fontFamily: 'monospace' }}>{invoice.payment.transactionId}</strong>
                </div>
              )}
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Method: {(invoice.payment?.method || 'UPI').toUpperCase()} • 
                Submitted: {invoice.payment?.paidAt ? new Date(invoice.payment.paidAt).toLocaleDateString() : 'N/A'}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button className="btn-primary" onClick={handleVerifyPayment} disabled={processing}>
                  <ShieldCheck size={16} />
                  {processing ? 'Verifying...' : 'Verify Payment'}
                </button>
                <button className="btn-secondary" onClick={onClose}>Later</button>
              </div>
            </div>
          ) : (
            /* Payment Actions */
            <>
              {/* Amount Card */}
              <div style={{ textAlign: 'center', background: 'var(--accent-subtle)', borderRadius: '10px', padding: '16px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invoice Amount</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-primary)' }}>{formattedAmount}</div>
              </div>

              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--bg-card-subtle)', borderRadius: '8px', padding: '4px' }}>
                {[
                  { id: 'qr', label: 'QR Code', icon: <QrCode size={14} /> },
                  { id: 'manual', label: 'Record Payment', icon: <CreditCard size={14} /> },
                  { id: 'demo', label: 'Demo Mode', icon: <AlertTriangle size={14} /> }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: 'none',
                      borderRadius: '6px',
                      background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                      color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: activeTab === tab.id ? 600 : 400,
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

              {/* QR Code Tab */}
              {activeTab === 'qr' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', display: 'inline-block', border: '1px solid var(--border-color)' }}>
                    <img src={qrCodeImgUrl} alt="Payment QR Code" width="200" height="200" style={{ borderRadius: '8px' }} />
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px' }}>
                    <Smartphone size={14} style={{ verticalAlign: 'middle' }} /> Scan with any UPI app to pay
                  </p>
                  {userProfile?.upiId && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      UPI ID: <strong>{userProfile.upiId}</strong>
                    </p>
                  )}
                  <div style={{ marginTop: '12px' }}>
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '13px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', textDecoration: 'none' }}
                    >
                      <ExternalLink size={14} /> Share Payment Link
                    </a>
                  </div>
                </div>
              )}

              {/* Manual Payment Recording Tab */}
              {activeTab === 'manual' && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Record a payment you've already received from the client.
                  </p>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Payment Method</label>
                    <select className="form-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer / NEFT / IMPS</option>
                      <option value="card">Credit / Debit Card</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Transaction ID / Reference <span className="req">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. UTR number, transaction ref, cheque number..."
                      value={manualTxnId}
                      onChange={(e) => setManualTxnId(e.target.value)}
                    />
                  </div>

                  <button
                    className="btn-primary btn-full"
                    onClick={handleRecordPayment}
                    disabled={processing || !manualTxnId.trim()}
                  >
                    <CheckCircle size={16} />
                    {processing ? 'Recording...' : `Record Payment of ${formattedAmount}`}
                  </button>
                </div>
              )}

              {/* Demo Mode Tab */}
              {activeTab === 'demo' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginBottom: '4px' }}>
                      <AlertTriangle size={16} color="#92400e" />
                      <strong style={{ color: '#92400e', fontSize: '13px' }}>Demo / Test Mode</strong>
                    </div>
                    <p style={{ fontSize: '12px', color: '#78350f', margin: 0 }}>
                      This simulates a payment for testing purposes. No real money is transferred.
                    </p>
                  </div>

                  <button
                    className="btn-secondary btn-full"
                    onClick={handleDemoPayment}
                    disabled={processing}
                    style={{ marginTop: '8px' }}
                  >
                    {processing ? 'Processing Demo...' : `Simulate ${formattedAmount} Payment`}
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
