import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  CUSTOMER_VIEW_MODE_STORAGE_KEY,
  isCustomerViewMode,
  useCustomerViewMode,
} from '../useCustomerViewMode'

describe('isCustomerViewMode', () => {
  it('accepts the valid customer view modes', () => {
    expect(isCustomerViewMode('table')).toBe(true)
    expect(isCustomerViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    expect(isCustomerViewMode('cards')).toBe(false)
    expect(isCustomerViewMode('grid')).toBe(false)
    expect(isCustomerViewMode('')).toBe(false)
  })
})

describe('useCustomerViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to "table" when storage is empty', () => {
    const { viewMode } = useCustomerViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('falls back to "table" when the stored value is invalid', () => {
    localStorage.setItem(CUSTOMER_VIEW_MODE_STORAGE_KEY, 'bogus')
    const { viewMode } = useCustomerViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('persists the chosen mode to localStorage', async () => {
    const { viewMode, setMode } = useCustomerViewMode()
    setMode('card')
    await nextTick()
    expect(localStorage.getItem(CUSTOMER_VIEW_MODE_STORAGE_KEY)).toBe('card')
    expect(viewMode.value).toBe('card')
  })

  it('reads an existing valid value from localStorage on subsequent composable instances', () => {
    localStorage.setItem(CUSTOMER_VIEW_MODE_STORAGE_KEY, 'card')
    const { viewMode } = useCustomerViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('toggleViewMode switches between the two modes', async () => {
    const { viewMode, toggleViewMode } = useCustomerViewMode()
    expect(viewMode.value).toBe('table')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('card')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('table')
  })

  it('displayMode bridges "card" to "cards" for AppDataTable', () => {
    const { displayMode, setMode } = useCustomerViewMode()
    expect(displayMode.value).toBe('table')
    setMode('card')
    expect(displayMode.value).toBe('cards')
    setMode('table')
    expect(displayMode.value).toBe('table')
  })
})
