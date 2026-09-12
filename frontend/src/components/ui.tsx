import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Formatters (existing API, unchanged)                                */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 ring-1 ring-accent-ring',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3 ring-1 ring-border',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger hover:bg-danger/20 ring-1 ring-danger/30',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all
        disabled:pointer-events-none disabled:opacity-50
        ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Badge / StatusPill                                                  */
/* ------------------------------------------------------------------ */

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-fg/10 text-fg-muted ring-fg/20',
  success: 'bg-success/10 text-success ring-success/30',
  warning: 'bg-warning/10 text-warning ring-warning/30',
  danger: 'bg-danger/10 text-danger ring-danger/30',
  info: 'bg-info/10 text-info ring-info/30',
  accent: 'bg-accent-soft text-accent ring-accent-ring',
}

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

const STATUS_TONES: Record<string, BadgeTone> = {
  completed: 'success',
  analyzing: 'warning',
  queued: 'info',
  created: 'neutral',
  stopped: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
  running: 'warning',
}

export function StatusPill({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? 'neutral'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

const SEVERITY_TONES: Record<string, BadgeTone> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'info',
  info: 'neutral',
}

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge tone={SEVERITY_TONES[severity.toLowerCase()] ?? 'neutral'}>{severity.toUpperCase()}</Badge>
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-surface ring-1 ring-border shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className = '',
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start justify-between gap-4 border-b border-border px-5 py-4 ${className}`}>
      <div>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Input / Select                                                      */
/* ------------------------------------------------------------------ */

const FIELD_BASE =
  'w-full rounded-lg bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle ' +
  'ring-1 ring-border transition-shadow focus:outline-none focus:ring-2 focus:ring-accent-ring'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', id, ...rest }: InputProps) {
  const field = (
    <input id={id} className={`${FIELD_BASE} h-9 ${className}`} {...rest} />
  )
  if (!label) return field
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-xs font-medium text-fg-muted">{label}</span>
      {field}
    </label>
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  children: ReactNode
}

export function Select({ label, className = '', id, children, ...rest }: SelectProps) {
  const field = (
    <select id={id} className={`${FIELD_BASE} h-9 ${className}`} {...rest}>
      {children}
    </select>
  )
  if (!label) return field
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-xs font-medium text-fg-muted">{label}</span>
      {field}
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* Spinner / Skeleton                                                  */
/* ------------------------------------------------------------------ */

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-fg-subtle ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}

export function SkeletonRow({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer h-4 rounded-md ${className}`} aria-hidden />
}

export function SkeletonCard({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <Card className={`p-5 ${className}`} aria-hidden>
      <div className="space-y-3">
        <SkeletonRow className="w-1/3" />
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonRow key={i} className={`${i % 2 ? 'w-5/6' : 'w-2/3'}`} />
        ))}
      </div>
    </Card>
  )
}
