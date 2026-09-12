import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { FlowsPage } from './FlowsPage'
import { captureFixture, flowDetailFixture, flowFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/**
 * Characterization tests for FlowsPage — lock current behavior before the
 * Phase-3 token sweep.
 */

const flowsPage = {
  items: [flowFixture()],
  total: 1,
  offset: 0,
  limit: 50,
}

function seed(over: { initialEntries?: string[]; flows?: typeof flowsPage } = {}) {
  return renderPage(<FlowsPage />, {
    initialEntries: over.initialEntries ?? ['/flows'],
    queries: [
      { queryKey: ['captures'], data: [captureFixture()] },
      { queryKey: ['flows', 'cap1', '', '', 'first_seen', 'asc', 0], data: over.flows ?? flowsPage },
      { queryKey: ['flow', 'flow1'], data: flowDetailFixture() },
    ],
  })
}

describe('FlowsPage', () => {
  it('renders heading, subtitle and filter buttons', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Flows' })).toBeDefined()
    expect(screen.getByText(/Reconstructed conversations/)).toBeDefined()
    // transport filters
    expect(screen.getByRole('button', { name: 'All' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'TCP' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'UDP' })).toBeDefined()
    // direction filters
    expect(screen.getByRole('button', { name: 'any' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'outbound' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'inbound' })).toBeDefined()
    // sort control
    expect(screen.getByLabelText('Sort by')).toBeDefined()
  })

  it('renders the flows table with all columns and row data', () => {
    seed()
    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual([
      'First Seen', 'Source', 'Dir', 'Destination', 'Proto', 'State', 'Packets', 'Bytes', 'Retrans', 'Resets', '',
    ])
    expect(within(table).getByText('192.168.1.42')).toBeDefined()
    expect(within(table).getByText('185.234.72.19')).toBeDefined()
    expect(within(table).getByText('established')).toBeDefined()
    expect(within(table).getByText('12')).toBeDefined() // packets
  })

  it('has a per-row packets button', () => {
    seed()
    expect(screen.getByRole('button', { name: /packets →/ })).toBeDefined()
  })

  it('clicking packets opens the evidence modal with packet rows', () => {
    seed()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /packets →/ }))
    })
    const modal = screen.getByRole('dialog')
    expect(modal).toBeDefined()
    // packet evidence table headers inside the modal
    for (const h of ['Time', 'Source', 'Destination', 'Proto', 'Flags', 'Len', 'Info']) {
      expect(within(modal).getByText(h, { exact: true })).toBeDefined()
    }
    // evidence row: SYN flag chips from fixture packets
    expect(within(modal).getAllByText('SYN').length).toBeGreaterThanOrEqual(2)
  })

  it('deep link (?capture_id=&flow=) opens the evidence modal directly', () => {
    seed({ initialEntries: ['/flows?capture_id=cap1&flow=flow1'] })
    const modal = screen.getByRole('dialog')
    expect(modal).toBeDefined()
  })

  it('shows the empty state when no flows match', () => {
    seed({ flows: { items: [], total: 0, offset: 0, limit: 50 } })
    expect(screen.getByText('No flows match the current filters.')).toBeDefined()
  })

  it('shows the empty state when no analyzed captures exist', () => {
    renderPage(<FlowsPage />, {
      initialEntries: ['/flows'],
      queries: [{ queryKey: ['captures'], data: [] }],
    })
    expect(screen.getByText('No analyzed captures yet — upload and analyze a PCAP first.')).toBeDefined()
  })

  it('renders pagination footer with record count', () => {
    seed()
    expect(screen.getByText(/1 records · page 1 of 1/)).toBeDefined()
  })
})
