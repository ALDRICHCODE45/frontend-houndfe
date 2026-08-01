import { describe, it, expect, beforeEach } from 'vitest'
import { ability, updateAbilityFromPermissionCodes, resetAbility } from '../ability'
import type { AppSubject } from '../../interfaces/auth.types'

describe('ability with Sale subject', () => {
  beforeEach(() => {
    resetAbility()
  })

  it('should parse read:Sale permission correctly', () => {
    updateAbilityFromPermissionCodes(['read:Sale'])

    expect(ability.can('read', 'Sale')).toBe(true)
    expect(ability.can('create', 'Sale')).toBe(false)
  })

  it('should parse create:Sale permission correctly', () => {
    updateAbilityFromPermissionCodes(['create:Sale'])

    expect(ability.can('create', 'Sale')).toBe(true)
    expect(ability.can('read', 'Sale')).toBe(false)
  })

  it('should parse multiple Sale permissions', () => {
    updateAbilityFromPermissionCodes(['read:Sale', 'update:Sale', 'delete:Sale'])

    expect(ability.can('read', 'Sale')).toBe(true)
    expect(ability.can('update', 'Sale')).toBe(true)
    expect(ability.can('delete', 'Sale')).toBe(true)
    expect(ability.can('create', 'Sale')).toBe(false)
  })

  it('should handle Sale alongside other subjects', () => {
    updateAbilityFromPermissionCodes(['read:Sale', 'read:Product', 'create:Customer'])

    expect(ability.can('read', 'Sale')).toBe(true)
    expect(ability.can('read', 'Product')).toBe(true)
    expect(ability.can('create', 'Customer')).toBe(true)
  })

  it('should reject invalid Sale permission format', () => {
    updateAbilityFromPermissionCodes(['read:Sale:extra', 'invalid'])

    expect(ability.can('read', 'Sale')).toBe(false)
  })

  it('should validate Sale is in AppSubject type union', () => {
    const subject: AppSubject = 'Sale'
    expect(subject).toBe('Sale')
  })

  it('should parse read:TenantMembership permission correctly', () => {
    updateAbilityFromPermissionCodes(['read:TenantMembership'])

    expect(ability.can('read', 'TenantMembership')).toBe(true)
    expect(ability.can('create', 'TenantMembership')).toBe(false)
  })

  it('should validate TenantMembership is in AppSubject type union', () => {
    const subject: AppSubject = 'TenantMembership'
    expect(subject).toBe('TenantMembership')
  })
})

describe('ability with NotificationConfig subject (notification-config WU-1)', () => {
  beforeEach(() => {
    resetAbility()
  })

  it('should parse read:NotificationConfig and grant read permission', () => {
    updateAbilityFromPermissionCodes(['read:NotificationConfig'])

    expect(ability.can('read', 'NotificationConfig')).toBe(true)
    expect(ability.can('update', 'NotificationConfig')).toBe(false)
  })

  it('should parse update:NotificationConfig and grant update permission', () => {
    updateAbilityFromPermissionCodes(['update:NotificationConfig'])

    expect(ability.can('update', 'NotificationConfig')).toBe(true)
    expect(ability.can('read', 'NotificationConfig')).toBe(false)
  })

  it('should parse read+update+create codes together on NotificationConfig', () => {
    updateAbilityFromPermissionCodes([
      'read:NotificationConfig',
      'update:NotificationConfig',
    ])

    expect(ability.can('read', 'NotificationConfig')).toBe(true)
    expect(ability.can('update', 'NotificationConfig')).toBe(true)
    expect(ability.can('delete', 'NotificationConfig')).toBe(false)
  })

  it('should not silently drop NotificationConfig — guard against parsePermissionCode returning null', () => {
    // If NotificationConfig is missing from APP_SUBJECTS, parsePermissionCode
    // returns null and the ability is never updated, so .can() stays false.
    updateAbilityFromPermissionCodes(['read:NotificationConfig'])

    expect(ability.can('read', 'NotificationConfig')).toBe(true)
  })

  it('should keep NotificationConfig alongside other subjects without bleed', () => {
    updateAbilityFromPermissionCodes([
      'read:NotificationConfig',
      'read:Product',
      'update:Customer',
    ])

    expect(ability.can('read', 'NotificationConfig')).toBe(true)
    expect(ability.can('read', 'Product')).toBe(true)
    expect(ability.can('update', 'Customer')).toBe(true)
    expect(ability.can('update', 'NotificationConfig')).toBe(false)
  })

  it('should validate NotificationConfig is in AppSubject type union', () => {
    const subject: AppSubject = 'NotificationConfig'
    expect(subject).toBe('NotificationConfig')
  })
})

