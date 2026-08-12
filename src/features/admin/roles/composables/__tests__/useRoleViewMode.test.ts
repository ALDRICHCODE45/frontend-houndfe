import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  ROLE_VIEW_MODE_STORAGE_KEY,
  isRoleViewMode,
  useRoleViewMode,
} from '../useRoleViewMode'

describe('isRoleViewMode', () => {
  it('accepts the valid admin-roles view modes', () => {
    expect(isRoleViewMode('table')).toBe(true)
    expect(isRoleViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    expect(isRoleViewMode('cards')).toBe(false)
    expect(isRoleViewMode('grid')).toBe(false)
    expect(isRoleViewMode('')).toBe(false)
  })
})

describe('useRoleViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to "table" when storage is empty', () => {
    const { viewMode } = useRoleViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('falls back to "table" when the stored value is invalid', () => {
    localStorage.setItem(ROLE_VIEW_MODE_STORAGE_KEY, 'bogus')
    const { viewMode } = useRoleViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('persists the chosen mode to localStorage', async () => {
    const { viewMode, setMode } = useRoleViewMode()
    setMode('card')
    await nextTick()
    expect(localStorage.getItem(ROLE_VIEW_MODE_STORAGE_KEY)).toBe('card')
    expect(viewMode.value).toBe('card')
  })

  it('reads an existing valid value from localStorage on subsequent composable instances', () => {
    localStorage.setItem(ROLE_VIEW_MODE_STORAGE_KEY, 'card')
    const { viewMode } = useRoleViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('toggleViewMode switches between the two modes', async () => {
    const { viewMode, toggleViewMode } = useRoleViewMode()
    expect(viewMode.value).toBe('table')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('card')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('table')
  })

  it('displayMode bridges "card" to "cards" for AppDataTable', () => {
    const { displayMode, setMode } = useRoleViewMode()
    expect(displayMode.value).toBe('table')
    setMode('card')
    expect(displayMode.value).toBe('cards')
    setMode('table')
    expect(displayMode.value).toBe('table')
  })
})
