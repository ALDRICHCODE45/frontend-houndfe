/**
 * WU-A — useEmployeeViewMode specs
 *
 * Covers REQ-6 (view mode preference with displayMode bridge).
 *
 * Pinned:
 *  - EMPLOYEE_VIEW_MODE_STORAGE_KEY = 'employee-view-mode'
 *  - default mode = 'table'
 *  - invalid stored value falls back to 'table'
 *  - displayMode bridges 'card' -> 'cards' (AppDataTable contract)
 *  - isEmployeeViewMode accepts only 'table' | 'card'
 *
 * RED — written before any production change to useEmployeeViewMode.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  EMPLOYEE_VIEW_MODE_STORAGE_KEY,
  isEmployeeViewMode,
  useEmployeeViewMode,
} from '../useEmployeeViewMode'

describe('isEmployeeViewMode — type guard', () => {
  it('accepts "table"', () => {
    expect(isEmployeeViewMode('table')).toBe(true)
  })

  it('accepts "card"', () => {
    expect(isEmployeeViewMode('card')).toBe(true)
  })

  it('rejects "cards" (plural — AppDataTable shape, not internal storage)', () => {
    expect(isEmployeeViewMode('cards')).toBe(false)
  })

  it('rejects unknown values', () => {
    expect(isEmployeeViewMode('grid')).toBe(false)
    expect(isEmployeeViewMode('')).toBe(false)
    expect(isEmployeeViewMode('TABLE')).toBe(false)
  })
})

describe('useEmployeeViewMode — reactive composable', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to "table" when localStorage is empty', () => {
    const { viewMode } = useEmployeeViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('falls back to "table" when the stored value is invalid', () => {
    localStorage.setItem(EMPLOYEE_VIEW_MODE_STORAGE_KEY, 'bogus-mode')
    const { viewMode } = useEmployeeViewMode()
    expect(viewMode.value).toBe('table')
  })

  it('persists the chosen mode under EMPLOYEE_VIEW_MODE_STORAGE_KEY', async () => {
    const { viewMode, setMode } = useEmployeeViewMode()
    setMode('card')
    await nextTick()
    expect(localStorage.getItem(EMPLOYEE_VIEW_MODE_STORAGE_KEY)).toBe('card')
    expect(viewMode.value).toBe('card')
  })

  it('reads a previously persisted valid value from localStorage', () => {
    localStorage.setItem(EMPLOYEE_VIEW_MODE_STORAGE_KEY, 'card')
    const { viewMode } = useEmployeeViewMode()
    expect(viewMode.value).toBe('card')
  })

  it('toggleViewMode switches between table and card', async () => {
    const { viewMode, toggleViewMode } = useEmployeeViewMode()
    expect(viewMode.value).toBe('table')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('card')
    toggleViewMode()
    await nextTick()
    expect(viewMode.value).toBe('table')
  })

  it('exposes displayMode that bridges "card" to "cards" for AppDataTable', () => {
    const { displayMode, setMode } = useEmployeeViewMode()
    expect(displayMode.value).toBe('table')
    setMode('card')
    expect(displayMode.value).toBe('cards')
    setMode('table')
    expect(displayMode.value).toBe('table')
  })

  it('exposes displayMode that stays "cards" when localStorage was already "card"', () => {
    localStorage.setItem(EMPLOYEE_VIEW_MODE_STORAGE_KEY, 'card')
    const { displayMode } = useEmployeeViewMode()
    expect(displayMode.value).toBe('cards')
  })
})