import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[var(--bg-root)] flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-bold text-[var(--danger)]">
              Something went wrong
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {this.state.error.message}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
