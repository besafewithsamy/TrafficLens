import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

// jsdom has no 2d canvas — cytoscape cannot mount. The canvas behavior is
// covered by e2e/graph.spec.ts; these tests lock the page chrome only.
// jsdom has no 2d canvas — cytoscape cannot mount. The canvas behavior is
// covered by e2e/graph.spec.ts; these tests lock the page chrome only.
vi.mock('cytoscape', () => {
  const cytoscapeMock: any = vi.fn(() => ({
    destroy: () => {},
    on: () => {},
    nodes: () => ({ on: () => {} }),
    edges: () => ({ on: () => {} }),
    layout: () => ({ run: () => {} }),
    resize: () => {},
    fit: () => {},
    elements: () => ({ remove: () => {} }),
    style: () => ({ fromString: () => ({ applyTo: () => {} }) }),
  }))
  cytoscapeMock.use = () => {}
  return { default: cytoscapeMock }
})

import { GraphPage } from './GraphPage'
import { captureFixture, graphFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/** Characterization tests for GraphPage chrome (pre Phase-3 sweep). */

function seed(graph = graphFixture()) {
  return renderPage(<GraphPage />, {
    initialEntries: ['/graph'],
    queries: [
      { queryKey: ['captures'], data: [captureFixture()] },
      { queryKey: ['graph', 'cap1'], data: graph },
    ],
  })
}

describe('GraphPage', () => {
  it('renders heading and graph stats summary', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Network Graph' })).toBeDefined()
    expect(screen.getByText(/2 hosts · 1 domains · 1 services · 4 edges/)).toBeDefined()
  })

  it('renders the edge-type filter legend', () => {
    seed()
    expect(screen.getByText('Edges')).toBeDefined()
  })

  it('shows the no-captures state when none analyzed', () => {
    renderPage(<GraphPage />, {
      initialEntries: ['/graph'],
      queries: [{ queryKey: ['captures'], data: [] }],
    })
    expect(screen.getByText(/No analyzed captures/i)).toBeDefined()
  })
})
