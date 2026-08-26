import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import {
  PAYMENT_METHOD_VIEW_MODE_STORAGE_KEY,
  isPaymentMethodViewMode,
  usePaymentMethodViewMode,
} from '../usePaymentMethodViewMode'

describe('isPaymentMethodViewMode (sdd custom-payment-methods S2A)', () => {
  it('accepts the valid admin-payment-methods view modes', () => {
    expect(isPaymentMethodViewMode('table')).toBe(true)
    expect(isPaymentMethodViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    expect(isPaymentMethodViewMode('cards')).toBe(false)
    expect(isPaymentMethodViewMode('grid')).toBe(false)
    expect(isPaymentMethodViewMode('')).toBe(false)
    expect(isPaymentMethodViewMode('TABLE')).toBe(false)
  })
})

describe('usePaymentMethodViewMode (sdd custom-payment-methods S2A)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to "table" when storage is empty', () => {
    const { viewMode } = usePaymentMethodViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('falls back to "table" when the stored value is invalid', () => {
    localStorage.setItem(PAYMENT_METHOD_VIEW_MODE_STORAGE_KEY, 'bogus')
    const { viewMode } = usePaymentMethodViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('persists the chosen mode to localStorage', async () => {
    const { viewMode, setMode } = usePaymentMethodViewMode()
    setMode('card')
    await nextTick()
    expect(localStorage.getItem(PAYMENT_METHOD_VIEW_MODE_STORAGE_KEY)).toBe('card')
    expect(viewMode.value).toBe('card')
  })

  it('reads an existing valid value from localStorage on subsequent composable instances', () => {
    localStorage.setItem(PAYMENT_METHOD_VIEW_MODE_STORAGE_KEY, 'card')
    const { viewMode } = usePaymentMethodViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('toggleViewMode switches between the two modes', async () => {
    const { viewMode, toggleViewMode } = usePaymentMethodViewMode()
    expect(viewMode.value).toBe('table')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('card')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('table')
  })

  it('displayMode bridges "card" to "cards" for AppDataTable', () => {
    const { displayMode, setMode } = usePaymentMethodViewMode()
    expect(displayMode.value).toBe('table')
    setMode('card')
    expect(displayMode.value).toBe('cards')
    setMode('table')
    expect(displayMode.value).toBe('table')
  })

  it('exposes toggleViewMode + setMode + viewMode + displayMode contracts', () => {
    const keys = Object.keys(usePaymentMethodViewMode()).sort()
    expect(keys).toEqual(['displayMode', 'setMode', 'toggleViewMode', 'viewMode'])
  })
})