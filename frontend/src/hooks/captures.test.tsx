import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './captures'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('start'))
    expect(result.current).toBe('start')
  })

  it('updates only after the delay', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), {
      initialProps: { v: 'a' },
    })
    rerender({ v: 'ab' })
    expect(result.current).toBe('a') // not yet
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('ab')
  })

  it('collapses rapid changes into one update', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), {
      initialProps: { v: '' },
    })
    for (const v of ['x', 'xy', 'xyz', 'xyzw']) rerender({ v })
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('') // still mid-debounce
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('xyzw') // only the final value lands
  })
})