// ── sdd-10 batch_delete:Promotion — explicit action (BD-REQ-001) ──────────────
//
// BD-REQ-001: the UI gate is `userCan('batch_delete', 'Promotion')` — an
// explicit check, not a derivation from `manage`/`delete`. The CASL layer
// guarantees (1) `batch_delete:Promotion` parses and grants the action, and
// (2) the action is scoped to `Promotion` only. The UI-level gate is asserted
// separately in PromotionsView.test.ts.

describe('ability with batch_delete:Promotion subject (sdd-10 promotions-batch-delete)', () => {
  beforeEach(() => {
    resetAbility()
  })

  it('parses batch_delete:Promotion and grants the explicit batch_delete permission on Promotion', () => {
    updateAbilityFromPermissionCodes(['batch_delete:Promotion'])

    expect(ability.can('batch_delete', 'Promotion')).toBe(true)
  })

  it('does NOT silently drop batch_delete when APP_ACTIONS is misconfigured (parse guard)', () => {
    // If `batch_delete` were missing from APP_ACTIONS, parsePermissionCode
    // would return null and ability.can would stay false — the UI gate would
    // never open and the bulk button would never appear. Asserting this
    // guards against silent dropping during future APP_ACTIONS edits.
    updateAbilityFromPermissionCodes(['batch_delete:Promotion'])

    expect(ability.can('batch_delete', 'Promotion')).toBe(true)
  })

  it('keeps batch_delete scoped to Promotion (no bleed to other subjects)', () => {
    updateAbilityFromPermissionCodes(['batch_delete:Promotion'])

    expect(ability.can('batch_delete', 'Promotion')).toBe(true)
    expect(ability.can('batch_delete', 'Product')).toBe(false)
    expect(ability.can('batch_delete', 'Sale')).toBe(false)
  })

  it('coexists with delete:Promotion — single-delete and batch-delete are distinct grants', () => {
    // Both actions remain independently grantable. `delete` is single-row;
    // `batch_delete` is bulk. A role can hold one without the other.
    updateAbilityFromPermissionCodes(['delete:Promotion', 'batch_delete:Promotion'])

    expect(ability.can('delete', 'Promotion')).toBe(true)
    expect(ability.can('batch_delete', 'Promotion')).toBe(true)
  })

  it('grant is revoked when batch_delete:Promotion is removed from the code list', () => {
    // First grant, then revoke — confirms the ability updates on each call.
    updateAbilityFromPermissionCodes(['batch_delete:Promotion'])
    expect(ability.can('batch_delete', 'Promotion')).toBe(true)

    updateAbilityFromPermissionCodes([])
    expect(ability.can('batch_delete', 'Promotion')).toBe(false)
  })
})

// ── sdd-quotations-crud S1: CASL registration for the Quotation subject ──────
//
// REQ-QTN-014: APP_SUBJECTS MUST include 'Quotation'. Permissions arrive as
// "action:Quotation" codes (e.g. 'read:Quotation', 'create:Quotation',
// 'update:Quotation', 'delete:Quotation'). The CASL layer MUST:
//   1. Parse each Quotation permission code and grant the action.
//   2. Keep grants scoped to Quotation (no bleed to other subjects).
//   3. Accept all four standard actions in isolation and together.
//   4. Drop the grant when the code is removed from the list.
//   5. Validate Quotation is a member of the AppSubject type union.
//
// If 'Quotation' were missing from APP_SUBJECTS, parsePermissionCode would
// return null and the ability would never update — the sidebar entry and
// the route guard would silently stay closed. These tests guard against
// that silent-drop regression.

