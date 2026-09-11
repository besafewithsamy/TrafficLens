import { describe, expect, it } from 'vitest'
import type { Graph } from '../types/api'
import {
  computeNodeMetrics,
  computeTier,
  edgeCurveForTier,
  hubEdgeIds,
  hubEdgeFactor,
  labeledNodeIds,
  layoutForTier,
  leafDomainIds,
  nodeSize,
  repulsionFor,
  elasticityFor,
} from './graph-scaling'

const graph = (nodes: any[], edges: any[]): Graph => ({
  nodes,
  edges,
  stats: {
    node_count: nodes.length,
    edge_count: edges.length,
    host_count: 0,
    domain_count: 0,
    service_count: 0,
  },
})

describe('computeTier', () => {
  it('detail for small graphs', () => {
    expect(computeTier(80)).toBe('detail')
    expect(computeTier(1)).toBe('detail')
  })
  it('balanced for medium graphs', () => {
    expect(computeTier(81)).toBe('balanced')
    expect(computeTier(300)).toBe('balanced')
  })
  it('scale for large graphs', () => {
    expect(computeTier(301)).toBe('scale')
    expect(computeTier(1000)).toBe('scale')
  })
})

describe('importance + node size', () => {
  it('alert hosts dominate plain hubs', () => {
    const g = graph(
      [
        { data: { id: 'plain', type: 'host', alert_count: 0, bytes_sent: 10000, bytes_received: 0 } },
        { data: { id: 'alert', type: 'host', alert_count: 1, bytes_sent: 0, bytes_received: 0 } },
      ],
      [],
    )
    const m = computeNodeMetrics(g)
    expect(m.scores.get('alert')!).toBeGreaterThan(m.scores.get('plain')!)
  })

  it('nodeSize grows with score but is capped', () => {
    expect(nodeSize(0)).toBe(18)
    expect(nodeSize(10)).toBeGreaterThan(nodeSize(0))
    expect(nodeSize(1e9)).toBe(44)
  })
})

describe('labeledNodeIds', () => {
  const hosts = [
    { data: { id: 'h1', type: 'host', alert_count: 2 } },
    { data: { id: 'h2', type: 'host', alert_count: 0 } },
    { data: { id: 'd1', type: 'domain' } },
    { data: { id: 'd2', type: 'domain' } },
    { data: { id: 'd3', type: 'domain' } },
  ]
  const edges = [
    { data: { id: 'e1', source: 'h2', target: 'd1', type: 'DNS' } },
    { data: { id: 'e2', source: 'h2', target: 'd2', type: 'DNS' } },
  ]
  const g = graph(hosts, edges)

  it('detail tier labels everything', () => {
    const m = computeNodeMetrics(g)
    expect(labeledNodeIds(m, 'detail', g).size).toBe(5)
  })

  it('balanced/scale tiers always include alert hosts within the limit', () => {
    const m = computeNodeMetrics(g)
    const labeled = labeledNodeIds(m, 'balanced', g)
    expect(labeled.size).toBeLessThanOrEqual(40)
    expect(labeled.has('h1')).toBe(true) // alert host always labeled
  })

  it('scale tier caps labels at alert hosts only', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      data: { id: `h${i}`, type: 'host', alert_count: i === 7 ? 1 : 0 },
    }))
    const g2 = graph(many, [])
    const m = computeNodeMetrics(g2)
    const labeled = labeledNodeIds(m, 'scale', g2)
    expect(labeled.size).toBe(1)
    expect(labeled.has('h7')).toBe(true)
  })
})

