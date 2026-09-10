import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import cytoscape, { type ElementDefinition } from 'cytoscape'
import { api } from '../api/client'
import { formatBytes } from '../components/ui'
import type { GraphNodeData } from '../types/api'

const NODE_STYLE: Record<string, { bg: string; border: string }> = {
  host: { bg: '#1e293b', border: '#38bdf8' },
  domain: { bg: '#1e1b2e', border: '#a78bfa' },
  service: { bg: '#17251f', border: '#34d399' },
}

const EDGE_COLORS: Record<string, string> = {
  DNS: '#38bdf8',
  RESOLVES_TO: '#64748b',
  HTTP: '#fbbf24',
  HTTPS: '#fbbf24',
  TLS: '#a78bfa',
  TCP: '#475569',
  UDP: '#7c3aed',
  EXPOSES: '#34d399',
}

export function GraphPage() {
  const [captureId, setCaptureId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: captures } = useQuery({
    queryKey: ['captures'],
    queryFn: api.listCaptures,
    refetchInterval: 5000,
  })
  const analyzed = (captures ?? []).filter((c) => c.status === 'completed')
  const effectiveCaptureId = captureId ?? analyzed[0]?.id ?? null

  const { data: graph, isError } = useQuery({
    queryKey: ['graph', effectiveCaptureId],
    queryFn: () => api.getGraph(effectiveCaptureId!),
    enabled: !!effectiveCaptureId,
  })

  useEffect(() => {
    if (!graph || !containerRef.current) return

    const elements: ElementDefinition[] = [
      ...graph.nodes.map((n) => ({ data: { ...n.data } })),
      ...graph.edges.map((e) => ({ data: { ...e.data } })),
    ]

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': (ele: { data: (k: string) => any }) =>
              NODE_STYLE[ele.data('type')]?.bg ?? '#1e293b',
            'border-color': (ele: { data: (k: string) => any }) =>
              ele.data('alert_count') > 0
                ? '#f87171'
                : NODE_STYLE[ele.data('type')]?.border ?? '#38bdf8',
            'border-width': (ele: { data: (k: string) => any }) =>
              ele.data('alert_count') > 0 ? 3 : 1.5,
            color: '#94a3b8',
            'font-size': 9,
            'font-family': 'ui-monospace, monospace',
            width: 26,
            height: 26,
            'min-zoomed-font-size': 6,
          },
        },
        {
          selector: 'node:selected',
          style: { 'border-width': 4, 'border-color': '#f59e0b' },
        },
        {
          selector: 'edge',
          style: {
            width: (ele: { data: (k: string) => any }) =>
              Math.min(1 + Math.log2(1 + (ele.data('packets') ?? 1)), 6),
            'line-color': (ele: { data: (k: string) => any }) =>
              EDGE_COLORS[ele.data('type')] ?? '#475569',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.7,
            'curve-style': 'bezier',
            opacity: 0.75,
          },
        },
        {
          selector: 'edge:selected',
          style: { opacity: 1, width: 4 },
        },
      ],
      layout: { name: 'cose', animate: true, animationDuration: 400 },
    })

    cy.on('tap', 'node', (e) => {
      const d = e.target.data() as GraphNodeData
      setSelectedNode(d)
    })
    cy.on('tap', 'edge', () => setSelectedNode(null))

    return () => {
      cy.destroy()
    }
  }, [graph])

  return (
    <div className="flex h-full flex-col p-8">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <h1 className="text-2xl font-semibold text-slate-100">Network Graph</h1>
        {graph && (
          <span className="text-xs text-slate-500">
            {graph.stats.host_count} hosts · {graph.stats.domain_count} domains ·{' '}
            {graph.stats.service_count} services · {graph.stats.edge_count} edges
          </span>
        )}
        <select
          value={effectiveCaptureId ?? ''}
          onChange={(e) => setCaptureId(e.target.value || null)}
          className="ml-auto rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200"
        >
          {analyzed.map((c) => (
            <option key={c.id} value={c.id}>
              {c.filename}
            </option>
          ))}
        </select>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <div ref={containerRef} className="h-full w-full" />

        {/* legend */}
        <div className="absolute left-3 top-3 space-y-1 rounded-lg bg-slate-900/90 p-3 text-[10px] ring-1 ring-slate-800">
          <div className="mb-1 font-medium text-slate-400">Edges</div>
          {Object.entries(EDGE_COLORS).map(([name, color]) => (
            <div key={name} className="flex items-center gap-2 text-slate-500">
              <span className="inline-block h-0.5 w-5" style={{ background: color }} />
              {name}
            </div>
          ))}
          <div className="mt-2 mb-1 font-medium text-slate-400">Nodes</div>
          <div className="flex items-center gap-2 text-slate-500">
            <span className="h-3 w-3 rounded-full ring-1 ring-sky-400" /> host
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <span className="h-3 w-3 rounded-full ring-1 ring-violet-400" /> domain
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <span className="h-3 w-3 rounded-full ring-1 ring-red-400" /> alert host
          </div>
        </div>

        {!graph && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            {isError
              ? 'Failed to build graph. Please try again.'
              : analyzed.length
                ? 'Building graph…'
                : 'No analyzed captures yet.'}
          </div>
        )}

        {/* Node detail panel */}
        {selectedNode && (
          <div className="absolute right-3 top-3 z-10 w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-4 shadow-xl">
            <div className="mb-2 flex items-start justify-between">
              <div className="font-mono text-sm font-semibold text-slate-100">
                {selectedNode.id}
              </div>
              <button onClick={() => setSelectedNode(null)} className="text-slate-500">
                ✕
              </button>
            </div>
            <div className="space-y-1.5 text-xs">
              <Row label="Type" value={selectedNode.type ?? '—'} />
              {selectedNode.hostname && <Row label="Hostname" value={selectedNode.hostname} />}
              {selectedNode.role && <Row label="Role" value={selectedNode.role} />}
              {selectedNode.type === 'host' && (
                <>
                  <Row
                    label="Traffic"
                    value={`↑ ${formatBytes(selectedNode.bytes_sent ?? 0)} · ↓ ${formatBytes(
                      selectedNode.bytes_received ?? 0,
                    )}`}
                  />
                  <Row
                    label="Alerts"
                    value={String(selectedNode.alert_count ?? 0)}
                    tone={(selectedNode.alert_count ?? 0) > 0 ? 'red' : undefined}
                  />
                </>
              )}
              {selectedNode.type === 'service' && (
                <>
                  <Row label="Service" value={selectedNode.service ?? '—'} />
                  <Row label="Port" value={String(selectedNode.port ?? '—')} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'red' }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${tone === 'red' ? 'text-red-400' : 'text-slate-300'}`}>
        {value}
      </span>
    </div>
  )
}
