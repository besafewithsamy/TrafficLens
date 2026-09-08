import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { formatBytes } from '../components/ui'
import type { EngineerIssue } from '../types/api'

const HEALTH_STYLE: Record<string, { label: string; cls: string }> = {
  healthy: { label: 'HEALTHY', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30' },
  warning: { label: 'WARNING', cls: 'bg-amber-500/10 text-amber-400 ring-amber-500/30' },
  degraded: { label: 'DEGRADED', cls: 'bg-red-500/10 text-red-400 ring-red-500/30' },
}

const ISSUE_SEV: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-sky-400',
  info: 'text-slate-400',
}

const PROTOCOL_COLORS = [
  '#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f87171',
  '#22d3ee', '#c084fc', '#4ade80', '#fb923c', '#94a3b8',
]

export function EngineerPage() {
  const [captureId, setCaptureId] = useState<string | null>(null)

  const { data: captures } = useQuery({
    queryKey: ['captures'],
    queryFn: api.listCaptures,
    refetchInterval: 5000,
  })
  const analyzed = (captures ?? []).filter((c) => c.status === 'completed')
  const effectiveCaptureId = captureId ?? analyzed[0]?.id ?? null

  const { data: m, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['engineer', effectiveCaptureId],
    queryFn: () => api.getEngineerMetrics(effectiveCaptureId!),
    enabled: !!effectiveCaptureId,
  })

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Engineer Mode</h1>
          <p className="mt-1 text-sm text-slate-500">
            Network health — throughput, reliability, latency. Not security.
          </p>
        </div>
        {m && (
          <span
            className={`ml-auto rounded-lg px-4 py-1.5 text-sm font-bold ring-1 ${
              (HEALTH_STYLE[m.health] ?? HEALTH_STYLE.healthy).cls
            }`}
          >
            {(HEALTH_STYLE[m.health] ?? HEALTH_STYLE.healthy).label}
          </span>
        )}
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
      </div>

      {!analyzed.length ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          No analyzed captures yet.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          Computing network health…
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-12">
          <div className="text-sm text-red-400">⚠ {String(error)}</div>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      ) : !m ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          No metrics available.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Health issues */}
          {m.issues.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Detected issues
              </div>
              <div className="space-y-1.5">
                {m.issues.map((i: EngineerIssue, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <span className={`font-bold ${ISSUE_SEV[i.severity] ?? 'text-slate-400'}`}>
                      ●
                    </span>
                    <span className="text-slate-300">{i.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top stats */}
          <div className="grid grid-cols-6 gap-4">
            <Metric label="Duration" value={`${m.capture_duration_s.toFixed(1)}s`} />
            <Metric label="Packets" value={m.total_packets.toLocaleString()} />
            <Metric label="Avg pps" value={m.avg_pps.toFixed(1)} />
            <Metric label="Peak pps" value={m.peak_pps.toFixed(0)} />
            <Metric label="Avg bandwidth" value={formatBps(m.avg_bandwidth_bps)} />
            <Metric label="Peak bandwidth" value={formatBps(m.peak_bandwidth_bps)} />
          </div>

          {/* TCP + DNS health */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                TCP reliability
              </div>
              <div className="space-y-2 text-sm">
                <HealthRow
                  label="Flows"
                  value={m.tcp.flows.toLocaleString()}
                  bad={false}
                />
                <HealthRow
                  label="Retransmissions"
                  value={`${m.tcp.retransmissions} (${(m.tcp.retransmission_ratio * 100).toFixed(1)}%)`}
                  bad={m.tcp.retransmission_ratio > 0.05}
                />
                <HealthRow
                  label="SYN retransmissions"
                  value={String(m.tcp.syn_retransmissions)}
                  bad={m.tcp.syn_retransmissions > 0}
                />
                <HealthRow
                  label="Resets"
                  value={`${m.tcp.resets} (${(m.tcp.reset_ratio * 100).toFixed(0)}%)`}
                  bad={m.tcp.reset_ratio > 0.1}
                />
                <HealthRow
                  label="Failed connections"
                  value={`${m.tcp.failed_flows} (${(m.tcp.failure_ratio * 100).toFixed(0)}%)`}
                  bad={m.tcp.failure_ratio > 0.5}
                />
                <HealthRow
                  label="One-way flows"
                  value={String(m.tcp.one_way_flows)}
                  bad={m.tcp.one_way_flows > 5}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                DNS health
              </div>
              <div className="space-y-2 text-sm">
                <HealthRow label="Transactions" value={String(m.dns.transactions)} bad={false} />
                <HealthRow
                  label="Avg latency"
                  value={m.dns.avg_latency_ms != null ? `${m.dns.avg_latency_ms} ms` : '—'}
                  bad={(m.dns.avg_latency_ms ?? 0) > 500}
                />
                <HealthRow
                  label="P95 latency"
                  value={m.dns.p95_latency_ms != null ? `${m.dns.p95_latency_ms} ms` : '—'}
                  bad={(m.dns.p95_latency_ms ?? 0) > 1000}
                />
                <HealthRow
                  label="NXDOMAIN rate"
                  value={`${(m.dns.nxdomain_rate * 100).toFixed(0)}%`}
                  bad={m.dns.nxdomain_rate > 0.3}
                />
                <div className="mt-4 border-t border-slate-800 pt-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                  MTU
                </div>
                <HealthRow
                  label="Max packet size"
                  value={`${m.max_packet_size} B`}
                  bad={m.mtu_boundary_packets > 0}
                />
                <HealthRow
                  label="Boundary packets"
                  value={String(m.mtu_boundary_packets)}
                  bad={m.mtu_boundary_packets > 0}
                />
              </div>
            </div>
          </div>

          {/* Throughput charts */}
          <div className="grid grid-cols-2 gap-4">
            <ChartCard title="Packets / sec">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={m.timeseries.pps}>
                  <defs>
                    <linearGradient id="ppsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke="#475569" fontSize={10} unit="s" />
                  <YAxis stroke="#475569" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pps"
                    stroke="#38bdf8"
                    fill="url(#ppsGrad)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Bandwidth (bps)">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={m.timeseries.bandwidth}>
                  <defs>
                    <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke="#475569" fontSize={10} unit="s" />
                  <YAxis stroke="#475569" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="bps"
                    stroke="#34d399"
                    fill="url(#bwGrad)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Protocol distribution + top talkers */}
          <div className="grid grid-cols-2 gap-4">
            <ChartCard title="Protocol distribution">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={Object.entries(m.protocol_distribution).map(([name, count]) => ({ name, count }))}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} />
                  <YAxis stroke="#475569" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {Object.entries(m.protocol_distribution).map((_, i) => (
                      <Cell key={i} fill={PROTOCOL_COLORS[i % PROTOCOL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                Top talkers
              </div>
              <div className="space-y-1.5">
                {m.top_talkers.slice(0, 8).map((t) => {
                  const max = m.top_talkers[0]?.sent_bytes || 1
                  return (
                    <div key={t.ip} className="flex items-center gap-3 text-xs">
                      <span className="w-28 truncate font-mono text-slate-300">{t.ip}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
                        <div
                          className="h-full rounded bg-sky-500/60"
                          style={{ width: `${(t.sent_bytes / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-slate-500">
                        {formatBytes(t.sent_bytes)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-100">{value}</div>
    </div>
  )
}

function HealthRow({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono ${bad ? 'text-red-400' : 'text-slate-200'}`}>{value}</span>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
        {title}
      </div>
      {children}
    </div>
  )
}

function formatBps(bps: number): string {
  if (bps > 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`
  if (bps > 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`
  if (bps > 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`
  return `${bps.toFixed(0)} bps`
}
