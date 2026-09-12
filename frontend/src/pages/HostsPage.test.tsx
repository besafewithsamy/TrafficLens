import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { HostsPage } from './HostsPage'
import { captureFixture, hostFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/** Characterization tests for HostsPage (pre Phase-3 sweep). */

function seed(hosts = [hostFixture()]) {
  return renderPage(<HostsPage />, {
    initialEntries: ['/hosts'],
    queries: [
      { queryKey: ['captures'], data: [captureFixture()] },
      { queryKey: ['hosts', 'cap1', ''], data: hosts },
    ],
  })
}

describe('HostsPage', () => {
  it('renders heading, subtitle and internal/external filter buttons', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Hosts' })).toBeDefined()
    expect(screen.getByText(/Host-centric investigation/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'All' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Internal' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'External' })).toBeDefined()
  })

  it('renders host cards with ip, classification, role and traffic stats', () => {
    seed()
    expect(screen.getByText('192.168.1.42')).toBeDefined()
    expect(screen.getByText('internal')).toBeDefined()
    expect(screen.getByText('workstation')).toBeDefined() // role badge
    expect(screen.getByText('workstation-42')).toBeDefined() // hostname
    expect(screen.getByText(/48 pkt/)).toBeDefined() // received packets
  })

  it('clicking a host card opens the detail overlay (raw overlay, not shared Modal)', () => {
    seed()
    act(() => {
      fireEvent.click(screen.getByText('192.168.1.42'))
    })
    // HostDetailModal is a plain overlay div (characterized pre-sweep)
    const overlay = document.querySelector('.fixed.inset-0.z-50') as HTMLElement | null
    expect(overlay).not.toBeNull()
    expect(overlay!.textContent).toContain('workstation-42') // hostname in header
  })

  it('shows the empty state when no hosts match the filter', () => {
    seed([])
    expect(screen.getByText('No hosts match the current filter.')).toBeDefined()
  })

  it('shows the empty state when no analyzed captures exist', () => {
    renderPage(<HostsPage />, {
      initialEntries: ['/hosts'],
      queries: [{ queryKey: ['captures'], data: [] }],
    })
    expect(screen.getByText('No analyzed captures yet.')).toBeDefined()
  })
})
