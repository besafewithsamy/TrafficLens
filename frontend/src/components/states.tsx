import { useEffect, useRef } from 'react'

/** Error message + retry button for a failed query. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-red-400">
      {message ?? 'Something went wrong while loading data.'}
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg bg-slate-800 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-slate-100"
        >
          Retry
        </button>
      )}
    </div>
  )
}

/** Standard empty-state box. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

/** Loading-state box. */
export function LoadingState({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
      {children ?? 'Loading…'}
    </div>
  )
}

/** Server-side pagination controls (Prev/Next + page x of y). */
export function Pagination({
  offset,
  limit,
  total,
  onPageChange,
}: {
  offset: number
  limit: number
  total: number
  onPageChange: (offset: number) => void
}) {
  const page = Math.floor(offset / limit) + 1
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const canPrev = offset > 0
  const canNext = offset + limit < total
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // follow page changes into view (tables live above the controls)
    topRef.current?.scrollIntoView({ block: 'nearest' })
  }, [offset])

  return (
    <div ref={topRef} className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5 text-xs text-slate-400">
      <span>
        {total.toLocaleString()} records · page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        <button
          disabled={!canPrev}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          className="rounded-lg px-3 py-1 text-slate-300 ring-1 ring-slate-700 transition hover:text-slate-100 disabled:opacity-40 disabled:hover:text-slate-300"
        >
          ← Prev
        </button>
        <button
          disabled={!canNext}
          onClick={() => onPageChange(offset + limit)}
          className="rounded-lg px-3 py-1 text-slate-300 ring-1 ring-slate-700 transition hover:text-slate-100 disabled:opacity-40 disabled:hover:text-slate-300"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
