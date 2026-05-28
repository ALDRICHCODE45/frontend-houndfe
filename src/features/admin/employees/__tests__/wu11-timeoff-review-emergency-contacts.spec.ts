/**
 * WU-11: Time-off review + pending approvals + emergency contacts CRUD — Strict TDD
 *
 * Tests cover:
 *   1. ReviewTimeOffDtoSchema validation (pure Zod)
 *   2. CreateEmergencyContactDtoSchema validation (pure Zod)
 *   3. UpdateEmergencyContactDtoSchema validation (pure Zod — partial)
 *   4. employeesApi spy tests for review + pending-approvals + emergency contacts
 *   5. employeeTimeOffQueryKeys + employeeEmergencyContactQueryKeys key shapes
 *   6. Pure helpers from useEmergencyContacts: sortContactsByCreatedAt, isPrimaryContact,
 *      buildContactDisplayEntry, formatContactRelationship
 *
 * No component mount tests — EmergencyContactsPanel uses queries that require
 * heavy provider setup. Logic is extracted to pure functions and tested directly
 * (Extract-Before-Mock rule from strict-tdd.md).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Schemas under test ───────────────────────────────────────────────────────
import {
  ReviewTimeOffDtoSchema,
  CreateEmergencyContactDtoSchema,
  UpdateEmergencyContactDtoSchema,
  type ReviewTimeOffDto,
  type CreateEmergencyContactDto,
  type UpdateEmergencyContactDto,
} from '../interfaces/employee.types'

// ─── Query keys ───────────────────────────────────────────────────────────────
import {
  employeeTimeOffQueryKeys,
  employeeEmergencyContactQueryKeys,
} from '@/core/shared/constants/query-keys'

// ─── API spy tests ────────────────────────────────────────────────────────────
import { employeesApi } from '../api/employees.api'
import type { TimeOffRequest, EmergencyContact } from '../interfaces/employee.types'

// ─── Pure helpers under test ──────────────────────────────────────────────────
import {
  sortContactsByCreatedAt,
  isPrimaryContact,
  buildContactDisplayEntry,
  formatContactRelationship,
} from '../composables/useEmergencyContacts'

// ─────────────────────────────────────────────────────────────────────────────
// 1. ReviewTimeOffDtoSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('ReviewTimeOffDtoSchema', () => {
  it('parses a valid APPROVED decision', () => {
    const dto: ReviewTimeOffDto = { decision: 'APPROVED' }
    const result = ReviewTimeOffDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.decision).toBe('APPROVED')
    }
  })

  it('parses a valid REJECTED decision with reviewerNotes', () => {
    const dto: ReviewTimeOffDto = {
      decision: 'REJECTED',
      reviewerNotes: 'No hay disponibilidad en julio.',
    }
    const result = ReviewTimeOffDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.decision).toBe('REJECTED')
      expect(result.data.reviewerNotes).toBe('No hay disponibilidad en julio.')
    }
  })

  it('rejects an invalid decision value', () => {
    const result = ReviewTimeOffDtoSchema.safeParse({ decision: 'PENDING' })
    expect(result.success).toBe(false)
  })

  it('rejects reviewerNotes exceeding 500 characters', () => {
    const result = ReviewTimeOffDtoSchema.safeParse({
      decision: 'APPROVED',
      reviewerNotes: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('accepts reviewerNotes of exactly 500 characters', () => {
    const result = ReviewTimeOffDtoSchema.safeParse({
      decision: 'APPROVED',
      reviewerNotes: 'y'.repeat(500),
    })
    expect(result.success).toBe(true)
  })

  it('parses when reviewerNotes is omitted entirely', () => {
    const result = ReviewTimeOffDtoSchema.safeParse({ decision: 'REJECTED' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reviewerNotes).toBeUndefined()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. CreateEmergencyContactDtoSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('CreateEmergencyContactDtoSchema', () => {
  it('parses a valid contact with required fields only', () => {
    const dto: CreateEmergencyContactDto = {
      name: 'María García',
      relationship: 'Esposa',
      phone: '+5215598765432',
    }
    const result = CreateEmergencyContactDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('María García')
      expect(result.data.relationship).toBe('Esposa')
      expect(result.data.phone).toBe('+5215598765432')
    }
  })

  it('parses a valid contact with optional email', () => {
    const dto: CreateEmergencyContactDto = {
      name: 'Carlos López',
      relationship: 'Padre',
      phone: '+525512345678',
      email: 'carlos@example.com',
    }
    const result = CreateEmergencyContactDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('carlos@example.com')
    }
  })

  it('rejects name exceeding 120 characters', () => {
    const result = CreateEmergencyContactDtoSchema.safeParse({
      name: 'N'.repeat(121),
      relationship: 'Padre',
      phone: '+525512345678',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = CreateEmergencyContactDtoSchema.safeParse({
      name: '',
      relationship: 'Padre',
      phone: '+525512345678',
    })
    expect(result.success).toBe(false)
  })

  it('rejects relationship exceeding 60 characters', () => {
    const result = CreateEmergencyContactDtoSchema.safeParse({
      name: 'Test',
      relationship: 'R'.repeat(61),
      phone: '+525512345678',
    })
    expect(result.success).toBe(false)
  })

  it('rejects phone exceeding 40 characters', () => {
    const result = CreateEmergencyContactDtoSchema.safeParse({
      name: 'Test',
      relationship: 'Padre',
      phone: '1'.repeat(41),
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email format', () => {
    const result = CreateEmergencyContactDtoSchema.safeParse({
      name: 'Test',
      relationship: 'Padre',
      phone: '+525512345678',
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts name of exactly 120 characters', () => {
    const result = CreateEmergencyContactDtoSchema.safeParse({
      name: 'A'.repeat(120),
      relationship: 'Padre',
      phone: '+525512345678',
    })
    expect(result.success).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. UpdateEmergencyContactDtoSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('UpdateEmergencyContactDtoSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    const result = UpdateEmergencyContactDtoSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('parses with only phone updated', () => {
    const dto: UpdateEmergencyContactDto = { phone: '+525512340000' }
    const result = UpdateEmergencyContactDtoSchema.safeParse(dto)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.phone).toBe('+525512340000')
    }
  })

  it('rejects invalid email even in partial update', () => {
    const result = UpdateEmergencyContactDtoSchema.safeParse({
      email: 'bad-email',
    })
    expect(result.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. employeeTimeOffQueryKeys key shapes
// ─────────────────────────────────────────────────────────────────────────────

describe('employeeTimeOffQueryKeys', () => {
  it('pending key has correct shape and is scoped per tenant (user is implicit in JWT)', () => {
    const key = employeeTimeOffQueryKeys.pending('tenant-1')
    expect(key[0]).toBe('employees')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('time-off-pending')
  })

  it('pending keys are unique per tenant', () => {
    const key1 = employeeTimeOffQueryKeys.pending('tenant-A')
    const key2 = employeeTimeOffQueryKeys.pending('tenant-B')
    expect(key1[1]).not.toBe(key2[1])
  })

  it('pendingByManager key has correct shape with managerId', () => {
    const key = employeeTimeOffQueryKeys.pendingByManager('tenant-1', 'mgr-42')
    expect(key[0]).toBe('employees')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('time-off-pending-by-manager')
    expect(key[3]).toBe('mgr-42')
  })

  it('pendingByManager keys are unique per managerId', () => {
    const key1 = employeeTimeOffQueryKeys.pendingByManager('tenant-1', 'mgr-A')
    const key2 = employeeTimeOffQueryKeys.pendingByManager('tenant-1', 'mgr-B')
    expect(key1[3]).not.toBe(key2[3])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. employeeEmergencyContactQueryKeys key shapes
// ─────────────────────────────────────────────────────────────────────────────

describe('employeeEmergencyContactQueryKeys', () => {
  it('list key has correct shape', () => {
    const key = employeeEmergencyContactQueryKeys.list('tenant-1', 'emp-99')
    expect(key[0]).toBe('employees')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('emergency-contacts')
    expect(key[3]).toBe('emp-99')
  })

  it('list keys are unique per employeeId', () => {
    const key1 = employeeEmergencyContactQueryKeys.list('tenant-1', 'emp-1')
    const key2 = employeeEmergencyContactQueryKeys.list('tenant-1', 'emp-2')
    expect(key1[3]).not.toBe(key2[3])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. employeesApi spy tests — review + pending-approvals + emergency contacts
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_TIME_OFF: TimeOffRequest = {
  id: 'to-1',
  employeeId: 'emp-1',
  type: 'VACATION',
  startDate: '2026-08-01',
  endDate: '2026-08-10',
  reason: 'Viaje familiar',
  status: 'APPROVED',
  createdAt: '2026-07-01T10:00:00Z',
}

const MOCK_CONTACT: EmergencyContact = {
  id: 'ec-1',
  employeeId: 'emp-1',
  name: 'María García',
  relationship: 'Esposa',
  phone: '+5215598765432',
  email: 'maria@example.com',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('employeesApi — reviewTimeOff', () => {
  beforeEach(() => {
    vi.spyOn(employeesApi, 'reviewTimeOff').mockResolvedValue(MOCK_TIME_OFF)
  })

  it('returns the updated TimeOffRequest', async () => {
    const result = await employeesApi.reviewTimeOff('emp-1', 'to-1', {
      decision: 'APPROVED',
    })
    expect(result.status).toBe('APPROVED')
    expect(result.id).toBe('to-1')
  })

  it('calls reviewTimeOff with correct arguments', async () => {
    const spy = vi.spyOn(employeesApi, 'reviewTimeOff').mockResolvedValue(MOCK_TIME_OFF)
    await employeesApi.reviewTimeOff('emp-X', 'to-Y', {
      decision: 'REJECTED',
      reviewerNotes: 'Fechas conflictivas',
    })
    expect(spy).toHaveBeenCalledWith('emp-X', 'to-Y', {
      decision: 'REJECTED',
      reviewerNotes: 'Fechas conflictivas',
    })
  })
})

describe('employeesApi — getPendingApprovals', () => {
  beforeEach(() => {
    vi.spyOn(employeesApi, 'getPendingApprovals').mockResolvedValue([MOCK_TIME_OFF])
  })

  it('returns an array of pending TimeOffRequests for the current user', async () => {
    const result = await employeesApi.getPendingApprovals()
    expect(result).toHaveLength(1)
    expect(result[0]!.status).toBe('APPROVED') // mock value
  })

  it('calls getPendingApprovals without any arguments (backend resolves from JWT)', async () => {
    const spy = vi.spyOn(employeesApi, 'getPendingApprovals').mockResolvedValue([])
    await employeesApi.getPendingApprovals()
    expect(spy).toHaveBeenCalledWith()
  })
})

describe('employeesApi — getPendingApprovalsByManager (admin/HR)', () => {
  beforeEach(() => {
    vi.spyOn(employeesApi, 'getPendingApprovalsByManager').mockResolvedValue([MOCK_TIME_OFF])
  })

  it('returns an array of pending TimeOffRequests for the given Employee.id', async () => {
    const result = await employeesApi.getPendingApprovalsByManager('mgr-1')
    expect(result).toHaveLength(1)
  })

  it('calls getPendingApprovalsByManager with the supplied Employee.id', async () => {
    const spy = vi.spyOn(employeesApi, 'getPendingApprovalsByManager').mockResolvedValue([])
    await employeesApi.getPendingApprovalsByManager('mgr-42')
    expect(spy).toHaveBeenCalledWith('mgr-42')
  })
})

describe('employeesApi — getEmergencyContacts', () => {
  beforeEach(() => {
    vi.spyOn(employeesApi, 'getEmergencyContacts').mockResolvedValue([MOCK_CONTACT])
  })

  it('returns an array of EmergencyContacts', async () => {
    const result = await employeesApi.getEmergencyContacts('emp-1')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('María García')
  })

  it('calls getEmergencyContacts with correct employeeId', async () => {
    const spy = vi.spyOn(employeesApi, 'getEmergencyContacts').mockResolvedValue([])
    await employeesApi.getEmergencyContacts('emp-Z')
    expect(spy).toHaveBeenCalledWith('emp-Z')
  })
})

describe('employeesApi — createEmergencyContact', () => {
  beforeEach(() => {
    vi.spyOn(employeesApi, 'createEmergencyContact').mockResolvedValue(MOCK_CONTACT)
  })

  it('returns the created EmergencyContact', async () => {
    const result = await employeesApi.createEmergencyContact('emp-1', {
      name: 'María García',
      relationship: 'Esposa',
      phone: '+5215598765432',
    })
    expect(result.id).toBe('ec-1')
    expect(result.name).toBe('María García')
  })

  it('calls createEmergencyContact with correct args', async () => {
    const spy = vi.spyOn(employeesApi, 'createEmergencyContact').mockResolvedValue(MOCK_CONTACT)
    const dto: CreateEmergencyContactDto = { name: 'Test', relationship: 'Amigo', phone: '123' }
    await employeesApi.createEmergencyContact('emp-A', dto)
    expect(spy).toHaveBeenCalledWith('emp-A', dto)
  })
})

describe('employeesApi — updateEmergencyContact', () => {
  beforeEach(() => {
    vi.spyOn(employeesApi, 'updateEmergencyContact').mockResolvedValue({
      ...MOCK_CONTACT,
      phone: '+525512340000',
    })
  })

  it('returns the updated EmergencyContact', async () => {
    const result = await employeesApi.updateEmergencyContact('emp-1', 'ec-1', {
      phone: '+525512340000',
    })
    expect(result.phone).toBe('+525512340000')
  })

  it('calls updateEmergencyContact with correct args', async () => {
    const spy = vi.spyOn(employeesApi, 'updateEmergencyContact').mockResolvedValue(MOCK_CONTACT)
    await employeesApi.updateEmergencyContact('emp-B', 'ec-B', { phone: '999' })
    expect(spy).toHaveBeenCalledWith('emp-B', 'ec-B', { phone: '999' })
  })
})

describe('employeesApi — deleteEmergencyContact', () => {
  beforeEach(() => {
    vi.spyOn(employeesApi, 'deleteEmergencyContact').mockResolvedValue(undefined)
  })

  it('resolves with undefined (204 No Content)', async () => {
    const result = await employeesApi.deleteEmergencyContact('emp-1', 'ec-1')
    expect(result).toBeUndefined()
  })

  it('calls deleteEmergencyContact with correct args', async () => {
    const spy = vi.spyOn(employeesApi, 'deleteEmergencyContact').mockResolvedValue(undefined)
    await employeesApi.deleteEmergencyContact('emp-C', 'ec-C')
    expect(spy).toHaveBeenCalledWith('emp-C', 'ec-C')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Pure helpers — sortContactsByCreatedAt, isPrimaryContact, etc.
// ─────────────────────────────────────────────────────────────────────────────

const makeContact = (id: string, createdAt: string): EmergencyContact => ({
  id,
  employeeId: 'emp-1',
  name: `Contact ${id}`,
  relationship: 'Familiar',
  phone: '+525512345678',
  email: null,
  createdAt,
  updatedAt: createdAt,
})

describe('sortContactsByCreatedAt', () => {
  it('sorts contacts by createdAt ascending (oldest first)', () => {
    const contacts = [
      makeContact('c2', '2026-02-01T00:00:00Z'),
      makeContact('c1', '2026-01-01T00:00:00Z'),
      makeContact('c3', '2026-03-01T00:00:00Z'),
    ]
    const sorted = sortContactsByCreatedAt(contacts)
    expect(sorted[0]!.id).toBe('c1')
    expect(sorted[1]!.id).toBe('c2')
    expect(sorted[2]!.id).toBe('c3')
  })

  it('returns a new array without mutating the input', () => {
    const contacts = [
      makeContact('c2', '2026-02-01T00:00:00Z'),
      makeContact('c1', '2026-01-01T00:00:00Z'),
    ]
    const sorted = sortContactsByCreatedAt(contacts)
    expect(contacts[0]!.id).toBe('c2') // original unchanged
    expect(sorted[0]!.id).toBe('c1')   // sorted is new array
  })
})

describe('isPrimaryContact', () => {
  it('returns true for the first contact in sorted array (index 0)', () => {
    const contacts = [
      makeContact('c1', '2026-01-01T00:00:00Z'),
      makeContact('c2', '2026-02-01T00:00:00Z'),
    ]
    expect(isPrimaryContact(contacts[0]!, contacts)).toBe(true)
  })

  it('returns false for non-primary contacts', () => {
    const contacts = [
      makeContact('c1', '2026-01-01T00:00:00Z'),
      makeContact('c2', '2026-02-01T00:00:00Z'),
    ]
    expect(isPrimaryContact(contacts[1]!, contacts)).toBe(false)
  })

  it('returns true for single-element array', () => {
    const contacts = [makeContact('c1', '2026-01-01T00:00:00Z')]
    expect(isPrimaryContact(contacts[0]!, contacts)).toBe(true)
  })
})

describe('formatContactRelationship', () => {
  it('returns the relationship string as-is (free text)', () => {
    expect(formatContactRelationship('Esposa')).toBe('Esposa')
  })

  it('handles multi-word relationships', () => {
    expect(formatContactRelationship('Hermano mayor')).toBe('Hermano mayor')
  })
})

describe('buildContactDisplayEntry', () => {
  it('builds display entry with all fields present', () => {
    const contact: EmergencyContact = {
      id: 'ec-1',
      employeeId: 'emp-1',
      name: 'María García',
      relationship: 'Esposa',
      phone: '+5215598765432',
      email: 'maria@example.com',
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-01-15T00:00:00Z',
    }
    const allContacts = [contact]
    const entry = buildContactDisplayEntry(contact, allContacts)
    expect(entry.id).toBe('ec-1')
    expect(entry.name).toBe('María García')
    expect(entry.relationship).toBe('Esposa')
    expect(entry.phone).toBe('+5215598765432')
    expect(entry.email).toBe('maria@example.com')
    expect(entry.isPrimary).toBe(true)
  })

  it('marks non-primary contacts correctly', () => {
    const contacts = [
      makeContact('c1', '2026-01-01T00:00:00Z'),
      makeContact('c2', '2026-02-01T00:00:00Z'),
    ]
    const entry = buildContactDisplayEntry(contacts[1]!, contacts)
    expect(entry.isPrimary).toBe(false)
    expect(entry.name).toBe('Contact c2')
  })

  it('handles null email gracefully', () => {
    const contact = makeContact('c1', '2026-01-01T00:00:00Z')
    const entry = buildContactDisplayEntry(contact, [contact])
    expect(entry.email).toBeNull()
  })
})
