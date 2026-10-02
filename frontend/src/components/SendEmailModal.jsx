import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  ExternalLink,
  Send,
  Copy,
  Check,
  Eye,
  Edit3,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Smartphone,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  buildInvoiceEmailData,
  buildReminderEmailData,
  buildReceiptEmailData,
  openGmailCompose,
  openMailtoCompose,
  sendEmailJS,
  copyEmailContent,
  getEmailSettings,
  saveEmailSettings,
  getInvoicePaymentDetails
} from '../utils/emailService';
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
  const [copied, setCopied] = useState(false);
  const [sendingCloud, setSendingCloud] = useState(false);
  const [activeTab, setActiveTab] = useState('compose'); // 'compose' | 'preview'
  const [showCloudConfig, setShowCloudConfig] = useState(false);

  const [emailSettings, setEmailSettings] = useState(getEmailSettings());
  const [cloudServiceId, setCloudServiceId] = useState(emailSettings.emailjs?.serviceId || '');
  const [cloudTemplateId, setCloudTemplateId] = useState(emailSettings.emailjs?.templateId || '');
  const [cloudPublicKey, setCloudPublicKey] = useState(emailSettings.emailjs?.publicKey || '');

  const hasCloudConfig = Boolean(
    emailSettings.emailjs?.serviceId &&
    emailSettings.emailjs?.templateId &&
    emailSettings.emailjs?.publicKey
  );

  const { paymentUrl, upiId } = getInvoicePaymentDetails(invoice, userProfile);

  // Validate email
  const isValidEmail = (email) => {
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Record dispatch activity and update invoice if draft
  const recordDispatch = async (channel) => {
    try {
      const updates = {};
      if (invoice.status === 'draft') {
        updates.status = 'sent';
      }
      if (recipient && recipient !== invoice.clientEmail) {
        updates.clientEmail = recipient.trim();
      }

      const activityItem = {
        event: 'email_dispatched',
        timestamp: new Date().toISOString(),
        actor: 'owner',
        details: {
          type,
          channel,
          recipient: recipient.trim(),
          subject: subject.trim()
        }
      };

      const existingActivity = Array.isArray(invoice.activity) ? invoice.activity : [];
      updates.activity = [activityItem, ...existingActivity];

      await api.updateInvoice(invoice.id, updates);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.warn('Failed to record email activity:', err);
    }
  };

  // 1. Send with Gmail Web
  const handleSendGmail = async () => {
    if (!recipient.trim()) {
      showToast('Please enter a recipient email address', 'error');
      return;
    }
    if (!isValidEmail(recipient)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    try {
      openGmailCompose({
        to: recipient.trim(),
        subject: subject.trim(),
        body: message.trim()
      });

      await recordDispatch('Gmail Web');
      showToast(`Draft opened in Gmail for ${recipient}! Click Send in Gmail to complete.`, 'success');
      onClose();
    } catch (err) {
      showToast('Error launching Gmail composer', 'error');
    }
  };

  // 2. Send with Default Mail Client (mailto:)
  const handleSendMailto = async () => {
    if (!recipient.trim()) {
      showToast('Please enter a recipient email address', 'error');
      return;
    }
    if (!isValidEmail(recipient)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    try {
      openMailtoCompose({
        to: recipient.trim(),
        subject: subject.trim(),
        body: message.trim()
      });

      await recordDispatch('Default Mail App');
      showToast(`Opened in your default email client for ${recipient}!`, 'success');
      onClose();
    } catch (err) {
      showToast('Error launching mail app', 'error');
    }
  };

  // 3. Send via Automated Cloud (EmailJS)
  const handleSendCloud = async () => {
    if (!recipient.trim()) {
      showToast('Please enter a recipient email address', 'error');
      return;
    }
    if (!isValidEmail(recipient)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    if (!hasCloudConfig && (!cloudServiceId || !cloudTemplateId || !cloudPublicKey)) {
      setShowCloudConfig(true);
      showToast('Please configure your EmailJS credentials below', 'info');
      return;
    }

    setSendingCloud(true);
    try {
      // Save credentials if just provided
      if (cloudServiceId && cloudTemplateId && cloudPublicKey) {
        saveEmailSettings({
          ...emailSettings,
          emailjs: {
            serviceId: cloudServiceId.trim(),
            templateId: cloudTemplateId.trim(),
            publicKey: cloudPublicKey.trim()
          }
        });
        setEmailSettings(getEmailSettings());
      }

      await sendEmailJS({
        to: recipient.trim(),
        subject: subject.trim(),
        message: message.trim(),
        invoiceData: { ...invoice, paymentUrl },
        config: {
          serviceId: cloudServiceId.trim() || emailSettings.emailjs?.serviceId,
          templateId: cloudTemplateId.trim() || emailSettings.emailjs?.templateId,
          publicKey: cloudPublicKey.trim() || emailSettings.emailjs?.publicKey
        }
      });

      await recordDispatch('EmailJS Cloud');
      showToast(`Email delivered successfully to ${recipient}!`, 'success');
      onClose();
    } catch (err) {
      showToast(err.message || 'Cloud delivery failed. Try Gmail Web instead.', 'error');
    } finally {
      setSendingCloud(false);
    }
  };

  // 4. Copy Message & Payment Link
  const handleCopy = async () => {
    try {
      await copyEmailContent(message.trim());
      setCopied(true);
      showToast('Invoice message copied to clipboard! Ready to paste.', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const getModalTitle = () => {
    if (type === 'receipt') return 'Send Payment Receipt';
    if (type === 'reminder') return 'Send Payment Reminder';
    return 'Send Invoice to Client';
  };

  return (
    <div className="custom-modal-backdrop" onClick={onClose}>
      <div
        className="custom-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '100%' }}
      >
        {/* Header */}
        <div className="custom-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--accent-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Mail size={18} />
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
            style={{ padding: '6px' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 24px', background: 'var(--bg-card-subtle)' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'compose' ? 'active' : ''}`}
            style={{ padding: '10px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setActiveTab('compose')}
          >
            <Edit3 size={14} /> Compose & Send
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            style={{ padding: '10px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setActiveTab('preview')}
          >
            <Eye size={14} /> Message Preview
          </button>
        </div>

        {/* Body */}
        <div className="custom-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 24px' }}>
          
          {activeTab === 'compose' ? (
            <>
              {/* Recipient Input */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Client Email Address <span style={{ color: '#dc2626' }}>*</span></span>
                  {!isValidEmail(recipient) && recipient.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#dc2626' }}>Invalid email format</span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. client@company.com"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    style={{
                      borderColor: !recipient ? '#f59e0b' : !isValidEmail(recipient) ? '#dc2626' : undefined
                    }}
                  />
                </div>
                {!recipient && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} /> Please enter the client's email to deliver this invoice.
                  </p>
                )}
              </div>

              {/* Subject Input */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Subject</label>
                <input
                  type="text"
                  className="form-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Quick Info Banner */}
              <div style={{
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smartphone size={14} color="#16a34a" />
                  <span>Includes <strong>Online Payment Portal</strong> + <strong>UPI Scan-to-Pay</strong></span>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                  onClick={() => setActiveTab('preview')}
                >
                  View message text &rarr;
                </button>
              </div>

              {/* Primary Sending Options Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  Select Sending Method
                </div>

                {/* Method 1: Gmail Web Compose (Recommended) */}
                <div
                  style={{
                    border: '1.5px solid #2563eb',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Mail size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                          Send with Gmail Web
                        </span>
                        <span style={{
                          background: '#dbeafe',
                          color: '#1e40af',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '12px'
                        }}>
                          RECOMMENDED • 100% INBOX DELIVERY
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Opens a pre-filled draft in Gmail. Dispatched directly from your authentic Gmail account — never lands in spam.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSendGmail}
                    style={{ flexShrink: 0, padding: '9px 16px', fontSize: '13px' }}
                  >
                    Open in Gmail
                  </button>
                </div>

                {/* Method 2: Default Mail Client (Outlook / Apple Mail) */}
                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'var(--bg-card-subtle)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <ExternalLink size={17} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                        Open in Default Email App
                      </div>
                      <p style={{ margin: '1px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Pre-fills in your desktop/mobile mail app (Outlook, Apple Mail, Thunderbird).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleSendMailto}
                    style={{ flexShrink: 0, padding: '7px 14px', fontSize: '12.5px' }}
                  >
                    Open Mail App
                  </button>
                </div>

                {/* Method 3: Automated Cloud Delivery (EmailJS) */}
                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: '#f0fdf4',
                        color: '#16a34a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Send size={16} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                            Automated Cloud Sending (EmailJS)
                          </span>
                          {hasCloudConfig && (
                            <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px' }}>
                              CONFIGURED
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '1px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                          Sends invisibly in background without opening any external mail apps.
                        </p>
                      </div>
                    </div>
                    {hasCloudConfig ? (
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ background: '#16a34a', borderColor: '#16a34a', flexShrink: 0, padding: '7px 14px', fontSize: '12.5px' }}
                        onClick={handleSendCloud}
                        disabled={sendingCloud}
                      >
                        {sendingCloud ? 'Sending...' : 'Send via Cloud'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ flexShrink: 0, padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => setShowCloudConfig(!showCloudConfig)}
                      >
                        {showCloudConfig ? 'Hide Config' : 'Configure (1 min)'}
                      </button>
                    )}
                  </div>

                  {/* Inline Cloud Config Drawer */}
                  {showCloudConfig && (
                    <div style={{
                      marginTop: '6px',
                      padding: '14px',
                      background: 'var(--bg-card-subtle)',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={14} color="#16a34a" />
                        Enter your EmailJS credentials (Free 200 emails/month):
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Service ID</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                            placeholder="service_xxx"
                            value={cloudServiceId}
                            onChange={(e) => setCloudServiceId(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Template ID</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                            placeholder="template_xxx"
                            value={cloudTemplateId}
                            onChange={(e) => setCloudTemplateId(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Public Key</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                            placeholder="user_xxx"
                            value={cloudPublicKey}
                            onChange={(e) => setCloudPublicKey(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ alignSelf: 'flex-start', background: '#16a34a', borderColor: '#16a34a', padding: '6px 14px', fontSize: '12px' }}
                        onClick={handleSendCloud}
                        disabled={sendingCloud}
                      >
                        {sendingCloud ? 'Sending...' : 'Save & Send Now'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Preview & Raw Message Editor Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Message Content (Editable text sent to client):
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={handleCopy}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy Text'}
                </button>
              </div>
              <textarea
                className="form-input"
                rows={12}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  resize: 'vertical'
                }}
              />
              <div style={{
                background: 'var(--bg-card-subtle)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}>
                Direct Payment Link: <code style={{ color: 'var(--accent-primary)', wordBreak: 'break-all' }}>{paymentUrl}</code>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="custom-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {copied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
            {copied ? 'Copied Message & Link' : 'Copy Message for WhatsApp / Chat'}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSendGmail}
            >
              <Mail size={15} /> Send via Gmail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
