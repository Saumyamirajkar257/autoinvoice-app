import React from 'react';
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
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';

export default function Dashboard({ stats, userProfile }) {
  const navigate = useNavigate();
  const formatMoney = (val) => formatCurrency(val, userProfile?.currency);
  const currencySymbol = getCurrencySymbol(userProfile?.currency);

  const userName = userProfile?.fullName || 'User';

  return (
    <div className="content-page">
      {/* Top Heading */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {userName}! Here is your business & tax overview.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate('/invoices/create')}
        >
          <Plus size={16} />
          Create Invoice
        </button>
      </div>

      {/* 4 Primary Metric Cards */}
      <div className="metrics-grid">
        {/* Card 1: Total Invoices */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-icon-box blue">
              <FileText size={18} />
            </div>
            <span className="metric-label">Total Invoices</span>
          </div>
          <div className="metric-value">{stats?.totalInvoices ?? 0}</div>
          <div className="metric-sub">
            <span className="metric-trend up">Live</span> {stats?.paidCount ?? 0} Paid • {stats?.draftCount ?? 0} Drafts
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-icon-box green">
              <DollarSign size={18} />
            </div>
            <span className="metric-label">Total Revenue ({currencySymbol})</span>
          </div>
          <div className="metric-value">{formatMoney(stats?.totalRevenue)}</div>
          <div className="metric-sub">
            <span className="metric-trend up">Collected</span> From {stats?.paidCount ?? 0} settled invoices
          </div>
        </div>

        {/* Card 3: Pending Amount */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-icon-box amber">
              <Clock size={18} />
            </div>
            <span className="metric-label">Pending / Unpaid ({currencySymbol})</span>
          </div>
          <div className="metric-value">{formatMoney(stats?.pendingAmount)}</div>
          <div className="metric-sub">
            {stats?.overdueCount > 0 ? (
              <span style={{ color: '#ef4444', fontWeight: 600 }}>{stats.overdueCount} Overdue</span>
            ) : (
              <span>Pending settlement</span>
            )}
          </div>
        </div>

        {/* Card 4: Total Clients */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-icon-box blue">
              <Users size={18} />
            </div>
            <span className="metric-label">Total Clients</span>
          </div>
          <div className="metric-value">{stats?.totalClients ?? 0}</div>
          <div className="metric-sub">Avg: {formatMoney(stats?.avgClientRevenue)} / client</div>
        </div>
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
            {(!stats?.recentInvoices || stats.recentInvoices.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>
                <ReceiptText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p style={{ fontSize: '13px' }}>No invoices created yet.</p>
              </div>
            ) : (
              stats.recentInvoices.map((inv) => (
                <div key={inv.id} className="recent-item">
                  <div className="recent-item-left">
                    <div className="recent-icon">
                      {inv.status === 'paid' ? (
                        <ArrowUpRight size={16} color="#16a34a" />
                      ) : (
                        <Clock size={16} color="#2563eb" />
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
                    <div className="recent-amount">{formatMoney(inv.amount)}</div>
                    <span className={`status-badge ${inv.status || 'sent'}`}>
                      {inv.status || 'sent'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Box: Quick Actions */}
        <div className="dash-box">
          <div className="dash-box-header">
            <h3>Quick Actions</h3>
          </div>

          <div className="quick-actions-btns">
            <button
              className="quick-action-btn primary"
              onClick={() => navigate('/invoices/create')}
            >
              <Plus size={16} />
              Create Invoice
            </button>
            <button
              className="quick-action-btn outline"
              onClick={() => navigate('/clients')}
            >
              <Users2 size={16} />
              Manage Clients
            </button>
            <button
              className="quick-action-btn outline"
              onClick={() => navigate('/profile')}
            >
              <UserCircle size={16} />
              Business Profile
            </button>
          </div>

          <div className="quick-stats-footer">
            <div>
              <div className="quick-stat-num">{stats?.paidCount ?? 0}</div>
              <div className="quick-stat-label">Paid</div>
            </div>
            <div>
              <div className="quick-stat-num">{stats?.draftCount ?? 0}</div>
              <div className="quick-stat-label">Drafts</div>
            </div>
            <div>
              <div className="quick-stat-num">{stats?.overdueCount ?? 0}</div>
              <div className="quick-stat-label">Overdue</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
