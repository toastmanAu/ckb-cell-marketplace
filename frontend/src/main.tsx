import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem', fontFamily: 'JetBrains Mono, monospace',
          background: '#080a0f', color: '#ff4560', minHeight: '100vh',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          <h2>Runtime Error</h2>
          <p>{this.state.error.message}</p>
          <p style={{ color: '#64748b', fontSize: '.85rem' }}>{this.state.error.stack}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
