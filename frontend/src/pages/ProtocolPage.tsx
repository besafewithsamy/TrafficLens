import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { formatBytes, formatTime } from '../components/ui'
import type { ProtocolStats } from '../types/api'

type Tab = 'dns' | 'http' | 'tls'

export function ProtocolPage() {
  const [captureId, setCaptureId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dns')

  const { data: captures } = useQuery({
    queryKey: ['captures'],
    queryFn: api.listCaptures,
    refetchInterval: 5000,
  })
  const analyzed = (captures ?? []).filter((c) => c.status === 'completed')
  const effectiveCaptureId = captureId ?? analyzed[0]?.id ?? null

  const { data: stats } = useQuery({
    queryKey: ['protocolStats', effectiveCaptureId],
    queryFn: () => api.protocolStats(effectiveCaptureId!),
    enabled: !!effectiveCaptureId,
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-100">Protocol Explorer</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        What is each protocol doing — not which fields live in a packet.
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
        {(['dns', 'http', 'tls'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 font-medium uppercase tracking-wide ring-1 transition ${
              tab === t
                ? 'bg-violet-500/10 text-violet-300 ring-violet-500/30'
                : 'text-slate-400 ring-slate-700 hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!analyzed.length ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          No analyzed captures yet.
        </div>
      ) : (
        <>
          {/* Protocol overview stats */}
          {stats && tab === 'dns' && <DnsStats stats={stats.dns} />}
          {stats && tab === 'http' && <HttpStats stats={stats.http} />}
          {tab === 'dns' && effectiveCaptureId && <DnsTable captureId={effectiveCaptureId} />}
          {tab === 'http' && effectiveCaptureId && <HttpTable captureId={effectiveCaptureId} />}
          {tab === 'tls' && effectiveCaptureId && <TlsTable captureId={effectiveCaptureId} />}
        </>
      )}
    </div>
  )
}

// ---------------- DNS ----------------

function DnsStats({ stats }: { stats: ProtocolStats['dns'] }) {
  return (
    <div className="mb-4 grid grid-cols-5 gap-4">
      <StatBox label="Transactions" value={stats.transactions} />
      <StatBox label="Unique Domains" value={stats.unique_domains} />
      <StatBox
        label="NXDOMAIN"
        value={stats.nxdomain_count}
        tone={stats.nxdomain_count > 0 ? 'red' : undefined}
      />
      <StatBox
        label="NXDOMAIN Rate"
        value={stats.nxdomain_rate ? `${(stats.nxdomain_rate * 100).toFixed(0)}%` : '0%'}
        tone={stats.nxdomain_rate > 0.2 ? 'red' : undefined}
      />
      <StatBox
        label="Avg Latency"
        value={stats.avg_latency != null ? `${(stats.avg_latency * 1000).toFixed(1)} ms` : '—'}
      />
    </div>
  )
}

function DnsTable({ captureId }: { captureId: string }) {
  const [domain, setDomain] = useState('')
  const [nxdomainOnly, setNxdomainOnly] = useState(false)

  const { data: txns, isLoading } = useQuery({
    queryKey: ['dns', captureId, domain, nxdomainOnly],
    queryFn: () => api.listDns(captureId, { domain: domain || undefined, rcode: nxdomainOnly ? 3 : undefined }),
  })

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-sm">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="filter by domain…"
          className="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
        />
        <button
          onClick={() => setNxdomainOnly(!nxdomainOnly)}
          className={`rounded-lg px-3 py-1.5 ring-1 transition ${
            nxdomainOnly
              ? 'bg-red-500/10 text-red-300 ring-red-500/30'
              : 'text-slate-400 ring-slate-700 hover:text-slate-200'
          }`}
        >
          NXDOMAIN only
        </button>
      </div>
      <TableShell count={txns?.length ?? 0} headers={['Time', 'Client', 'Query', 'Type', 'Answers', 'RCode', 'Latency']} loading={isLoading}>
        {(txns ?? []).slice(0, 200).map((t) => (
          <tr key={t.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
            <Td className="font-mono text-xs text-slate-500">{formatTime(t.timestamp)}</Td>
            <Td className="font-mono text-xs">{t.client_ip}</Td>
            <Td className="max-w-[280px] truncate font-mono text-xs text-slate-200">
              {t.query_name}
            </Td>
            <Td className="text-xs text-slate-400">{t.query_type === '1' ? 'A' : t.query_type}</Td>
            <Td className="font-mono text-xs text-emerald-400/80">
              {t.response_ips.length ? t.response_ips.join(', ') : '—'}
            </Td>
            <Td>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  t.rcode === 0
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : t.rcode === 3
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {t.rcode === 0 ? 'NOERROR' : t.rcode === 3 ? 'NXDOMAIN' : `RC${t.rcode}`}
              </span>
            </Td>
            <Td className="text-xs text-slate-400">
              {t.latency != null ? `${(t.latency * 1000).toFixed(1)} ms` : '—'}
            </Td>
          </tr>
        ))}
      </TableShell>
    </div>
  )
}

// ---------------- HTTP ----------------

function HttpStats({ stats }: { stats: { transactions: number; status_codes: Record<string, number>; methods: Record<string, number>; total_request_bytes: number; total_response_bytes: number } }) {
  return (
    <div className="mb-4 grid grid-cols-5 gap-4">
      <StatBox label="Transactions" value={stats.transactions} />
      <StatBox label="Methods" value={Object.keys(stats.methods).join(', ') || '—'} />
      <StatBox
        label="Errors (4xx/5xx)"
        value={
          Object.entries(stats.status_codes)
            .filter(([s]) => Number(s) >= 400)
            .reduce((a, [, c]) => a + c, 0)
        }
        tone="amber"
      />
      <StatBox label="Request Bytes" value={formatBytes(stats.total_request_bytes)} />
      <StatBox label="Response Bytes" value={formatBytes(stats.total_response_bytes)} />
    </div>
  )
}

function HttpTable({ captureId }: { captureId: string }) {
  const [hostFilter, setHostFilter] = useState('')
  const { data: txns, isLoading } = useQuery({
    queryKey: ['http', captureId, hostFilter],
    queryFn: () => api.listHttp(captureId, { host: hostFilter || undefined }),
  })

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-sm">
        <input
          value={hostFilter}
          onChange={(e) => setHostFilter(e.target.value)}
          placeholder="filter by host header…"
          className="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
        />
      </div>
      <TableShell count={txns?.length ?? 0} headers={['Time', 'Method', 'Host', 'Path', 'Status', 'UA', 'Size']} loading={isLoading}>
        {(txns ?? []).slice(0, 200).map((t) => (
          <tr key={t.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
            <Td className="font-mono text-xs text-slate-500">{formatTime(t.timestamp)}</Td>
            <Td className="text-xs font-bold text-sky-400">{t.method ?? '—'}</Td>
            <Td className="font-mono text-xs text-slate-200">{t.host ?? '—'}</Td>
            <Td className="max-w-[160px] truncate font-mono text-xs text-slate-400">
              {t.path ?? '—'}
            </Td>
            <Td>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  t.status_code != null && t.status_code < 400
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {t.status_code ?? '?'}
              </span>
            </Td>
            <Td className="max-w-[180px] truncate text-xs text-slate-500">
              {t.user_agent ?? '—'}
            </Td>
            <Td className="text-xs text-slate-400">
              {formatBytes(t.request_len)} / {formatBytes(t.response_len)}
            </Td>
          </tr>
        ))}
      </TableShell>
    </div>
  )
}

// ---------------- TLS ----------------

function TlsTable({ captureId }: { captureId: string }) {
  const [sniFilter, setSniFilter] = useState('')
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['tls', captureId, sniFilter],
    queryFn: () => api.listTls(captureId, { sni: sniFilter || undefined }),
  })

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-sm">
        <input
          value={sniFilter}
          onChange={(e) => setSniFilter(e.target.value)}
          placeholder="filter by SNI…"
          className="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
        />
      </div>
      <TableShell count={sessions?.length ?? 0} headers={['First Seen', 'Client', 'Server', 'SNI', 'Bytes', 'Packets']} loading={isLoading}>
        {(sessions ?? []).map((s) => (
          <tr key={s.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
            <Td className="font-mono text-xs text-slate-500">{formatTime(s.first_seen)}</Td>
            <Td className="font-mono text-xs">{s.client_ip}</Td>
            <Td className="font-mono text-xs">
              {s.server_ip}
              <span className="text-slate-500">:{s.server_port}</span>
            </Td>
            <Td className="font-mono text-xs text-violet-300">{s.sni ?? '— (encrypted/no SNI)'}</Td>
            <Td className="text-xs text-slate-400">{formatBytes(s.bytes)}</Td>
            <Td className="text-xs text-slate-400">{s.packets}</Td>
          </tr>
        ))}
      </TableShell>
    </div>
  )
}

// ---------------- shared bits ----------------

function StatBox({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: 'red' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold ${
          tone === 'red' ? 'text-red-400' : tone === 'amber' ? 'text-amber-400' : 'text-slate-100'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function TableShell({
  headers,
  count,
  loading,
  children,
}: {
  headers: string[]
  count: number
  loading?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="border-b border-slate-800 px-4 py-3 text-sm text-slate-400">
        {loading ? 'Loading…' : `${count.toLocaleString()} records`}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              {headers.map((h) => (
                <th key={h} className="px-4 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 text-slate-300 ${className}`}>{children}</td>
}
