import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#141413] text-[#faf9f5] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-3xl border border-[#fb7185]/40 bg-[#1e1e1c] p-6 text-center space-y-4 shadow-2xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fb7185]/20 text-[#fb7185]">
              <span className="text-2xl font-bold">⚠️</span>
            </div>
            <h2 className="text-lg font-bold">Clinical Session Interrupted</h2>
            <p className="text-xs text-[#a9a99f]">
              An unexpected interface error occurred in this view. Your session and patient data remain secure.
            </p>
            {this.state.error?.message && (
              <pre className="text-left font-mono text-[10px] bg-[#161614] p-3 rounded-xl border border-[#3e3e38] text-[#fb7185] overflow-x-auto max-h-28">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-[#d97757] px-4 py-2.5 text-xs font-bold text-[#faf9f5] hover:bg-[#d97757]/80 transition shadow-lg shadow-[#d97757]/20"
            >
              Reload Interface
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
