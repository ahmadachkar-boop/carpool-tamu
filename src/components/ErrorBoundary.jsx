import React from 'react';
import { AlertCircle, RefreshCw, Home, X } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      dismissed: false
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
      errorCount: prevState.errorCount + 1,
      dismissed: false // Reset dismissed state on new error
    }));

    // Log to external error tracking service if available
    // e.g., Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      dismissed: false
    });

    // Call optional onReset callback if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleDismiss = () => {
    this.setState({ dismissed: true });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError && !this.state.dismissed) {
      // Custom fallback UI from props
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // Less obtrusive error banner UI
      return (
        <div className="relative">
          {/* Error Banner - Fixed at top */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b-4 border-red-500 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AlertCircle size={28} className="text-red-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-red-900 mb-1">
                    Component Error
                  </h3>
                  <p className="text-sm text-red-700 mb-3">
                    {this.props.errorMessage ||
                      'This component encountered an error. You can try again, reload the page, or navigate away.'}
                  </p>

                  {/* Show error details in development */}
                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <details className="mb-3">
                      <summary className="cursor-pointer text-xs font-semibold text-red-800 hover:text-red-900 mb-1">
                        Technical Details
                      </summary>
                      <div className="bg-red-100 rounded-lg p-2 text-xs font-mono overflow-auto max-h-32">
                        <p className="text-red-800 font-bold mb-1">{this.state.error.toString()}</p>
                        <pre className="text-red-700 whitespace-pre-wrap text-xs">
                          {this.state.errorInfo?.componentStack?.substring(0, 500)}
                        </pre>
                      </div>
                    </details>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={this.handleReset}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg font-semibold hover:bg-red-700 transition flex items-center gap-1.5"
                    >
                      <RefreshCw size={14} />
                      Try Again
                    </button>

                    <button
                      onClick={this.handleReload}
                      className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg font-semibold hover:bg-gray-700 transition flex items-center gap-1.5"
                    >
                      <RefreshCw size={14} />
                      Reload
                    </button>

                    <button
                      onClick={this.handleGoHome}
                      className="px-3 py-1.5 bg-white border border-red-300 text-red-700 text-sm rounded-lg font-semibold hover:bg-red-50 transition flex items-center gap-1.5"
                    >
                      <Home size={14} />
                      Dashboard
                    </button>

                    <button
                      onClick={this.handleDismiss}
                      className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg font-semibold hover:bg-gray-50 transition"
                    >
                      Dismiss
                    </button>
                  </div>

                  {this.state.errorCount > 2 && (
                    <div className="mt-2 text-xs text-red-700 font-medium">
                      ⚠️ This error keeps occurring. Consider reloading or navigating away.
                    </div>
                  )}
                </div>

                <button
                  onClick={this.handleDismiss}
                  className="flex-shrink-0 text-red-600 hover:text-red-800 transition"
                  aria-label="Dismiss"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
          </div>

          {/* Spacer to prevent content from being hidden under fixed banner */}
          <div className="h-48"></div>

          {/* Navigation fallback - show basic navigation */}
          <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="text-center">
                <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Component Failed to Render
                </h2>
                <p className="text-gray-600 mb-6">
                  Use the error banner above to recover, or use the navigation menu to go elsewhere.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={this.handleGoHome}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                  >
                    Go to Dashboard
                  </button>
                  <button
                    onClick={this.handleReload}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // If dismissed, show the children but keep the error logged
    if (this.state.hasError && this.state.dismissed) {
      return (
        <>
          {/* Small dismissible reminder */}
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
            <p className="text-xs text-yellow-800 text-center">
              ⚠️ Component error was dismissed - some features may not work properly.{' '}
              <button
                onClick={this.handleReload}
                className="underline font-semibold hover:text-yellow-900"
              >
                Reload to fix
              </button>
            </p>
          </div>
          {this.props.children}
        </>
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
