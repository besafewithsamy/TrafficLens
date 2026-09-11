import { describe, expect, it } from 'vitest'
import type { Graph } from '../types/api'
import {
  computeNodeMetrics,
  computeTier,
  edgeCurveForTier,
  labeledNodeIds,
  leafDomainIds,
  nodeSize,
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

  it('scale tier caps at 25 labels', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      data: { id: `h${i}`, type: 'host', alert_count: 0 },
    }))
    const g2 = graph(many, [])
    const m = computeNodeMetrics(g2)
    expect(labeledNodeIds(m, 'scale', g2).size).toBe(25)
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
  it('scale tier uses draft quality, no animation, straight edges', () => {
    const l = layoutForTierByTier('scale', 500)
    expect(l.quality).toBe('draft')
    expect(l.animate).toBe(false)
    expect(edgeCurveForTier('scale')).toBe('straight')
    expect(edgeCurveForTier('detail')).toBe('bezier')
  })
})

// helper re-import to avoid circular reference in test
import { layoutForTier } from './graph-scaling'
function layoutForTierByTier(tier: 'detail' | 'balanced' | 'scale', count: number) {
  return layoutForTier(count, tier)
}
