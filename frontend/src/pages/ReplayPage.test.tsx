import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { ReplayPage } from './ReplayPage'
import { captureFixture, timelineEventsFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/** Characterization tests for ReplayPage (pre Phase-3 sweep). */

function seed(events = timelineEventsFixture) {
  return renderPage(<ReplayPage />, {
    initialEntries: ['/replay'],
    queries: [
      { queryKey: ['captures'], data: [captureFixture()] },
      { queryKey: ['replay', 'cap1'], data: events },
    ],
  })
}

describe('ReplayPage', () => {
  it('renders heading, subtitle and transport controls', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Incident Replay' })).toBeDefined()
    expect(screen.getByText(/click any event for evidence/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDefined()
    // speed buttons
    for (const s of ['0.5×', '1×', '4×', '16×', '64×']) {
      expect(screen.getByRole('button', { name: s })).toBeDefined()
    }
  })

  it('shows the event position counter starting at 1/2', () => {
    seed()
    expect(screen.getByText('1/2')).toBeDefined()
  })

  it('Next advances the position counter', () => {
    seed()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })
    expect(screen.getByText('2/2')).toBeDefined()
  })

  it('shows the no-captures state when none are analyzed', () => {
    renderPage(<ReplayPage />, {
      initialEntries: ['/replay'],
      queries: [{ queryKey: ['captures'], data: [] }],
    })
    expect(screen.getByText('No analyzed captures yet.')).toBeDefined()
  })
})
