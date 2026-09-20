import React from 'react';
import {
  FileText,
  DollarSign,
  Clock,
  Users,
  Plus,
  ArrowUpRight,
  Users2,
  UserCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';

export default function Dashboard({ stats, userProfile }) {
  const navigate = useNavigate();
  const formatMoney = (val) => formatCurrency(val, userProfile?.currency);
  const currencySymbol = getCurrencySymbol(userProfile?.currency);

  const userName = userProfile?.fullName || 'Zaid Shaikh';

  return (
    <div className="content-page">
      {/* Top Heading */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {userName}! Here's your invoicing overview.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate('/invoices/create')}
        >
          <Plus size={16} />
          Create Invoice
        </button>
      </div>

      {/* 4 Metric Cards */}
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
          <div className="metric-sub">+{stats?.totalInvoices ?? 0} this month</div>
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
          <div className="metric-sub">+{formatMoney(stats?.totalRevenue)} this month</div>
        </div>

        {/* Card 3: Pending Amount */}
        <div className="metric-card">
          <div className="metric-header">
            <div className="metric-icon-box amber">
              <Clock size={18} />
            </div>
            <span className="metric-label">Pending Amount ({currencySymbol})</span>
          </div>
          <div className="metric-value">{formatMoney(stats?.pendingAmount)}</div>
          <div className="metric-sub">
            {stats?.recentInvoices?.filter(i => i.status === 'sent').length || 0} invoices sent
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
          <div className="metric-sub">Avg: {formatMoney(stats?.avgClientRevenue)}</div>
        </div>
      </div>

      {/* Two Column Grid: Recent Invoices & Quick Actions */}
      <div className="dash-grid">
        {/* Left Box: Recent Invoices */}
        <div className="dash-box">
          <div className="dash-box-header">
            <h3>Recent Invoices</h3>
            <span
              className="view-all-link"
              onClick={() => navigate('/invoices')}
            >
              View All
            </span>
          </div>

          <div className="recent-list">
            {(!stats?.recentInvoices || stats.recentInvoices.length === 0) ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', padding: '16px 0' }}>
                No invoices created yet.
              </p>
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
              Create New Invoice
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
              Update Profile
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
          </div>
        </div>
      </div>
    </div>
  );
}
