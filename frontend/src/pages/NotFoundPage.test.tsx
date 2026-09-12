import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { NotFoundPage } from './NotFoundPage'
import { renderPage } from '../test/harness'

afterEach(cleanup)

/** Characterization tests for NotFoundPage (pre Phase-3 sweep). */

describe('NotFoundPage', () => {
  it('renders 404, message and back-to-dashboard link', () => {
    renderPage(<NotFoundPage />, { initialEntries: ['/nowhere'] })
    expect(screen.getByText('404')).toBeDefined()
    expect(screen.getByText(/This page doesn't exist/)).toBeDefined()
    const link = screen.getByRole('link', { name: /Back to dashboard/ })
    expect(link.getAttribute('href')).toBe('/')
  })
})