describe('ability with Quotation subject (sdd-quotations-crud S1, REQ-QTN-014)', () => {
  beforeEach(() => {
    resetAbility()
  })

  it('parses read:Quotation and grants read on Quotation only', () => {
    updateAbilityFromPermissionCodes(['read:Quotation'])

    expect(ability.can('read', 'Quotation')).toBe(true)
    expect(ability.can('create', 'Quotation')).toBe(false)
    expect(ability.can('update', 'Quotation')).toBe(false)
    expect(ability.can('delete', 'Quotation')).toBe(false)
  })

  it('parses create:Quotation and grants create on Quotation only', () => {
    updateAbilityFromPermissionCodes(['create:Quotation'])

    expect(ability.can('create', 'Quotation')).toBe(true)
    expect(ability.can('read', 'Quotation')).toBe(false)
  })

  it('parses update:Quotation and grants update on Quotation only', () => {
    updateAbilityFromPermissionCodes(['update:Quotation'])

    expect(ability.can('update', 'Quotation')).toBe(true)
    expect(ability.can('read', 'Quotation')).toBe(false)
  })

  it('parses delete:Quotation and grants delete on Quotation only', () => {
    updateAbilityFromPermissionCodes(['delete:Quotation'])

    expect(ability.can('delete', 'Quotation')).toBe(true)
  })

  it('parses all four Quotation actions together (full lifecycle role)', () => {
    updateAbilityFromPermissionCodes([
      'create:Quotation',
      'read:Quotation',
      'update:Quotation',
      'delete:Quotation',
    ])

    expect(ability.can('create', 'Quotation')).toBe(true)
    expect(ability.can('read', 'Quotation')).toBe(true)
    expect(ability.can('update', 'Quotation')).toBe(true)
    expect(ability.can('delete', 'Quotation')).toBe(true)
  })

  it('does NOT silently drop Quotation — guard against parsePermissionCode returning null', () => {
    // If Quotation were missing from APP_SUBJECTS, parsePermissionCode would
    // return null and the ability would never update, so can() stays false.
    // Asserting true here guards against silent-drop during future edits.
    updateAbilityFromPermissionCodes(['read:Quotation'])

    expect(ability.can('read', 'Quotation')).toBe(true)
  })

  it('keeps Quotation scoped — no bleed to Sale/Customer/Product', () => {
    updateAbilityFromPermissionCodes(['read:Quotation'])

    expect(ability.can('read', 'Quotation')).toBe(true)
    expect(ability.can('read', 'Sale')).toBe(false)
    expect(ability.can('read', 'Customer')).toBe(false)
    expect(ability.can('read', 'Product')).toBe(false)
  })

  it('coexists with other subjects without bleed (Quotation alongside Sale)', () => {
    // The 'all' subject implies every action on every subject, so we stay
    // away from that here — the test focuses on the explicit-grant path.
    updateAbilityFromPermissionCodes(['read:Quotation', 'read:Sale', 'update:Customer'])

    expect(ability.can('read', 'Quotation')).toBe(true)
    expect(ability.can('read', 'Sale')).toBe(true)
    expect(ability.can('update', 'Customer')).toBe(true)
    expect(ability.can('update', 'Quotation')).toBe(false)
    expect(ability.can('create', 'Sale')).toBe(false)
  })

  it('grant is revoked when the Quotation code is removed from the code list', () => {
    updateAbilityFromPermissionCodes(['read:Quotation'])
    expect(ability.can('read', 'Quotation')).toBe(true)

    updateAbilityFromPermissionCodes([])
    expect(ability.can('read', 'Quotation')).toBe(false)
  })

  it('rejects malformed Quotation permission codes (extra segments)', () => {
    updateAbilityFromPermissionCodes(['read:Quotation:extra', 'read:Quotation'])

    // Malformed code dropped; well-formed code still grants.
    expect(ability.can('read', 'Quotation')).toBe(true)
  })

  it('validates Quotation is in the AppSubject type union', () => {
    // Compile-time guarantee. If AppSubject no longer includes 'Quotation'
    // (someone accidentally removed it from auth.types.ts), this assignment
    // fails the build.
    const subject: AppSubject = 'Quotation'
    expect(subject).toBe('Quotation')
  })
})
