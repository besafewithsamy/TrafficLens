import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { CasesPage } from './CasesPage'
import { captureFixture, caseDetailFixture, caseFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/** Characterization tests for CasesPage (pre Phase-3 sweep). */

function seed(over: { cases?: ReturnType<typeof caseFixture>[]; selectedId?: string } = {}) {
  const cases = over.cases ?? [caseFixture()]
  const queries: { queryKey: unknown[]; data: unknown }[] = [
    { queryKey: ['captures'], data: [captureFixture()] },
    { queryKey: ['cases'], data: cases },
  ]
  if (over.selectedId) {
    queries.push({ queryKey: ['case', over.selectedId], data: caseDetailFixture() })
  }
  const utils = renderPage(<CasesPage />, { initialEntries: ['/cases'], queries })
  if (over.selectedId) {
    // select the case (list button click)
    const btn = screen.getByText(caseFixture().name)
    act(() => {
      fireEvent.click(btn)
    })
  }
  return utils
}

describe('CasesPage', () => {
  it('renders heading, subtitle and the create-case form', () => {
    seed()
    expect(screen.getByRole('heading', { name: 'Cases' })).toBeDefined()
    expect(screen.getByText(/Group related captures into one investigation/)).toBeDefined()
    expect(screen.getByLabelText('Case name')).toBeDefined()
    expect(screen.getByLabelText('Case description')).toBeDefined()
    expect(screen.getByRole('button', { name: '+ New case' })).toBeDefined()
  })

  it('create button is disabled until a name is typed', () => {
    seed()
    const btn = screen.getByRole('button', { name: '+ New case' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    const input = screen.getByLabelText('Case name') as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: 'Incident-42' } })
    })
    const enabled = screen.getByRole('button', { name: '+ New case' }) as HTMLButtonElement
    expect(enabled.disabled).toBe(false)
  })

  it('lists existing cases in the sidebar list', () => {
    seed()
    expect(screen.getByText('C2 Investigation')).toBeDefined()
    expect(screen.getByText(/1 cap/)).toBeDefined()
  })

  it('selecting a case shows the detail header with stats', () => {
    seed({ selectedId: 'case1' })
    // case detail header + stats from fixture
    expect(screen.getAllByText('C2 Investigation').length).toBeGreaterThanOrEqual(2) // list + detail
    expect(screen.getByText('Captures')).toBeDefined()
    expect(screen.getByText('Packets')).toBeDefined()
    expect(screen.getByText('Alerts')).toBeDefined()
    expect(screen.getByText('Incidents')).toBeDefined()
  })

  it('shows the placeholder when no case is selected', () => {
    seed()
    expect(screen.getByText('Select or create a case to see its investigation.')).toBeDefined()
  })

  it('shows the no-cases hint when list is empty', () => {
    seed({ cases: [] })
    expect(screen.getByText('No cases yet — create one and add analyzed captures.')).toBeDefined()
  })
})
