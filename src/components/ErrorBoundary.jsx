import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('❌ ErrorBoundary caught an error:', error, errorInfo);

    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Log to external error tracking service if available
    // e.g., Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Call optional onReset callback if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI from props
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border-2 border-red-200 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Oops! Something went wrong
              </h2>

              <p className="text-gray-600 mb-6">
                {this.props.errorMessage ||
                  'The application encountered an unexpected error. You can try reloading the page or going back home.'}
              </p>

              {/* Show error details in development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="w-full mb-6 text-left">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900 mb-2">
                    Technical Details
                  </summary>
                  <div className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-auto max-h-48">
                    <p className="text-red-600 font-bold mb-2">{this.state.error.toString()}</p>
                    <pre className="text-gray-700 whitespace-pre-wrap">
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={this.handleReset}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} />
                  Try Again
                </button>

                <button
                  onClick={this.handleReload}
                  className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} />
                  Reload Page
                </button>
              </div>

              <button
                onClick={this.handleGoHome}
                className="mt-3 w-full px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-2"
              >
                <Home size={18} />
                Go to Dashboard
              </button>

              {this.state.errorCount > 2 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    ⚠️ This error keeps occurring. Please contact support if the problem persists.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  return function WithErrorBoundaryWrapper(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

export default ErrorBoundary;
