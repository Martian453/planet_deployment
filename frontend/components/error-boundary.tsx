"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  title?: string;
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
    console.error("❌ Uncaught error in dashboard tile:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900/40 border border-red-500/20 rounded-2xl m-1 text-center backdrop-blur-md h-full min-h-[220px]">
          <div className="h-9 w-9 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <h4 className="text-xs font-black uppercase tracking-wider text-white mb-1">
            {this.props.title || "Widget Failed"}
          </h4>
          <p className="text-[10px] text-slate-400 max-w-[200px] mb-3 leading-relaxed">
            {this.state.error?.message || "An unexpected rendering error occurred inside this tile."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-[9px] font-bold uppercase tracking-wider transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            Reload Tile
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
