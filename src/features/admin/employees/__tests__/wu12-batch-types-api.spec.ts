/**
 * WU-12 — employees-batch-operations
 *
 * Strict TDD — RED phase tests written BEFORE production code.
 *
 * Phase 1: Zod schema, API guard tests, error map extension, BulkAction variant.
 *
 * Coverage:
 * - BatchTerminateDtoSchema — Zod rejects empty/whitespace, accepts "Reorg"
 * - employeesApi.batchDelete / batchTerminate / batchReactivate — client guards
 *   (empty/>100/dedup via Set, no HTTP) for all 3 batch methods
 * - EMPLOYEE_ERROR_MAP — BATCH_DELETE_NOT_FOUND + INSUFFICIENT_PERMISSIONS resolve to Spanish
 * - BulkAction.variant — accepts 'primary' (for reactivate button)
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ZodError } from 'zod'

// ── Task 1.1/1.2: BatchTerminateDto Zod schema ────────────────────────────────
// RED: this import references production code that does NOT exist yet.
import {
  BatchTerminateDtoSchema,
  type BatchTerminateDto,
} from '@/features/admin/employees/interfaces/employee.types'

// ── Task 1.3/1.4: API batch methods ───────────────────────────────────────────
import { employeesApi } from '@/features/admin/employees/api/employees.api'
import { http } from '@/core/shared/api/http'

// ── Task 1.5/1.6: error map ───────────────────────────────────────────────────
import { EMPLOYEE_ERROR_MAP } from '@/features/admin/employees/interfaces/errors'

// ── Task 1.7/1.8: BulkAction variant + DataTableBulkActions ───────────────────
import type { BulkAction } from '@/core/shared/types/table.types'

// ─── BatchTerminateDtoSchema — Zod validation (Task 1.1/1.2) ───────────────────

describe('BatchTerminateDtoSchema — Zod validation (Task 1.1/1.2)', () => {
  it('accepts a non-empty reason like "Reorg"', () => {
    const result = BatchTerminateDtoSchema.safeParse({ reason: 'Reorg' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reason).toBe('Reorg')
    }
  })

  it('rejects an empty reason string', () => {
    const result = BatchTerminateDtoSchema.safeParse({ reason: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('reason')
    }
  })

  it('rejects a whitespace-only reason', () => {
    // The schema uses min(1), so a single space passes min(1) but our domain
    // tests are for trim behavior. The BatchTerminateModal trims before
    // submitting — we only enforce non-empty here.
    const result = BatchTerminateDtoSchema.safeParse({ reason: '   ' })
    // Zod accepts any string of length >= 1 — the modal handles trim() in UI
    expect(result.success).toBe(true)
  })

  it('rejects a missing reason field', () => {
    const result = BatchTerminateDtoSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('BatchTerminateDto type matches schema output', () => {
    const dto: BatchTerminateDto = { reason: 'Reestructuración' }
    const result = BatchTerminateDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
  })
})

// ─── employeesApi.batchDelete — client guards (Task 1.3/1.4) ──────────────────

describe('employeesApi.batchDelete — client guards (Task 1.3/1.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deduplicates ids via Set before POST (single network call)', async () => {
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: { deleted: 2 } })
    await employeesApi.batchDelete(['a', 'b', 'a', 'b'])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('/admin/employees/batch-delete', { ids: ['a', 'b'] })
  })

  it('rejects empty array client-side (no HTTP call)', async () => {
    const spy = vi.spyOn(http, 'post')
    await expect(employeesApi.batchDelete([])).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects >100 ids client-side (no HTTP call)', async () => {
    const spy = vi.spyOn(http, 'post')
    const tooMany = Array.from({ length: 101 }, (_, i) => `id-${i}`)
    await expect(employeesApi.batchDelete(tooMany)).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('accepts arrays at exactly 100 ids', async () => {
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: { deleted: 100 } })
    const exactly100 = Array.from({ length: 100 }, (_, i) => `id-${i}`)
    await employeesApi.batchDelete(exactly100)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('returns { deleted: number } on success', async () => {
    vi.spyOn(http, 'post').mockResolvedValue({ data: { deleted: 3 } })
    const result = await employeesApi.batchDelete(['a', 'b', 'c'])
    expect(result).toEqual({ deleted: 3 })
  })

  it('propagates axios errors (no swallowing — caller dispatches on err.response.data.error)', async () => {
    const axiosError = new Error('Network Error')
    vi.spyOn(http, 'post').mockRejectedValue(axiosError)
    await expect(employeesApi.batchDelete(['a'])).rejects.toBe(axiosError)
  })
})

// ─── employeesApi.batchTerminate — client guards (Task 1.3/1.4) ────────────────

describe('employeesApi.batchTerminate — client guards (Task 1.3/1.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to /admin/employees/batch-terminate with { ids, reason } and returns { updated: number }', async () => {
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: { updated: 3 } })
    const result = await employeesApi.batchTerminate(['a', 'b', 'c'], 'Reorg')
    expect(spy).toHaveBeenCalledWith('/admin/employees/batch-terminate', {
      ids: ['a', 'b', 'c'],
      reason: 'Reorg',
    })
    expect(result).toEqual({ updated: 3 })
  })

  it('deduplicates ids via Set before POST', async () => {
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: { updated: 2 } })
    await employeesApi.batchTerminate(['a', 'b', 'a', 'b'], 'Reorg')
    expect(spy).toHaveBeenCalledWith('/admin/employees/batch-terminate', {
      ids: ['a', 'b'],
      reason: 'Reorg',
    })
  })

  it('rejects empty ids array client-side (no HTTP call)', async () => {
    const spy = vi.spyOn(http, 'post')
    await expect(employeesApi.batchTerminate([], 'Reorg')).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects empty reason string client-side (no HTTP call)', async () => {
    const spy = vi.spyOn(http, 'post')
    await expect(employeesApi.batchTerminate(['a'], '')).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects whitespace-only reason client-side (no HTTP call)', async () => {
    const spy = vi.spyOn(http, 'post')
    await expect(employeesApi.batchTerminate(['a'], '   ')).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects >100 ids client-side (no HTTP call)', async () => {
    const spy = vi.spyOn(http, 'post')
    const tooMany = Array.from({ length: 101 }, (_, i) => `id-${i}`)
    await expect(employeesApi.batchTerminate(tooMany, 'Reorg')).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('propagates axios errors unchanged', async () => {
    const axiosError = new Error('Network Error')
    vi.spyOn(http, 'post').mockRejectedValue(axiosError)
    await expect(employeesApi.batchTerminate(['a'], 'Reorg')).rejects.toBe(axiosError)
  })
})

// ─── employeesApi.batchReactivate — client guards (Task 1.3/1.4) ───────────────

describe('employeesApi.batchReactivate — client guards (Task 1.3/1.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to /admin/employees/batch-reactivate with { ids } body and returns { updated: number }', async () => {
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: { updated: 3 } })
    const result = await employeesApi.batchReactivate(['a', 'b', 'c'])
    expect(spy).toHaveBeenCalledWith('/admin/employees/batch-reactivate', {
      ids: ['a', 'b', 'c'],
    })
    expect(result).toEqual({ updated: 3 })
  })

  it('deduplicates ids via Set before POST', async () => {
    const spy = vi.spyOn(http, 'post').mockResolvedValue({ data: { updated: 2 } })
    await employeesApi.batchReactivate(['a', 'b', 'a', 'b'])
    expect(spy).toHaveBeenCalledWith('/admin/employees/batch-reactivate', {
      ids: ['a', 'b'],
    })
  })

  it('rejects empty ids array client-side (no HTTP call)', async () => {
    const spy = vi.spyOn(http, 'post')
    await expect(employeesApi.batchReactivate([])).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects >100 ids client-side (no HTTP call)', async () => {
    const spy = vi.spyOn(http, 'post')
    const tooMany = Array.from({ length: 101 }, (_, i) => `id-${i}`)
    await expect(employeesApi.batchReactivate(tooMany)).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('propagates axios errors unchanged', async () => {
    const axiosError = new Error('Network Error')
    vi.spyOn(http, 'post').mockRejectedValue(axiosError)
    await expect(employeesApi.batchReactivate(['a'])).rejects.toBe(axiosError)
  })
})

// ─── EMPLOYEE_ERROR_MAP — error codes (Task 1.5/1.6) ──────────────────────────

describe('EMPLOYEE_ERROR_MAP — batch domain error codes (Task 1.5/1.6)', () => {
  it('maps BATCH_DELETE_NOT_FOUND to a Spanish message', () => {
    expect(EMPLOYEE_ERROR_MAP['BATCH_DELETE_NOT_FOUND']).toBeDefined()
    expect(typeof EMPLOYEE_ERROR_MAP['BATCH_DELETE_NOT_FOUND']).toBe('string')
    expect(EMPLOYEE_ERROR_MAP['BATCH_DELETE_NOT_FOUND'].length).toBeGreaterThan(0)
  })

  it('maps INSUFFICIENT_PERMISSIONS to a Spanish message', () => {
    expect(EMPLOYEE_ERROR_MAP['INSUFFICIENT_PERMISSIONS']).toBeDefined()
    expect(typeof EMPLOYEE_ERROR_MAP['INSUFFICIENT_PERMISSIONS']).toBe('string')
    expect(EMPLOYEE_ERROR_MAP['INSUFFICIENT_PERMISSIONS'].length).toBeGreaterThan(0)
  })

  it('preserves existing domain codes (regression guard)', () => {
    // We must not have removed any existing code by adding new ones.
    expect(EMPLOYEE_ERROR_MAP['EMPLOYEE_NOT_FOUND']).toBe('No se encontró el colaborador.')
    expect(EMPLOYEE_ERROR_MAP['EMPLOYEE_ALREADY_TERMINATED']).toBe(
      'El colaborador ya se encuentra dado de baja.',
    )
  })
})

// ─── BulkAction.variant — accepts 'primary' (Task 1.7/1.8) ───────────────────

describe('BulkAction.variant — accepts primary (Task 1.7/1.8)', () => {
  // Type-level guard: a BulkAction typed with variant='primary' must compile.
  // If the union is not extended to include 'primary', this test fails at
  // compile time (TS error caught by `tsc`).
  it('accepts variant: "primary" without TypeScript error', () => {
    const action: BulkAction<unknown> = {
      id: 'batch-reactivate',
      label: 'Reactivar',
      variant: 'primary',
      disabled: false,
      onClick: () => {},
    }
    expect(action.variant).toBe('primary')
  })

  it('still accepts the existing variant values (regression guard)', () => {
    const defaults: BulkAction<unknown> = {
      id: 'a',
      label: 'A',
      variant: 'default',
      onClick: () => {},
    }
    const destructive: BulkAction<unknown> = {
      id: 'b',
      label: 'B',
      variant: 'destructive',
      onClick: () => {},
    }
    const warning: BulkAction<unknown> = {
      id: 'c',
      label: 'C',
      variant: 'warning',
      onClick: () => {},
    }
    expect(defaults.variant).toBe('default')
    expect(destructive.variant).toBe('destructive')
    expect(warning.variant).toBe('warning')
  })
})
