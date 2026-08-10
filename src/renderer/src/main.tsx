import React, { Component } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// Error Boundary — catches any unhandled React errors to prevent the
// entire app from going white (blank screen). Shows the error instead.
interface EBState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[SSH Client Error]', error, info.componentStack)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'Menlo, Monaco, monospace',
          padding: '40px'
        }}>
          <h2 style={{ color: '#f44336', marginBottom: '16px' }}>应用发生异常</h2>
          <pre style={{
            background: '#2d2d2d',
            padding: '16px 24px',
            borderRadius: '8px',
            color: '#f44336',
            maxWidth: '700px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '13px',
            lineHeight: '1.5'
          }}>
            {this.state.error?.message || '未知错误'}
          </pre>
          <button
            style={{
              marginTop: '20px',
              background: '#0e639c',
              color: '#fff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
