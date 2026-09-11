import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { StatusPill, formatBytes, formatDuration } from '../components/ui'
import { useCaptures } from '../hooks/captures'
import type { Capture } from '../types/api'

export function Dashboard() {
  const navigate = useNavigate()
  const { data: captures, isLoading } = useCaptures()

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.listJobs,
    refetchInterval: (q) => {
      const active = q.state.data?.some((j) => j.status === 'running' || j.status === 'queued')
      return active ? 1500 : 15000
    },
  })

  const completed = captures?.filter((c) => c.status === 'completed') ?? []
  const totalPackets = completed.reduce((acc, c) => acc + c.packet_count, 0)
  const activeJob = jobs?.find((j) => j.status === 'running' || j.status === 'queued')
  const lastFlowSummary = completed[completed.length - 1]?.summary?.flow_summary ?? null
  const alertSummary = completed[completed.length - 1]?.summary?.alert_summary ?? null

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Here is what happened — with the network evidence behind it.
          </p>
        </div>
        <Link
          to="/capture"
          className="rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/20"
        >
          + Upload PCAP
        </Link>
      </div>

      {/* Top statistics */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Captures" value={captures?.length ?? 0} />
        <StatCard label="Analyzed" value={completed.length} tone="emerald" />
        <StatCard label="Total Packets" value={totalPackets.toLocaleString()} />
        <StatCard
          label="Active Jobs"
          value={activeJob ? 1 : 0}
          tone={activeJob ? 'amber' : undefined}
        />
      </div>

      {/* Active job banner */}
      {activeJob && (
        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-amber-300">
              Analysis in progress — {activeJob.stage}
            </span>
            <span className="text-amber-400">{activeJob.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${activeJob.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Flow summary (Step 2) */}
      {lastFlowSummary && (
        <div className="mt-4 grid grid-cols-6 gap-4">
          <FlowStat label="Flows" value={lastFlowSummary.flow_count ?? 0} />
          <FlowStat label="TCP" value={lastFlowSummary.tcp_flows ?? 0} />
          <FlowStat label="UDP" value={lastFlowSummary.udp_flows ?? 0} />
          <FlowStat
            label="Failed"
            value={lastFlowSummary.failed_flows ?? 0}
            tone="red"
          />
          <FlowStat
            label="Resets"
            value={lastFlowSummary.reset_flows ?? 0}
            tone="red"
          />
          <FlowStat
            label="Retransmitting"
            value={lastFlowSummary.retransmitting_flows ?? 0}
            tone="amber"
          />
        </div>
      )}

      {/* Alerts strip (Step 4) */}
      {alertSummary && alertSummary.total > 0 && (
        <button
          onClick={() => navigate('/alerts')}
          className="mt-4 flex w-full items-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-left transition hover:bg-red-500/10"
        >
          
          <div className="flex-1">
            <div className="text-sm font-medium text-red-300">
              {alertSummary.total} alert{alertSummary.total > 1 ? 's' : ''} — max risk score{' '}
              {alertSummary.max_score}
            </div>
            <div className="mt-1 flex gap-2 text-xs">
              {Object.entries(alertSummary.by_severity)
                .filter(([, n]) => n > 0)
                .map(([sev, n]) => (
                  <span key={sev} className="rounded bg-slate-800/60 px-2 py-0.5 text-slate-400">
                    {sev}: {n}
                  </span>
                ))}
            </div>
          </div>
          <span className="text-xs text-red-300">view alerts →</span>
        </button>
      )}

      {/* Captures table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-300">
          Recent Captures
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : !captures?.length ? (
          <EmptyState />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5">File</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Packets</th>
                <th className="px-4 py-2.5">Size</th>
                <th className="px-4 py-2.5">Duration</th>
                <th className="px-4 py-2.5">Parser</th>
                <th className="px-4 py-2.5">Progress</th>
              </tr>
            </thead>
            <tbody>
              {captures.map((c) => (
                <CaptureRow key={c.id} capture={c} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function CaptureRow({ capture }: { capture: Capture }) {
  return (
    <tr className="border-t border-slate-800/60 hover:bg-slate-800/30">
      <td className="px-4 py-2.5 font-medium text-slate-200">{capture.filename}</td>
      <td className="px-4 py-2.5">
        <StatusPill status={capture.status} />
      </td>
      <td className="px-4 py-2.5 text-slate-400">{capture.packet_count.toLocaleString()}</td>
      <td className="px-4 py-2.5 text-slate-400">{formatBytes(capture.size_bytes)}</td>
      <td className="px-4 py-2.5 text-slate-400">
        {formatDuration(capture.first_packet_ts, capture.last_packet_ts)}
      </td>
      <td className="px-4 py-2.5 text-slate-400">{capture.parser_used ?? '—'}</td>
      <td className="w-32 px-4 py-2.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${
              capture.status === 'failed' ? 'bg-red-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${capture.analysis_progress}%` }}
          />
        </div>
      </td>
    </tr>
  )
}

function FlowStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div
        className={`mt-1 text-xl font-semibold ${
          tone === 'red' ? 'text-red-400' : tone === 'amber' ? 'text-amber-400' : 'text-slate-100'
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: 'emerald' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            tone === 'emerald' ? 'bg-emerald-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-sky-400'
          }`}
        />
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-100">{value}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 p-12">
      <div className="h-10 w-10 rounded-full border-2 border-dashed border-slate-700" />
      <p className="text-sm text-slate-500">No captures yet.</p>
      <Link
        to="/capture"
        className="rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20"
      >
        Upload your first PCAP
      </Link>
    </div>
  )
}
