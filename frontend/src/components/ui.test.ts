import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, formatTime } from './ui'

describe('formatBytes', () => {
  it('handles zero and falsy', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500.0 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes and caps at GB', () => {
    expect(formatBytes(1024 ** 2)).toBe('1.0 MB')
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB')
    expect(formatBytes(1024 ** 4)).toBe('1024.0 GB') // capped unit
  })
})

describe('formatTime', () => {
  it('returns dash for null', () => {
    expect(formatTime(null)).toBe('—')
  })

  it('formats epoch seconds', () => {
    const ts = new Date('2026-09-11T12:00:00').getTime() / 1000
    expect(formatTime(ts)).toMatch(/\d{2}:\d{2}:\d{2}/)
  })
})

describe('formatDuration', () => {
  it('returns dash when bounds missing', () => {
    expect(formatDuration(null, 5)).toBe('—')
    expect(formatDuration(5, null)).toBe('—')
  })

  it('never goes negative', () => {
    expect(formatDuration(10, 5)).toBe('0.0s')
  })

  it('formats seconds with one decimal', () => {
    expect(formatDuration(0, 2.5)).toBe('2.5s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(0, 125)).toBe('2m 5s')
  })
})
