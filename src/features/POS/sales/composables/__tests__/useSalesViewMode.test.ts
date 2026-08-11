import { describe, expect, it, beforeEach } from 'vitest'
import {
  isSalesViewMode,
  useSalesViewMode,
  SALES_VIEW_MODE_STORAGE_KEY,
} from '../useSalesViewMode'

describe('isSalesViewMode', () => {
  it('accepts the valid sales view modes', () => {
    expect(isSalesViewMode('table')).toBe(true)
    expect(isSalesViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    // `cards` is AppDataTable's displayMode vocabulary, not ours — the guard
    // must reject it so the plural form never reaches localStorage.
    expect(isSalesViewMode('cards')).toBe(false)
    expect(isSalesViewMode('grid')).toBe(false)
    expect(isSalesViewMode('')).toBe(false)
  })
})

describe('useSalesViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uses its own storage key so sales and products view modes stay independent', () => {
    expect(SALES_VIEW_MODE_STORAGE_KEY).toBe('pos-sales-view-mode')
  })

  it('defaults to table when nothing is persisted', () => {
    const { viewMode } = useSalesViewMode()

    expect(viewMode.value).toBe('table')
  })

  it('restores a persisted card mode from localStorage', () => {
    localStorage.setItem(SALES_VIEW_MODE_STORAGE_KEY, 'card')

    const { viewMode } = useSalesViewMode()

    expect(viewMode.value).toBe('card')
  })

  it('falls back to table when the persisted value is not a valid mode', () => {
    localStorage.setItem(SALES_VIEW_MODE_STORAGE_KEY, 'cards')

    const { viewMode } = useSalesViewMode()

    expect(viewMode.value).toBe('table')
  })

  it('persists the selected mode so it survives a reload', async () => {
    const { setMode } = useSalesViewMode()

    setMode('card')
    await Promise.resolve()

    expect(localStorage.getItem(SALES_VIEW_MODE_STORAGE_KEY)).toBe('card')
    // A fresh consumer (the reload) reads back the same mode.
    expect(useSalesViewMode().viewMode.value).toBe('card')
  })

  it('toggles between table and card', () => {
    const { viewMode, toggleViewMode } = useSalesViewMode()

    toggleViewMode()
    expect(viewMode.value).toBe('card')

    toggleViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('bridges the internal mode to AppDataTable displayMode vocabulary', () => {
    // AppDataTable expects 'table' | 'cards'; we store the singular 'card'.
    const { setMode, displayMode } = useSalesViewMode()

    expect(displayMode.value).toBe('table')

    setMode('card')
    expect(displayMode.value).toBe('cards')

    setMode('table')
    expect(displayMode.value).toBe('table')
  })
})
