import { describe, it, expect } from 'vitest'
import {
  TimeOffRequestSchema,
  VacationBalanceSchema,
  CreateTimeOffDtoSchema,
  isValidTimeOffRange,
} from '../employee.types'

/**
 * Slice S4 — Type completeness + client date-range refine.
 *
 * Acceptance source: `sdd/hr-validation-notifications/spec` (obs 3175) +
 * `sdd/hr-validation-notifications/design` (obs 3176).
 *
 * Coverage:
 *   - TimeOffRequestSchema carries the FULL backend EmployeeTimeOff shape
 *     (requestedByUserId, reviewerUserId, reviewedAt, reviewerNotes,
 *     tenantId, updatedAt). Nullable for the reviewer/requester/notes
 *     fields; required for tenantId and updatedAt.
 *   - VacationBalanceSchema carries `year` alongside entitlement, used,
 *     pending, remaining.
 *   - CreateTimeOffDtoSchema rejects endDate < startDate at the schema
 *     level (client-side validation, blocks submit before network).
 *   - isValidTimeOffRange(start, end) is a pure helper exported for
 *     runtime reuse (the same predicate the superRefine uses).
 */

const FULL_PAYLOAD = {
  // Existing fields (preserved by S1–S3)
  id: 'to-1',
  employeeId: 'emp-1',
  type: 'VACATION',
  startDate: '2026-08-01',
  endDate: '2026-08-10',
  reason: 'Viaje familiar',
  status: 'PENDING',
  createdAt: '2026-05-01T00:00:00Z',
  // New fields required by the backend EmployeeTimeOff shape
  requestedByUserId: 'user-42',
  reviewerUserId: null,
  reviewedAt: null,
  reviewerNotes: null,
  tenantId: 'tenant-1',
  updatedAt: '2026-05-01T00:00:00Z',
} as const

const REVIEWED_PAYLOAD = {
  ...FULL_PAYLOAD,
  status: 'APPROVED',
  reviewerUserId: 'user-99',
  reviewedAt: '2026-05-02T15:30:00Z',
  reviewerNotes: 'Aprobado según política',
  updatedAt: '2026-05-02T15:30:00Z',
} as const

