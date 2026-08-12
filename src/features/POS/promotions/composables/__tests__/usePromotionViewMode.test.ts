import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  PROMOTION_VIEW_MODE_STORAGE_KEY,
  isPromotionViewMode,
  usePromotionViewMode,
} from '../usePromotionViewMode'

describe('isPromotionViewMode', () => {
  it('accepts the valid promotion view modes', () => {
    expect(isPromotionViewMode('table')).toBe(true)
    expect(isPromotionViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    expect(isPromotionViewMode('cards')).toBe(false)
    expect(isPromotionViewMode('grid')).toBe(false)
    expect(isPromotionViewMode('')).toBe(false)
  })
})

describe('usePromotionViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to "table" when storage is empty', () => {
    const { viewMode } = usePromotionViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('falls back to "table" when the stored value is invalid', () => {
    localStorage.setItem(PROMOTION_VIEW_MODE_STORAGE_KEY, 'bogus')
    const { viewMode } = usePromotionViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('persists the chosen mode to localStorage', async () => {
    const { viewMode, setMode } = usePromotionViewMode()
    setMode('card')
    await nextTick()
    expect(localStorage.getItem(PROMOTION_VIEW_MODE_STORAGE_KEY)).toBe('card')
    expect(viewMode.value).toBe('card')
  })

  it('reads an existing valid value from localStorage on subsequent composable instances', () => {
    localStorage.setItem(PROMOTION_VIEW_MODE_STORAGE_KEY, 'card')
    const { viewMode } = usePromotionViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('toggleViewMode switches between the two modes', async () => {
    const { viewMode, toggleViewMode } = usePromotionViewMode()
    expect(viewMode.value).toBe('table')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('card')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('table')
  })

  it('displayMode bridges "card" to "cards" for AppDataTable', () => {
    const { displayMode, setMode } = usePromotionViewMode()
    expect(displayMode.value).toBe('table')
    setMode('card')
    expect(displayMode.value).toBe('cards')
    setMode('table')
    expect(displayMode.value).toBe('table')
  })
})