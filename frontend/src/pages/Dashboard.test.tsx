import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import { Dashboard } from './Dashboard'
import { captureFixture, jobFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

/**
 * Characterization tests for Dashboard — lock current behavior before the
 * Phase-3 token sweep. If any assertion breaks, the sweep changed behavior.
 */

function seed(captures = [captureFixture()], jobs = [jobFixture()]) {
  return renderPage(<Dashboard />, {
    queries: [
      { queryKey: ['captures'], data: captures },
      { queryKey: ['jobs'], data: jobs },
    ],
  })
}

afterEach(cleanup)

describe('Dashboard', () => {
  it('renders the heading and upload link', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeDefined()
    const upload = screen.getByRole('link', { name: '+ Upload PCAP' })
    expect(upload.getAttribute('href')).toBe('/capture')
  })

  it('renders the four top stat cards with derived values', () => {
    const { container } = seed()
    const labels = screen.getAllByText('Captures')
    expect(labels.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Analyzed', { exact: true })).toBeDefined()
    expect(screen.getByText('Total Packets', { exact: true })).toBeDefined()
    expect(screen.getByText('Active Jobs', { exact: true })).toBeDefined()
    // 128 as the total-packets stat value (text-2xl stat number)
    const statValues = [...container.querySelectorAll('div.text-2xl')].map((d) => d.textContent)
    expect(statValues).toContain('128')
  })

  it('shows flow summary stats when the last analyzed capture has them', () => {
    const { container } = seed()
    // FlowStat values from fixture flow_summary (text-xl stat numbers)
    const statValues = [...container.querySelectorAll('div.text-xl')].map((d) => d.textContent)
    expect(statValues).toEqual(expect.arrayContaining(['8', '6', '2', '1', '2', '3']))
    expect(screen.getByText('Retransmitting', { exact: true })).toBeDefined()
  })

  it('shows the alert strip with counts by severity', () => {
    seed()
    expect(screen.getByText(/max risk score/)).toBeDefined()
    // severity breakdown chips
    expect(screen.getByText('critical: 1')).toBeDefined()
    expect(screen.getByText('high: 1')).toBeDefined()
    expect(screen.getByText('view alerts →')).toBeDefined()
  })

  it('renders the recent captures table with all columns and the capture row', () => {
    seed()
    const table = screen.getByRole('table')
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(headers).toEqual(['File', 'Status', 'Packets', 'Size', 'Duration', 'Parser', 'Progress'])
    expect(within(table).getByText('c2_beacon.pcap')).toBeDefined()
    expect(within(table).getByText('Completed')).toBeDefined() // StatusPill
    expect(within(table).getByText('scapy')).toBeDefined()
  })

  it('shows an active-job progress banner when a job is running', () => {
    seed([captureFixture()], [
      jobFixture({ status: 'running', progress: 45, stage: 'flow_reconstruction' }),
    ])
    expect(screen.getByText(/Analysis in progress — flow_reconstruction/)).toBeDefined()
    expect(screen.getByText('45%')).toBeDefined()
  })

  it('renders the empty state with CTA when no captures exist', () => {
    seed([], [])
    expect(screen.getByText('No captures yet.')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Upload your first PCAP' })).toBeDefined()
  })

  it('shows a loading state while captures load', () => {
    renderPage(<Dashboard />, { queries: [] })
    expect(screen.getByText('Loading…')).toBeDefined()
  })
})
