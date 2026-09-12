import type { UseQueryResult } from '@tanstack/react-query'

/** Unified loading / error / empty state rendering for data queries. */
export function QueryState({
  query,
  emptyText = 'No data available.',
  children,
}: {
  query: UseQueryResult
  emptyText?: string
  children: React.ReactNode
}) {
  if (query.isLoading) {
    return (
      <StateShell>
        <div className="animate-pulse text-fg-subtle">Loading…</div>
      </StateShell>
    )
  }
  if (query.isError) {
    return (
      <StateShell>
        <div className="text-danger">{String(query.error)}</div>
        <button
          onClick={() => query.refetch()}
          className="mt-3 rounded-lg bg-surface-3 px-4 py-1.5 text-xs text-fg-muted ring-1 ring-border-strong hover:bg-border-strong"
        >
          Retry
        </button>
      </StateShell>
    )
  }
  const empty =
    query.data == null ||
    (Array.isArray(query.data) && query.data.length === 0)
  if (empty) {
    return <StateShell>{emptyText}</StateShell>
  }
  return <>{children}</>
}

function StateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/50 p-12 text-center text-sm text-fg-subtle">
      {children}
    </div>
  )
}
