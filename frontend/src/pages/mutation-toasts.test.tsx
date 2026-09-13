import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { toast as toastImported } from 'sonner'

// Mock sonner at module level; every page funnels through it. The vi.mock
// factory is hoisted, so the mock fns live inside it and are read back from
// the mocked module below.
vi.mock('sonner', () => {
  const fns = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    promise: vi.fn(),
  }
  return { toast: fns, Toaster: () => null }
})

const toastMock = vi.mocked(toastImported)

import { AlertsPage } from './AlertsPage'
import { CasesPage } from './CasesPage'
import { alertFixture, captureFixture, caseDetailFixture, caseFixture } from '../test/fixtures'
import { renderPage } from '../test/harness'
import type { Alert } from '../types/api'

afterEach(cleanup)

/** Mutable fetch stub — tests assign responses per test. */
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  toastMock.success.mockReset()
  toastMock.error.mockReset()
})

function ok(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function fail(detail: string, status = 400) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Route-aware fetch stub: mutations match by method+URL substring; everything
 * else falls through to a benign empty-list 200 so background refetches
 * (triggered by invalidateQueries) never crash the page.
 */
function stubFetch(routes: { match: (url: string, init?: RequestInit) => boolean; respond: () => Response }[]) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    for (const r of routes) {
      if (r.match(url, init)) return r.respond()
    }
    return ok([])
  })
}

/* ------------------------------------------------------------------ */
/* Analysis job watcher — completion toast fires once per job (works   */
/* independently of which page is mounted).                            */
/* ------------------------------------------------------------------ */

describe('analysis completion toast', () => {
  it('watchJobForToast toasts "Analysis completed" exactly once per job', async () => {
    // Wire a fake streamJob: capture the onUpdate callback, push snapshots.
    const clientModule = await import('../api/client')
    const { watchJobForToast } = await import('../components/toasts')
    const origStreamJob = clientModule.api.streamJob
    const subscribers: ((job: any) => void)[] = []
    clientModule.api.streamJob = ((_id: string, onUpdate: (job: any) => void) => {
      subscribers.push(onUpdate)
      return () => {}
    }) as any

    try {
      watchJobForToast('jobX')

      // push running snapshots — no toast yet
      for (const progress of [10, 50, 90]) {
        for (const sub of subscribers) sub({ id: 'jobX', status: 'running', progress, stage: 'flows', message: null })
      }
      expect(toastMock.success).not.toHaveBeenCalled()

      // terminal snapshot → exactly one toast
      for (const sub of subscribers)
        sub({ id: 'jobX', status: 'completed', progress: 100, stage: 'done', message: null, result: { packets: 128 } })
      expect(toastMock.success).toHaveBeenCalledTimes(1)
      expect(toastMock.success).toHaveBeenCalledWith('Analysis completed — 128 packets', { id: 'job-jobX' })

      // duplicate terminal snapshots must NOT re-toast (dedup guard)
      for (const sub of subscribers)
        sub({ id: 'jobX', status: 'completed', progress: 100, stage: 'done', message: null, result: { packets: 128 } })
      expect(toastMock.success).toHaveBeenCalledTimes(1)
    } finally {
      clientModule.api.streamJob = origStreamJob
    }
  })
})

describe('AlertsPage mutation toasts', () => {
  function seedAlerts(over: Partial<Alert> = {}) {
    const alert = alertFixture(over)
    return {
      alert,
      render: renderPage(<AlertsPage />, {
        initialEntries: ['/alerts'],
        queries: [
          { queryKey: ['captures'], data: [captureFixture()] },
          { queryKey: ['alerts', 'cap1', ''], data: { items: [alert], total: 1, offset: 0, limit: 100 } },
          { queryKey: ['captureDetail', 'cap1'], data: captureFixture() },
        ],
      }),
    }
  }

  it('acks an alert → success toast after the backend confirms', async () => {
    const { alert } = seedAlerts()
    stubFetch([
      {
        match: (url, init) => init?.method === 'POST' && url.includes('/alerts/alert1/ack'),
        respond: () => ok({ ...alert, acknowledged: true }),
      },
    ])

    // expand the card, then click Acknowledge
    act(() => {
      fireEvent.click(screen.getByText(alert.title).closest('button')!)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }))
    })

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Alert acknowledged', { id: 'ack-alert1' }),
    )
    expect(toastMock.error).not.toHaveBeenCalled()
  })

  it('ack failure → error toast with backend detail, no success', async () => {
    const { alert } = seedAlerts()
    stubFetch([
      {
        match: (url, init) => init?.method === 'POST' && url.includes('/alerts/alert1/ack'),
        respond: () => fail('alert is locked', 409),
      },
    ])

    act(() => {
      fireEvent.click(screen.getByText(alert.title).closest('button')!)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }))
    })

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        'Alert update failed — alert is locked',
        { id: 'ack-alert1' },
      ),
    )
    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('saving a note → "Note saved" toast', async () => {
    const { alert } = seedAlerts()
    stubFetch([
      {
        match: (url, init) => init?.method === 'PATCH' && url.includes('/alerts/alert1'),
        respond: () => ok({ ...alert, note: 'checked' }),
      },
    ])

    act(() => {
      fireEvent.click(screen.getByText(alert.title).closest('button')!)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ note' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save note' }))
    })

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Note saved', { id: 'triage-alert1' }),
    )
  })

  it('toggling a triage tag → "Triage updated" toast', async () => {
    const { alert } = seedAlerts()
    stubFetch([
      {
        match: (url, init) => init?.method === 'PATCH' && url.includes('/alerts/alert1'),
        respond: () => ok({ ...alert, tags: ['confirmed'] }),
      },
    ])

    act(() => {
      fireEvent.click(screen.getByText(alert.title).closest('button')!)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'confirmed' }))
    })

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Triage updated', { id: 'triage-alert1' }),
    )
  })
})

describe('CasesPage mutation toasts', () => {
  function seedCases() {
    return renderPage(<CasesPage />, {
      initialEntries: ['/cases'],
      queries: [
        { queryKey: ['captures'], data: [captureFixture()] },
        { queryKey: ['cases'], data: [caseFixture()] },
      ],
    })
  }

  it('creates a case → success toast with the case name', async () => {
    seedCases()
    const created = caseDetailFixture({ id: 'case2', name: 'IR-42' })
    stubFetch([
      {
        match: (url, init) => init?.method === 'POST' && url.endsWith('/cases'),
        respond: () => ok(created),
      },
      {
        match: (url) => url.includes('/cases/case2'),
        respond: () => ok(created), // detail fetch for the newly selected case
      },
      {
        match: (url) => url.includes('/cases'),
        respond: () => ok([caseFixture()]), // list refetch after invalidate
      },
    ])

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Case name'), { target: { value: 'IR-42' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ New case' }))
    })

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Case created — IR-42', { id: 'case-create' }),
    )
    expect(toastMock.error).not.toHaveBeenCalled()
  })

  it('create failure → error toast with backend detail', async () => {
    seedCases()
    stubFetch([
      {
        match: (url, init) => init?.method === 'POST' && url.endsWith('/cases'),
        respond: () => fail('name already exists', 409),
      },
    ])

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Case name'), { target: { value: 'dup' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ New case' }))
    })

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        'Case creation failed — name already exists',
        { id: 'case-create' },
      ),
    )
    expect(toastMock.success).not.toHaveBeenCalled()
  })
})
