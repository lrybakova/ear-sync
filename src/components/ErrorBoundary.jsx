import { Component } from 'react';

/**
 * Error Boundary - catches render errors and shows recovery UI
 * instead of a white screen crash
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('EarSync Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          background: '#0f0f1a',
          color: '#e2e8f0',
          fontFamily: 'Inter, -apple-system, sans-serif',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ marginBottom: '8px', fontSize: '1.3rem' }}>Something went wrong</h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px', maxWidth: '400px', fontSize: '0.9rem' }}>
            An unexpected error occurred. Your saved data is safe.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: 'white',
                border: 'none',
                padding: '12px 28px',
                borderRadius: '10px',
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#2a2a42',
                color: '#e2e8f0',
                border: '1px solid #3a3a5c',
                padding: '12px 28px',
                borderRadius: '10px',
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
          {this.state.error && (
            <details style={{ marginTop: '24px', color: '#64748b', fontSize: '0.75rem', maxWidth: '500px' }}>
              <summary style={{ cursor: 'pointer' }}>Error details</summary>
              <pre style={{ textAlign: 'left', whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
