import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/**
 * Renders a page inside MemoryRouter + a QueryClient whose cache is
 * pre-seeded with the given entries — no network, no loading states.
 *
 * Usage:
 *   renderPage(<AlertsPage />, {
 *     initialEntries: ['/alerts?capture_id=cap1'],
 *     queries: [{ queryKey: ['captures'], data: [captureFixture()] }],
 *   })
 */
export function renderPage(
  ui: ReactElement,
  opts: {
    initialEntries?: string[]
    path?: string
    queries?: { queryKey: unknown[]; data: unknown }[]
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchInterval: false, gcTime: Infinity, staleTime: Infinity },
    },
  })
  for (const { queryKey, data } of opts.queries ?? []) {
    queryClient.setQueryData(queryKey, data)
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={opts.initialEntries ?? ['/']}>
        <Routes>
          <Route path={opts.path ?? '/'} element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** QueryClient with the same seeding, for tests needing the client itself. */
export function seededQueryClient(
  queries: { queryKey: unknown[]; data: unknown }[] = [],
): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchInterval: false, gcTime: Infinity, staleTime: Infinity },
    },
  })
  for (const { queryKey, data } of queries) {
    queryClient.setQueryData(queryKey, data)
  }
  return queryClient
}
