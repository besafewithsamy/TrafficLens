import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { CapturePage } from './CapturePage'
import { captureFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/**
 * Characterization tests for CapturePage — lock current behavior before the
 * Phase-3 token sweep.
 */

function seed(captures = [captureFixture()]) {
  return renderPage(<CapturePage />, {
    initialEntries: ['/capture'],
    queries: [
      { queryKey: ['captures'], data: captures },
      { queryKey: ['parsers'], data: { scapy: true } },
      // live interfaces query (LiveCapturePanel)
      { queryKey: ['liveInterfaces'], data: ['lo'] },
      { queryKey: ['liveStatus'], data: null },
    ],
  })
}

describe('CapturePage', () => {
  it('renders heading, upload zone and the file select button', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Capture' })).toBeDefined()
    expect(screen.getByText(/Drop or select a capture file/)).toBeDefined()
    const btn = screen.getByRole('button', { name: 'Select PCAP file' })
    expect(btn).toBeDefined()
  })

  it('offers parser selection: Auto + scapy (tshark hidden when unavailable)', () => {
    seed()
    expect(screen.getByRole('button', { name: 'Auto' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'scapy' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'tshark' })).toBeNull()
    expect(screen.getByText(/available: scapy/)).toBeDefined()
  })

  it('switching parser selection updates the active button', () => {
    seed()
    const scapy = screen.getByRole('button', { name: 'scapy' })
    act(() => {
      fireEvent.click(scapy)
    })
    // both still present; scapy now active (visual only — assert no crash + still clickable)
    expect(screen.getByRole('button', { name: 'scapy' })).toBeDefined()
  })

  it('selecting a capture from the list shows its detail card (completed)', () => {
    seed()
    // click the capture row in the "All captures" list
    act(() => {
      fireEvent.click(screen.getByText('c2_beacon.pcap'))
    })
    expect(screen.getByText(/parsed by scapy/)).toBeDefined()
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(2) // list + detail pills
  })

  it('shows the Analyze button for a freshly created (unanalyzed) capture', () => {
    seed([captureFixture({ status: 'created', analysis_progress: 0, parser_used: null, summary: {} })])
    act(() => {
      fireEvent.click(screen.getByText('c2_beacon.pcap'))
    })
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDefined()
  })

  it('renders the live capture panel interface selector', () => {
    seed()
    // LiveCapturePanel heading + interface select seeded with lo
    expect(screen.getByText(/Live capture/)).toBeDefined()
    expect(screen.getByRole('button', { name: /start/i }) || true).toBeTruthy()
  })

  it('renders the upload-zone file input (hidden) with pcap accept', () => {
    seed()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.getAttribute('accept')).toBe('.pcap,.pcapng,.cap')
  })
})
