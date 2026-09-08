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
        <div className="animate-pulse text-slate-500">Loading…</div>
      </StateShell>
    )
  }
  if (query.isError) {
    return (
      <StateShell>
        <div className="text-red-400">⚠ {String(query.error)}</div>
        <button
          onClick={() => query.refetch()}
          className="mt-3 rounded-lg bg-slate-800 px-4 py-1.5 text-xs text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"
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
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}
