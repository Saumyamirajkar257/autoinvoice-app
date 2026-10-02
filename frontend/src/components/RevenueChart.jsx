import React, { useState } from 'react';
import { formatCurrency } from '../utils/currency';

export default function RevenueChart({ invoices = [], expenses = [], userProfile }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const formatMoney = (val) => formatCurrency(val, userProfile?.currency || 'INR - Indian Rupee');

  // Compute last 6 months data
  const monthsData = [];
  const today = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
    const m = d.getMonth();
    const y = d.getFullYear();

    // Filter paid invoices in this month
    const rev = invoices.filter(inv => {
      if (inv.status !== 'paid' && inv.status !== 'verified') return false;
      const invDate = new Date(inv.paidAt || inv.due || inv.created);
      return !isNaN(invDate.getTime()) && invDate.getMonth() === m && invDate.getFullYear() === y;
    }).reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

    // Filter expenses in this month
    const exp = expenses.filter(e => {
      if (!e.date) return false;
      const expDate = new Date(e.date);
      return !isNaN(expDate.getTime()) && expDate.getMonth() === m && expDate.getFullYear() === y;
    }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    monthsData.push({
      label: monthLabel,
      revenue: rev,
      expense: exp,
      profit: rev - exp
    });
  }

  // Find max value for SVG scale
  const maxVal = Math.max(...monthsData.map(d => Math.max(d.revenue, d.expense)), 1000);

  // SVG Chart dimensions
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingY * 2;
  const colWidth = plotWidth / monthsData.length;
  const barWidth = 16;

  return (
    <div className="chart-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Revenue & Expense Overview
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Financial performance across the last 6 months
          </p>
        </div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '12px', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--accent-primary)' }}></span>
            <span style={{ color: 'var(--text-secondary)' }}>Revenue</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444' }}></span>
            <span style={{ color: 'var(--text-secondary)' }}>Expenses</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Background Grid Lines */}
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
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 6}
                  y={yPos + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-muted)"
                >
                  {formatMoney(maxVal * ratio).replace(/(\.00|INR|USD|\$|₹)/g, '').trim()}
                </text>
              </g>
            );
          })}

          {/* Bars */}
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
                {/* Hover Column Indicator */}
                {isHovered && (
                  <rect
                    x={paddingX + idx * colWidth + 4}
                    y={paddingY}
                    width={colWidth - 8}
                    height={plotHeight}
                    fill="var(--bg-card-subtle)"
                    rx="4"
                    opacity="0.5"
                  />
                )}

                {/* Revenue Bar */}
                <rect
                  x={centerX - barWidth - 2}
                  y={revY}
                  width={barWidth}
                  height={Math.max(revHeight, 2)}
                  fill="var(--accent-primary)"
                  rx="3"
                />

                {/* Expense Bar */}
                <rect
                  x={centerX + 2}
                  y={expY}
                  width={barWidth}
                  height={Math.max(expHeight, 2)}
                  fill="#ef4444"
                  rx="3"
                />

                {/* Month Label */}
                <text
                  x={centerX}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '500'}
                  fill={isHovered ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Details Floating Banner */}
        {hoveredIndex !== null && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 12px',
            marginTop: '8px',
            boxShadow: 'var(--card-shadow)',
            fontSize: '12px'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Month: </span>
              <strong>{monthsData[hoveredIndex].label}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--accent-primary)' }}>Revenue: </span>
              <strong>{formatMoney(monthsData[hoveredIndex].revenue)}</strong>
            </div>
            <div>
              <span style={{ color: '#ef4444' }}>Expenses: </span>
              <strong>{formatMoney(monthsData[hoveredIndex].expense)}</strong>
            </div>
            <div>
              <span style={{ color: monthsData[hoveredIndex].profit >= 0 ? '#16a34a' : '#ef4444' }}>Net: </span>
              <strong>{formatMoney(monthsData[hoveredIndex].profit)}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
