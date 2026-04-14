import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full grid place-items-center p-8">
          <div className="glass p-8 max-w-md text-center">
            <AlertTriangle size={32} className="text-jarvis-warning mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-jarvis-ink mb-2">Something went wrong</h2>
            <p className="text-sm text-jarvis-body mb-4">
              {this.state.error?.message ?? "An unexpected error occurred"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-jarvis-primary/15 text-jarvis-primary text-sm font-semibold hover:bg-jarvis-primary/25 transition"
            >
              <RefreshCw size={14} /> Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
