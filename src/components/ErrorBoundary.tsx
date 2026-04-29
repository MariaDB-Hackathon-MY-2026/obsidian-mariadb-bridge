import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-sleek-bg flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full">
            <div className="bg-sleek-card border border-sleek-border rounded-3xl p-8 md:p-10 backdrop-blur-xl relative overflow-hidden">
              {/* Decorative accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-sleek-accent/10 blur-3xl -mr-16 -mt-16 rounded-full" />
              
              <div className="relative space-y-8">
                <div className="w-16 h-16 bg-sleek-accent/10 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-sleek-accent" />
                </div>
                
                <div className="space-y-4">
                  <h1 className="text-3xl font-bold tracking-tight text-sleek-text">
                    Something went wrong
                  </h1>
                  <p className="text-sleek-muted text-sm leading-relaxed">
                    An unexpected error occurred while rendering the application. This could be due to a temporary connection issue or a logic fault.
                  </p>
                </div>

                {this.state.error && (
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <p className="text-[10px] font-mono text-sleek-accent uppercase tracking-widest mb-2 opacity-50">Error details</p>
                    <p className="text-xs font-mono text-sleek-muted break-all">
                      {this.state.error.message}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button
                    onClick={this.handleReset}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-sleek-accent text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-sleek-accent/20"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reload App
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 text-sleek-muted rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    <Home className="w-3.5 h-3.5" />
                    Go Home
                  </button>
                </div>
              </div>
            </div>
            
            <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-sleek-muted/20">
              VectorSync Neural Bridge &bull; Core System Stability
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
