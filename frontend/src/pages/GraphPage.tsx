import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import cytoscape, { type ElementDefinition } from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { api } from '../api/client'
import { CapturePicker } from '../components/CapturePicker'
import { ErrorState } from '../components/states'
import { formatBytes } from '../components/ui'
import { useSelectedCapture } from '../hooks/captures'
import type { Graph, GraphNodeData } from '../types/api'

cytoscape.use(fcose)

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

const KNOWN_EDGE_TYPES = ['DNS', 'RESOLVES_TO', 'HTTP', 'TLS', 'TCP', 'UDP', 'EXPOSES']
// HTTP and HTTPS share a color/toggle; HTTPS maps onto the HTTP filter
const filterForEdge = (type: string) => (type === 'HTTPS' ? 'HTTP' : type)
const edgeColor = (type: string) => EDGE_COLORS[type] ?? '#f472b6'
const edgeLabel = (type: string) =>
  type === 'RESOLVES_TO' ? 'resolves to' : type.toLowerCase()

type EdgeGroup = { key: string; color: string; label: string; count: number }

// Group the actual edge types found in this graph into toggle entries:
// known types get their canonical toggle; anything else (QUIC, C2-PORT, …)
// becomes its own toggle so no edge is implicitly hidden.
function buildEdgeGroups(graph: Graph): EdgeGroup[] {
  const counts = new Map<string, { count: number; original: string }>()
  for (const e of graph.edges) {
    const key = filterForEdge(e.data.type)
    const cur = counts.get(key)
    if (cur) {
      cur.count += 1
    } else {
      counts.set(key, { count: 1, original: e.data.type })
    }
  }
  const groups: EdgeGroup[] = [...KNOWN_EDGE_TYPES, ...[...counts.keys()].filter(
    (k) => !KNOWN_EDGE_TYPES.includes(k),
  )]
    .filter((key) => counts.has(key))
    .map((key) => {
      const { count } = counts.get(key)!
      return { key, color: edgeColor(key), label: edgeLabel(key), count }
    })
  return groups
}

const FCOSE_LAYOUT = {
  name: 'fcose',
  quality: 'default' as const,
  animate: true,
  animationDuration: 500,
  fit: true,
  padding: 30,
  nodeSeparation: 120,
  idealEdgeLength: (edge: { data: (k: string) => number }) =>
    90 - Math.min(40, Math.log2(1 + (edge.data('packets') ?? 0)) * 10),
  nodeRepulsion: () => 9000,
}

export function GraphPage() {
  const { analyzed, effectiveCaptureId, setCaptureId } = useSelectedCapture()
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null)
  const [edgeFilters, setEdgeFilters] = useState<Set<string> | null>(null)
  const [nodeFilters, setNodeFilters] = useState<Set<string>>(
    () => new Set(['domain', 'service']),
  )
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: graph, isError } = useQuery({
    queryKey: ['graph', effectiveCaptureId],
    queryFn: () => api.getGraph(effectiveCaptureId!),
    enabled: !!effectiveCaptureId,
  })

  const edgeGroups = useMemo(() => (graph ? buildEdgeGroups(graph) : []), [graph])

  // null = all enabled (fresh capture); user toggles carve out exclusions
  const activeEdgeFilters = edgeFilters ?? new Set(edgeGroups.map((g) => g.key))
  const toggleEdgeFilter = (key: string) => {
    setEdgeFilters(toggleInSet(activeEdgeFilters, key))
  }

  // Filtered elements: hosts always render; domain/service nodes and edge
  // types are toggleable. Edges survive only when both endpoints do.
  const elements = useMemo(() => {
    if (!graph) return []
    const nodes = graph.nodes.filter(
      (n) => n.data.type === 'host' || !n.data.type || nodeFilters.has(n.data.type),
    )
    const nodeIds = new Set(nodes.map((n) => n.data.id))
    const edges = graph.edges.filter(
      (e) =>
        activeEdgeFilters.has(filterForEdge(e.data.type)) &&
        nodeIds.has(e.data.source) &&
        nodeIds.has(e.data.target),
    )
    return [
      ...nodes.map((n) => ({ data: { ...n.data } })),
      ...edges.map((e) => ({ data: { ...e.data } })),
    ] as ElementDefinition[]
  }, [graph, activeEdgeFilters, nodeFilters])

  useEffect(() => {
    if (!containerRef.current) return

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
            'line-color': (ele: { data: (k: string) => any }) => edgeColor(ele.data('type')),
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
      layout: FCOSE_LAYOUT,
    })

    cy.on('tap', 'node', (e) => {
      const d = e.target.data() as GraphNodeData
      setSelectedNode(d)
    })
    cy.on('tap', 'edge', () => setSelectedNode(null))
    cy.fit(undefined, 30)

    return () => {
      cy.destroy()
    }
  }, [elements])

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
        <div className="ml-auto">
          <CapturePicker captures={analyzed} value={effectiveCaptureId} onChange={setCaptureId} />
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <div ref={containerRef} className="h-full w-full" />

        {/* legend / filters */}
        <div className="absolute left-3 top-3 space-y-1 rounded-lg bg-slate-900/90 p-3 text-[10px] ring-1 ring-slate-800">
          <div className="mb-1 font-medium text-slate-400">Edges</div>
          {edgeGroups.map((g) => {
            const active = activeEdgeFilters.has(g.key)
            return (
              <button
                key={g.key}
                onClick={() => toggleEdgeFilter(g.key)}
                className={`flex items-center gap-2 text-left transition-opacity ${
                  active ? 'text-slate-500' : 'text-slate-600 opacity-40'
                }`}
              >
                <span
                  className="inline-block h-0.5 w-5"
                  style={{ background: g.color, opacity: active ? 1 : 0.3 }}
                />
                <span className="flex-1">{g.label}</span>
                <span className="text-slate-600">{g.count}</span>
              </button>
            )
          })}
          <div className="mt-2 mb-1 font-medium text-slate-400">Nodes</div>
          {(
            [
              ['host', 'host', '#38bdf8'],
              ['domain', 'domain', '#a78bfa'],
              ['service', 'service', '#34d399'],
            ] as const
          ).map(([type, label, ring]) => {
            const active = type === 'host' || nodeFilters.has(type)
            return (
              <button
                key={type}
                disabled={type === 'host'}
                onClick={() => setNodeFilters(toggleInSet(nodeFilters, type))}
                className={`flex items-center gap-2 text-left transition-opacity ${
                  active ? 'text-slate-500' : 'text-slate-600 opacity-40'
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full ring-1"
                  style={{ boxShadow: `inset 0 0 0 1px ${ring}`, opacity: active ? 1 : 0.3 }}
                />
                {label}
              </button>
            )
          })}
          <div className="mt-2 border-t border-slate-800 pt-1.5 text-slate-600">
            {elements.length > 0
              ? `${elements.length} shown`
              : 'nothing matches filters'}
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
        {isError && !graph && (
          <div className="absolute inset-x-0 bottom-6 mx-auto w-fit">
            <ErrorState message="Graph request failed." />
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
                ×
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

function toggleInSet(current: Iterable<string>, name: string): Set<string> {
  const next = new Set(current)
  if (next.has(name)) {
    next.delete(name)
  } else {
    next.add(name)
  }
  return next
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
