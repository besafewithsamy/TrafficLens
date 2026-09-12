import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { TimelinePage } from './TimelinePage'
import { captureFixture, timelinePageFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/** Characterization tests for TimelinePage (pre Phase-3 sweep). */

function seed(over: { events?: typeof timelinePageFixture } = {}) {
  return renderPage(<TimelinePage />, {
    initialEntries: ['/timeline'],
    queries: [
      { queryKey: ['captures'], data: [captureFixture()] },
      {
        queryKey: ['timeline', 'cap1', '', '', '', 0],
        data: over.events ?? timelinePageFixture,
      },
    ],
  })
}

describe('TimelinePage', () => {
  it('renders heading, subtitle and all filter controls', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeDefined()
    expect(screen.getByText(/Chronological events/)).toBeDefined()
    expect(screen.getByLabelText('Filter by host')).toBeDefined()
    expect(screen.getByLabelText('Filter by event type')).toBeDefined()
  })

  it('renders timeline events with labels and severity dots', () => {
    seed()
    expect(screen.getByText('Beaconing: 192.168.1.42 → 185.234.72.19')).toBeDefined()
    expect(screen.getByText('DNS query: c2.evil.example')).toBeDefined()
  })

  it('shows the empty state when no events match filters', () => {
    seed({ events: { items: [], total: 0, offset: 0, limit: 200 } })
    expect(screen.getByText('No events match the current filters.')).toBeDefined()
  })

  it('shows the no-captures empty state', () => {
    renderPage(<TimelinePage />, {
      initialEntries: ['/timeline'],
      queries: [{ queryKey: ['captures'], data: [] }],
    })
    expect(screen.getByText('No analyzed captures yet.')).toBeDefined()
  })
})
