import { describe, it, expect, vi, afterEach } from 'vitest'
import { format } from 'date-fns'
import { formatSaleDate } from '../saleDate.utils'

describe('saleDate.utils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats today values as relative text', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T14:50:00.000Z'))

    const iso = '2026-05-06T14:43:00.000Z'
    const result = formatSaleDate(iso)
    const hour = format(new Date(iso), 'HH:mm')

    expect(result).toBe(`Hoy a las ${hour}`)
  })

  it('formats yesterday values as relative text', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T12:00:00.000Z'))

    const iso = '2026-05-06T08:29:12.000Z'
    const result = formatSaleDate(iso)
    const hour = format(new Date(iso), 'HH:mm')

    expect(result).toBe(`Ayer a las ${hour}`)
  })

  it('formats older values using absolute date and time with seconds', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-10T00:00:00.000Z'))

    const iso = '2026-05-06T08:29:12.000Z'
    const result = formatSaleDate(iso)
    const absolute = format(new Date(iso), 'dd/MM/yyyy HH:mm:ss')

    expect(result).toBe(absolute)
  })
})
