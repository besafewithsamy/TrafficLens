import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { StatusPill, formatBytes } from '../components/ui'
import { useCaptures } from '../hooks/captures'
import type { Capture, Job } from '../types/api'

export function CapturePage() {
  const [selectedCapture, setSelectedCapture] = useState<Capture | null>(null)
  const [parser, setParser] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [liveJob, setLiveJob] = useState<Job | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { data: parsers } = useQuery({ queryKey: ['parsers'], queryFn: api.parsers })
  const { data: captures } = useCaptures()

  const upload = useMutation({
    mutationFn: api.uploadCapture,
    onSuccess: async (capture) => {
      setUploadError(null)
      setSelectedCapture(capture)
      await queryClient.invalidateQueries({ queryKey: ['captures'] })
    },
    onError: (err) => setUploadError(err.message),
  })

  const analyze = useMutation({
    mutationFn: (captureId: string) => api.analyzeCapture(captureId, parser || undefined),
    onSuccess: (job) => {
      setLiveJob(job)
      queryClient.invalidateQueries({ queryKey: ['captures'] })
    },
  })

  // SSE live progress for the running job (falls back to captures polling)
  useEffect(() => {
    if (!liveJob || liveJob.status === 'completed' || liveJob.status === 'failed') return
    const unsubscribe = api.streamJob(
      liveJob.id,
      (job) => setLiveJob(job),
      () => queryClient.invalidateQueries({ queryKey: ['captures'] }),
    )
    return unsubscribe
  }, [liveJob, queryClient])

  // Selected capture status from the shared captures list (post-refresh source of truth)
  const captureRow = captures?.find((c) => c.id === selectedCapture?.id) ?? null
  const current =
    liveJob && (liveJob.status === 'running' || liveJob.status === 'queued')
      ? {
          ...(captureRow ?? selectedCapture ?? undefined),
          status: 'analyzing' as const,
          analysis_progress:
            liveJob.status === 'running' ? Math.max(1, Math.round(liveJob.progress)) : 1,
        }
      : (captureRow ?? selectedCapture)
  const busy = upload.isPending || analyze.isPending

  const protocolRows = useMemo(() => {
    const summary = current?.summary?.protocol_counts
    if (!summary) return []
    const max = Math.max(...Object.values(summary))
    return Object.entries(summary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count, pct: (count / max) * 100 }))
  }, [current])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-100">Capture</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Upload a PCAP/PCAPNG, start a background analysis, and watch the pipeline work.
      </p>

      {/* Upload zone */}
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="text-3xl text-slate-600">⇪</div>
          <p className="text-sm text-slate-400">
            Drop or select a capture file (<span className="text-slate-300">.pcap</span>,{' '}
            <span className="text-slate-300">.pcapng</span>)
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pcap,.pcapng,.cap"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload.mutate(f)
              e.target.value = ''
            }}
          />
          <button
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-emerald-500/10 px-5 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {upload.isPending ? 'Uploading…' : 'Select PCAP file'}
          </button>
          {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
        </div>
      </div>

      {/* Parser selection */}
      <div className="mt-6 flex items-center gap-3 text-sm">
        <span className="text-slate-500">Parser:</span>
        {['', 'scapy', 'tshark']
          .filter((p) => p !== 'tshark' || parsers?.tshark)
          .map((p) => (
            <button
              key={p}
              onClick={() => setParser(p)}
              className={`rounded-lg px-3 py-1.5 ring-1 transition ${
                parser === p
                  ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                  : 'text-slate-400 ring-slate-700 hover:text-slate-200'
              }`}
              title={p === '' ? 'Automatic (Scapy default)' : `${p} parser`}
            >
              {p === '' ? 'Auto' : p}
            </button>
          ))}
        {parsers && (
          <span className="ml-2 text-xs text-slate-600">
            available: {Object.entries(parsers).filter(([, v]) => v).map(([k]) => k).join(', ')}
          </span>
        )}
      </div>

      {/* Selected capture detail */}
      {current && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-800 px-5 py-4">
            <div className="flex-1">
              <div className="font-medium text-slate-200">{current.filename}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {formatBytes(current.size_bytes ?? 0)} ·{' '}
                {(current.packet_count ?? 0).toLocaleString()} packets
                {current.parser_used && ` · parsed by ${current.parser_used}`}
              </div>
            </div>
            <StatusPill status={current.status} />
            {current.status === 'created' && (
              <button
                disabled={analyze.isPending}
                onClick={() => analyze.mutate(current.id)}
                className="rounded-lg bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {analyze.isPending ? 'Starting…' : '▶ Analyze'}
              </button>
            )}
            {(current.status === 'analyzing' || current.status === 'queued') && (
              <span className="text-sm text-amber-400">Analysis running…</span>
            )}
          </div>

          {/* Progress */}
          {(current.status === 'analyzing' || current.status === 'queued') && (
            <div className="px-5 py-3">
              <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                <span>
                  {liveJob?.status === 'running' && liveJob.stage
                    ? liveJob.stage
                    : current.status === 'queued'
                      ? 'Queued'
                      : 'Working…'}
                </span>
                <span>{current.analysis_progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${current.analysis_progress}%` }}
                />
              </div>
            </div>
          )}

          {current.status === 'failed' && current.error && (
            <div className="px-5 py-3 text-sm text-red-400">{current.error}</div>
          )}

          {/* Summary results */}
          {current.status === 'completed' && (
            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <SummaryStat label="Packets" value={current.packet_count.toLocaleString()} />
                <SummaryStat
                  label="Source IPs"
                  value={current.summary.unique_source_ips ?? 0}
                />
                <SummaryStat
                  label="Destination IPs"
                  value={current.summary.unique_destination_ips ?? 0}
                />
                <SummaryStat
                  label="Protocols"
                  value={Object.keys(current.summary.protocol_counts ?? {}).length}
                />
              </div>

              {protocolRows.length > 0 && (
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
                    Protocol distribution
                  </div>
                  <div className="space-y-1.5">
                    {protocolRows.map((p) => (
                      <div key={p.name} className="flex items-center gap-3 text-xs">
                        <span className="w-16 text-right font-mono text-slate-400">{p.name}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
                          <div
                            className="h-full rounded bg-sky-500/60"
                            style={{ width: `${p.pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-slate-500">{p.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(current.summary.top_talkers?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
                    Top talkers
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {current.summary.top_talkers!.slice(0, 6).map((t) => (
                      <span
                        key={t.ip}
                        className="rounded-lg bg-slate-800/60 px-3 py-1.5 font-mono text-xs text-slate-300 ring-1 ring-slate-700"
                      >
                        {t.ip}
                        <span className="ml-2 text-slate-500">{t.packets} pkt</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Existing captures */}
      {captures && captures.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-300">
            All captures
          </div>
          <div className="divide-y divide-slate-800/60">
            {captures.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCapture(c)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-slate-800/30 ${
                  current?.id === c.id ? 'bg-emerald-500/5' : ''
                }`}
              >
                <span className="font-medium text-slate-300">{c.filename}</span>
                <StatusPill status={c.status} />
                <span className="ml-auto text-xs text-slate-500">
                  {c.packet_count.toLocaleString()} pkt · {formatBytes(c.size_bytes)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-800/40 px-3 py-2.5 ring-1 ring-slate-800">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-200">{value}</div>
    </div>
  )
}
