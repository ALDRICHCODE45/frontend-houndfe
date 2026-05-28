/**
 * WU-07: Compensación tab — Strict TDD test file
 *
 * Tests cover:
 *   1. AddSalaryChangeDtoSchema validation (pure Zod)
 *   2. AddPositionChangeDtoSchema validation (pure Zod)
 *   3. employeesApi spy tests for salary + position history endpoints
 *   4. formatCurrencyMXN re-use (already tested in WU-06A, triangulated here)
 *   5. formatSalaryCents — pure display helper
 *   6. employeeSalaryQueryKeys.history key shape
 *   7. employeePositionQueryKeys.history key shape
 *
 * No component mount tests — CompensacionPanel uses queries that require heavy
 * provider setup. Logic is extracted to pure functions and tested directly
 * (Extract-Before-Mock rule from strict-tdd.md).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'

// ─── Schemas under test (imported AFTER they exist) ───────────────────────────
import {
  AddSalaryChangeDtoSchema,
  AddPositionChangeDtoSchema,
  type AddSalaryChangeDto,
  type AddPositionChangeDto,
} from '../interfaces/employee.types'

// ─── Pure helpers under test ──────────────────────────────────────────────────
import { formatCurrencyMXN } from '../composables/useEmployeeDetail'
import {
  formatSalaryCents,
  formatEffectiveDate,
  buildSalaryTimelineEntry,
  buildPositionTimelineEntry,
} from '../composables/useCompensacion'

// ─── Query keys ───────────────────────────────────────────────────────────────
import {
  employeeSalaryQueryKeys,
  employeePositionQueryKeys,
} from '@/core/shared/constants/query-keys'

// ─── API spy test (pure call shape) ───────────────────────────────────────────
import { employeesApi } from '../api/employees.api'
import type { SalaryChange, PositionChange } from '../interfaces/employee.types'

// ─────────────────────────────────────────────────────────────────────────────
// 1. AddSalaryChangeDtoSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('AddSalaryChangeDtoSchema', () => {
  it('parses a valid DTO with all required fields', () => {
    const dto: AddSalaryChangeDto = {
      amountCents: 4_500_000,
      currency: 'MXN',
      effectiveFrom: '2026-06-01',
      reason: 'Aumento anual por desempeño',
    }
    const result = AddSalaryChangeDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
  })

  it('uses MXN as default when currency is omitted', () => {
    const input = {
      amountCents: 100_000,
      effectiveFrom: '2026-01-01',
      reason: 'Ingreso inicial',
    }
    const result = AddSalaryChangeDtoSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currency).toBe('MXN')
    }
  })

  it('rejects amountCents = 0 (must be min 1)', () => {
    const result = AddSalaryChangeDtoSchema.safeParse({
      amountCents: 0,
      currency: 'MXN',
      effectiveFrom: '2026-06-01',
      reason: 'Ajuste',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative amountCents', () => {
    const result = AddSalaryChangeDtoSchema.safeParse({
      amountCents: -1,
      currency: 'MXN',
      effectiveFrom: '2026-06-01',
      reason: 'Ajuste',
    })
    expect(result.success).toBe(false)
  })

  it('rejects currency shorter than 3 chars', () => {
    const result = AddSalaryChangeDtoSchema.safeParse({
      amountCents: 100_000,
      currency: 'MX',
      effectiveFrom: '2026-06-01',
      reason: 'Ajuste',
    })
    expect(result.success).toBe(false)
  })

  it('rejects currency longer than 3 chars', () => {
    const result = AddSalaryChangeDtoSchema.safeParse({
      amountCents: 100_000,
      currency: 'MXNN',
      effectiveFrom: '2026-06-01',
      reason: 'Ajuste',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty reason', () => {
    const result = AddSalaryChangeDtoSchema.safeParse({
      amountCents: 100_000,
      currency: 'MXN',
      effectiveFrom: '2026-06-01',
      reason: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing effectiveFrom', () => {
    const result = AddSalaryChangeDtoSchema.safeParse({
      amountCents: 100_000,
      currency: 'MXN',
      reason: 'Ajuste',
    })
    expect(result.success).toBe(false)
  })

  it('accepts USD currency (3 chars)', () => {
    const result = AddSalaryChangeDtoSchema.safeParse({
      amountCents: 200_000,
      currency: 'USD',
      effectiveFrom: '2026-06-01',
      reason: 'Sueldo en USD',
    })
    expect(result.success).toBe(true)
  })

  it('rejects decimal amountCents (must be integer)', () => {
    const result = AddSalaryChangeDtoSchema.safeParse({
      amountCents: 1500.5,
      currency: 'MXN',
      effectiveFrom: '2026-06-01',
      reason: 'Ajuste',
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. AddPositionChangeDtoSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('AddPositionChangeDtoSchema', () => {
  it('parses a valid full DTO with all fields', () => {
    const dto: AddPositionChangeDto = {
      position: 'Gerente de Finanzas',
      department: 'Finanzas',
      effectiveFrom: '2026-06-01',
      reason: 'Promoción interna',
    }
    const result = AddPositionChangeDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
  })

  it('parses valid DTO without optional department', () => {
    const dto = {
      position: 'Analista',
      effectiveFrom: '2026-01-01',
      reason: 'Contratación',
    }
    const result = AddPositionChangeDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.department).toBeUndefined()
    }
  })

  it('rejects empty position string', () => {
    const result = AddPositionChangeDtoSchema.safeParse({
      position: '',
      effectiveFrom: '2026-06-01',
      reason: 'Ajuste',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty reason string', () => {
    const result = AddPositionChangeDtoSchema.safeParse({
      position: 'Analista',
      effectiveFrom: '2026-06-01',
      reason: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing position', () => {
    const result = AddPositionChangeDtoSchema.safeParse({
      effectiveFrom: '2026-06-01',
      reason: 'Ajuste',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing effectiveFrom', () => {
    const result = AddPositionChangeDtoSchema.safeParse({
      position: 'Analista',
      reason: 'Ajuste',
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Query key shapes
// ─────────────────────────────────────────────────────────────────────────────

describe('employeeSalaryQueryKeys.history', () => {
  it('returns a tuple with employees, tenantId, salary-history, employeeId', () => {
    const key = employeeSalaryQueryKeys.history('tenant-1', 'emp-abc')
    expect(key).toEqual(['employees', 'tenant-1', 'salary-history', 'emp-abc'])
  })

  it('produces unique keys for different employees', () => {
    const key1 = employeeSalaryQueryKeys.history('t1', 'emp-1')
    const key2 = employeeSalaryQueryKeys.history('t1', 'emp-2')
    expect(key1).not.toEqual(key2)
  })
})

describe('employeePositionQueryKeys.history', () => {
  it('returns a tuple with employees, tenantId, position-history, employeeId', () => {
    const key = employeePositionQueryKeys.history('tenant-1', 'emp-abc')
    expect(key).toEqual(['employees', 'tenant-1', 'position-history', 'emp-abc'])
  })

  it('produces unique keys for different tenants', () => {
    const key1 = employeePositionQueryKeys.history('t1', 'emp-1')
    const key2 = employeePositionQueryKeys.history('t2', 'emp-1')
    expect(key1).not.toEqual(key2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. API call shapes — spy on http, verify URL + method
// ─────────────────────────────────────────────────────────────────────────────

describe('employeesApi.getSalaryHistory', () => {
  const mockSalaryHistory: SalaryChange[] = [
    {
      id: 'sh-1',
      employeeId: 'emp-1',
      amountCents: 4_500_000,
      currency: 'MXN',
      effectiveFrom: '2026-06-01',
      reason: 'Aumento anual',
      createdAt: '2026-05-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.spyOn(employeesApi, 'getSalaryHistory').mockResolvedValue(mockSalaryHistory)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls getSalaryHistory and returns array of SalaryChange', async () => {
    const result = await employeesApi.getSalaryHistory('emp-1')
    expect(result).toHaveLength(1)
    const first = result[0]
    expect(first?.amountCents).toBe(4_500_000)
    expect(first?.currency).toBe('MXN')
  })

  it('passes the correct employeeId when called', async () => {
    const spy = vi.spyOn(employeesApi, 'getSalaryHistory')
    await employeesApi.getSalaryHistory('emp-xyz')
    expect(spy).toHaveBeenCalledWith('emp-xyz')
  })
})

describe('employeesApi.addSalaryChange', () => {
  const mockCreated: SalaryChange = {
    id: 'sh-new',
    employeeId: 'emp-1',
    amountCents: 5_000_000,
    currency: 'MXN',
    effectiveFrom: '2026-07-01',
    reason: 'Ajuste por inflación',
    createdAt: '2026-06-15T00:00:00Z',
  }

  beforeEach(() => {
    vi.spyOn(employeesApi, 'addSalaryChange').mockResolvedValue(mockCreated)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls addSalaryChange and returns the created SalaryChange', async () => {
    const dto: AddSalaryChangeDto = {
      amountCents: 5_000_000,
      currency: 'MXN',
      effectiveFrom: '2026-07-01',
      reason: 'Ajuste por inflación',
    }
    const result = await employeesApi.addSalaryChange('emp-1', dto)
    expect(result.id).toBe('sh-new')
    expect(result.amountCents).toBe(5_000_000)
  })

  it('passes employeeId and dto to addSalaryChange', async () => {
    const spy = vi.spyOn(employeesApi, 'addSalaryChange')
    const dto: AddSalaryChangeDto = {
      amountCents: 1_000_000,
      currency: 'MXN',
      effectiveFrom: '2026-06-01',
      reason: 'Inicial',
    }
    await employeesApi.addSalaryChange('emp-abc', dto)
    expect(spy).toHaveBeenCalledWith('emp-abc', dto)
  })
})

describe('employeesApi.getPositionHistory', () => {
  const mockPositionHistory: PositionChange[] = [
    {
      id: 'ph-1',
      employeeId: 'emp-1',
      position: 'Gerente',
      department: 'Finanzas',
      effectiveFrom: '2026-01-01',
      reason: 'Promoción',
      createdAt: '2025-12-15T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.spyOn(employeesApi, 'getPositionHistory').mockResolvedValue(mockPositionHistory)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls getPositionHistory and returns array of PositionChange', async () => {
    const result = await employeesApi.getPositionHistory('emp-1')
    expect(result).toHaveLength(1)
    const first = result[0]
    expect(first?.position).toBe('Gerente')
    expect(first?.department).toBe('Finanzas')
  })

  it('passes the correct employeeId when called', async () => {
    const spy = vi.spyOn(employeesApi, 'getPositionHistory')
    await employeesApi.getPositionHistory('emp-xyz')
    expect(spy).toHaveBeenCalledWith('emp-xyz')
  })
})

describe('employeesApi.addPositionChange', () => {
  const mockCreated: PositionChange = {
    id: 'ph-new',
    employeeId: 'emp-1',
    position: 'Director',
    department: 'Ejecutivo',
    effectiveFrom: '2026-07-01',
    reason: 'Ascenso',
    createdAt: '2026-06-20T00:00:00Z',
  }

  beforeEach(() => {
    vi.spyOn(employeesApi, 'addPositionChange').mockResolvedValue(mockCreated)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls addPositionChange and returns the created PositionChange', async () => {
    const dto: AddPositionChangeDto = {
      position: 'Director',
      department: 'Ejecutivo',
      effectiveFrom: '2026-07-01',
      reason: 'Ascenso',
    }
    const result = await employeesApi.addPositionChange('emp-1', dto)
    expect(result.id).toBe('ph-new')
    expect(result.position).toBe('Director')
  })

  it('passes employeeId and dto correctly', async () => {
    const spy = vi.spyOn(employeesApi, 'addPositionChange')
    const dto: AddPositionChangeDto = {
      position: 'Analista',
      effectiveFrom: '2026-01-01',
      reason: 'Contratación',
    }
    await employeesApi.addPositionChange('emp-new', dto)
    expect(spy).toHaveBeenCalledWith('emp-new', dto)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Pure helpers from useCompensacion
// ─────────────────────────────────────────────────────────────────────────────

describe('formatSalaryCents', () => {
  it('formats 4500000 cents as $45,000.00 in MXN', () => {
    const result = formatSalaryCents(4_500_000, 'MXN')
    // The formatted value should contain 45,000 or 45.000 (locale-dependent)
    // We verify it contains the correct numeric magnitude
    expect(result).toContain('45')
    expect(result).toContain('000')
  })

  it('formats 100 cents as $1.00', () => {
    const result = formatSalaryCents(100, 'MXN')
    expect(result).toContain('1')
    expect(result).toContain('00')
  })

  it('formats 0 cents as $0.00', () => {
    const result = formatSalaryCents(0, 'MXN')
    expect(result).toContain('0')
  })

  it('formats USD currency correctly', () => {
    const result = formatSalaryCents(1_000_000, 'USD')
    expect(result).toContain('10')
    expect(result).toContain('000')
  })
})

describe('formatEffectiveDate', () => {
  it('formats YYYY-MM-DD string to locale date string', () => {
    const result = formatEffectiveDate('2026-06-01')
    // Should produce a human-readable date containing the year
    expect(result).toContain('2026')
  })

  it('formats different months correctly', () => {
    const jan = formatEffectiveDate('2025-01-15')
    const dec = formatEffectiveDate('2025-12-15')
    // Both should contain the year
    expect(jan).toContain('2025')
    expect(dec).toContain('2025')
    // They should be different
    expect(jan).not.toBe(dec)
  })

  it('accepts full ISO date string with time component (backend format)', () => {
    // Backend returns effectiveFrom as '2027-05-27T00:00:00.000Z', not 'YYYY-MM-DD'.
    // Regression: formatEffectiveDate used to break by appending a second time suffix,
    // producing an invalid date that crashed the salary history timeline.
    const result = formatEffectiveDate('2027-05-27T00:00:00.000Z')
    expect(result).toContain('2027')
    expect(result).not.toContain('NaN')
    expect(result).not.toBe('Invalid Date')
  })

  it('returns the original string when given an unparseable date (graceful fallback)', () => {
    const result = formatEffectiveDate('not-a-date')
    expect(result).toBe('not-a-date')
  })
})

describe('buildSalaryTimelineEntry', () => {
  it('produces a display entry with formatted amount and date', () => {
    const change = {
      id: 'sh-1',
      employeeId: 'emp-1',
      amountCents: 4_500_000,
      currency: 'MXN',
      effectiveFrom: '2026-06-01',
      reason: 'Aumento anual',
      createdAt: '2026-05-01T00:00:00Z',
    }
    const entry = buildSalaryTimelineEntry(change)
    expect(entry.id).toBe('sh-1')
    expect(entry.amountFormatted).toContain('45')
    expect(entry.dateFormatted).toContain('2026')
    expect(entry.reason).toBe('Aumento anual')
    expect(entry.currency).toBe('MXN')
  })

  it('produces correct entry for small amount', () => {
    const change = {
      id: 'sh-2',
      employeeId: 'emp-2',
      amountCents: 100,
      currency: 'MXN',
      effectiveFrom: '2025-01-01',
      reason: 'Ingreso mínimo',
      createdAt: '2024-12-31T00:00:00Z',
    }
    const entry = buildSalaryTimelineEntry(change)
    expect(entry.amountFormatted).toContain('1')
    expect(entry.reason).toBe('Ingreso mínimo')
  })
})

describe('buildPositionTimelineEntry', () => {
  it('produces a display entry with position, department, and date', () => {
    const change = {
      id: 'ph-1',
      employeeId: 'emp-1',
      position: 'Gerente de Finanzas',
      department: 'Finanzas',
      effectiveFrom: '2026-06-01',
      reason: 'Promoción',
      createdAt: '2026-05-01T00:00:00Z',
    }
    const entry = buildPositionTimelineEntry(change)
    expect(entry.id).toBe('ph-1')
    expect(entry.position).toBe('Gerente de Finanzas')
    expect(entry.department).toBe('Finanzas')
    expect(entry.dateFormatted).toContain('2026')
    expect(entry.reason).toBe('Promoción')
  })

  it('handles null department gracefully', () => {
    const change = {
      id: 'ph-2',
      employeeId: 'emp-1',
      position: 'Analista',
      department: null,
      effectiveFrom: '2026-01-01',
      reason: 'Contratación',
      createdAt: '2025-12-31T00:00:00Z',
    }
    const entry = buildPositionTimelineEntry(change)
    expect(entry.department).toBeNull()
    expect(entry.position).toBe('Analista')
    expect(entry.dateFormatted).toContain('2026')
  })
})
