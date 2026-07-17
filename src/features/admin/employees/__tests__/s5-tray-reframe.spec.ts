/**
 * S5 — Tenant-wide tray reframe (hr-validation-notifications)
 *
 * Pure-function + runtime computed-logic tests for the new tenant-wide
 * "Validaciones pendientes" tray:
 *
 *   1. `buildManagerMap` (from useManagerResolution) — verify the name map
 *      builder covers our tray use case (Employee[] → id→fullName lookup).
 *   2. `filterPendingBySearch(requests, nameMap, query)` — pure client-side
 *      filter by resolved employee name (case-insensitive substring).
 *   3. `resolveSickReason('SICK', null)` — S5 changes the medical-stripped
 *      placeholder from "Confidencial" to "Motivo médico reservado".
 *   4. `resolveDomainErrorMessage(code, fallback)` — pure lookup against the
 *      `EMPLOYEE_ERROR_MAP`, used by the `useReviewTimeOff` mutation to
 *      surface 409 `TIME_OFF_INVALID_TRANSITION` as a voseo message.
 *   5. `computeTrayRows` — runtime computed-logic test pattern mirroring the
 *      `filteredRequests` `computed` in `PendingApprovalsView.vue` (the
 *      view's search/filter pipeline).
 *
 * No component mount, no axios mock, no Pinia — these are all pure
 * data-transformation helpers extracted via the Extract-Before-Mock rule.
 */

import { describe, it, expect } from 'vitest'

// ─── Pure helpers under test ──────────────────────────────────────────────────
import {
  resolveSickReason,
  filterPendingBySearch,
  resolveDomainErrorMessage,
  computeTrayRows,
} from '../composables/useAusencias'
import { buildManagerMap } from '../composables/useManagerResolution'

// ─── Types ────────────────────────────────────────────────────────────────────
import type { TimeOffRequest, Employee } from '../interfaces/employee.types'
import type { ManagerInfo } from '../composables/useManagerResolution'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const REQ_FIXTURES: TimeOffRequest[] = [
  {
    id: 'to-1',
    employeeId: 'emp-1',
    type: 'VACATION',
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    reason: 'Viaje familiar',
    status: 'PENDING',
    createdAt: '2026-07-01T10:00:00Z',
    requestedByUserId: 'user-1',
    reviewerUserId: null,
    reviewedAt: null,
    reviewerNotes: null,
    tenantId: 'tenant-1',
    updatedAt: '2026-07-01T10:00:00Z',
  },
  {
    id: 'to-2',
    employeeId: 'emp-2',
    type: 'SICK',
    startDate: '2026-08-05',
    endDate: '2026-08-06',
    reason: null, // Tier 3 medical-stripped
    status: 'PENDING',
    createdAt: '2026-07-05T10:00:00Z',
    requestedByUserId: 'user-2',
    reviewerUserId: null,
    reviewedAt: null,
    reviewerNotes: null,
    tenantId: 'tenant-1',
    updatedAt: '2026-07-05T10:00:00Z',
  },
  {
    id: 'to-3',
    employeeId: 'emp-3',
    type: 'PERSONAL',
    startDate: '2026-08-15',
    endDate: '2026-08-16',
    reason: 'Trámite bancario',
    status: 'PENDING',
    createdAt: '2026-07-10T10:00:00Z',
    requestedByUserId: 'user-3',
    reviewerUserId: null,
    reviewedAt: null,
    reviewerNotes: null,
    tenantId: 'tenant-1',
    updatedAt: '2026-07-10T10:00:00Z',
  },
]

