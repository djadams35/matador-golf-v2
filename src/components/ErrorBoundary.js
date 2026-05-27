import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-5">
          <div className="mb-3" style={{ fontSize: '2.5rem' }}>⛳</div>
          <h4 className="fw-bold text-matador-red">Something went wrong</h4>
          <p className="text-muted mb-4">An unexpected error occurred. Try refreshing the page.</p>
          <button
            className="btn btn-matador"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
