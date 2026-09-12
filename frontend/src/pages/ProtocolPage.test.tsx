import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { ProtocolPage } from './ProtocolPage'
import { captureFixture, dnsPageFixture, httpPageFixture, protocolStatsFixture, tlsPageFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/** Characterization tests for ProtocolPage (pre Phase-3 sweep). */

function seed() {
  return renderPage(<ProtocolPage />, {
    initialEntries: ['/protocol'],
    queries: [
      { queryKey: ['captures'], data: [captureFixture()] },
      { queryKey: ['protocolStats', 'cap1'], data: protocolStatsFixture() },
      { queryKey: ['dns', 'cap1', '', false, 0], data: dnsPageFixture },
      { queryKey: ['http', 'cap1', '', 0], data: httpPageFixture },
      { queryKey: ['tls', 'cap1', '', 0], data: tlsPageFixture },
    ],
  })
}

describe('ProtocolPage', () => {
  it('renders heading, subtitle and the three protocol tabs', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Protocol Explorer' })).toBeDefined()
    expect(screen.getByText(/not which fields live in a packet/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'dns' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'http' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'tls' })).toBeDefined()
  })

  it('dns tab (default) shows stats and the transactions table', () => {
    seed()
    // stat boxes
    expect(screen.getByText('Transactions')).toBeDefined()
    expect(screen.getByText('Unique Domains')).toBeDefined()
    // fixture domains in the table
    expect(screen.getAllByText('c2.evil.example').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('missing.example')).toBeDefined()
    expect(screen.getByLabelText('Filter by domain')).toBeDefined()
  })

  it('switching to http tab shows HTTP stats and table', () => {
    seed()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'http' }))
    })
    expect(screen.getByText('example.com')).toBeDefined() // fixture host row
  })

  it('switching to tls tab shows TLS sessions table', () => {
    seed()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'tls' }))
    })
    expect(screen.getByLabelText('Filter by SNI')).toBeDefined()
    // fixture session row: client + sni
    expect(screen.getAllByText('192.168.1.42').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('c2.evil.example').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the empty state when no analyzed captures exist', () => {
    renderPage(<ProtocolPage />, {
      initialEntries: ['/protocol'],
      queries: [{ queryKey: ['captures'], data: [] }],
    })
    expect(screen.getByText('No analyzed captures yet.')).toBeDefined()
  })
})
