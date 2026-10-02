import React from 'react';
import {
  FileText,
  Mail,
  Eye,
  CreditCard,
  ShieldCheck,
  BellRing,
  Receipt,
  Edit3,
  Trash2,
  Plus,
  Clock
} from 'lucide-react';

const EVENT_CONFIG = {
  created: {
    icon: Plus,
    label: 'Invoice Created',
    color: '#2563eb',
    bg: '#eff6ff'
  },
  email_sent: {
    icon: Mail,
    label: 'Email Sent',
    color: '#8b5cf6',
    bg: '#f5f3ff'
  },
  client_viewed: {
    icon: Eye,
    label: 'Viewed by Client',
    color: '#0891b2',
    bg: '#ecfeff'
  },
  payment_submitted: {
    icon: CreditCard,
    label: 'Payment Submitted',
    color: '#d97706',
    bg: '#fef3c7'
  },
  payment_recorded: {
    icon: CreditCard,
    label: 'Payment Recorded',
    color: '#16a34a',
    bg: '#dcfce7'
  },
  payment_verified: {
    icon: ShieldCheck,
    label: 'Payment Verified',
    color: '#16a34a',
    bg: '#dcfce7'
  },
  reminder_sent: {
    icon: BellRing,
    label: 'Reminder Sent',
    color: '#ea580c',
    bg: '#fff7ed'
  },
  receipt_sent: {
    icon: Receipt,
    label: 'Receipt Sent',
    color: '#16a34a',
    bg: '#dcfce7'
  },
  status_changed: {
    icon: Edit3,
    label: 'Status Changed',
    color: '#64748b',
    bg: '#f1f5f9'
  },
  deleted: {
    icon: Trash2,
    label: 'Invoice Deleted',
    color: '#dc2626',
    bg: '#fee2e2'
  }
};

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDetailText(event, details) {
  if (!details) return null;
  
  switch (event) {
    case 'email_sent':
      return details.to ? `To: ${details.to}` : null;
    case 'reminder_sent':
      return details.to ? `To: ${details.to} (${details.type || 'reminder'})` : null;
    case 'receipt_sent':
      return details.to ? `To: ${details.to}` : null;
    case 'payment_submitted':
    case 'payment_recorded':
      return details.transactionId 
        ? `Txn: ${details.transactionId}${details.method ? ` • ${details.method.toUpperCase()}` : ''}`
        : null;
    case 'payment_verified':
      return details.verifiedBy ? `Verified by: ${details.verifiedBy}` : null;
    case 'status_changed':
      return details.from && details.to ? `${details.from} → ${details.to}` : null;
    case 'created':
      return details.status ? `Status: ${details.status}` : null;
    default:
      return null;
  }
}

export default function ActivityTimeline({ activity = [] }) {
  if (!activity || activity.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
        <Clock size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
        <div style={{ fontSize: '13px' }}>No activity recorded yet</div>
      </div>
    );
  }

  // Sort newest first
  const sorted = [...activity].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div style={{ position: 'relative' }}>
      {sorted.map((entry, idx) => {
        const config = EVENT_CONFIG[entry.event] || {
          icon: FileText,
          label: entry.event?.replace(/_/g, ' ') || 'Event',
          color: '#64748b',
          bg: '#f1f5f9'
        };
        const IconComp = config.icon;
        const detailText = getDetailText(entry.event, entry.details);
        const isLast = idx === sorted.length - 1;

        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: '12px',
              paddingBottom: isLast ? '0' : '16px',
              position: 'relative'
            }}
          >
            {/* Vertical line */}
            {!isLast && (
              <div style={{
                position: 'absolute',
                left: '15px',
                top: '32px',
                bottom: '0',
                width: '2px',
                background: 'var(--border-color)',
                zIndex: 0
              }} />
            )}

            {/* Icon circle */}
            <div style={{
              width: '32px',
              height: '32px',
              minWidth: '32px',
              borderRadius: '50%',
              background: config.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
              border: `2px solid ${config.color}20`
            }}>
              <IconComp size={14} color={config.color} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {config.label}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
              {detailText && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                  {detailText}
                </div>
              )}
              {entry.actor && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'capitalize' }}>
                  By: {entry.actor}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