describe('hub-aware layout multipliers', () => {
  it('repulsion grows with degree up to 3x', () => {
    expect(repulsionFor(0, 9000)).toBe(9000)
    expect(repulsionFor(40, 9000)).toBe(18000)
    expect(repulsionFor(80, 9000)).toBe(27000)
    expect(repulsionFor(500, 9000)).toBe(27000) // capped
  })

  it('hub edges are stretched, regular edges are not', () => {
    expect(hubEdgeFactor(5)).toBe(1)
    expect(hubEdgeFactor(21)).toBe(1.3)
  })

  it('hub edges get stretchier elasticity', () => {
    expect(elasticityFor(true)).toBeLessThan(elasticityFor(false))
  })

  it('hubEdgeIds marks edges touching degree>15 nodes', () => {
    const g = graph(
      [
        { data: { id: 'hub', type: 'host' } },
        { data: { id: 'plain', type: 'host' } },
        { data: { id: 'a', type: 'host' } },
        { data: { id: 'b', type: 'host' } },
      ],
      [
        { data: { id: 'e1', source: 'hub', target: 'a', type: 'DNS' } },
        { data: { id: 'e2', source: 'plain', target: 'b', type: 'DNS' } },
      ],
    )
    const m = computeNodeMetrics(g)
    const hubEdges = hubEdgeIds(m.degrees, g)
    expect(hubEdges.size).toBe(0) // degree 1 — no hubs yet

    // now make 'hub' a real hub
    const g2 = graph(
      [
        { data: { id: 'hub', type: 'host' } },
        { data: { id: 'plain', type: 'host' } },
        ...Array.from({ length: 16 }, (_, i) => ({ data: { id: `n${i}`, type: 'host' } })),
      ],
      [
        ...Array.from({ length: 16 }, (_, i) => ({
          data: { id: `he${i}`, source: 'hub', target: `n${i}`, type: 'DNS' },
        })),
        { data: { id: 'e2', source: 'plain', target: 'hub', type: 'DNS' } },
      ],
    )
    const m2 = computeNodeMetrics(g2)
    const hubEdges2 = hubEdgeIds(m2.degrees, g2)
    expect(hubEdges2.has('he0')).toBe(true)
    expect(hubEdges2.has('e2')).toBe(true)
  })

  it('scale tier curves hub edges, straightens the rest', () => {
    const hubEdges = new Set(['e1'])
    const curve = edgeCurveForTier('scale', hubEdges) as unknown as (edge: { id: () => string }) => string
    expect(typeof curve).toBe('function')
    expect(curve({ id: () => 'e1' })).toBe('bezier')
    expect(curve({ id: () => 'e2' })).toBe('straight')
    // non-scale tiers: flat bezier, not a function
    expect(edgeCurveForTier('balanced')).toBe('bezier')
    expect(edgeCurveForTier('detail')).toBe('bezier')
  })
})

describe('leafDomainIds', () => {
  it('returns degree<=1 domains only', () => {
    const g = graph(
      [
        { data: { id: 'leaf', type: 'domain' } },
        { data: { id: 'hub', type: 'domain' } },
        { data: { id: 'host1', type: 'host' } },
        { data: { id: 'host2', type: 'host' } },
      ],
      [
        { data: { id: 'e1', source: 'host1', target: 'leaf', type: 'DNS' } },
        { data: { id: 'e2', source: 'host1', target: 'hub', type: 'DNS' } },
        { data: { id: 'e3', source: 'host2', target: 'hub', type: 'DNS' } },
      ],
    )
    const m = computeNodeMetrics(g)
    const leaves = leafDomainIds(m, g)
    expect(leaves.has('leaf')).toBe(true)
    expect(leaves.has('hub')).toBe(false)
    expect(leaves.has('host1')).toBe(false)
  })
})

describe('layout + viewport per tier', () => {
  type AnyLayout = { quality?: string; animate?: boolean; gravity?: number; nodeRepulsion: (node?: any) => number }

  it('scale tier uses draft quality, no animation, lower gravity, degree-aware repulsion', () => {
    const l = layoutForTier(500, 'scale') as unknown as AnyLayout
    expect(l.quality).toBe('draft')
    expect(l.animate).toBe(false)
    expect(l.gravity).toBe(0.12)
    const l2 = layoutForTier(500, 'scale', new Map([['hub', 80]])) as unknown as AnyLayout
    expect(l2.nodeRepulsion({ data: (k: string) => (k === 'id' ? 'hub' : undefined) })).toBeGreaterThan(
      l2.nodeRepulsion({ data: (k: string) => (k === 'id' ? 'plain' : undefined) }),
    )
  })

  it('balanced keeps default animation and moderate gravity', () => {
    const l = layoutForTier(150, 'balanced') as unknown as AnyLayout
    expect(l.animate).toBe(true)
    expect(l.gravity).toBe(0.2)
  })

  it('detail tier is unchanged (no gravity override, flat repulsion)', () => {
    const l = layoutForTier(30, 'detail') as unknown as AnyLayout
    expect(l.nodeRepulsion()).toBe(9000)
    expect(l.gravity).toBeUndefined()
  })
})
