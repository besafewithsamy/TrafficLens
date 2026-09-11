import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { api } from '../api/client'
import { CapturePicker } from '../components/CapturePicker'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState, Pagination } from '../components/states'
import { formatBytes, formatTime } from '../components/ui'
import { useSelectedCapture } from '../hooks/captures'
import type { Flow, PacketEvidence } from '../types/api'

const BADGE: Record<string, string> = {
  established: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
  half_open: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
  closed: 'bg-slate-500/10 text-slate-400 ring-slate-500/30',
  reset: 'bg-red-500/10 text-red-400 ring-red-500/30',
}

const DIR_LABEL: Record<string, string> = {
  outbound: '→ out',
  inbound: '← in',
  internal: '↔ int',
  unknown: '?',
}

const PAGE_SIZE = 50

export function FlowsPage() {
  const { analyzed, effectiveCaptureId, setCaptureId } = useSelectedCapture()
  const [transport, setTransport] = useState('')
  const [direction, setDirection] = useState('')
  const [offset, setOffset] = useState(0)
  const [sort, setSort] = useState('first_seen')
  const [order, setOrder] = useState('asc')
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)

  // Deep links: /flows?capture_id=…&flow=… opens that capture + flow's evidence modal
  const [searchParams] = useSearchParams()
  const deepCaptureId = searchParams.get('capture_id')
  const deepFlowId = searchParams.get('flow')
  useEffect(() => {
    if (deepCaptureId) {
      setCaptureId(deepCaptureId)
      setOffset(0)
    }
    if (deepFlowId) setSelectedFlowId(deepFlowId)
    // runs once per navigation; deep-link params stay in the URL harmlessly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepCaptureId, deepFlowId])

  const { data: page, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['flows', effectiveCaptureId, transport, direction, sort, order, offset],
    queryFn: () =>
      api.listFlows(
        effectiveCaptureId!,
        {
          transport: transport || undefined,
          direction: direction || undefined,
          sort,
          order,
        },
        { limit: PAGE_SIZE, offset },
      ),
    enabled: !!effectiveCaptureId,
  })

  const flows = page?.items ?? []

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-100">Flows</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Reconstructed conversations — start from the flow, drill into the packet evidence.
      </p>

      {/* Capture picker + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <CapturePicker captures={analyzed} value={effectiveCaptureId} onChange={(id) => { setCaptureId(id); setOffset(0) }} />
        {['', 'TCP', 'UDP'].map((t) => (
          <button
            key={t}
            onClick={() => { setTransport(t); setOffset(0) }}
            className={`rounded-lg px-3 py-1.5 ring-1 transition ${
              transport === t
                ? 'bg-sky-500/10 text-sky-300 ring-sky-500/30'
                : 'text-slate-400 ring-slate-700 hover:text-slate-200'
            }`}
          >
            {t || 'All'}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-600">direction:</span>
        {['', 'outbound', 'inbound', 'internal'].map((d) => (
          <button
            key={d}
            onClick={() => { setDirection(d); setOffset(0) }}
            className={`rounded-lg px-3 py-1.5 ring-1 transition ${
              direction === d
                ? 'bg-sky-500/10 text-sky-300 ring-sky-500/30'
                : 'text-slate-400 ring-slate-700 hover:text-slate-200'
            }`}
          >
            {d || 'any'}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-600">sort:</span>
        <select
          aria-label="Sort by"
          value={sort}
          onChange={(e) => { setSort(e.target.value); setOffset(0) }}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300"
        >
          <option value="first_seen">first seen</option>
          <option value="bytes">bytes</option>
          <option value="packets">packets</option>
          <option value="duration">duration</option>
        </select>
        <button
          onClick={() => { setOrder(order === 'asc' ? 'desc' : 'asc'); setOffset(0) }}
          className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 ring-1 ring-slate-700 hover:text-slate-200"
        >
          {order === 'asc' ? '↑ asc' : '↓ desc'}
        </button>
      </div>

      {!analyzed.length ? (
        <EmptyState>No analyzed captures yet — upload and analyze a PCAP first.</EmptyState>
      ) : isLoading ? (
        <LoadingState>Reconstructing flows…</LoadingState>
      ) : isError ? (
        <ErrorState message={String(error)} onRetry={() => refetch()} />
      ) : !flows.length ? (
        <EmptyState>No flows match the current filters.</EmptyState>
      ) : (
        <FlowsTable
          flows={flows}
          onSelect={setSelectedFlowId}
          footer={
            page && (
              <Pagination
                offset={page.offset}
                limit={page.limit}
                total={page.total}
                onPageChange={setOffset}
              />
            )
          }
        />
      )}

      {selectedFlowId && (
        <FlowEvidenceModal flowId={selectedFlowId} onClose={() => setSelectedFlowId(null)} />
      )}
    </div>
  )
}

const col = createColumnHelper<Flow>()

function FlowsTable({
  flows,
  onSelect,
  footer,
}: {
  flows: Flow[]
  onSelect: (id: string) => void
  footer?: React.ReactNode
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack column defs are heterogeneously typed
  const columns: ColumnDef<Flow, any>[] = useMemo(
    () => [
      col.accessor('first_seen', {
        header: 'First Seen',
        cell: (c) => <span className="font-mono text-xs text-slate-400">{formatTime(c.getValue())}</span>,
      }),
      col.accessor('source_ip', {
        header: 'Source',
        cell: (c) => (
          <span className="font-mono text-slate-300">
            {c.getValue()}
            <span className="text-slate-500">:{c.row.original.source_port}</span>
          </span>
        ),
      }),
      col.accessor('direction', {
        header: 'Dir',
        cell: (c) => (
          <span className="text-xs text-slate-500">{DIR_LABEL[c.getValue()] ?? '?'}</span>
        ),
      }),
      col.accessor('destination_ip', {
        header: 'Destination',
        cell: (c) => (
          <span className="font-mono text-slate-300">
            {c.getValue()}
            <span className="text-slate-500">:{c.row.original.destination_port}</span>
          </span>
        ),
      }),
      col.accessor('transport_protocol', {
        header: 'Proto',
        cell: (c) => {
          const t = c.getValue()
          const app = c.row.original.application_protocol
          return (
            <span className="flex items-center gap-1.5">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${
                  t === 'TCP'
                    ? 'bg-sky-500/10 text-sky-400 ring-sky-500/30'
                    : 'bg-violet-500/10 text-violet-400 ring-violet-500/30'
                }`}
              >
                {t}
              </span>
              {app && <span className="text-xs text-slate-500">{app}</span>}
            </span>
          )
        },
      }),
      col.accessor('tcp_state', {
        header: 'State',
        cell: (c) => {
          const s = c.getValue()
          if (!s) return <span className="text-xs text-slate-600">—</span>
          return (
            <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${BADGE[s] ?? BADGE.closed}`}>
              {s}
            </span>
          )
        },
      }),
      col.accessor('packets', {
        header: 'Packets',
        cell: (c) => <span className="text-slate-400">{c.getValue().toLocaleString()}</span>,
      }),
      col.accessor('bytes', {
        header: 'Bytes',
        cell: (c) => <span className="text-slate-400">{formatBytes(c.getValue())}</span>,
      }),
      col.accessor('retransmissions', {
        header: 'Retrans',
        cell: (c) =>
          c.getValue() > 0 ? (
            <span className="text-amber-400">{c.getValue()}</span>
          ) : (
            <span className="text-slate-600">0</span>
          ),
      }),
      col.accessor('resets', {
        header: 'Resets',
        cell: (c) =>
          c.getValue() > 0 ? (
            <span className="text-red-400">{c.getValue()}</span>
          ) : (
            <span className="text-slate-600">0</span>
          ),
      }),
      col.display({
        id: 'actions',
        header: '',
        cell: (c) => (
          <button
            onClick={() => onSelect(c.row.original.id)}
            className="rounded px-2 py-1 text-xs text-sky-400 ring-1 ring-sky-500/30 hover:bg-sky-500/10"
          >
            packets →
          </button>
        ),
      }),
    ],
    [onSelect],
  )

  const table = useReactTable<Flow>({
    data: flows,
    columns,
    getCoreRowModel: getCoreRowModel<Flow>(),
  })

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="text-left text-xs uppercase tracking-wider text-slate-500">
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-2.5 select-none">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t border-slate-800/60 hover:bg-slate-800/30"
                onClick={() => onSelect(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}

function FlowEvidenceModal({ flowId, onClose }: { flowId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: flow, isLoading, isError } = useQuery({
    queryKey: ['flow', flowId],
    queryFn: () => api.getFlow(flowId),
  })

  return (
    <Modal
      title={
        flow ? (
          <>
            <span className="font-mono">
              {flow.source_ip}:{flow.source_port}
            </span>
            <span className="mx-2 text-slate-500">→</span>
            <span className="font-mono">
              {flow.destination_ip}:{flow.destination_port}
            </span>
          </>
        ) : (
          'Loading flow…'
        )
      }
      subtitle={
        flow && (
          <>
            {flow.transport_protocol} · {flow.application_protocol ?? '—'} ·{' '}
            {flow.packets} packets · {formatBytes(flow.bytes)}
            {flow.retransmissions > 0 && (
              <span className="text-amber-400"> · {flow.retransmissions} retransmissions</span>
            )}
            {flow.resets > 0 && <span className="text-red-400"> · {flow.resets} resets</span>}
          </>
        )
      }
      onClose={onClose}
      wide
    >
      {isError ? (
        <div className="p-12 text-center text-sm text-red-400">
          Failed to load packet evidence.
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['flow', flowId] })}
            className="ml-3 rounded-lg bg-slate-800 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:text-slate-100"
          >
            Retry
          </button>
        </div>
      ) : isLoading || !flow ? (
        <div className="p-12 text-center text-sm text-slate-500">Loading packet evidence…</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900">
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5">Time</th>
              <th className="px-4 py-2.5">Source</th>
              <th className="px-4 py-2.5">Destination</th>
              <th className="px-4 py-2.5">Proto</th>
              <th className="px-4 py-2.5">Flags</th>
              <th className="px-4 py-2.5">Len</th>
              <th className="px-4 py-2.5">Info</th>
            </tr>
          </thead>
          <tbody>
            {flow.packet_evidence.map((p: PacketEvidence, i: number) => (
              <EvidenceRow key={i} pkt={p} />
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}

function EvidenceRow({ pkt }: { pkt: PacketEvidence }) {
  const info =
    (pkt.metadata['dns.query'] as string) ??
    (pkt.metadata['http.host'] as string) ??
    (pkt.metadata['http.method'] as string) ??
    (pkt.metadata['tls.sni'] as string) ??
    ''
  return (
    <tr className="border-t border-slate-800/60 hover:bg-slate-800/30">
      <td className="px-4 py-2 font-mono text-xs text-slate-500">
        {formatTime(pkt.timestamp)}
      </td>
      <td className="px-4 py-2 font-mono text-xs text-slate-300">
        {pkt.source_ip}
        {pkt.source_port != null && <span className="text-slate-500">:{pkt.source_port}</span>}
      </td>
      <td className="px-4 py-2 font-mono text-xs text-slate-300">
        {pkt.destination_ip}
        {pkt.destination_port != null && (
          <span className="text-slate-500">:{pkt.destination_port}</span>
        )}
      </td>
      <td className="px-4 py-2 text-xs text-slate-400">{pkt.protocol ?? '—'}</td>
      <td className="px-4 py-2">
        <span className="flex gap-1">
          {pkt.flags.map((f) => (
            <span
              key={f}
              className={`rounded px-1 text-[10px] font-bold ${
                f === 'RST'
                  ? 'bg-red-500/20 text-red-400'
                  : f === 'SYN'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'bg-slate-700/50 text-slate-400'
              }`}
            >
              {f}
            </span>
          ))}
        </span>
      </td>
      <td className="px-4 py-2 text-xs text-slate-400">{pkt.length}</td>
      <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs text-slate-500">
        {info || '—'}
      </td>
    </tr>
  )
}
