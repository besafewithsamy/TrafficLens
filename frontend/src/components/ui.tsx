export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
    analyzing: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
    queued: 'bg-sky-500/10 text-sky-400 ring-sky-500/30',
    created: 'bg-slate-500/10 text-slate-400 ring-slate-500/30',
    failed: 'bg-red-500/10 text-red-400 ring-red-500/30',
    running: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
        styles[status] ?? styles.created
      }`}
    >
      {status}
    </span>
  )
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

export function formatTime(ts: number | null): string {
  if (ts == null) return '—'
  return new Date(ts * 1000).toLocaleTimeString()
}

export function formatDuration(start: number | null, end: number | null): string {
  if (start == null || end == null) return '—'
  const s = Math.max(0, end - start)
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}
