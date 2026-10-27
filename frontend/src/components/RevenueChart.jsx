import React, { useState, useMemo } from 'react';
import { formatCurrency } from '../utils/currency';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, BarChart3, Calendar } from 'lucide-react';

export default function RevenueChart({ invoices = [], expenses = [], userProfile }) {
  const [timeRange, setTimeRange] = useState('6m'); // '3m' | '6m' | '12m' | 'all'
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const formatMoney = (val) => formatCurrency(val, userProfile?.currency || 'INR - Indian Rupee');

  // Compute months data based on timeRange
  const monthsData = useMemo(() => {
    const numMonths = timeRange === '3m' ? 3 : (timeRange === '12m' ? 12 : 6);
    const months = [];
    const today = new Date();

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
      const yearShort = d.getFullYear().toString().slice(-2);
      const m = d.getMonth();
      const y = d.getFullYear();

      // Paid / Partially Paid revenue
      const rev = invoices.reduce((sum, inv) => {
        const invDate = new Date(inv.paidAt || inv.due || inv.created);
        if (isNaN(invDate.getTime())) return sum;
        if (invDate.getMonth() === m && invDate.getFullYear() === y) {
          if (inv.status === 'paid' || inv.status === 'verified') {
            return sum + (Number(inv.amount) || 0);
          }
          if (inv.amountPaid) {
            return sum + Number(inv.amountPaid);
          }
        }
        return sum;
      }, 0);

      // Expenses
      const exp = expenses.reduce((sum, e) => {
        if (!e.date) return sum;
        const expDate = new Date(e.date);
        if (!isNaN(expDate.getTime()) && expDate.getMonth() === m && expDate.getFullYear() === y) {
          return sum + (Number(e.amount) || 0);
        }
        return sum;
      }, 0);

      const profit = rev - exp;
      const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;

      months.push({
        label: numMonths > 6 ? `${monthLabel} '${yearShort}` : monthLabel,
        fullDate: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        revenue: rev,
        expense: exp,
        profit,
        margin
      });
    }

    return months;
  }, [invoices, expenses, timeRange]);

  // Aggregate stats across period
  const totalPeriodRevenue = monthsData.reduce((sum, d) => sum + d.revenue, 0);
  const totalPeriodExpenses = monthsData.reduce((sum, d) => sum + d.expense, 0);
  const totalPeriodProfit = totalPeriodRevenue - totalPeriodExpenses;
  const overallMargin = totalPeriodRevenue > 0 ? Math.round((totalPeriodProfit / totalPeriodRevenue) * 100) : 0;

  // Max value for SVG scale
  const maxVal = Math.max(...monthsData.map(d => Math.max(d.revenue, d.expense)), 2000);

  // SVG dimensions
  const svgWidth = 660;
  const svgHeight = 220;
  const paddingX = 45;
  const paddingY = 28;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingY * 2;
  const colWidth = plotWidth / monthsData.length;
  const barWidth = Math.max(8, Math.min(20, (colWidth / 2) - 4));

  return (
    <div className="chart-card">
      {/* Top Header & Range Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="var(--accent-primary)" />
            <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Cash Flow & Profit Analytics
            </h3>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Real-time comparison of collected revenue versus operating expenses
          </p>
        </div>

        {/* Time Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card-subtle)', padding: '3px', borderRadius: '8px' }}>
          {[
            { id: '3m', label: '3M' },
            { id: '6m', label: '6M' },
            { id: '12m', label: '1 Year' }
          ].map(btn => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setTimeRange(btn.id)}
              style={{
                border: 'none',
                background: timeRange === btn.id ? 'var(--bg-card)' : 'transparent',
                color: timeRange === btn.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontWeight: timeRange === btn.id ? 700 : 500,
                fontSize: '11.5px',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: timeRange === btn.id ? 'var(--card-shadow)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mini KPI summary banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        background: 'var(--bg-card-subtle)',
        padding: '12px 16px',
        borderRadius: '10px',
        marginBottom: '18px',
        border: '1px solid var(--border-subtle)'
      }}>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Period Revenue</span>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-primary)' }}>{formatMoney(totalPeriodRevenue)}</div>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Period Expenses</span>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#ef4444' }}>{formatMoney(totalPeriodExpenses)}</div>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Net Profit (Margin)</span>
          <div style={{ fontSize: '16px', fontWeight: 800, color: totalPeriodProfit >= 0 ? '#16a34a' : '#ef4444' }}>
            {formatMoney(totalPeriodProfit)} ({overallMargin}%)
          </div>
        </div>
      </div>

      {/* SVG Chart Plot */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block', minWidth: '480px' }}>
          {/* Subtle Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const yPos = paddingY + plotHeight * (1 - ratio);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={yPos}
                  x2={svgWidth - paddingX}
                  y2={yPos}
                  stroke="var(--border-subtle)"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  fontSize="9.5"
                  fill="var(--text-muted)"
                  fontFamily="inherit"
                >
                  {formatMoney(maxVal * ratio).replace(/(\.00|INR|USD|\$|₹)/g, '').trim()}
                </text>
              </g>
            );
          })}

          {/* Render Bars */}
          {monthsData.map((d, idx) => {
            const centerX = paddingX + idx * colWidth + colWidth / 2;
            const revHeight = (d.revenue / maxVal) * plotHeight;
            const expHeight = (d.expense / maxVal) * plotHeight;

            const revY = paddingY + plotHeight - revHeight;
            const expY = paddingY + plotHeight - expHeight;
            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Column highlight area on hover */}
                {isHovered && (
                  <rect
                    x={paddingX + idx * colWidth + 2}
                    y={paddingY}
                    width={colWidth - 4}
                    height={plotHeight}
                    fill="var(--bg-card-subtle)"
                    rx="6"
                    opacity="0.7"
                  />
                )}

                {/* Revenue Bar */}
                <rect
                  x={centerX - barWidth - 1.5}
                  y={revY}
                  width={barWidth}
                  height={Math.max(revHeight, 2)}
                  fill="var(--accent-primary)"
                  rx="3"
                  style={{ transition: 'height 0.4s ease, y 0.4s ease' }}
                />

                {/* Expense Bar */}
                <rect
                  x={centerX + 1.5}
                  y={expY}
                  width={barWidth}
                  height={Math.max(expHeight, 2)}
                  fill="#ef4444"
                  rx="3"
                  style={{ transition: 'height 0.4s ease, y 0.4s ease' }}
                />

                {/* X Axis Label */}
                <text
                  x={centerX}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isHovered ? '700' : '500'}
                  fill={isHovered ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover inspection pill */}
        {hoveredIndex !== null && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 14px',
            marginTop: '10px',
            boxShadow: 'var(--card-shadow)',
            fontSize: '12px'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {monthsData[hoveredIndex].fullDate}
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Revenue: </span>
                <strong style={{ color: 'var(--accent-primary)' }}>{formatMoney(monthsData[hoveredIndex].revenue)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Expenses: </span>
                <strong style={{ color: '#ef4444' }}>{formatMoney(monthsData[hoveredIndex].expense)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Net Profit: </span>
                <strong style={{ color: monthsData[hoveredIndex].profit >= 0 ? '#16a34a' : '#ef4444' }}>
                  {formatMoney(monthsData[hoveredIndex].profit)} ({monthsData[hoveredIndex].margin}%)
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
