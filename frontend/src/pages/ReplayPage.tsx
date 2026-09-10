import { useEffect, useMemo, useRef, useState } from 'react'
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

const SPEEDS = [0.5, 1, 4, 16, 64]

export function ReplayPage() {
  const [captureId, setCaptureId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const [position, setPosition] = useState(0) // event index
  const [selected, setSelected] = useState<TimelineEvent | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: captures } = useQuery({
    queryKey: ['captures'],
    queryFn: api.listCaptures,
    refetchInterval: 5000,
  })
  const analyzed = (captures ?? []).filter((c) => c.status === 'completed')
  const effectiveCaptureId = captureId ?? analyzed[0]?.id ?? null

  const { data: events, isError } = useQuery({
    queryKey: ['replay', effectiveCaptureId],
    queryFn: () => api.getReplay(effectiveCaptureId!),
    enabled: !!effectiveCaptureId,
  })

  // playback: advance position at `speed` events/sec
  useEffect(() => {
    if (!playing || !events) return
    timerRef.current = setInterval(() => {
      setPosition((p) => {
        if (p >= events.length - 1) {
          setPlaying(false)
          return events.length - 1
        }
        return p + 1
      })
    }, 1000 / speed)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [playing, speed, events])

  const current = events?.[position] ?? null
  const past = useMemo(() => events?.slice(Math.max(0, position - 14), position + 1) ?? [], [events, position])

  return (
    <div className="flex h-full flex-col p-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-100">Incident Replay</h1>
        <span className="text-xs text-slate-500">
          watch what happened, in order — click any event for evidence
        </span>
        <select
          value={effectiveCaptureId ?? ''}
          onChange={(e) => {
            setCaptureId(e.target.value || null)
            setPosition(0)
            setPlaying(false)
          }}
          className="ml-auto rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200"
        >
          {analyzed.map((c) => (
            <option key={c.id} value={c.id}>
              {c.filename}
            </option>
          ))}
        </select>
      </div>

      {!events ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          {analyzed.length ? 'Loading events…' : 'No analyzed captures yet.'}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-red-400">
          Failed to load replay events. Please try again.
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          {/* Transport controls */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
            <button
              onClick={() => {
                if (position >= events.length - 1) setPosition(0)
                setPlaying(!playing)
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-lg text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20"
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <button
              onClick={() => setPosition((p) => Math.max(0, p - 1))}
              className="rounded-lg px-2 py-1 text-slate-400 ring-1 ring-slate-700 hover:text-slate-200"
              title="previous event"
            >
              ⏮
            </button>
            <button
              onClick={() => setPosition((p) => Math.min(events.length - 1, p + 1))}
              className="rounded-lg px-2 py-1 text-slate-400 ring-1 ring-slate-700 hover:text-slate-200"
              title="next event"
            >
              ⏭
            </button>

            {/* scrubber */}
            <input
              type="range"
              min={0}
              max={events.length - 1}
              value={position}
              onChange={(e) => {
                setPlaying(false)
                setPosition(Number(e.target.value))
              }}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-emerald-400"
            />

            {/* speed */}
            <div className="flex items-center gap-1.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`rounded px-2 py-1 text-xs ring-1 transition ${
                    speed === s
                      ? 'bg-sky-500/10 text-sky-300 ring-sky-500/30'
                      : 'text-slate-400 ring-slate-700 hover:text-slate-200'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>

            <div className="w-14 text-right font-mono text-xs text-slate-500">
              {position + 1}/{events.length}
            </div>
          </div>

          {/* Current event spotlight */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
            {current ? (
              <button
                onClick={() => setSelected(current)}
                className="flex w-full items-center gap-4 text-left"
              >
                <span className="font-mono text-lg text-slate-500">
                  {formatTime(current.timestamp)}
                </span>
                <span
                  className={`text-xl ${
                    (TYPE_META[current.event_type] ?? { color: 'text-slate-500' }).color
                  }`}
                >
                  {(TYPE_META[current.event_type] ?? { icon: '·' }).icon}
                </span>
                <span
                  className={`text-base ${
                    current.severity === 'critical'
                      ? 'text-red-300'
                      : current.severity === 'high'
                        ? 'text-orange-300'
                        : 'text-slate-200'
                  }`}
                >
                  {current.label}
                </span>
                <span className="ml-auto text-xs text-slate-500">details →</span>
              </button>
            ) : (
              <span className="text-sm text-slate-500">No events</span>
            )}
          </div>

          {/* Event tape (recent history, newest at bottom) */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="space-y-1">
              {past.map((e, i) => {
                const isCurrent = i === past.length - 1
                const meta = TYPE_META[e.event_type] ?? { icon: '·', color: 'text-slate-500' }
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm transition ${
                      isCurrent
                        ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span className="w-16 shrink-0 font-mono text-xs text-slate-500">
                      {formatTime(e.timestamp)}
                    </span>
                    <span className={`w-4 shrink-0 ${meta.color}`}>{meta.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-300">{e.label}</span>
                    {isCurrent && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-emerald-400">
                        now
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {selected && <ReplayEventModal event={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ReplayEventModal({ event, onClose }: { event: TimelineEvent; onClose: () => void }) {
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
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Source</div>
              <div className="mt-0.5 font-mono text-slate-300">{event.source_ip ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                Destination
              </div>
              <div className="mt-0.5 font-mono text-slate-300">
                {event.destination_ip ?? '—'}
                {event.destination_port ? `:${event.destination_port}` : ''}
              </div>
            </div>
          </div>
          <pre className="overflow-auto rounded-lg bg-slate-950/60 p-3 font-mono text-xs text-slate-400 ring-1 ring-slate-800">
            {JSON.stringify(event.detail, null, 2)}
          </pre>
          {flow && (
            <div className="rounded-lg bg-slate-950/60 p-3 font-mono text-xs text-slate-400 ring-1 ring-slate-800">
              flow: {flow.source_ip}:{flow.source_port} → {flow.destination_ip}:
              {flow.destination_port} · {flow.packets} pkt · {flow.bytes} B ·{' '}
              {flow.tcp_state ?? 'n/a'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
