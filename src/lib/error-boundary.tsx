import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

/**
 * Top-level error boundary (master 4.8). Mounted around the shell's route
 * outlet and around the router itself, so a crashed page loses its content
 * area but never the whole application. The fallback states what happened,
 * offers a reload and a link home, and records nothing silently.
 */

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Rendered inside the fallback card; can use router hooks when the boundary sits inside the router. */
  fallbackAction?: ReactNode
  /** Scope label shown in the fallback ("this page", "the application"). */
  scope?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The real sink (Sentry et al.) arrives with the backend; log loudly for now.
    console.error('[ErrorBoundary]', error.message, info.componentStack?.split('\n')[1] ?? '')
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const scope = this.props.scope ?? 'this page'
    return (
      <div
        role="alert"
        data-error-boundary
        className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      >
        <div className="flex size-11 items-center justify-center rounded-card border border-crit/30 bg-crit-wash">
          <TriangleAlert className="size-5 text-crit-ink" />
        </div>
        <div>
          <h2 className="text-md font-semibold text-ink">Something went wrong on {scope}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
            The view failed to render. Your data is safe — the register, investigations and actions
            are unaffected.
          </p>
          <p className="mt-2 max-w-md truncate font-mono text-xs text-ink-faint" title={error.message}>
            {error.message}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-8 items-center rounded-md bg-brand px-3 text-base font-medium text-on-brand transition-colors duration-120 hover:bg-brand-hover"
          >
            Reload
          </button>
          {this.props.fallbackAction}
        </div>
      </div>
    )
  }
}
