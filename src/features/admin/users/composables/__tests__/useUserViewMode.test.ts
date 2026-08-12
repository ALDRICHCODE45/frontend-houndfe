import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  USER_VIEW_MODE_STORAGE_KEY,
  isUserViewMode,
  useUserViewMode,
} from '../useUserViewMode'

describe('isUserViewMode', () => {
  it('accepts the valid admin-users view modes', () => {
    expect(isUserViewMode('table')).toBe(true)
    expect(isUserViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    expect(isUserViewMode('cards')).toBe(false)
    expect(isUserViewMode('grid')).toBe(false)
    expect(isUserViewMode('')).toBe(false)
  })
})

describe('useUserViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to "table" when storage is empty', () => {
    const { viewMode } = useUserViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('falls back to "table" when the stored value is invalid', () => {
    localStorage.setItem(USER_VIEW_MODE_STORAGE_KEY, 'bogus')
    const { viewMode } = useUserViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('persists the chosen mode to localStorage', async () => {
    const { viewMode, setMode } = useUserViewMode()
    setMode('card')
    await nextTick()
    expect(localStorage.getItem(USER_VIEW_MODE_STORAGE_KEY)).toBe('card')
    expect(viewMode.value).toBe('card')
  })

  it('reads an existing valid value from localStorage on subsequent composable instances', () => {
    localStorage.setItem(USER_VIEW_MODE_STORAGE_KEY, 'card')
    const { viewMode } = useUserViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('toggleViewMode switches between the two modes', async () => {
    const { viewMode, toggleViewMode } = useUserViewMode()
    expect(viewMode.value).toBe('table')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('card')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('table')
  })

  it('displayMode bridges "card" to "cards" for AppDataTable', () => {
    const { displayMode, setMode } = useUserViewMode()
    expect(displayMode.value).toBe('table')
    setMode('card')
    expect(displayMode.value).toBe('cards')
    setMode('table')
    expect(displayMode.value).toBe('table')
  })
})