const FULL_BALANCE = {
  year: 2026,
  entitlement: 12,
  used: 5,
  pending: 3,
  remaining: 4,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// TimeOffRequestSchema — backend payload round-trip
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeOffRequestSchema — backend EmployeeTimeOff shape (S4)', () => {
  it('parses a full PENDING payload with every new field', () => {
    const result = TimeOffRequestSchema.safeParse(FULL_PAYLOAD)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.requestedByUserId).toBe('user-42')
    expect(result.data.reviewerUserId).toBeNull()
    expect(result.data.reviewedAt).toBeNull()
    expect(result.data.reviewerNotes).toBeNull()
    expect(result.data.tenantId).toBe('tenant-1')
    expect(result.data.updatedAt).toBe('2026-05-01T00:00:00Z')
  })

  it('parses a reviewed payload with non-null reviewer fields', () => {
    const result = TimeOffRequestSchema.safeParse(REVIEWED_PAYLOAD)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.status).toBe('APPROVED')
    expect(result.data.reviewerUserId).toBe('user-99')
    expect(result.data.reviewedAt).toBe('2026-05-02T15:30:00Z')
    expect(result.data.reviewerNotes).toBe('Aprobado según política')
    expect(result.data.updatedAt).toBe('2026-05-02T15:30:00Z')
  })

  it('preserves every existing field alongside the new ones (no regression)', () => {
    const result = TimeOffRequestSchema.safeParse(FULL_PAYLOAD)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.id).toBe('to-1')
    expect(result.data.employeeId).toBe('emp-1')
    expect(result.data.type).toBe('VACATION')
    expect(result.data.startDate).toBe('2026-08-01')
    expect(result.data.endDate).toBe('2026-08-10')
    expect(result.data.reason).toBe('Viaje familiar')
    expect(result.data.status).toBe('PENDING')
    expect(result.data.createdAt).toBe('2026-05-01T00:00:00Z')
  })

  it('rejects a payload missing tenantId (backend always sends it)', () => {
    const { tenantId: _tenantId, ...rest } = FULL_PAYLOAD
    const result = TimeOffRequestSchema.safeParse(rest)
    expect(result.success).toBe(false)
    if (result.success) return
    const paths = result.error.issues.map((i) => i.path[0])
    expect(paths).toContain('tenantId')
  })

  it('rejects a payload missing updatedAt (backend always sends it)', () => {
    const { updatedAt: _updatedAt, ...rest } = FULL_PAYLOAD
    const result = TimeOffRequestSchema.safeParse(rest)
    expect(result.success).toBe(false)
    if (result.success) return
    const paths = result.error.issues.map((i) => i.path[0])
    expect(paths).toContain('updatedAt')
  })

  it('accepts the four reviewer/requester fields as explicit null', () => {
    const result = TimeOffRequestSchema.safeParse({
      ...FULL_PAYLOAD,
      requestedByUserId: null,
      reviewerUserId: null,
      reviewedAt: null,
      reviewerNotes: null,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.requestedByUserId).toBeNull()
    expect(result.data.reviewerUserId).toBeNull()
    expect(result.data.reviewedAt).toBeNull()
    expect(result.data.reviewerNotes).toBeNull()
  })

  it('rejects reviewerUserId of wrong type (number)', () => {
    const result = TimeOffRequestSchema.safeParse({
      ...FULL_PAYLOAD,
      reviewerUserId: 42, // wrong type
    })
    expect(result.success).toBe(false)
  })

  it('rejects tenantId of wrong type (null)', () => {
    const result = TimeOffRequestSchema.safeParse({
      ...FULL_PAYLOAD,
      tenantId: null,
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// VacationBalanceSchema — adds year
// ─────────────────────────────────────────────────────────────────────────────

describe('VacationBalanceSchema — adds year (S4)', () => {
  it('parses a full balance with year and exposes all five fields', () => {
    const result = VacationBalanceSchema.safeParse(FULL_BALANCE)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.year).toBe(2026)
    expect(result.data.entitlement).toBe(12)
    expect(result.data.used).toBe(5)
    expect(result.data.pending).toBe(3)
    expect(result.data.remaining).toBe(4)
  })

  it('rejects a balance missing year (backend always sends it)', () => {
    const { year: _year, ...rest } = FULL_BALANCE
    const result = VacationBalanceSchema.safeParse(rest)
    expect(result.success).toBe(false)
    if (result.success) return
    const paths = result.error.issues.map((i) => i.path[0])
    expect(paths).toContain('year')
  })

  it('rejects year of wrong type (string)', () => {
    const result = VacationBalanceSchema.safeParse({
      ...FULL_BALANCE,
      year: '2026',
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isValidTimeOffRange — pure helper
// ─────────────────────────────────────────────────────────────────────────────

describe('isValidTimeOffRange — pure range predicate (S4)', () => {
  it('returns true when endDate is greater than startDate', () => {
    expect(isValidTimeOffRange('2026-08-01', '2026-08-10')).toBe(true)
  })

  it('returns true when endDate equals startDate (single-day request)', () => {
    expect(isValidTimeOffRange('2026-08-01', '2026-08-01')).toBe(true)
  })

  it('returns false when endDate is before startDate', () => {
    expect(isValidTimeOffRange('2026-08-10', '2026-08-01')).toBe(false)
  })

  it('returns false when endDate is one day before startDate', () => {
    expect(isValidTimeOffRange('2026-08-02', '2026-08-01')).toBe(false)
  })

  it('accepts string inputs that parse as ISO date-times (defensive)', () => {
    expect(isValidTimeOffRange('2026-08-01T00:00:00Z', '2026-08-10T23:59:59Z')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CreateTimeOffDtoSchema — client-side range refine
// ─────────────────────────────────────────────────────────────────────────────

describe('CreateTimeOffDtoSchema — client-side range validation (S4)', () => {
  const baseDto = {
    type: 'VACATION',
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    reason: 'Viaje',
  } as const

  it('accepts a valid range where endDate > startDate', () => {
    const result = CreateTimeOffDtoSchema.safeParse(baseDto)
    expect(result.success).toBe(true)
  })

  it('accepts a single-day range where endDate == startDate', () => {
    const result = CreateTimeOffDtoSchema.safeParse({
      ...baseDto,
      startDate: '2026-08-01',
      endDate: '2026-08-01',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid range without a reason (reason is optional)', () => {
    const { reason: _reason, ...rest } = baseDto
    const result = CreateTimeOffDtoSchema.safeParse(rest)
    expect(result.success).toBe(true)
  })

  it('rejects endDate < startDate with a voseo message attached to endDate', () => {
    const result = CreateTimeOffDtoSchema.safeParse({
      ...baseDto,
      startDate: '2026-08-10',
      endDate: '2026-08-01',
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const endDateIssue = result.error.issues.find((i) => i.path[0] === 'endDate')
    expect(endDateIssue).toBeDefined()
    // Voseo convention — message is Spanish.
    expect(endDateIssue?.message.toLowerCase()).toMatch(/(fecha|fin|inicio|mayor|igual)/)
  })

  it('still validates base fields (type, reason max) when range is invalid', () => {
    // Note: Zod's superRefine only fires when all base field validations pass.
    // So when type+reason are ALSO invalid, the range check is skipped — but
    // the other field errors still surface. This is by design in Zod v3.
    const result = CreateTimeOffDtoSchema.safeParse({
      ...baseDto,
      type: 'INVALID_TYPE',
      startDate: '2026-08-10',
      endDate: '2026-08-01',
      reason: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const paths = result.error.issues.map((i) => i.path[0])
    expect(paths).toContain('type')
    expect(paths).toContain('reason')
  })
})