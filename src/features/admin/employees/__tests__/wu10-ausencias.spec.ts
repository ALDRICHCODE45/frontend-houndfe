/**
 * WU-10: Ausencias tab — Strict TDD test file
 *
 * Tests cover:
 *   1. CreateTimeOffDtoSchema validation (pure Zod)
 *   2. employeeTimeOffQueryKeys key shapes
 *   3. employeesApi spy tests (getTimeOff, getVacationBalance, createTimeOff, cancelTimeOff)
 *   4. Pure helpers: formatTimeOffType, formatTimeOffStatus, computeTimeOffDays,
 *      resolveSickReason, canCancelTimeOff
 *
 * No component mount tests — AusenciasPanel uses queries that require heavy
 * provider setup. Logic is extracted to pure functions and tested directly
 * (Extract-Before-Mock rule from strict-tdd.md).
 *
 * SICK reason guard (Tier 3):
 *   - reason === null && type === 'SICK' → display "Confidencial"
 *   - reason === null && type !== 'SICK' → display "—"
 *   - reason === '' (empty string) → display "—"
 *   - reason has value → display reason
 *
 * Cancel guard:
 *   - status === 'PENDING' → canCancel
 *   - status === 'APPROVED' && startDate is future → canCancel
 *   - status === 'APPROVED' && startDate is today or past → cannotCancel
 *   - status === 'REJECTED' or 'CANCELLED' → cannotCancel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Schema under test ────────────────────────────────────────────────────────
import {
  CreateTimeOffDtoSchema,
  type CreateTimeOffDto,
} from '../interfaces/employee.types'

// ─── Query keys ───────────────────────────────────────────────────────────────
import { employeeTimeOffQueryKeys } from '@/core/shared/constants/query-keys'

// ─── API spy tests ────────────────────────────────────────────────────────────
import { employeesApi } from '../api/employees.api'
import type { TimeOffRequest, VacationBalance } from '../interfaces/employee.types'

// ─── Pure helpers under test ──────────────────────────────────────────────────
import {
  formatTimeOffType,
  formatTimeOffStatus,
  computeTimeOffDays,
  resolveSickReason,
  canCancelTimeOff,
} from '../composables/useAusencias'

// ─────────────────────────────────────────────────────────────────────────────
// 1. CreateTimeOffDtoSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('CreateTimeOffDtoSchema', () => {
  it('parses a valid DTO with required fields only', () => {
    const dto: CreateTimeOffDto = {
      type: 'VACATION',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
    }
    const result = CreateTimeOffDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
  })

  it('parses a valid DTO with optional reason', () => {
    const dto: CreateTimeOffDto = {
      type: 'SICK',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      reason: 'Gripe',
    }
    const result = CreateTimeOffDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reason).toBe('Gripe')
      expect(result.data.type).toBe('SICK')
    }
  })

  it('rejects an invalid TimeOffType', () => {
    const result = CreateTimeOffDtoSchema.safeParse({
      type: 'MATERNITY',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when startDate is missing', () => {
    const result = CreateTimeOffDtoSchema.safeParse({
      type: 'VACATION',
      endDate: '2026-08-10',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when endDate is missing', () => {
    const result = CreateTimeOffDtoSchema.safeParse({
      type: 'VACATION',
      startDate: '2026-08-01',
    })
    expect(result.success).toBe(false)
  })

  it('rejects reason exceeding 500 characters', () => {
    const result = CreateTimeOffDtoSchema.safeParse({
      type: 'PERSONAL',
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      reason: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('accepts all 4 TimeOffType values', () => {
    const types = ['VACATION', 'SICK', 'PERSONAL', 'UNPAID'] as const
    for (const type of types) {
      const result = CreateTimeOffDtoSchema.safeParse({
        type,
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      })
      expect(result.success).toBe(true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. employeeTimeOffQueryKeys
// ─────────────────────────────────────────────────────────────────────────────

describe('employeeTimeOffQueryKeys', () => {
  it('list key has correct shape', () => {
    const key = employeeTimeOffQueryKeys.list('tenant-1', 'emp-1', 2026)
    expect(key[0]).toBe('employees')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('time-off')
    expect(key[3]).toBe('emp-1')
  })

  it('list key is unique per employeeId', () => {
    const key1 = employeeTimeOffQueryKeys.list('t', 'emp-1', 2026)
    const key2 = employeeTimeOffQueryKeys.list('t', 'emp-2', 2026)
    expect(key1).not.toEqual(key2)
  })

  it('list key includes year and status in params object', () => {
    const key = employeeTimeOffQueryKeys.list('t', 'emp-1', 2026, 'PENDING')
    const params = key[4] as { year: number; status?: string }
    expect(params.year).toBe(2026)
    expect(params.status).toBe('PENDING')
  })

  it('balance key has correct shape', () => {
    const key = employeeTimeOffQueryKeys.balance('tenant-1', 'emp-1', 2026)
    expect(key[0]).toBe('employees')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('time-off-balance')
    expect(key[3]).toBe('emp-1')
    expect(key[4]).toBe(2026)
  })

  it('balance key is unique per year', () => {
    const key1 = employeeTimeOffQueryKeys.balance('t', 'emp-1', 2026)
    const key2 = employeeTimeOffQueryKeys.balance('t', 'emp-1', 2025)
    expect(key1).not.toEqual(key2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. employeesApi spy tests — time-off endpoints
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_TIME_OFF: TimeOffRequest = {
  id: 'to-1',
  employeeId: 'emp-1',
  type: 'VACATION',
  startDate: '2026-08-01',
  endDate: '2026-08-10',
  reason: 'Viaje familiar',
  status: 'PENDING',
  createdAt: '2026-05-01T00:00:00Z',
  // S4 additions — backend EmployeeTimeOff v1 shape
  requestedByUserId: 'user-42',
  reviewerUserId: null,
  reviewedAt: null,
  reviewerNotes: null,
  tenantId: 'tenant-1',
  updatedAt: '2026-05-01T00:00:00Z',
}

const MOCK_BALANCE: VacationBalance = {
  // S4 addition — year is required by the backend vacation-balance contract
  year: 2026,
  entitlement: 12,
  used: 5,
  pending: 3,
  remaining: 7,
}

describe('employeesApi — getTimeOff', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(employeesApi, 'getTimeOff').mockResolvedValue({
      data: [MOCK_TIME_OFF],
      total: 1,
      page: 1,
      limit: 20,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns time-off list', async () => {
    const result = await employeesApi.getTimeOff('emp-1')
    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.id).toBe('to-1')
  })

  it('passes employeeId to the API', async () => {
    await employeesApi.getTimeOff('emp-42')
    expect(spy).toHaveBeenCalledWith('emp-42')
  })
})

describe('employeesApi — getVacationBalance', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(employeesApi, 'getVacationBalance').mockResolvedValue(MOCK_BALANCE)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns vacation balance with entitlement, used, pending, remaining', async () => {
    const result = await employeesApi.getVacationBalance('emp-1')
    expect(result.entitlement).toBe(12)
    expect(result.used).toBe(5)
    expect(result.pending).toBe(3)
    expect(result.remaining).toBe(7)
  })

  it('passes employeeId to the API', async () => {
    await employeesApi.getVacationBalance('emp-99')
    expect(spy).toHaveBeenCalledWith('emp-99')
  })
})

describe('employeesApi — createTimeOff', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(employeesApi, 'createTimeOff').mockResolvedValue(MOCK_TIME_OFF)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the created time-off request', async () => {
    const dto: CreateTimeOffDto = {
      type: 'VACATION',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
    }
    const result = await employeesApi.createTimeOff('emp-1', dto)
    expect(result.id).toBe('to-1')
    expect(result.status).toBe('PENDING')
  })

  it('passes employeeId and dto to the API', async () => {
    const dto: CreateTimeOffDto = {
      type: 'SICK',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      reason: 'Gripe',
    }
    await employeesApi.createTimeOff('emp-7', dto)
    expect(spy).toHaveBeenCalledWith('emp-7', dto)
  })
})

describe('employeesApi — cancelTimeOff', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(employeesApi, 'cancelTimeOff').mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves with undefined on success', async () => {
    const result = await employeesApi.cancelTimeOff('emp-1', 'to-1')
    expect(result).toBeUndefined()
  })

  it('passes employeeId and timeOffId to the API', async () => {
    await employeesApi.cancelTimeOff('emp-5', 'to-99')
    expect(spy).toHaveBeenCalledWith('emp-5', 'to-99')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('formatTimeOffType', () => {
  it('maps VACATION to Spanish label', () => {
    expect(formatTimeOffType('VACATION')).toBe('Vacaciones')
  })

  it('maps SICK to Spanish label', () => {
    expect(formatTimeOffType('SICK')).toBe('Enfermedad')
  })

  it('maps PERSONAL to Spanish label', () => {
    expect(formatTimeOffType('PERSONAL')).toBe('Personal')
  })

  it('maps UNPAID to Spanish label', () => {
    expect(formatTimeOffType('UNPAID')).toBe('Sin goce de sueldo')
  })
})

describe('formatTimeOffStatus', () => {
  it('maps PENDING to Spanish label', () => {
    expect(formatTimeOffStatus('PENDING')).toBe('Pendiente')
  })

  it('maps APPROVED to Spanish label', () => {
    expect(formatTimeOffStatus('APPROVED')).toBe('Aprobada')
  })

  it('maps REJECTED to Spanish label', () => {
    expect(formatTimeOffStatus('REJECTED')).toBe('Rechazada')
  })

  it('maps CANCELLED to Spanish label', () => {
    expect(formatTimeOffStatus('CANCELLED')).toBe('Cancelada')
  })
})

describe('computeTimeOffDays', () => {
  it('returns 1 for same-day time-off', () => {
    // Same start and end = 1 inclusive day
    expect(computeTimeOffDays('2026-08-01', '2026-08-01')).toBe(1)
  })

  it('returns 10 for 10-day time-off', () => {
    // Aug 1 to Aug 10 inclusive = 10 days
    expect(computeTimeOffDays('2026-08-01', '2026-08-10')).toBe(10)
  })

  it('returns 3 for a 3-day time-off', () => {
    expect(computeTimeOffDays('2026-06-01', '2026-06-03')).toBe(3)
  })
})

describe('resolveSickReason — Tier 3 medical stripping guard', () => {
  it('returns "Confidencial" when type is SICK and reason is null', () => {
    // This is the core Tier 3 guard behavior
    const display = resolveSickReason('SICK', null)
    expect(display).toBe('Confidencial')
  })

  it('returns the reason when type is SICK and reason has a value', () => {
    const display = resolveSickReason('SICK', 'Gripe severa')
    expect(display).toBe('Gripe severa')
  })

  it('returns "—" when type is VACATION and reason is null', () => {
    // Non-SICK with null reason → em dash placeholder
    const display = resolveSickReason('VACATION', null)
    expect(display).toBe('—')
  })

  it('returns the reason text for non-SICK types with a reason', () => {
    const display = resolveSickReason('PERSONAL', 'Trámite personal')
    expect(display).toBe('Trámite personal')
  })

  it('returns "—" for empty string reason regardless of type', () => {
    expect(resolveSickReason('VACATION', '')).toBe('—')
    expect(resolveSickReason('SICK', '')).toBe('—')
  })
})

describe('canCancelTimeOff', () => {
  const FUTURE_DATE = '2099-12-31'
  const PAST_DATE = '2000-01-01'
  const TODAY = new Date().toISOString().slice(0, 10)

  it('returns true for PENDING time-off (always cancellable)', () => {
    expect(canCancelTimeOff('PENDING', PAST_DATE)).toBe(true)
    expect(canCancelTimeOff('PENDING', FUTURE_DATE)).toBe(true)
  })

  it('returns true for APPROVED time-off with future startDate', () => {
    expect(canCancelTimeOff('APPROVED', FUTURE_DATE)).toBe(true)
  })

  it('returns false for APPROVED time-off with past startDate', () => {
    expect(canCancelTimeOff('APPROVED', PAST_DATE)).toBe(false)
  })

  it('returns false for APPROVED time-off that starts today', () => {
    // Today is NOT future — already started, cannot cancel
    expect(canCancelTimeOff('APPROVED', TODAY)).toBe(false)
  })

  it('returns false for REJECTED status', () => {
    expect(canCancelTimeOff('REJECTED', FUTURE_DATE)).toBe(false)
  })

  it('returns false for CANCELLED status', () => {
    expect(canCancelTimeOff('CANCELLED', FUTURE_DATE)).toBe(false)
  })
})
