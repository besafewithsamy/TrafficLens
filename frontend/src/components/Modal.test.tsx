import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

afterEach(cleanup)

function renderModal(onClose = () => {}) {
  return render(
    <Modal title="Evidence" onClose={onClose}>
      <button type="button">First action</button>
      <button type="button">Second action</button>
    </Modal>,
  )
}

describe('Modal', () => {
  it('renders as a dialog with title and close button', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('Evidence')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined()
  })

  it('moves focus into the dialog on open and restores it on close', () => {
    const opener = document.createElement('button')
    opener.textContent = 'Opener'
    document.body.appendChild(opener)
    opener.focus()

    const { unmount } = renderModal()
    // focus moved inside the dialog (first focusable or the panel)
    expect(document.activeElement).not.toBe(opener)
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)

    unmount()
    // focus restored to the opener
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('traps Tab focus within the dialog', () => {
    renderModal()
    const first = screen.getByRole('button', { name: 'First action' })
    const last = screen.getByRole('button', { name: 'Second action' })
    const closeBtn = screen.getByRole('button', { name: 'Close' })

    // DOM order: [close, first, last]. Tab from the DOM-last wraps to the DOM-first.
    last.focus()
    act(() => {
      fireEvent.keyDown(window, { key: 'Tab' })
    })
    expect(document.activeElement).toBe(closeBtn)

    // Shift-Tab from the DOM-first wraps to the DOM-last.
    closeBtn.focus()
    act(() => {
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    })
    expect(document.activeElement).toBe(last)

    // middle buttons keep normal order (trap doesn't hijack interior tabs)
    first.focus()
    expect(document.activeElement).toBe(first)
  })

  it('closes on Escape', () => {
    let closed = false
    renderModal(() => {
      closed = true
    })
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(closed).toBe(true)
  })
})
