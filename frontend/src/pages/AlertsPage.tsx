import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { CapturePicker } from '../components/CapturePicker'
import { EmptyState, ErrorState, LoadingState } from '../components/states'
import { formatTime } from '../components/ui'
import { useSelectedCapture } from '../hooks/captures'
import type { Alert } from '../types/api'

const SEVERITY_STYLE: Record<string, { badge: string; bar: string; label: string }> = {
  critical: { badge: 'bg-red-500/10 text-red-400 ring-red-500/30', bar: 'bg-red-400', label: 'CRITICAL' },
  high: { badge: 'bg-orange-500/10 text-orange-400 ring-orange-500/30', bar: 'bg-orange-400', label: 'HIGH' },
  medium: { badge: 'bg-amber-500/10 text-amber-400 ring-amber-500/30', bar: 'bg-amber-400', label: 'MEDIUM' },
  low: { badge: 'bg-sky-500/10 text-sky-400 ring-sky-500/30', bar: 'bg-sky-400', label: 'LOW' },
  info: { badge: 'bg-slate-500/10 text-slate-400 ring-slate-500/30', bar: 'bg-slate-400', label: 'INFO' },
}

const RULE_LABELS: Record<string, string> = {
  port_scan: 'Port Scan',
  beaconing: 'Beaconing',
  dns_tunneling: 'DNS Tunneling',
  nxdomain_burst: 'NXDOMAIN Burst',
  suspicious_port: 'Suspicious Port',
  excessive_connection_failures: 'Connection Failures',
  connection_without_dns: 'Direct IP Connection',
  high_outbound_volume: 'High Outbound Volume',
  arp_spoofing: 'ARP Spoofing',
  lateral_movement: 'Lateral Movement',
  dga_domain: 'DGA Domains',
  data_exfiltration: 'Data Exfiltration',
  low_slow_beaconing: 'Low-and-Slow Beaconing',
  suspicious_user_agent: 'Suspicious User Agent',
}

