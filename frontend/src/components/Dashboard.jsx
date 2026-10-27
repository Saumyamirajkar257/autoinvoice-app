import React, { useMemo } from 'react';
import {
  FileText,
  DollarSign,
  Clock,
  Users,
  Plus,
  ArrowUpRight,
  Users2,
  UserCircle,
  ReceiptText,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Wallet,
  Receipt,
  CheckCircle2,
  ShieldCheck,
  Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { useCountUp } from '../utils/useCountUp';
import RevenueChart from './RevenueChart';

function AnimatedNumber({ value, isCurrency = false, currencySetting = 'INR - Indian Rupee' }) {
  const animated = useCountUp(value, 1000);
  if (isCurrency) {
    return <>{formatCurrency(animated, currencySetting)}</>;
  }
  return <>{Math.round(animated)}</>;
}

export default function Dashboard({ stats, userProfile, invoices = [], expenses = [] }) {
  const navigate = useNavigate();
  const formatMoney = (val) => formatCurrency(val, userProfile?.currency || 'INR - Indian Rupee');
  const currencySymbol = getCurrencySymbol(userProfile?.currency);
  const currencySetting = userProfile?.currency || 'INR - Indian Rupee';

  const userName = userProfile?.fullName || 'Business Owner';

  // Compute live aggregates directly from invoices for 100% precision
  const metrics = useMemo(() => {
    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const partialInvoices = invoices.filter(i => i.status === 'partially_paid');
    const sentInvoices = invoices.filter(i => i.status === 'sent');
    const overdueInvoices = invoices.filter(i => i.status === 'overdue');
    const draftInvoices = invoices.filter(i => i.status === 'draft');

    const totalRevenue = invoices.reduce((sum, i) => {
      if (i.status === 'paid') return sum + Number(i.amount || 0);
      if (i.amountPaid) return sum + Number(i.amountPaid || 0);
      return sum;
    }, 0);

    const pendingAmount = invoices.reduce((sum, i) => {
      if (i.status === 'sent' || i.status === 'pending_verification') {
        const bal = i.balanceDue !== undefined ? Number(i.balanceDue) : Number(i.amount || 0);
        return sum + bal;
      }
      if (i.status === 'partially_paid') {
        return sum + Number(i.balanceDue || 0);
      }
      if (i.status === 'overdue') {
        const bal = i.balanceDue !== undefined ? Number(i.balanceDue) : Number(i.amount || 0);
        return sum + bal;
      }
      return sum;
    }, 0);

    const totalExpenseAmt = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = totalRevenue - totalExpenseAmt;

    const totalBilled = totalRevenue + pendingAmount;
    const collectionEfficiency = totalBilled > 0 ? Math.round((totalRevenue / totalBilled) * 100) : 100;

    return {
      totalInvoices,
      totalRevenue,
      pendingAmount,
      totalExpenseAmt,
      netProfit,
      collectionEfficiency,
      paidCount: paidInvoices.length,
      partialCount: partialInvoices.length,
      sentCount: sentInvoices.length,
      overdueCount: overdueInvoices.length,
      draftCount: draftInvoices.length
    };
  }, [invoices, expenses]);

  return (
    <div className="content-page">
      {/* Top Heading */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title">Executive Command Center</h1>
            <span style={{
              background: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--accent-primary)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '0.4px'
            }}>
              Live SaaS Audit
            </span>
          </div>
          <p className="page-subtitle">Welcome back, {userName}! Real-time billing performance, collections, and statutory ledger.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            onClick={() => navigate('/invoices')}
            title="Browse all registered invoices"
          >
            <ReceiptText size={16} /> All Invoices
          </button>
          <button
            className="btn-primary"
            onClick={() => navigate('/invoices/create')}
          >
            <Plus size={16} /> Create Invoice
          </button>
        </div>
      </div>

      {/* Overdue Action Banner if overdue invoices exist */}
      {metrics.overdueCount > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="#dc2626" />
            <div>
              <strong style={{ color: '#dc2626', fontSize: '14px' }}>
                {metrics.overdueCount} Invoice{metrics.overdueCount > 1 ? 's' : ''} Overdue for Collection
              </strong>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                You have outstanding receivables past their due date requiring payment reminders.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-danger btn-sm"
            onClick={() => navigate('/invoices')}
          >
            Review & Send Reminders
          </button>
        </div>
      )}

      {/* 4 Primary Metric Cards with Smooth Staggered Animation & Count-Ups */}
      <div className="metrics-grid">
        {/* Card 1: Total Revenue Collected */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-icon-box green">
              <DollarSign size={18} />
            </div>
            <span className="metric-label">Total Revenue ({currencySymbol})</span>
          </div>
          <div className="metric-value">
            <AnimatedNumber value={metrics.totalRevenue} isCurrency currencySetting={currencySetting} />
          </div>
          <div className="metric-sub">
            <span className="metric-trend up">Collected</span> {metrics.paidCount} paid • {metrics.partialCount} partial
          </div>
        </div>

        {/* Card 2: Receivables / Outstanding Balance */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-icon-box amber">
              <Clock size={18} />
            </div>
            <span className="metric-label">Outstanding Receivables</span>
          </div>
          <div className="metric-value" style={{ color: metrics.pendingAmount > 0 ? '#d97706' : 'var(--text-primary)' }}>
            <AnimatedNumber value={metrics.pendingAmount} isCurrency currencySetting={currencySetting} />
          </div>
          <div className="metric-sub">
            {metrics.overdueCount > 0 ? (
              <span style={{ color: '#ef4444', fontWeight: 700 }}>{metrics.overdueCount} Past Due</span>
            ) : (
              <span>Pending customer settlement</span>
            )}
          </div>
        </div>

        {/* Card 3: Invoiced Volume */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-icon-box blue">
              <FileText size={18} />
            </div>
            <span className="metric-label">Total Invoices</span>
          </div>
          <div className="metric-value">
            <AnimatedNumber value={metrics.totalInvoices} />
          </div>
          <div className="metric-sub">
            Efficiency: <strong style={{ color: 'var(--accent-primary)', marginLeft: '3px' }}>{metrics.collectionEfficiency}%</strong>
          </div>
        </div>

        {/* Card 4: Operating Expenses & Net Margin */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-icon-box blue">
              <Wallet size={18} />
            </div>
            <span className="metric-label">Operating Expenses</span>
          </div>
          <div className="metric-value" style={{ color: '#ef4444' }}>
            <AnimatedNumber value={metrics.totalExpenseAmt} isCurrency currencySetting={currencySetting} />
          </div>
          <div className="metric-sub">
            Net: <strong style={{ color: metrics.netProfit >= 0 ? '#16a34a' : '#ef4444', marginLeft: '3px' }}>{formatMoney(metrics.netProfit)}</strong>
          </div>
        </div>
      </div>

      {/* Visual Invoice Status Distribution Strip */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
        boxShadow: 'var(--card-shadow)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Receivables Pipeline & Settlement Ratio ({metrics.collectionEfficiency}% Collected)
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {metrics.paidCount} Paid • {metrics.partialCount} Partial • {metrics.sentCount} Sent • {metrics.overdueCount} Overdue
          </span>
        </div>

        {/* Multi-segment progress bar */}
        <div style={{
          width: '100%',
          height: '8px',
          background: 'var(--bg-card-subtle)',
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex'
        }}>
          {metrics.totalInvoices > 0 ? (
            <>
              <div style={{ width: `${(metrics.paidCount / metrics.totalInvoices) * 100}%`, background: '#16a34a' }} title="Paid" />
              <div style={{ width: `${(metrics.partialCount / metrics.totalInvoices) * 100}%`, background: '#3b82f6' }} title="Partially Paid" />
              <div style={{ width: `${(metrics.sentCount / metrics.totalInvoices) * 100}%`, background: '#f59e0b' }} title="Sent" />
              <div style={{ width: `${(metrics.overdueCount / metrics.totalInvoices) * 100}%`, background: '#ef4444' }} title="Overdue" />
              <div style={{ width: `${(metrics.draftCount / metrics.totalInvoices) * 100}%`, background: 'var(--text-muted)' }} title="Drafts" />
            </>
          ) : (
            <div style={{ width: '100%', background: 'var(--border-subtle)' }} />
          )}
        </div>
      </div>

      {/* 6-Month Visual Financial Analytics Chart */}
      <div style={{ marginBottom: '24px' }}>
        <RevenueChart invoices={invoices} expenses={expenses} userProfile={userProfile} />
      </div>

      {/* Two Column Grid: Recent Invoices & Quick Actions */}
      <div className="dash-grid">
        {/* Left Box: Recent Invoices */}
        <div className="dash-box">
          <div className="dash-box-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ReceiptText size={18} color="var(--accent-primary)" />
              <h3>Recent Invoices</h3>
            </div>
            <span
              className="view-all-link"
              onClick={() => navigate('/invoices')}
            >
              View All &rarr;
            </span>
          </div>

          <div className="recent-list">
            {(!invoices || invoices.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px 0' }}>
                <ReceiptText size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <p style={{ fontSize: '13.5px', fontWeight: 600 }}>No invoices created yet.</p>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => navigate('/invoices/create')}
                  style={{ marginTop: '10px' }}
                >
                  <Plus size={14} /> Create Your First Invoice
                </button>
              </div>
            ) : (
              invoices.slice(0, 5).map((inv) => (
                <div key={inv.id} className="recent-item">
                  <div className="recent-item-left">
                    <div className="recent-icon">
                      {inv.status === 'paid' ? (
                        <CheckCircle2 size={16} color="#16a34a" />
                      ) : inv.status === 'partially_paid' ? (
                        <Clock size={16} color="#f59e0b" />
                      ) : (
                        <FileText size={16} color="var(--accent-primary)" />
                      )}
                    </div>
                    <div>
                      <div className="recent-id">{inv.id}</div>
                      <div className="recent-client">{inv.client}</div>
                      <div className="recent-date">
                        Created {inv.created} • Due {inv.due}
                      </div>
                    </div>
                  </div>

                  <div className="recent-item-right">
                    <div className="recent-amount">{formatMoney(inv.amount, inv.currency)}</div>
                    <span className={`status-badge ${inv.status || 'sent'}`}>
                      {inv.status === 'partially_paid' ? 'Partial' : (inv.status || 'sent')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Box: Quick Actions & Operations */}
        <div className="dash-box">
          <div className="dash-box-header">
            <h3>Quick Business Actions</h3>
          </div>

          <div className="quick-actions-btns">
            <button
              className="quick-action-btn primary"
              onClick={() => navigate('/invoices/create')}
            >
              <Plus size={16} />
              Create Tax Invoice
            </button>
            <button
              className="quick-action-btn outline"
              onClick={() => navigate('/payments')}
            >
              <Receipt size={16} color="#16a34a" />
              Payments & Receipts Ledger
            </button>
            <button
              className="quick-action-btn outline"
              onClick={() => navigate('/expenses')}
            >
              <Wallet size={16} color="#dc2626" />
              Record Business Expense
            </button>
            <button
              className="quick-action-btn outline"
              onClick={() => navigate('/clients')}
            >
              <Users2 size={16} />
              Manage Client Directory
            </button>
          </div>

          <div className="quick-stats-footer">
            <div>
              <div className="quick-stat-num" style={{ color: '#16a34a' }}>{metrics.paidCount}</div>
              <div className="quick-stat-label">Paid</div>
            </div>
            <div>
              <div className="quick-stat-num" style={{ color: '#3b82f6' }}>{metrics.partialCount}</div>
              <div className="quick-stat-label">Partial</div>
            </div>
            <div>
              <div className="quick-stat-num">{metrics.draftCount}</div>
              <div className="quick-stat-label">Drafts</div>
            </div>
            <div>
              <div className="quick-stat-num" style={{ color: metrics.overdueCount > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                {metrics.overdueCount}
              </div>
              <div className="quick-stat-label">Overdue</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
