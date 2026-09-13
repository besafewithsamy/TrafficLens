import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { AlertsPage } from './AlertsPage'
import { CasesPage } from './CasesPage'
import { FlowsPage } from './FlowsPage'
import { HostsPage } from './HostsPage'
import { captureFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/**
 * Skeleton loading states: pages show shimmer placeholders (aria-hidden)
 * inside a role="status" announcer while the initial data load is pending —
 * no generic "Loading…" boxes. Empty/error states stay text-based.
 */

describe('skeleton loading states', () => {
  it('FlowsPage renders skeleton table rows while flows load', () => {
    renderPage(<FlowsPage />, {
      initialEntries: ['/flows'],
      // captures present (so the page renders), flows query NOT seeded → loading
      queries: [{ queryKey: ['captures'], data: [captureFixture()] }],
    })
    const status = screen.getAllByRole('status').at(-1)! // Spinner also uses role=status
    expect(status.textContent).toContain('Loading')
    // skeleton rows inside the status region
    expect(status.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(10)
    // real headers visible so the layout matches the loaded table
    expect(screen.getByText('First Seen')).toBeDefined()
    expect(screen.getByText('Retrans')).toBeDefined()
  })

  it('AlertsPage renders alert-card skeletons while alerts load', () => {
    renderPage(<AlertsPage />, {
      initialEntries: ['/alerts'],
      queries: [{ queryKey: ['captures'], data: [captureFixture()] }],
    })
    const status = screen.getAllByRole('status').at(-1)!
    expect(status.textContent).toContain('Running suspicion engine')
    // gauge circles: rounded-full skeleton pieces
    expect(status.querySelectorAll('.skeleton-shimmer.rounded-full').length).toBe(6)
  })

  it('HostsPage renders host-card skeletons in the grid while hosts load', () => {
    renderPage(<HostsPage />, {
      initialEntries: ['/hosts'],
      queries: [{ queryKey: ['captures'], data: [captureFixture()] }],
    })
    const status = screen.getAllByRole('status').at(-1)!
    expect(status.textContent).toContain('Profiling hosts')
    expect(status.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(12)
  })

  it('CasesPage renders sidebar skeletons while cases load', () => {
    renderPage(<CasesPage />, {
      initialEntries: ['/cases'],
      queries: [{ queryKey: ['captures'], data: [captureFixture()] }],
    })
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Loading')
    expect(status.querySelectorAll('.skeleton-shimmer').length).toBe(8) // 4 rows × 2 rows-each
  })

  it('AlertsPage clean/empty state still renders text (not skeletons)', () => {
    renderPage(<AlertsPage />, {
      initialEntries: ['/alerts'],
      queries: [
        { queryKey: ['captures'], data: [captureFixture()] },
        { queryKey: ['alerts', 'cap1', ''], data: { items: [], total: 0, offset: 0, limit: 100 } },
        { queryKey: ['captureDetail', 'cap1'], data: captureFixture() },
      ],
    })
    expect(screen.getByText(/No alerts matched/)).toBeDefined()
    expect(document.querySelectorAll('.skeleton-shimmer').length).toBe(0)
  })
})
