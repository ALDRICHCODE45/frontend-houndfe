import { describe, expect, it } from 'vitest'
import { pendingPaymentsBadge } from '../salesListTabs.utils'

describe('pendingPaymentsBadge', () => {
  it('returns a hidden badge for zero pending payments', () => {
    expect(pendingPaymentsBadge(0)).toEqual({ visible: false, text: null })
  })

  it('returns a visible badge with the count when greater than zero', () => {
    expect(pendingPaymentsBadge(3)).toEqual({ visible: true, text: '3' })
  })

  it('returns a single-digit badge as a string', () => {
    expect(pendingPaymentsBadge(1).text).toBe('1')
  })

  it('returns a multi-digit badge as a string', () => {
    expect(pendingPaymentsBadge(42).text).toBe('42')
  })

  it('never renders a badge for negative counts (defensive)', () => {
    expect(pendingPaymentsBadge(-1)).toEqual({ visible: false, text: null })
  })
})