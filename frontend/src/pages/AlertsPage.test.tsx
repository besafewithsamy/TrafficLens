import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { AlertsPage } from './AlertsPage'
import { alertFixture, captureFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/**
 * Characterization tests for AlertsPage — lock current behavior before the
 * Phase-3 token sweep.
 */

const alertsPage = {
  items: [
    alertFixture(),
    alertFixture({
      id: 'alert2',
      rule_name: 'dns_tunneling',
      title: 'DNS tunneling: 192.168.1.42',
      severity: 'high',
      score: 71,
      acknowledged: true,
      tags: ['confirmed'],
      note: 'verified by analyst',
    }),
  ],
  total: 2,
  offset: 0,
  limit: 100,
}

function seed(over: { alerts?: typeof alertsPage; capture?: ReturnType<typeof captureFixture> } = {}) {
  const capture = over.capture ?? captureFixture({
    summary: {
      ...captureFixture().summary,
      incidents: [
        {
          source_ip: '192.168.1.42',
          rule_names: ['beaconing'],
          alert_count: 1,
          max_score: 92,
          severity: 'critical',
          first_seen: 1700000030,
          last_seen: 1700000120,
          alert_ids: ['alert1'],
          title: '192.168.1.42 — C2 beaconing pattern',
          story: 'Periodic outbound connections with low jitter.',
        },
      ],
    },
  })
  return renderPage(<AlertsPage />, {
    initialEntries: ['/alerts'],
    queries: [
      { queryKey: ['captures'], data: [capture] },
      { queryKey: ['alerts', 'cap1', ''], data: over.alerts ?? alertsPage },
      { queryKey: ['captureDetail', 'cap1'], data: capture },
    ],
  })
}

describe('AlertsPage', () => {
  it('renders heading, subtitle and severity filter buttons with counts', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Alerts' })).toBeDefined()
    expect(screen.getByText(/Every alert is explainable/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'All' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'critical (1)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'high (1)' })).toBeDefined()
  })

  it('renders alert cards with severity badge, rule label and score gauge', () => {
    seed()
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThanOrEqual(1) // alert + incident badges
    expect(screen.getAllByText('HIGH').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Beaconing')).toBeDefined() // rule label
    expect(screen.getByText('DNS Tunneling')).toBeDefined()
    expect(screen.getByText('92')).toBeDefined()
    expect(screen.getByText('71')).toBeDefined()
  })

  it('shows acknowledged marker on acked alerts', () => {
    seed()
    expect(screen.getByText('acknowledged')).toBeDefined()
  })

  it('renders correlated incidents from the capture summary', () => {
    seed()
    expect(screen.getByText(/Correlated incidents \(1\)/)).toBeDefined()
    expect(screen.getByText('192.168.1.42 — C2 beaconing pattern')).toBeDefined()
    expect(screen.getByText('1 alerts · max score 92')).toBeDefined()
  })

  it('expands an alert card to show reasons, evidence and actions', () => {
    seed()
    // header button toggles expansion
    const toggleBtn = screen.getByText('Beaconing: 192.168.1.42 → 185.234.72.19')
      .closest('button')!
    act(() => {
      fireEvent.click(toggleBtn)
    })
    // expanded content
    expect(screen.getByText('Reasons')).toBeDefined()
    expect(screen.getByText('Regular intervals')).toBeDefined()
    expect(screen.getByText('Consistent destination')).toBeDefined()
    expect(screen.getByText('Evidence')).toBeDefined()
    expect(screen.getByText(/Host/)).toBeDefined()
    expect(screen.getByText('Acknowledge')).toBeDefined()
    expect(screen.getByText('confirmed')).toBeDefined()
    expect(screen.getByText('false-positive')).toBeDefined()
    expect(screen.getByText('escalated')).toBeDefined()
    // evidence JSON dump present (pre-sweep behavior)
    expect(screen.getByText(/intervals_s/)).toBeDefined()
  })

  it('has the deep link to the first related flow evidence (when expanded)', () => {
    seed()
    // expand the first alert card
    const toggleBtn = screen.getByText('Beaconing: 192.168.1.42 → 185.234.72.19').closest('button')!
    act(() => {
      fireEvent.click(toggleBtn)
    })
    const link = screen.getByRole('link', { name: /related flows.*view evidence/ })
    expect(link.getAttribute('href')).toBe('/flows?capture_id=cap1&flow=flow1')
  })

  it('switches the active severity filter on click', () => {
    seed()
    const btn = screen.getByRole('button', { name: 'critical (1)' })
    act(() => {
      fireEvent.click(btn)
    })
    // still rendered and clickable (query key changes → loading state, then refetch)
    expect(screen.getByRole('button', { name: /critical/ })).toBeDefined()
  })

  it('hides confirmed/false-positive alerts when the checkbox is on', () => {
    seed()
    expect(screen.getByText('DNS tunneling: 192.168.1.42')).toBeDefined()
    act(() => {
      fireEvent.click(screen.getByLabelText('hide confirmed & false-positives'))
    })
    expect(screen.queryByText('DNS tunneling: 192.168.1.42')).toBeNull() // tag=confirmed hidden
    expect(screen.getByText('Beaconing: 192.168.1.42 → 185.234.72.19')).toBeDefined() // still visible
  })

  it('shows the clean-capture state when no alerts match', () => {
    seed({ alerts: { items: [], total: 0, offset: 0, limit: 100 } })
    expect(screen.getByText(/No alerts matched/)).toBeDefined()
  })

  it('shows the empty state when no analyzed captures exist', () => {
    renderPage(<AlertsPage />, {
      initialEntries: ['/alerts'],
      queries: [{ queryKey: ['captures'], data: [] }],
    })
    expect(screen.getByText('No analyzed captures yet.')).toBeDefined()
  })

  it('offers the report download link', () => {
    seed()
    const link = screen.getByText('Download report (HTML/PDF)')
    expect(link.getAttribute('href')).toBe('/api/captures/cap1/report')
  })
})