// Minimal Employee shape — only the fields buildManagerMap reads.
const EMP_FIXTURES: Employee[] = [
  {
    id: 'emp-1',
    employeeNumber: 'E001',
    fullName: 'María García',
    email: null,
    status: 'ACTIVE',
    contractType: 'PERMANENT',
    workModality: 'ONSITE',
    currentPosition: 'Diseñadora',
    currentDepartment: 'Producto',
    managerId: null,
    hireDate: '2024-01-15',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
  },
  {
    id: 'emp-2',
    employeeNumber: 'E002',
    fullName: 'Carlos López',
    email: null,
    status: 'ACTIVE',
    contractType: 'PERMANENT',
    workModality: 'REMOTE',
    currentPosition: 'Developer',
    currentDepartment: 'Engineering',
    managerId: null,
    hireDate: '2024-02-01',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
  },
  {
    id: 'emp-3',
    employeeNumber: 'E003',
    fullName: 'Ana Martínez',
    email: null,
    status: 'ACTIVE',
    contractType: 'PERMANENT',
    workModality: 'ONSITE',
    currentPosition: 'PM',
    currentDepartment: 'Producto',
    managerId: null,
    hireDate: '2024-03-01',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 1. buildManagerMap — name-map builder (reused from useManagerResolution)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildManagerMap — name map for tray lookup (S5.a)', () => {
  it('builds a Map<employeeId, ManagerInfo> from an Employee array', () => {
    const map = buildManagerMap(EMP_FIXTURES)
    expect(map.size).toBe(3)
    expect(map.get('emp-1')?.fullName).toBe('María García')
    expect(map.get('emp-2')?.fullName).toBe('Carlos López')
    expect(map.get('emp-3')?.fullName).toBe('Ana Martínez')
  })

  it('returns an empty map for an empty employee list', () => {
    const map = buildManagerMap([])
    expect(map.size).toBe(0)
  })

  it('preserves fullName, email, currentPosition, currentDepartment', () => {
    const map: Map<string, ManagerInfo> = buildManagerMap(EMP_FIXTURES)
    const info = map.get('emp-1')
    expect(info?.fullName).toBe('María García')
    expect(info?.email).toBeNull()
    expect(info?.currentPosition).toBe('Diseñadora')
    expect(info?.currentDepartment).toBe('Producto')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. filterPendingBySearch — client-side search by resolved name (S5.b)
// ─────────────────────────────────────────────────────────────────────────────

describe('filterPendingBySearch — client search by employee name (S5.b)', () => {
  const nameMap = buildManagerMap(EMP_FIXTURES)

  it('returns all requests when query is empty', () => {
    const result = filterPendingBySearch(REQ_FIXTURES, nameMap, '')
    expect(result).toHaveLength(3)
  })

  it('returns all requests when query is whitespace-only', () => {
    const result = filterPendingBySearch(REQ_FIXTURES, nameMap, '   ')
    expect(result).toHaveLength(3)
  })

  it('filters by exact name (case-insensitive)', () => {
    const result = filterPendingBySearch(REQ_FIXTURES, nameMap, 'maría garcía')
    expect(result).toHaveLength(1)
    expect(result[0]!.employeeId).toBe('emp-1')
  })

  it('filters by partial name (case-insensitive substring)', () => {
    const result = filterPendingBySearch(REQ_FIXTURES, nameMap, 'LÓPEZ')
    expect(result).toHaveLength(1)
    expect(result[0]!.employeeId).toBe('emp-2')
  })

  it('matches across multiple requests sharing a name fragment', () => {
    // "í" (accented i) appears in "María" and "Martínez" but NOT in "Carlos"
    const result = filterPendingBySearch(REQ_FIXTURES, nameMap, 'í')
    expect(result).toHaveLength(2)
    const ids = result.map((r) => r.employeeId).sort()
    expect(ids).toEqual(['emp-1', 'emp-3'])
  })

  it('returns an empty array when no name matches', () => {
    const result = filterPendingBySearch(REQ_FIXTURES, nameMap, 'zzzzz')
    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })

  it('preserves the input ordering (does NOT re-sort)', () => {
    // backend returns startDate asc; the filter MUST NOT mutate the order
    const result = filterPendingBySearch(REQ_FIXTURES, nameMap, '')
    expect(result.map((r) => r.id)).toEqual(['to-1', 'to-2', 'to-3'])
  })

  it('returns an empty array when input is empty (no requests)', () => {
    const result = filterPendingBySearch([], nameMap, 'María')
    expect(result).toEqual([])
  })

  it('falls back gracefully when an employeeId is missing from the name map', () => {
    // to-2 belongs to emp-2 which is in the map; build a request for an unknown id
    const unknownReq: TimeOffRequest = {
      ...REQ_FIXTURES[0]!,
      id: 'to-X',
      employeeId: 'emp-UNKNOWN',
    }
    const result = filterPendingBySearch([unknownReq], nameMap, 'anything')
    // Unknown id → name resolves to "—" → no name match → empty result
    expect(result).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. resolveSickReason — S5 changes SICK+null from "Confidencial" to
//    "Motivo médico reservado" (Tier 3 medical-stripped placeholder).
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSickReason — SICK+null displays "Motivo médico reservado" (S5.c)', () => {
  it('SICK + null → "Motivo médico reservado" (S5 change)', () => {
    // S5: backend strips the medical reason when caller lacks
    // read:EmployeeTimeOffMedical → frontend shows a voseo placeholder.
    expect(resolveSickReason('SICK', null)).toBe('Motivo médico reservado')
  })

  it('SICK + reason text → returns the reason unchanged', () => {
    expect(resolveSickReason('SICK', 'Gripe severa')).toBe('Gripe severa')
  })

  it('VACATION + null → "—" placeholder (unchanged)', () => {
    expect(resolveSickReason('VACATION', null)).toBe('—')
  })

  it('PERSONAL + null → "—" placeholder (unchanged)', () => {
    expect(resolveSickReason('PERSONAL', null)).toBe('—')
  })

  it('UNPAID + reason text → returns the reason unchanged', () => {
    expect(resolveSickReason('UNPAID', 'Permiso sin goce')).toBe('Permiso sin goce')
  })

  it('SICK + empty string → "—" (empty user-supplied, not medical-strip)', () => {
    // '' means user did not provide a reason, NOT a Tier 3 strip.
    expect(resolveSickReason('SICK', '')).toBe('—')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. resolveDomainErrorMessage — 409 / domain-error → voseo toast (S5.d)
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveDomainErrorMessage — EMPLOYEE_ERROR_MAP lookup (S5.d)', () => {
  it('maps TIME_OFF_INVALID_TRANSITION to its voseo message', () => {
    const msg = resolveDomainErrorMessage('TIME_OFF_INVALID_TRANSITION')
    expect(msg).toBe(
      'La solicitud de ausencia no permite esa transición de estado.',
    )
  })

  it('maps TIME_OFF_INVALID_DATE_RANGE to its voseo message', () => {
    const msg = resolveDomainErrorMessage('TIME_OFF_INVALID_DATE_RANGE')
    expect(msg).toBe(
      'El rango de fechas no es válido. La fecha de fin debe ser posterior o igual a la de inicio.',
    )
  })

  it('maps EMPLOYEE_NOT_FOUND to its voseo message', () => {
    const msg = resolveDomainErrorMessage('EMPLOYEE_NOT_FOUND')
    expect(msg).toBe('No se encontró el colaborador.')
  })

  it('falls back to a voseo default for an unknown code', () => {
    const msg = resolveDomainErrorMessage('SOME_UNKNOWN_CODE')
    // Default is the same defensive fallback normalizeApiError uses.
    expect(msg).toBe('No pudimos completar la operación. Reintentá.')
  })

  it('respects an explicit fallback override when the code is unknown', () => {
    const msg = resolveDomainErrorMessage('SOME_UNKNOWN_CODE', 'Error custom.')
    expect(msg).toBe('Error custom.')
  })

  it('ignores a fallback override when the code IS in the map (map wins)', () => {
    // Map is authoritative — fallback only applies on a miss.
    const msg = resolveDomainErrorMessage(
      'TIME_OFF_NOT_FOUND',
      'Ignored fallback',
    )
    expect(msg).toBe('No se encontró la solicitud de ausencia.')
  })

  it('returns the fallback for empty string code', () => {
    const msg = resolveDomainErrorMessage('')
    expect(msg).toBe('No pudimos completar la operación. Reintentá.')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. computeTrayRows — runtime computed-logic test pattern
//
// Mirrors the view's `filteredRequests` `computed` exactly:
//   filteredRequests = filterPendingBySearch(requests, nameMap, query.trim())
// ─────────────────────────────────────────────────────────────────────────────

describe('computeTrayRows — view mirror of filteredRequests computed (S5 runtime)', () => {
  const nameMap = buildManagerMap(EMP_FIXTURES)

  it('returns empty array when requests is empty', () => {
    expect(computeTrayRows([], nameMap, '')).toEqual([])
  })

  it('returns all requests when query is empty (after trim)', () => {
    const result = computeTrayRows(REQ_FIXTURES, nameMap, '   ')
    expect(result).toHaveLength(3)
  })

  it('trims the query before filtering', () => {
    // Leading/trailing whitespace should not break the match
    const result = computeTrayRows(REQ_FIXTURES, nameMap, '  Carlos  ')
    expect(result).toHaveLength(1)
    expect(result[0]!.employeeId).toBe('emp-2')
  })

  it('preserves backend order (does not re-sort) when there is no match', () => {
    // Even with a no-match query, the result is just []; but with a match,
    // the surviving entries must keep their original index order.
    const result = computeTrayRows(REQ_FIXTURES, nameMap, 'a')
    // "a" appears in: María, Carlos (no — "a" is in c-a-rlos), Ana
    // Carlos: c-a-r-l-o-s → yes "a" present
    // María: m-a-r-í-a → yes
    // Ana: a-n-a → yes
    const ids = result.map((r) => r.employeeId)
    expect(ids).toContain('emp-1')
    expect(ids).toContain('emp-2')
    expect(ids).toContain('emp-3')
    // Order preserved: emp-1, emp-2, emp-3 (matches input)
    expect(ids).toEqual(['emp-1', 'emp-2', 'emp-3'])
  })

  it('returns empty array when query has no matches', () => {
    expect(computeTrayRows(REQ_FIXTURES, nameMap, 'zzz no match')).toEqual([])
  })

  it('handles a nameMap that does not cover the request employeeId', () => {
    // Build a map that only knows about emp-1
    const partialMap = buildManagerMap(EMP_FIXTURES.slice(0, 1))
    const result = computeTrayRows(REQ_FIXTURES, partialMap, 'María')
    expect(result).toHaveLength(1)
    expect(result[0]!.employeeId).toBe('emp-1')
  })
})