export function AlertsPage() {
  const { analyzed, effectiveCaptureId, setCaptureId } = useSelectedCapture()
  const [severity, setSeverity] = useState('')
  const [unconfirmedOnly, setUnconfirmedOnly] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: page, isLoading, isError, refetch } = useQuery({
    queryKey: ['alerts', effectiveCaptureId, severity],
    queryFn: () =>
      api.listAlerts(effectiveCaptureId!, { severity: severity || undefined }, { limit: 100 }),
    enabled: !!effectiveCaptureId,
  })

  const allAlerts = page?.items ?? []
  const alerts = unconfirmedOnly
    ? allAlerts.filter(
        (a) => !a.tags.includes('confirmed') && !a.tags.includes('false-positive'),
      )
    : allAlerts

  const ack = useMutation({
    mutationFn: ({ id, acknowledged }: { id: string; acknowledged: boolean }) =>
      api.ackAlert(id, acknowledged),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const triage = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      acknowledged?: boolean
      tags?: string[]
      note?: string
    }) => api.triageAlert(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  // capture summary for correlated incidents
  const { data: captureDetail } = useQuery({
    queryKey: ['captureDetail', effectiveCaptureId],
    queryFn: () => api.getCapture(effectiveCaptureId!),
    enabled: !!effectiveCaptureId,
  })
  const incidents = captureDetail?.summary?.incidents ?? []

  const counts = allAlerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-100">Alerts</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Every alert is explainable — reasons, evidence, and the flows behind it.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <CapturePicker captures={analyzed} value={effectiveCaptureId} onChange={setCaptureId} />
        {['', 'critical', 'high', 'medium', 'low'].map((s) => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={`rounded-lg px-3 py-1.5 ring-1 transition ${
              severity === s
                ? 'bg-red-500/10 text-red-300 ring-red-500/30'
                : 'text-slate-400 ring-slate-700 hover:text-slate-200'
            }`}
          >
            {s || 'All'}
            {s && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
        <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={unconfirmedOnly}
            onChange={(e) => setUnconfirmedOnly(e.target.checked)}
            className="accent-emerald-500"
          />
          hide confirmed & false-positives
        </label>
        {effectiveCaptureId && (
          <a
            href={api.captureReportUrl(effectiveCaptureId)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-sky-300 ring-1 ring-sky-500/30 transition hover:bg-sky-500/10"
          >
            ⬇ Download report (HTML/PDF)
          </a>
        )}
      </div>

      {/* Correlated incidents */}
      {incidents.length > 0 && (
        <div className="mb-6 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Correlated incidents ({incidents.length})
          </div>
          {incidents.map((inc) => (
            <div
              key={`${inc.source_ip}-${inc.first_seen}`}
              className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${
                    (SEVERITY_STYLE[inc.severity] ?? SEVERITY_STYLE.info).badge
                  }`}
                >
                  {(SEVERITY_STYLE[inc.severity] ?? SEVERITY_STYLE.info).label}
                </span>
                <span className="text-sm font-medium text-slate-200">{inc.title}</span>
                <span className="ml-auto font-mono text-xs text-slate-500">
                  {inc.alert_count} alerts · max score {inc.max_score}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{inc.story}</p>
            </div>
          ))}
        </div>
      )}

      {!analyzed.length ? (
        <EmptyState>No analyzed captures yet.</EmptyState>
      ) : isLoading ? (
        <LoadingState>Running suspicion engine…</LoadingState>
      ) : isError ? (
        <ErrorState message="Failed to load alerts." onRetry={() => refetch()} />
      ) : !alerts.length ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-12 text-center">
          <div className="text-3xl text-emerald-500">✓</div>
          <p className="mt-2 text-sm text-emerald-300">No alerts matched — traffic looks clean.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              expanded={expanded === alert.id}
              onToggle={() => setExpanded(expanded === alert.id ? null : alert.id)}
              onAck={(v) => ack.mutate({ id: alert.id, acknowledged: v })}
              ackPending={ack.isPending && ack.variables?.id === alert.id}
                  onToggleTag={(tag, active) => {
                    const next = active
                      ? alert.tags.filter((t) => t !== tag)
                      : [...alert.tags, tag]
                    triage.mutate({ id: alert.id, tags: next })
                  }}
                  onSaveNote={(note) => triage.mutate({ id: alert.id, note })}
              triagePending={triage.isPending && triage.variables?.id === alert.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertCard({
  alert,
  expanded,
  onToggle,
  onAck,
  ackPending,
  onToggleTag,
  onSaveNote,
  triagePending,
}: {
  alert: Alert
  expanded: boolean
  onToggle: () => void
  onAck: (v: boolean) => void
  ackPending?: boolean
  onToggleTag: (tag: string, active: boolean) => void
  onSaveNote: (note: string) => void
  triagePending?: boolean
}) {
  const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.info
  const [showNote, setShowNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(alert.note ?? '')

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-slate-900/40 transition ${
        alert.acknowledged ? 'border-slate-800 opacity-60' : 'border-slate-700'
      }`}
    >
      {/* Header — always visible */}
      <button onClick={onToggle} className="flex w-full items-center gap-4 px-5 py-4 text-left">
        {/* Score gauge */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#1e293b" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              className={
                alert.severity === 'critical'
                  ? 'text-red-400'
                  : alert.severity === 'high'
                    ? 'text-orange-400'
                    : alert.severity === 'medium'
                      ? 'text-amber-400'
                      : 'text-sky-400'
              }
              strokeWidth="3"
              strokeDasharray={`${(alert.score / 100) * 94.2} 94.2`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-xs font-bold text-slate-200">{alert.score}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${style.badge}`}>
              {style.label}
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-slate-700">
              {RULE_LABELS[alert.rule_name] ?? alert.rule_name}
            </span>
            {alert.acknowledged && (
              <span className="text-[10px] text-slate-500">acknowledged</span>
            )}
          </div>
          <div className="mt-1 truncate text-sm font-medium text-slate-200">{alert.title}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {alert.timestamp != null && formatTime(alert.timestamp)}
            {alert.source_ip && ` · source ${alert.source_ip}`}
          </div>
        </div>

        <span className="shrink-0 text-slate-500">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded evidence */}
      {expanded && (
        <div className="border-t border-slate-800 bg-slate-950/40 px-5 py-4">
          {/* Host / destination */}
          <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Host</div>
              <div className="mt-0.5 font-mono text-slate-200">{alert.source_ip ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                Destination
              </div>
              <div className="mt-0.5 font-mono text-slate-200">
                {alert.destination_ip ?? '—'}
                {alert.destination_port ? `:${alert.destination_port}` : ''}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Risk</div>
              <div className="mt-0.5 font-semibold text-slate-200">{alert.score}/100</div>
            </div>
          </div>

          {/* Reasons */}
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
              Reasons
            </div>
            <div className="space-y-1">
              {alert.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <span className="text-slate-300">
                    {r.reason}
                    <span className="ml-2 text-xs text-slate-500">{r.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence JSON */}
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
              Evidence
            </div>
            <pre className="max-h-40 overflow-auto rounded-lg bg-slate-900/80 p-3 font-mono text-xs text-slate-400 ring-1 ring-slate-800">
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </div>

          {/* Explanation */}
          {alert.explanation && (
            <div className="mb-4 rounded-lg border-l-2 border-slate-600 bg-slate-900/60 p-3 text-sm leading-relaxed text-slate-300">
              {alert.explanation}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAck(!alert.acknowledged)
              }}
              disabled={ackPending}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition ${
                ackPending
                  ? 'cursor-wait bg-slate-800/50 text-slate-500 ring-slate-700'
                  : alert.acknowledged
                    ? 'bg-slate-800 text-slate-400 ring-slate-700 hover:text-slate-200'
                    : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              {ackPending
                ? 'Saving…'
                : alert.acknowledged
                  ? 'Un-acknowledge'
                  : '✓ Acknowledge'}
            </button>

            {/* Triage tags */}
            {(['confirmed', 'false-positive', 'escalated'] as const).map((tag) => {
              const active = alert.tags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleTag(tag, active)
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs ring-1 transition ${
                    active
                      ? tag === 'confirmed'
                        ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                        : tag === 'false-positive'
                          ? 'bg-slate-500/10 text-slate-300 ring-slate-500/30'
                          : 'bg-red-500/10 text-red-300 ring-red-500/30'
                      : 'text-slate-500 ring-slate-700 hover:text-slate-300'
                  }`}
                >
                  {tag}
                </button>
              )
            })}

            {/* Deep link: jump to first related flow's evidence */}
            {alert.related_flow_ids.length > 0 && (
              <a
                href={`/flows?capture_id=${alert.capture_id}&flow=${alert.related_flow_ids[0]}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg px-3 py-1.5 text-xs text-sky-400 ring-1 ring-sky-500/30 transition hover:bg-sky-500/10"
              >
                {alert.related_flow_ids.length} related flow{alert.related_flow_ids.length > 1 ? 's' : ''} →
                view evidence
              </a>
            )}

            {/* Analyst note */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowNote(!showNote)
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500 ring-1 ring-slate-700 transition hover:text-slate-300"
            >
              {alert.note ? '✎ edit note' : '+ note'}
            </button>
          </div>

          {/* Note editor */}
          {showNote && (
            <div className="mt-3">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Analyst note — e.g. 'checked with John, this server is legit'"
                aria-label="Analyst note"
                rows={2}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none"
              />
              <div className="mt-1.5 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSaveNote(noteDraft)
                    setShowNote(false)
                  }}
                  disabled={triagePending}
                  className="rounded-lg bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {triagePending ? 'Saving…' : 'Save note'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowNote(false)
                  }}
                  className="rounded-lg px-3 py-1 text-xs text-slate-400 ring-1 ring-slate-700 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Saved note display */}
          {alert.note && !showNote && (
            <div className="mt-3 rounded-lg border-l-2 border-emerald-500/50 bg-slate-900/60 p-2.5 text-sm text-slate-300">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Note</span>{' '}
              {alert.note}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
