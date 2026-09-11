import type { Graph, GraphNodeData } from '../types/api'

/**
 * Adaptive-visualization logic for the network graph.
 *
 * The graph renders in one of three tiers based on visible node count, so a
 * small PCAP stays fully detailed while a large capture automatically switches
 * to a scalable representation (draft layout, selective labels, collapsed
 * leaf domains) instead of an unreadable hairball.
 */

export type Tier = 'detail' | 'balanced' | 'scale'

export const TIER_LIMITS = { balanced: 80, scale: 300 } as const

export function computeTier(visibleNodeCount: number): Tier {
  if (visibleNodeCount > TIER_LIMITS.scale) return 'scale'
  if (visibleNodeCount > TIER_LIMITS.balanced) return 'balanced'
  return 'detail'
}

/** node id → incident edge count (both directions). */
export function buildDegreeMap(graph: Graph): Map<string, number> {
  const deg = new Map<string, number>()
  for (const e of graph.edges) {
    deg.set(e.data.source, (deg.get(e.data.source) ?? 0) + 1)
    deg.set(e.data.target, (deg.get(e.data.target) ?? 0) + 1)
  }
  return deg
}

/**
 * Importance score driving node size, label selection and top-N ordering.
 * Alert hosts dominate, then connectivity, then traffic volume.
 */
export function importanceScore(
  node: GraphNodeData,
  degree: number,
): number {
  let score = degree * 5
  const alerts = node.alert_count ?? 0
  if (alerts > 0) score += 100 * alerts
  const bytes = (node.bytes_sent ?? 0) + (node.bytes_received ?? 0)
  if (bytes > 0) score += 4 * Math.log2(1 + bytes)
  return score
}

export interface NodeMetrics {
  scores: Map<string, number>
  degrees: Map<string, number>
  /** node ids ranked by importance, highest first */
  ranked: string[]
}

export function computeNodeMetrics(graph: Graph): NodeMetrics {
  const degrees = buildDegreeMap(graph)
  const scores = new Map<string, number>()
  for (const n of graph.nodes) {
    scores.set(n.data.id, importanceScore(n.data, degrees.get(n.data.id) ?? 0))
  }
  const ranked = [...graph.nodes]
    .map((n) => n.data.id)
    .sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0))
  return { scores, degrees, ranked }
}

/** Max label count per tier: detail shows everything. */
export const LABEL_LIMITS: Record<Tier, number | null> = {
  detail: null,
  balanced: 40,
  scale: 25,
}

/** Node ids whose labels are shown. Detail tier → all. */
export function labeledNodeIds(metrics: NodeMetrics, tier: Tier, graph: Graph): Set<string> {
  const limit = LABEL_LIMITS[tier]
  if (limit === null) return new Set(graph.nodes.map((n) => n.data.id))
  const labeled = new Set<string>()
  for (const n of graph.nodes) {
    if ((n.data.alert_count ?? 0) > 0) labeled.add(n.data.id)
  }
  for (const id of metrics.ranked) {
    if (labeled.size >= limit) break
    labeled.add(id)
  }
  return labeled
}

/** degree ≤ 1 domain nodes — pure label noise at scale (DGA junk etc.). */
export function leafDomainIds(metrics: NodeMetrics, graph: Graph): Set<string> {
  const leaves = new Set<string>()
  for (const n of graph.nodes) {
    if (n.data.type === 'domain' && (metrics.degrees.get(n.data.id) ?? 0) <= 1) {
      leaves.add(n.data.id)
    }
  }
  return leaves
}

/** Node size by importance: 18px floor … 44px cap. */
export function nodeSize(score: number): number {
  return Math.min(44, 18 + 4 * Math.log2(1 + Math.max(0, score)))
}

/** Layout parameters scale with node count so large graphs keep spreading. */
export function layoutForTier(nodeCount: number, tier: Tier) {
  const spread = Math.sqrt(nodeCount / 50)
  const common = {
    name: 'fcose' as const,
    padding: 30,
    idealEdgeLength: (edge: { data: (k: string) => number }) =>
      (90 - Math.min(40, Math.log2(1 + (edge.data('packets') ?? 0)) * 10)) * Math.min(spread, 2),
  }
  if (tier === 'detail') {
    return {
      ...common,
      quality: 'default' as const,
      animate: true,
      animationDuration: 500,
      fit: true,
      nodeSeparation: 120,
      nodeRepulsion: () => 9000,
    }
  }
  if (tier === 'balanced') {
    return {
      ...common,
      quality: 'default' as const,
      animate: true,
      animationDuration: 400,
      fit: true,
      nodeSeparation: Math.round(120 * Math.min(spread, 1.8)),
      nodeRepulsion: () => Math.round(9000 * Math.min(spread, 1.8)),
    }
  }
  return {
    ...common,
    quality: 'draft' as const,
    animate: false,
    randomize: true,
    fit: true,
    nodeSeparation: Math.round(120 * Math.min(spread, 2)),
    nodeRepulsion: () => Math.round(9000 * Math.min(spread, 2)),
  }
}

/** Cytoscape viewport options for smooth pan/zoom at each tier. */
export function viewportForTier(tier: Tier) {
  if (tier === 'detail') {
    return {
      hideLabelsOnViewport: false,
      textureOnViewport: false,
      hideEdgesOnViewport: false,
      pixelRatio: undefined as number | undefined,
    }
  }
  return {
    hideLabelsOnViewport: true,
    textureOnViewport: tier === 'scale',
    hideEdgesOnViewport: tier === 'scale',
    pixelRatio: tier === 'scale' ? 1 : undefined,
  }
}

/** Straight edges are ~2x faster to draw than bezier curves. */
export const edgeCurveForTier = (tier: Tier) => (tier === 'scale' ? 'straight' : 'bezier')
