import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  Check,
  FileText,
  RefreshCw,
  AlertCircle,
  Eye,
  ShieldCheck,
  Link2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  buildInvoiceEmailData,
  buildReminderEmailData,
  buildReceiptEmailData,
  getInvoicePaymentDetails
} from '../utils/emailService';
import { getInvoicePDFBase64 } from './pdfGenerator';
import { api } from '../api';

export default function SendEmailModal({
  invoice,
  type = 'invoice', // 'invoice' | 'reminder' | 'receipt'
  reminderType = 'upcoming',
  userProfile,
  clients = [],
  payment = null,
  onClose,
  onRefresh,
  showToast
}) {
  if (!invoice) return null;

  const clientObj = clients.find(c => c.company === invoice.client);
  const initialRecipient = invoice.clientEmail || clientObj?.email || '';

  // Generate initial email data
  const initialData = type === 'receipt'
    ? buildReceiptEmailData(invoice, userProfile, clientObj, payment || invoice.payment)
    : type === 'reminder'
      ? buildReminderEmailData(invoice, userProfile, clientObj, reminderType)
      : buildInvoiceEmailData(invoice, userProfile, clientObj);

  const [recipient, setRecipient] = useState(initialRecipient);
  const [subject, setSubject] = useState(initialData.subject || '');
  const [message, setMessage] = useState(initialData.textBody || '');
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { paymentUrl } = getInvoicePaymentDetails(invoice, userProfile);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !sending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, sending]);

  const isValidEmail = (email) => {
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleDirectSend = async () => {
    if (!recipient.trim()) {
      showToast('Please enter a recipient email address', 'error');
      return;
    }
    if (!isValidEmail(recipient)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setSending(true);
    showToast(`Sending invoice ${invoice.id} to ${recipient.trim()}...`, 'info');

    try {
      let pdfBase64 = null;
      try {
        pdfBase64 = getInvoicePDFBase64(
          invoice,
          userProfile,
          clientObj,
          invoice.language,
          invoice.currency,
          invoice.template
        );
      } catch (pdfErr) {
        console.warn('PDF generation notice:', pdfErr);
      }

      if (type === 'reminder') {
        await api.sendPaymentReminder(invoice.id, reminderType);
      } else {
        await api.sendInvoiceEmail(invoice.id, {
          recipientEmail: recipient.trim(),
          pdfBase64,
          subject: subject.trim(),
          message: message.trim()
        });
      }

      showToast(`Invoice ${invoice.id} was sent to ${recipient.trim()}`, 'success');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Send invoice email error:', err);
      showToast('Unable to send the invoice. Please check the email address or try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  const getModalTitle = () => {
    if (type === 'receipt') return 'Send Payment Receipt';
    if (type === 'reminder') return 'Send Payment Reminder';
    return 'Send Invoice to Client';
  };

  return (
    <div className="custom-modal-backdrop" onClick={!sending ? onClose : undefined}>
      <div
        className="custom-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', width: '100%' }}
      >
        {/* Header */}
        <div className="custom-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'var(--accent-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Mail size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {getModalTitle()}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Invoice <strong style={{ color: 'var(--text-primary)' }}>{invoice.id}</strong> • Total: <strong style={{ color: 'var(--accent-primary)' }}>{initialData.formattedAmount}</strong>
              </p>
            </div>
          </div>
          <button
            className="icon-action-btn"
            onClick={onClose}
            disabled={sending}
            style={{ padding: '6px' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="custom-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Recipient Input */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px', display: 'block' }}>
              Client Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="form-input"
                style={{ paddingLeft: '34px', fontSize: '13.5px' }}
                placeholder="client@company.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={sending}
                autoFocus
              />
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
              The client will receive this invoice directly in their inbox with no activation or account required.
            </p>
          </div>

          {/* Subject Line */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px', display: 'block' }}>
              Email Subject
            </label>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '13px' }}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          {/* Attached PDF Preview Card */}
          <div style={{
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileText size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {invoice.id}.pdf
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Auto-generated official PDF attachment ({invoice.template || 'Modern'} template)
                </div>
              </div>
            </div>
            <span style={{
              background: '#dcfce7',
              color: '#15803d',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '12px'
            }}>
              ✓ ATTACHED
            </span>
          </div>

          {/* Invoice Summary Card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12.5px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '8px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Client:</span>
                <strong>{invoice.client || 'Client'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Amount Due:</span>
                <strong style={{ color: 'var(--accent-primary)' }}>{initialData.formattedAmount}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Due Date:</span>
                <strong>{invoice.due || 'Upon Receipt'}</strong>
              </div>
            </div>
            <div style={{
              borderTop: '1px dashed var(--border-color)',
              paddingTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11.5px',
              color: 'var(--text-muted)'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Link2 size={13} color="var(--accent-primary)" />
                Includes direct payment button:
              </span>
              <a
                href={paymentUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                View & Pay Link &rarr;
              </a>
            </div>
          </div>

          {/* Toggleable Message Text */}
          <div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showPreview ? 'Hide message body' : 'View / edit email message text'}
            </button>
            {showPreview && (
              <textarea
                className="form-textarea"
                rows={5}
                style={{ fontSize: '12px', marginTop: '6px', fontFamily: 'monospace' }}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="custom-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <ShieldCheck size={15} color="#16a34a" />
            <span>Delivered directly to client inbox</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={sending}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleDirectSend}
              disabled={sending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                fontSize: '13px'
              }}
            >
              {sending ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  Sending to Client...
                </>
              ) : (
                <>
                  <Send size={15} />
                  Send Invoice
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
