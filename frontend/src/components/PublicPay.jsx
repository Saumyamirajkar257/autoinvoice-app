import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, Smartphone, QrCode, CreditCard, Lock, FileText, Download } from 'lucide-react';
import { api } from '../api';
import { formatCurrency } from '../utils/currency';
import { generateInvoicePDF } from './pdfGenerator';

export default function PublicPay() {
  const { invId } = useParams();
  const [searchParams] = useSearchParams();
  const ownerUid = searchParams.get('uid') || '';

  const [invoice, setInvoice] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [txnRef, setTxnRef] = useState('');
  const [payerName, setPayerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');

  useEffect(() => {
    async function loadInvoiceData() {
      try {
        setLoading(true);
        // Use the new public API endpoint
        const data = await api.getPublicInvoice(invId || '', ownerUid);
        
        if (data?.invoice) {
          setInvoice(data.invoice);
          setUserProfile(data.profile || {});
        } else {
          // Fallback: try loading from local data
          const [invoices, profile] = await Promise.all([
            api.getInvoices().catch(() => []),
            api.getProfile().catch(() => ({}))
          ]);
          const target = invoices.find(i => String(i.id).toLowerCase() === String(invId || '').toLowerCase()) || invoices[0];
          setInvoice(target || null);
          setUserProfile(profile);
        }
      } catch (e) {
        console.error('Public pay load error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadInvoiceData();
  }, [invId, ownerUid]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main, #f8fafc)', color: 'var(--text-muted, #94a3b8)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner-dot" style={{ margin: '0 auto 12px' }} />
          <div>Loading Invoice...</div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main, #f8fafc)', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
          <FileText size={48} color="var(--text-muted, #94a3b8)" style={{ margin: '0 auto 16px' }} />
          <h2>Invoice Not Found</h2>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '14px', marginBottom: '20px' }}>
            The requested invoice link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  const currencyStr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
  const formattedAmount = formatCurrency(invoice.amount, currencyStr);
  const isAlreadyPaid = invoice.status === 'paid';
  const isPendingVerification = invoice.status === 'pending_verification' || invoice.payment?.status === 'pending_verification';
  const senderName = userProfile?.businessName || userProfile?.fullName || 'AutoInvoice';
  
  // QR Code
  let qrCodeImgUrl = userProfile?.customQrUrl;
  if (!qrCodeImgUrl) {
    if (userProfile?.upiId) {
      const upiString = `upi://pay?pa=${encodeURIComponent(userProfile.upiId)}&pn=${encodeURIComponent(senderName)}&am=${invoice.amount}&cu=INR&tn=Invoice%20${encodeURIComponent(invoice.id)}`;
      qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`;
    } else {
      qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`;
    }
  }

  // Client confirms payment by submitting transaction reference
  const handleConfirmPayment = async () => {
    if (!txnRef.trim()) {
      alert('Please enter your transaction reference or UTR number.');
      return;
    }
    setSubmitting(true);
    try {
      await api.confirmClientPayment(invoice.id, {
        transactionId: txnRef.trim(),
        method: paymentMethod,
        payerName: payerName.trim()
      });
      setSubmitted(true);
    } catch (err) {
      alert('Unable to submit payment confirmation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    const lang = invoice.language || 'English';
    const curr = invoice.currency || userProfile?.currency || 'INR - Indian Rupee';
    const tmpl = invoice.template || 'modern';
    generateInvoicePDF(invoice, userProfile, null, lang, curr, tmpl);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main, #f8fafc)', color: 'var(--text-primary, #0f172a)', padding: '20px 16px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        
        {/* Top Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="brand-icon">
              <Lock size={16} color="#ffffff" />
            </div>
            <strong style={{ fontSize: '18px' }}>AutoInvoice Pay</strong>
          </div>
          <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '4px 8px', borderRadius: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={12} /> Secure
          </span>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '0', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
          {/* Header Banner */}
          <div style={{ 
            background: isAlreadyPaid ? '#16a34a' : isPendingVerification ? '#d97706' : '#2563eb', 
            color: '#ffffff', 
            padding: '24px 20px', 
            textAlign: 'center' 
          }}>
            <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {senderName}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, margin: '4px 0' }}>
              {formattedAmount}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              Invoice #{invoice.id} • Due {invoice.due || 'Upon Receipt'}
            </div>
          </div>

          <div style={{ padding: '24px' }}>
            {/* PAID */}
            {isAlreadyPaid ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <CheckCircle2 size={38} color="#16a34a" />
                </div>
                <h2 style={{ fontSize: '22px', color: '#16a34a', margin: '0 0 6px 0' }}>Payment Complete!</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-muted, #94a3b8)', margin: '0 0 20px 0' }}>
                  Your payment of <strong>{formattedAmount}</strong> has been received.
                </p>
                {invoice.payment?.transactionId && (
                  <div style={{ background: 'var(--bg-card-subtle, #f1f5f9)', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Transaction: </span>
                    <strong style={{ fontFamily: 'monospace' }}>{invoice.payment.transactionId}</strong>
                  </div>
                )}
                <button className="btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={handleDownloadPDF}>
                  <Download size={16} /> Download Invoice PDF
                </button>
              </div>
            ) : (isPendingVerification || submitted) ? (
              /* PENDING VERIFICATION */
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <ShieldCheck size={38} color="#d97706" />
                </div>
                <h2 style={{ fontSize: '20px', color: '#d97706', margin: '0 0 8px 0' }}>Payment Submitted</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-muted, #94a3b8)', margin: '0 0 12px 0' }}>
                  Your payment reference has been sent to <strong>{senderName}</strong> for verification.
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
                  You will receive a confirmation once the payment is verified.
                </p>
                <button className="btn-secondary" style={{ width: '100%', padding: '12px', marginTop: '16px' }} onClick={handleDownloadPDF}>
                  <Download size={16} /> Download Invoice PDF
                </button>
              </div>
            ) : (
              /* PAYMENT FORM */
              <div>
                {/* Invoice Details */}
                <div style={{ marginBottom: '20px', fontSize: '13px', background: 'var(--bg-card-subtle, #f1f5f9)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Billed To:</span>
                    <strong>{invoice.client}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Description:</span>
                    <span>{invoice.description || 'Professional Services'}</span>
                  </div>
                  {invoice.taxAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Tax Included:</span>
                      <span>{formatCurrency(invoice.taxAmount, currencyStr)}</span>
                    </div>
                  )}
                </div>

                {/* QR Code */}
                <div style={{ textAlign: 'center', marginBottom: '20px', background: '#ffffff', border: '2px dashed #2563eb', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Smartphone size={16} color="#2563eb" />
                    Scan with UPI / Phone Camera
                  </div>
                  <img src={qrCodeImgUrl} alt="Payment QR Code" style={{ width: '160px', height: '160px', margin: '0 auto', display: 'block' }} />
                  <div style={{ marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
                    Supports Google Pay, PhonePe, Paytm & all UPI apps
                  </div>
                  {userProfile?.upiId && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#334155' }}>
                      UPI ID: <strong>{userProfile.upiId}</strong>
                    </div>
                  )}
                </div>

                {/* Payment Confirmation Form */}
                <div style={{ background: 'var(--bg-card-subtle, #f1f5f9)', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                    Confirm Your Payment
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '12px' }}>
                    After paying via UPI or bank transfer, enter your transaction reference below. The business owner will verify and confirm your payment.
                  </p>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Payment Method</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {[
                        { id: 'upi', name: 'UPI', icon: Smartphone },
                        { id: 'bank_transfer', name: 'Bank', icon: QrCode },
                        { id: 'card', name: 'Card', icon: CreditCard }
                      ].map(m => {
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPaymentMethod(m.id)}
                            style={{
                              padding: '8px',
                              border: `2px solid ${paymentMethod === m.id ? '#2563eb' : 'var(--border-color, #e2e8f0)'}`,
                              borderRadius: '8px',
                              background: paymentMethod === m.id ? '#eff6ff' : 'var(--bg-card, #fff)',
                              color: paymentMethod === m.id ? '#2563eb' : 'var(--text-secondary, #475569)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '11px',
                              fontWeight: paymentMethod === m.id ? 600 : 400
                            }}
                          >
                            <Icon size={16} />
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Your Name (optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter your name"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Transaction Reference / UTR Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 412345678901 or UTR number"
                      value={txnRef}
                      onChange={(e) => setTxnRef(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700 }}
                  onClick={handleConfirmPayment}
                  disabled={submitting || !txnRef.trim()}
                >
                  <ShieldCheck size={18} />
                  {submitting ? 'Submitting...' : 'Confirm Payment'}
                </button>

                <button
                  className="btn-secondary"
                  style={{ width: '100%', padding: '10px', marginTop: '10px', fontSize: '13px' }}
                  onClick={handleDownloadPDF}
                >
                  <Download size={14} /> Download Invoice PDF
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
          AutoInvoice • Secure Payment Portal
        </div>
      </div>
    </div>
  );
}
