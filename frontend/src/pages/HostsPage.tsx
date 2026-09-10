import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { CapturePicker } from '../components/CapturePicker'
import { formatBytes, formatTime } from '../components/ui'
import { useSelectedCapture } from '../hooks/captures'
import type { Host } from '../types/api'

export function HostsPage() {
  const { analyzed, effectiveCaptureId, setCaptureId } = useSelectedCapture()
  const [internalFilter, setInternalFilter] = useState<'' | 'true' | 'false'>('')
  const [selectedHost, setSelectedHost] = useState<Host | null>(null)

  const { data: hosts, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hosts', effectiveCaptureId, internalFilter],
    queryFn: () =>
      api.listHosts(effectiveCaptureId!, internalFilter ? internalFilter === 'true' : undefined),
    enabled: !!effectiveCaptureId,
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-100">Hosts</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Host-centric investigation — every host with its services, peers, and behavior.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <CapturePicker captures={analyzed} value={effectiveCaptureId} onChange={setCaptureId} />
        {[
          { v: '', l: 'All' },
          { v: 'true', l: 'Internal' },
          { v: 'false', l: 'External' },
        ].map(({ v, l }) => (
          <button
            key={v}
            onClick={() => setInternalFilter(v as '' | 'true' | 'false')}
            className={`rounded-lg px-3 py-1.5 ring-1 transition ${
              internalFilter === v
                ? 'bg-sky-500/10 text-sky-300 ring-sky-500/30'
                : 'text-slate-400 ring-slate-700 hover:text-slate-200'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {!analyzed.length ? (
        <EmptyState text="No analyzed captures yet." />
      ) : isLoading ? (
        <EmptyState text="Profiling hosts…" />
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
      ) : !hosts?.length ? (
        <EmptyState text="No hosts match the current filter." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {hosts.map((h) => (
            <HostCard key={h.id} host={h} onClick={() => setSelectedHost(h)} />
          ))}
        </div>
      )}

      {selectedHost && <HostDetailModal host={selectedHost} onClose={() => setSelectedHost(null)} />}
    </div>
  )
}

function HostCard({ host, onClick }: { host: Host; onClick: () => void }) {
  const totalBytes = host.bytes_sent + host.bytes_received
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-slate-600 hover:bg-slate-900/70"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-100">{host.ip}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
                host.is_internal
                  ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
                  : 'bg-sky-500/10 text-sky-400 ring-sky-500/30'
              }`}
            >
              {host.is_internal ? 'internal' : 'external'}
            </span>
          </div>
          {host.hostname && (
            <div className="mt-0.5 text-xs text-slate-500">{host.hostname}</div>
          )}
        </div>
        {host.role && (
          <span className="rounded-lg bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/30">
            {host.role}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-400">
        <span>
          ↑ {formatBytes(host.bytes_sent)} · {host.packets_sent} pkt
        </span>
        <span>
          ↓ {formatBytes(host.bytes_received)} · {host.packets_received} pkt
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {host.services.slice(0, 4).map((s) => (
          <span
            key={s.port}
            className="rounded bg-slate-800/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 ring-1 ring-slate-700"
          >
            {s.port}/{s.service}
          </span>
        ))}
        {host.services.length > 4 && (
          <span className="text-[10px] text-slate-500">+{host.services.length - 4} more</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600">
        <span>{formatTime(host.first_seen)} → {formatTime(host.last_seen)}</span>
        <span>{totalBytes > 0 ? formatBytes(totalBytes) : '—'}</span>
      </div>
    </button>
  )
}

function HostDetailModal({ host, onClose }: { host: Host; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
          <div>
            <div className="font-mono text-lg font-semibold text-slate-100">{host.ip}</div>
            <div className="text-xs text-slate-500">
              {host.hostname ? `${host.hostname} · ` : ''}
              {host.role ?? 'no role inferred'} · {host.mac ?? 'no MAC'}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>

        <div className="space-y-6 p-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 text-sm">
            <MiniStat label="Sent" value={formatBytes(host.bytes_sent)} />
            <MiniStat label="Received" value={formatBytes(host.bytes_received)} />
            <MiniStat label="Peers" value={host.behavior_summary.unique_peers ?? 0} />
            <MiniStat
              label="Connections"
              value={host.behavior_summary.connections_initiated ?? 0}
            />
          </div>

          {/* Relationship tree (Module A) */}
          {(host.contacted.length > 0 || host.services.length > 0) && (
            <div>
              <SectionTitle>Relationships</SectionTitle>
              <div className="rounded-lg bg-slate-950/60 p-4 font-mono text-xs ring-1 ring-slate-800">
                <div className="text-slate-200">{host.ip}</div>
                {host.services.slice(0, 8).map((s) => (
                  <div key={s.port} className="ml-2 text-slate-400">
                    ├──{' '}
                    <span className="text-emerald-400">LISTENS</span> :{s.port}{' '}
                    <span className="text-slate-500">({s.service})</span>
                  </div>
                ))}
                {host.contacted.slice(0, 10).map((c, i) => (
                  <div key={`${c.ip}-${c.port}`} className="ml-2 text-slate-400">
                    {i === Math.min(host.contacted.length, 10) - 1 ? '└──' : '├──'}{' '}
                    <span className="text-sky-400">{c.app_protocol}</span> → {c.ip}
                    <span className="text-slate-500">:{c.port}</span>{' '}
                    <span className="text-slate-600">
                      {c.packets} pkt · {formatBytes(c.bytes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Protocol distribution */}
          <div>
            <SectionTitle>Protocol activity</SectionTitle>
            <div className="space-y-1.5">
              {Object.entries(host.protocols)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([proto, count]) => {
                  const max = Math.max(...Object.values(host.protocols))
                  return (
                    <div key={proto} className="flex items-center gap-3 text-xs">
                      <span className="w-20 text-right font-mono text-slate-400">{proto}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
                        <div
                          className="h-full rounded bg-sky-500/60"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-slate-500">{count}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-800/40 px-3 py-2 ring-1 ring-slate-800">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-200">{value}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
      {text}
    </div>
  )
}
