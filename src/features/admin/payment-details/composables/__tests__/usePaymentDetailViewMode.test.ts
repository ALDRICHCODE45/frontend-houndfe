import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import {
  PAYMENT_DETAIL_VIEW_MODE_STORAGE_KEY,
  isPaymentDetailViewMode,
  usePaymentDetailViewMode,
} from '../usePaymentDetailViewMode'

describe('isPaymentDetailViewMode (sdd payment-details-admin S2)', () => {
  it('accepts the valid admin-payment-details view modes', () => {
    expect(isPaymentDetailViewMode('table')).toBe(true)
    expect(isPaymentDetailViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    expect(isPaymentDetailViewMode('cards')).toBe(false)
    expect(isPaymentDetailViewMode('grid')).toBe(false)
    expect(isPaymentDetailViewMode('')).toBe(false)
    expect(isPaymentDetailViewMode('TABLE')).toBe(false)
  })
})

describe('usePaymentDetailViewMode (sdd payment-details-admin S2)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to "table" when storage is empty', () => {
    const { viewMode } = usePaymentDetailViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('falls back to "table" when the stored value is invalid', () => {
    localStorage.setItem(PAYMENT_DETAIL_VIEW_MODE_STORAGE_KEY, 'bogus')
    const { viewMode } = usePaymentDetailViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('persists the chosen mode to localStorage', async () => {
    const { viewMode, setMode } = usePaymentDetailViewMode()
    setMode('card')
    await nextTick()
    expect(localStorage.getItem(PAYMENT_DETAIL_VIEW_MODE_STORAGE_KEY)).toBe('card')
    expect(viewMode.value).toBe('card')
  })

  it('reads an existing valid value from localStorage on subsequent composable instances', () => {
    localStorage.setItem(PAYMENT_DETAIL_VIEW_MODE_STORAGE_KEY, 'card')
    const { viewMode } = usePaymentDetailViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('toggleViewMode switches between the two modes', async () => {
    const { viewMode, toggleViewMode } = usePaymentDetailViewMode()
    expect(viewMode.value).toBe('table')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('card')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('table')
  })

  it('displayMode bridges "card" to "cards" for AppDataTable', () => {
    const { displayMode, setMode } = usePaymentDetailViewMode()
    expect(displayMode.value).toBe('table')
    setMode('card')
    expect(displayMode.value).toBe('cards')
    setMode('table')
    expect(displayMode.value).toBe('table')
  })

  it('exposes toggleViewMode, not setMode semantics, for table<->card cycling', () => {
    const keys = Object.keys(usePaymentDetailViewMode()).sort()
    // Locked contract: setMode + toggleViewMode + viewMode + displayMode
    expect(keys).toEqual(['displayMode', 'setMode', 'toggleViewMode', 'viewMode'])
  })
})
