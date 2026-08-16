/**
 * WU-A — usePendingApprovalsViewMode specs (REQ-2)
 *
 * Pinned:
 *  - PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY = 'pending-approvals-view-mode'
 *  - default mode = 'card'  (deliberate tray UX)
 *  - invalid stored value falls back to 'card'
 *  - displayMode bridges 'card' -> 'cards' (AppDataTable contract)
 *  - isPendingApprovalsViewMode accepts only 'table' | 'card'
 *  - localStorage round-trip
 *
 * RED — written before usePendingApprovalsViewMode production code.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY,
  isPendingApprovalsViewMode,
  usePendingApprovalsViewMode,
} from '../usePendingApprovalsViewMode'

describe('isPendingApprovalsViewMode — type guard', () => {
  it('accepts "table"', () => {
    expect(isPendingApprovalsViewMode('table')).toBe(true)
  })

  it('accepts "card"', () => {
    expect(isPendingApprovalsViewMode('card')).toBe(true)
  })

  it('rejects "cards" (plural — AppDataTable shape, not internal storage)', () => {
    expect(isPendingApprovalsViewMode('cards')).toBe(false)
  })

  it('rejects unknown values', () => {
    expect(isPendingApprovalsViewMode('kanban')).toBe(false)
    expect(isPendingApprovalsViewMode('')).toBe(false)
    expect(isPendingApprovalsViewMode('TABLE')).toBe(false)
    expect(isPendingApprovalsViewMode('Card')).toBe(false)
  })
})

describe('usePendingApprovalsViewMode — reactive composable', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to "card" when localStorage is empty (deliberate tray UX)', () => {
    const { viewMode } = usePendingApprovalsViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('falls back to "card" when the stored value is invalid', () => {
    localStorage.setItem(PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY, 'bogus-mode')
    const { viewMode } = usePendingApprovalsViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('persists the chosen mode under PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY', async () => {
    const { viewMode, setMode } = usePendingApprovalsViewMode()
    setMode('table')
    await nextTick()
    expect(localStorage.getItem(PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY)).toBe('table')
    expect(viewMode.value).toBe('table')
  })

  it('reads a previously persisted valid value from localStorage', () => {
    localStorage.setItem(PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY, 'table')
    const { viewMode } = usePendingApprovalsViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('toggleViewMode switches between table and card', async () => {
    const { viewMode, toggleViewMode } = usePendingApprovalsViewMode()
    expect(viewMode.value).toBe('card')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('table')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('card')
  })

  it('exposes displayMode that bridges "card" to "cards" for AppDataTable', () => {
    const { displayMode, setMode } = usePendingApprovalsViewMode()
    expect(displayMode.value).toBe('cards')
    setMode('table')
    expect(displayMode.value).toBe('table')
    setMode('card')
    expect(displayMode.value).toBe('cards')
  })

  it('exposes displayMode that stays "table" when localStorage was already "table"', () => {
    localStorage.setItem(PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY, 'table')
    const { displayMode } = usePendingApprovalsViewMode()
    expect(displayMode.value).toBe('table')
  })

  it('localStorage round-trip: setMode persists, fresh composable reads it back', async () => {
    const first = usePendingApprovalsViewMode()
    first.setMode('table')
    await nextTick()
    expect(localStorage.getItem(PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY)).toBe('table')

    // Mount a fresh composable — it must read from localStorage, not the default.
    const second = usePendingApprovalsViewMode()
    expect(second.viewMode.value).toBe('table')
    expect(second.displayMode.value).toBe('table')
  })
})