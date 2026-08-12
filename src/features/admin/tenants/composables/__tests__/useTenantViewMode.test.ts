/**
 * useTenantViewMode — view mode preference composable.
 *
 * Persists the table/card preference in localStorage under
 * `admin-tenants-view-mode`. Bridges `card` → `cards` for AppDataTable's
 * `displayMode` prop. Mirrors `useRoleViewMode`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  TENANT_VIEW_MODE_STORAGE_KEY,
  isTenantViewMode,
  useTenantViewMode,
} from '../useTenantViewMode'

describe('isTenantViewMode', () => {
  it('accepts the valid admin-tenants view modes', () => {
    expect(isTenantViewMode('table')).toBe(true)
    expect(isTenantViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    expect(isTenantViewMode('cards')).toBe(false)
    expect(isTenantViewMode('grid')).toBe(false)
    expect(isTenantViewMode('')).toBe(false)
  })
})

describe('useTenantViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to "table" when storage is empty', () => {
    const { viewMode } = useTenantViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('falls back to "table" when the stored value is invalid', () => {
    localStorage.setItem(TENANT_VIEW_MODE_STORAGE_KEY, 'bogus')
    const { viewMode } = useTenantViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('persists the chosen mode to localStorage', async () => {
    const { viewMode, setMode } = useTenantViewMode()
    setMode('card')
    await nextTick()
    expect(localStorage.getItem(TENANT_VIEW_MODE_STORAGE_KEY)).toBe('card')
    expect(viewMode.value).toBe('card')
  })

  it('reads an existing valid value from localStorage on subsequent composable instances', () => {
    localStorage.setItem(TENANT_VIEW_MODE_STORAGE_KEY, 'card')
    const { viewMode } = useTenantViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('toggleViewMode switches between the two modes', async () => {
    const { viewMode, toggleViewMode } = useTenantViewMode()
    expect(viewMode.value).toBe('table')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('card')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('table')
  })

  it('displayMode bridges "card" to "cards" for AppDataTable', () => {
    const { displayMode, setMode } = useTenantViewMode()
    expect(displayMode.value).toBe('table')
    setMode('card')
    expect(displayMode.value).toBe('cards')
    setMode('table')
    expect(displayMode.value).toBe('table')
  })
})