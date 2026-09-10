import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-16 text-center">
      <div className="text-5xl font-bold text-slate-700">404</div>
      <p className="text-sm text-slate-400">This page doesn&apos;t exist.</p>
      <Link
        to="/"
        className="mt-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20"
      >
        ← Back to dashboard
      </Link>
    </div>
  )
}
