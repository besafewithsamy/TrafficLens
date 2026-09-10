import type { Capture } from '../types/api'

/** Shared capture <select> used by every analysis page. */
export function CapturePicker({
  captures,
  value,
  onChange,
}: {
  captures: Capture[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  return (
    <select
      aria-label="Select capture"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200"
    >
      {captures.map((c) => (
        <option key={c.id} value={c.id}>
          {c.filename}
        </option>
      ))}
    </select>
  )
}
