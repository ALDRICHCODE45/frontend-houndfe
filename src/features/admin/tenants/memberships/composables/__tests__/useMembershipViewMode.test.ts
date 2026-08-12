/**
 * useMembershipViewMode — view mode preference composable.
 *
 * Persists the table/card preference in localStorage under
 * `admin-tenant-members-view-mode`. Bridges `card` → `cards` for
 * AppDataTable's `displayMode` prop. Mirrors `useTenantViewMode`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  MEMBERSHIP_VIEW_MODE_STORAGE_KEY,
  isMembershipViewMode,
  useMembershipViewMode,
} from '../useMembershipViewMode'

describe('isMembershipViewMode', () => {
  it('accepts the valid admin-tenant-members view modes', () => {
    expect(isMembershipViewMode('table')).toBe(true)
    expect(isMembershipViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    expect(isMembershipViewMode('cards')).toBe(false)
    expect(isMembershipViewMode('grid')).toBe(false)
    expect(isMembershipViewMode('')).toBe(false)
  })
})

describe('useMembershipViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to "table" when storage is empty', () => {
    const { viewMode } = useMembershipViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('falls back to "table" when the stored value is invalid', () => {
    localStorage.setItem(MEMBERSHIP_VIEW_MODE_STORAGE_KEY, 'bogus')
    const { viewMode } = useMembershipViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('persists the chosen mode to localStorage', async () => {
    const { viewMode, setMode } = useMembershipViewMode()
    setMode('card')
    await nextTick()
    expect(localStorage.getItem(MEMBERSHIP_VIEW_MODE_STORAGE_KEY)).toBe('card')
    expect(viewMode.value).toBe('card')
  })

  it('reads an existing valid value from localStorage on subsequent composable instances', () => {
    localStorage.setItem(MEMBERSHIP_VIEW_MODE_STORAGE_KEY, 'card')
    const { viewMode } = useMembershipViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('toggleViewMode switches between the two modes', async () => {
    const { viewMode, toggleViewMode } = useMembershipViewMode()
    expect(viewMode.value).toBe('table')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('card')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('table')
  })

  it('displayMode bridges "card" to "cards" for AppDataTable', () => {
    const { displayMode, setMode } = useMembershipViewMode()
    expect(displayMode.value).toBe('table')
    setMode('card')
    expect(displayMode.value).toBe('cards')
    setMode('table')
    expect(displayMode.value).toBe('table')
  })
})