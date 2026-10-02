import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled Application Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (window.location.hash) {
      window.location.hash = '#/dashboard';
    } else {
      window.location.href = '/dashboard';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--bg-main, #f8fafc)',
          color: 'var(--text-primary, #0f172a)'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertTriangle size={28} color="#dc2626" />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              Something went wrong
            </h2>

            <p style={{ fontSize: '14px', color: 'var(--text-muted, #64748b)', margin: '0 0 20px', lineHeight: 1.5 }}>
              AutoInvoice recovered from an unexpected error. You can reload the page or return to the dashboard safely.
            </p>

            {this.state.error?.message && (
              <div style={{
                background: 'var(--bg-card-subtle, #f1f5f9)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#b91c1c',
                textAlign: 'left',
                marginBottom: '24px',
                wordBreak: 'break-word',
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={this.handleReload}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px' }}
              >
                <RefreshCw size={15} /> Reload Page
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={this.handleReset}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px' }}
              >
                <Home size={15} /> Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
