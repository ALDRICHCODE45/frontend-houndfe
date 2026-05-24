import { describe, it, expect, vi, afterEach } from 'vitest'
import { format } from 'date-fns'
import { formatSaleDate, formatSaleDueDate } from '../saleDate.utils'

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

  describe('formatSaleDueDate', () => {
    it('renders the UTC day of a midnight-UTC timestamp without timezone shift', () => {
      // Bug reported: backend stores dueDate as midnight UTC; rendering with
      // local timezone in negative offsets (e.g. UTC-6 Mexico City) was shifting
      // "2026-05-30T00:00:00Z" backwards to "29/05/2026". formatSaleDueDate
      // uses UTC components to keep the day stable across timezones.
      expect(formatSaleDueDate('2026-05-30T00:00:00.000Z')).toBe('30/05/2026')
    })

    it('omits the time component entirely', () => {
      // dueDate is semantically a calendar date, not an instant — no clock.
      expect(formatSaleDueDate('2026-07-01T14:43:00.000Z')).not.toMatch(/\d{2}:\d{2}/)
    })

    it('renders dd/MM/yyyy format', () => {
      expect(formatSaleDueDate('2026-12-09T00:00:00.000Z')).toBe('09/12/2026')
      expect(formatSaleDueDate('2026-01-05T00:00:00.000Z')).toBe('05/01/2026')
    })
  })
})
