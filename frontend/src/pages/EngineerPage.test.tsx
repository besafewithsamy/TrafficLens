import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { EngineerPage } from './EngineerPage'
import { captureFixture, engineerMetricsFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/** Characterization tests for EngineerPage (pre Phase-3 sweep). */

function seed(metrics = engineerMetricsFixture()) {
  return renderPage(<EngineerPage />, {
    initialEntries: ['/engineer'],
    queries: [
      { queryKey: ['captures'], data: [captureFixture()] },
      { queryKey: ['engineer', 'cap1'], data: metrics },
    ],
  })
}

describe('EngineerPage', () => {
  it('renders heading, subtitle and health badge', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Engineer Mode' })).toBeDefined()
    expect(screen.getByText(/throughput, reliability, latency/)).toBeDefined()
    expect(screen.getByText('WARNING')).toBeDefined() // fixture health
  })

  it('lists detected issues from metrics', () => {
    seed()
    expect(screen.getByText(/Detected issues/)).toBeDefined()
    expect(screen.getByText(/3 retransmissions across 2 flows/)).toBeDefined()
    expect(screen.getByText(/50% of queries returned NXDOMAIN/)).toBeDefined()
  })

  it('shows the no-captures state when none analyzed', () => {
    renderPage(<EngineerPage />, {
      initialEntries: ['/engineer'],
      queries: [{ queryKey: ['captures'], data: [] }],
    })
    expect(screen.getByText('No analyzed captures yet.')).toBeDefined()
  })
})
