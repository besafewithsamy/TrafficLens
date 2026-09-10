import { useEffect } from 'react'

/** Shared modal shell: backdrop, Escape to close, stopPropagation. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`max-h-[85vh] w-full ${
          wide ? 'max-w-4xl' : 'max-w-2xl'
        } overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="font-medium text-slate-200">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
