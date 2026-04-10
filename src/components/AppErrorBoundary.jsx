import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

function formatErrorDetails(error, errorInfo) {
  if (!error) return '';
  const parts = [error.stack || `${error.name}: ${error.message}`];
  if (errorInfo?.componentStack) {
    parts.push(errorInfo.componentStack.trim());
  }
  return parts.filter(Boolean).join('\n\n');
}

function ErrorFallback({ error, errorInfo, onReset }) {
  const details = formatErrorDetails(error, errorInfo);
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-canvas text-text-primary relative overflow-hidden">
      <div className="aurora-drift absolute inset-0 pointer-events-none" />
      <div className="noise-overlay absolute inset-0 pointer-events-none" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl rounded-3xl border border-aurora-rose/20 bg-surface/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-aurora-rose/20 bg-aurora-rose/10">
              <AlertTriangle className="h-7 w-7 text-aurora-rose" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-aurora-rose">
                Runtime Recovery
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-text-primary">
                The dashboard hit a rendering error.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                The app is still alive, but this screen caught the crash so you do not end up with a black screen.
                You can retry immediately or reload the workspace.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-xl bg-aurora-teal px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#12e8da]"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Render
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="inline-flex items-center gap-2 rounded-xl border border-hairline ui-panel-soft px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-text-primary shadow-sm"
            >
              <Home className="h-4 w-4" />
              Reload App
            </button>
          </div>

          {error?.message && (
            <div className="mt-6 ui-well p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-disabled">
                Error Summary
              </div>
              <p className="mt-2 font-mono text-sm text-aurora-rose">{error.message}</p>
            </div>
          )}

          {isDev && details && (
            <div className="mt-4 rounded-2xl border border-hairline bg-panel-strong p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-disabled">
                Dev Details
              </div>
              <pre className="mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-text-muted no-scrollbar">
                {details}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      resetKey: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[AppErrorBoundary] Caught runtime error', error, errorInfo);
  }

  handleReset = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return (
      <React.Fragment key={this.state.resetKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
