import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { formatTime } from '../components/ui'
import type { TimelineEvent } from '../types/api'

const TYPE_META: Record<string, { icon: string; color: string }> = {
  dns_query: { icon: '❓', color: 'text-sky-400' },
  dns_response: { icon: '✉', color: 'text-emerald-400' },
  tcp_connect: { icon: '⇄', color: 'text-sky-400' },
  udp_session: { icon: '◦', color: 'text-violet-400' },
  tcp_reset: { icon: '⊗', color: 'text-red-400' },
  flow_failed: { icon: '✕', color: 'text-amber-400' },
  http_request: { icon: '⇅', color: 'text-sky-400' },
  tls_handshake: { icon: '🔒', color: 'text-violet-400' },
  alert: { icon: '⚠', color: 'text-red-400' },
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-400',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
  low: 'bg-sky-400',
}

export function TimelinePage() {
  const [captureId, setCaptureId] = useState<string | null>(null)
  const [host, setHost] = useState('')
  const [eventType, setEventType] = useState('')
  const [severity, setSeverity] = useState('')
  const [selected, setSelected] = useState<TimelineEvent | null>(null)

  const { data: captures } = useQuery({
    queryKey: ['captures'],
    queryFn: api.listCaptures,
    refetchInterval: 5000,
  })
  const analyzed = (captures ?? []).filter((c) => c.status === 'completed')
  const effectiveCaptureId = captureId ?? analyzed[0]?.id ?? null

  const { data: events, isLoading } = useQuery({
    queryKey: ['timeline', effectiveCaptureId, host, eventType, severity],
    queryFn: () =>
      api.getTimeline(effectiveCaptureId!, {
        host: host || undefined,
        eventType: eventType || undefined,
        severity: severity || undefined,
      }),
    enabled: !!effectiveCaptureId,
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-100">Timeline</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Chronological events — filter to &quot;everything related to X between T1 and T2&quot;.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <select
          value={effectiveCaptureId ?? ''}
          onChange={(e) => setCaptureId(e.target.value || null)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200"
        >
          {analyzed.map((c) => (
            <option key={c.id} value={c.id}>
              {c.filename}
            </option>
          ))}
        </select>
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="host / IP / domain…"
          className="w-56 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 placeholder-slate-600 focus:border-sky-500/50 focus:outline-none"
        />
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200"
        >
          <option value="">all types</option>
          <option value="dns_query">DNS queries</option>
          <option value="dns_response">DNS responses</option>
          <option value="tcp_connect">TCP connections</option>
          <option value="udp_session">UDP sessions</option>
          <option value="http_request">HTTP</option>
          <option value="tls_handshake">TLS</option>
          <option value="flow_failed">failures</option>
          <option value="tcp_reset">resets</option>
          <option value="alert">alerts</option>
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200"
        >
          <option value="">any severity</option>
          <option value="critical">critical</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
        </select>
      </div>

      {!analyzed.length ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          No analyzed captures yet.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          Building timeline…
        </div>
      ) : !events?.length ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          No events match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="border-b border-slate-800 px-4 py-3 text-sm text-slate-400">
            {events.length.toLocaleString()} events
          </div>
          <EventList events={events} onSelect={setSelected} />
        </div>
      )}

      {selected && <EventDetailModal event={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function EventList({
  events,
  onSelect,
}: {
  events: TimelineEvent[]
  onSelect: (e: TimelineEvent) => void
}) {
  // group by wall-clock minute for visual rhythm
  const rows = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        minute: Math.floor(e.timestamp / 60) * 60,
      })),
    [events],
  )

  return (
    <div className="max-h-[65vh] overflow-y-auto">
      {rows.map((e) => {
        const meta = TYPE_META[e.event_type] ?? { icon: '·', color: 'text-slate-500' }
        return (
          <button
            key={e.id}
            onClick={() => onSelect(e)}
            className="flex w-full items-center gap-3 border-t border-slate-800/60 px-4 py-2 text-left hover:bg-slate-800/30"
          >
            <span className="w-16 shrink-0 font-mono text-xs text-slate-500">
              {formatTime(e.timestamp)}
            </span>
            <span className={`w-4 shrink-0 text-center ${meta.color}`}>{meta.icon}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{e.label}</span>
            {e.severity && (
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[e.severity] ?? 'bg-slate-500'}`}
                title={e.severity}
              />
            )}
            {e.protocol && (
              <span className="shrink-0 rounded bg-slate-800/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                {e.protocol}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function EventDetailModal({
  event,
  onClose,
}: {
  event: TimelineEvent
  onClose: () => void
}) {
  const { data: flow } = useQuery({
    queryKey: ['flow', event.related_flow_id],
    queryFn: () => api.getFlow(event.related_flow_id!),
    enabled: !!event.related_flow_id,
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-slate-200">{event.label}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {new Date(event.timestamp * 1000).toLocaleString()} · {event.event_type}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Source" value={event.source_ip ?? '—'} />
            <Field
              label="Destination"
              value={
                event.destination_ip
                  ? `${event.destination_ip}${event.destination_port ? ':' + event.destination_port : ''}`
                  : '—'
              }
            />
            <Field label="Protocol" value={event.protocol ?? '—'} />
            <Field label="Domain" value={event.domain ?? '—'} />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
              Detail
            </div>
            <pre className="overflow-auto rounded-lg bg-slate-950/60 p-3 font-mono text-xs text-slate-400 ring-1 ring-slate-800">
              {JSON.stringify(event.detail, null, 2)}
            </pre>
          </div>

          {flow && (
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                Related flow evidence
              </div>
              <div className="rounded-lg bg-slate-950/60 p-3 font-mono text-xs text-slate-400 ring-1 ring-slate-800">
                {flow.source_ip}:{flow.source_port} → {flow.destination_ip}:{flow.destination_port}{' '}
                {flow.transport_protocol}
                {' · '}
                {flow.packets} packets, {flow.bytes} bytes, state {flow.tcp_state ?? 'n/a'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-slate-300">{value}</div>
    </div>
  )
}
