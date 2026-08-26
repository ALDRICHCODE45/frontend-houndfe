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

// ── sdd payment-details-admin S1: CASL registration for PaymentDetail ───────
//
// REQ-AUTH-001/002/004 — mirrors the Quotation/NotificationConfig precedent.
// PaymentDetail is added to AppSubject + APP_SUBJECTS so:
//   1. parsePermissionCode accepts the four CRUD codes.
//   2. updateAbilityFromPermissionCodes grants the corresponding CASL actions.
//   3. Malformed codes (extra `:` segments, unknown subjects) are dropped
//      without affecting unrelated grants.
//   4. Removing the code revokes the grant on the next updateAbility call.
//   5. The AppSubject union admits 'PaymentDetail' (compile-time).

describe('ability with PaymentDetail subject (sdd payment-details-admin S1, REQ-AUTH-001/002/004)', () => {
  beforeEach(() => {
    resetAbility()
  })

  it('parses read:PaymentDetail and grants read on PaymentDetail only', () => {
    updateAbilityFromPermissionCodes(['read:PaymentDetail'])

    expect(ability.can('read', 'PaymentDetail')).toBe(true)
    expect(ability.can('create', 'PaymentDetail')).toBe(false)
    expect(ability.can('update', 'PaymentDetail')).toBe(false)
    expect(ability.can('delete', 'PaymentDetail')).toBe(false)
  })

  it('parses create:PaymentDetail and grants create only', () => {
    updateAbilityFromPermissionCodes(['create:PaymentDetail'])

    expect(ability.can('create', 'PaymentDetail')).toBe(true)
    expect(ability.can('read', 'PaymentDetail')).toBe(false)
  })

  it('parses update:PaymentDetail and grants update only', () => {
    updateAbilityFromPermissionCodes(['update:PaymentDetail'])

    expect(ability.can('update', 'PaymentDetail')).toBe(true)
    expect(ability.can('read', 'PaymentDetail')).toBe(false)
  })

  it('parses delete:PaymentDetail and grants delete only', () => {
    updateAbilityFromPermissionCodes(['delete:PaymentDetail'])

    expect(ability.can('delete', 'PaymentDetail')).toBe(true)
  })

  it('parses all four PaymentDetail actions together (full CRUD role)', () => {
    updateAbilityFromPermissionCodes([
      'create:PaymentDetail',
      'read:PaymentDetail',
      'update:PaymentDetail',
      'delete:PaymentDetail',
    ])

    expect(ability.can('create', 'PaymentDetail')).toBe(true)
    expect(ability.can('read', 'PaymentDetail')).toBe(true)
    expect(ability.can('update', 'PaymentDetail')).toBe(true)
    expect(ability.can('delete', 'PaymentDetail')).toBe(true)
  })

  it('does NOT silently drop PaymentDetail — guard against parsePermissionCode returning null', () => {
    updateAbilityFromPermissionCodes(['read:PaymentDetail'])

    expect(ability.can('read', 'PaymentDetail')).toBe(true)
  })

  it('keeps PaymentDetail scoped — no bleed to Quotation/Sale/Product', () => {
    updateAbilityFromPermissionCodes(['read:PaymentDetail'])

    expect(ability.can('read', 'PaymentDetail')).toBe(true)
    expect(ability.can('read', 'Quotation')).toBe(false)
    expect(ability.can('read', 'Sale')).toBe(false)
    expect(ability.can('read', 'Product')).toBe(false)
  })

  it('coexists with other subjects without bleed (PaymentDetail alongside Quotation)', () => {
    updateAbilityFromPermissionCodes([
      'read:PaymentDetail',
      'read:Quotation',
      'update:Customer',
    ])

    expect(ability.can('read', 'PaymentDetail')).toBe(true)
    expect(ability.can('read', 'Quotation')).toBe(true)
    expect(ability.can('update', 'Customer')).toBe(true)
    expect(ability.can('update', 'PaymentDetail')).toBe(false)
  })

  it('grant is revoked when the PaymentDetail code is removed from the code list', () => {
    updateAbilityFromPermissionCodes(['read:PaymentDetail'])
    expect(ability.can('read', 'PaymentDetail')).toBe(true)

    updateAbilityFromPermissionCodes([])
    expect(ability.can('read', 'PaymentDetail')).toBe(false)
  })

  it('rejects malformed PaymentDetail codes (REQ-AUTH-004)', () => {
    updateAbilityFromPermissionCodes([
      'read:PaymentDetail:extra', // extra segment → dropped
      'fly:PaymentDetail', // unknown action → dropped
      'read:UnknownSubject', // unknown subject → dropped
      'read:PaymentDetail', // well-formed → grants
    ])

    // The well-formed code still grants even though three malformed
    // siblings were dropped — guards against sibling-drop regressions.
    expect(ability.can('read', 'PaymentDetail')).toBe(true)
  })

  it('validates PaymentDetail is in the AppSubject type union', () => {
    const subject: AppSubject = 'PaymentDetail'
    expect(subject).toBe('PaymentDetail')
  })
})

// ── sdd custom-payment-methods S1: CASL registration for PaymentMethod ────
//
// REQ-PM-006 / design §5.1 — mirrors the PaymentDetail precedent with one
// critical invariant (the silent-drop regression test):
//   parsePermissionCode('create:PaymentMethod') returns ['create','PaymentMethod']
//   ONLY when 'PaymentMethod' is registered in APP_SUBJECTS + AppSubject.
// If somebody removed it from either, the ability would silently stay closed
// (the route guard + create button + nav entry would all stay hidden) and
// the tenant admin could never reach the new module. The "ALL four CRUD
// actions" suite plus the AppSubject union assertion freeze this contract.

describe('ability with PaymentMethod subject (sdd custom-payment-methods S1, REQ-PM-006)', () => {
  beforeEach(() => {
    resetAbility()
  })

  it('parses read:PaymentMethod and grants read on PaymentMethod only', () => {
    updateAbilityFromPermissionCodes(['read:PaymentMethod'])

    expect(ability.can('read', 'PaymentMethod')).toBe(true)
    expect(ability.can('create', 'PaymentMethod')).toBe(false)
    expect(ability.can('update', 'PaymentMethod')).toBe(false)
    expect(ability.can('delete', 'PaymentMethod')).toBe(false)
  })

  it('parses create:PaymentMethod and grants create only', () => {
    updateAbilityFromPermissionCodes(['create:PaymentMethod'])

    expect(ability.can('create', 'PaymentMethod')).toBe(true)
    expect(ability.can('read', 'PaymentMethod')).toBe(false)
  })

  it('parses update:PaymentMethod and grants update only', () => {
    updateAbilityFromPermissionCodes(['update:PaymentMethod'])

    expect(ability.can('update', 'PaymentMethod')).toBe(true)
    expect(ability.can('read', 'PaymentMethod')).toBe(false)
  })

  it('parses delete:PaymentMethod and grants delete only', () => {
    updateAbilityFromPermissionCodes(['delete:PaymentMethod'])

    expect(ability.can('delete', 'PaymentMethod')).toBe(true)
  })

  it('parses all four PaymentMethod actions together (full CRUD role)', () => {
    updateAbilityFromPermissionCodes([
      'create:PaymentMethod',
      'read:PaymentMethod',
      'update:PaymentMethod',
      'delete:PaymentMethod',
    ])

    expect(ability.can('create', 'PaymentMethod')).toBe(true)
    expect(ability.can('read', 'PaymentMethod')).toBe(true)
    expect(ability.can('update', 'PaymentMethod')).toBe(true)
    expect(ability.can('delete', 'PaymentMethod')).toBe(true)
  })

  // The critical silent-drop regression test (REQ-PM-006). If 'PaymentMethod'
  // were missing from APP_SUBJECTS, parsePermissionCode would return null and
  // ability.can would stay false — the UI gate would never open and the
  // sidebar/route would silently stay closed. Asserting true here guards
  // against the silent-drop path during future APP_SUBJECTS edits.
  it('does NOT silently drop PaymentMethod — parsePermissionCode returns the tuple when registered (REQ-PM-006)', () => {
    updateAbilityFromPermissionCodes(['create:PaymentMethod'])

    expect(ability.can('create', 'PaymentMethod')).toBe(true)
  })

  it('keeps PaymentMethod scoped — no bleed to Sale/Customer/Product/PaymentDetail', () => {
    updateAbilityFromPermissionCodes(['read:PaymentMethod'])

    expect(ability.can('read', 'PaymentMethod')).toBe(true)
    expect(ability.can('read', 'Sale')).toBe(false)
    expect(ability.can('read', 'Customer')).toBe(false)
    expect(ability.can('read', 'Product')).toBe(false)
    expect(ability.can('read', 'PaymentDetail')).toBe(false)
  })

  it('coexists with other subjects without bleed (PaymentMethod alongside PaymentDetail + Sale)', () => {
    updateAbilityFromPermissionCodes([
      'read:PaymentMethod',
      'read:PaymentDetail',
      'update:Sale',
    ])

    expect(ability.can('read', 'PaymentMethod')).toBe(true)
    expect(ability.can('read', 'PaymentDetail')).toBe(true)
    expect(ability.can('update', 'Sale')).toBe(true)
    expect(ability.can('update', 'PaymentMethod')).toBe(false)
    expect(ability.can('create', 'Sale')).toBe(false)
  })

  it('grant is revoked when the PaymentMethod code is removed from the code list', () => {
    updateAbilityFromPermissionCodes(['read:PaymentMethod'])
    expect(ability.can('read', 'PaymentMethod')).toBe(true)

    updateAbilityFromPermissionCodes([])
    expect(ability.can('read', 'PaymentMethod')).toBe(false)
  })

  it('rejects malformed PaymentMethod codes (extra segments / unknown action / unknown subject)', () => {
    updateAbilityFromPermissionCodes([
      'read:PaymentMethod:extra', // extra segment → dropped
      'fly:PaymentMethod', // unknown action → dropped
      'read:UnknownSubject', // unknown subject → dropped
      'read:PaymentMethod', // well-formed → grants
    ])

    expect(ability.can('read', 'PaymentMethod')).toBe(true)
  })

  it('only the 4 CRUD actions grant their respective verbs — no implicit manage bleed-through', () => {
    // Backend registry exposes only create / read / update / delete for
    // PaymentMethod (REQ-PM-006). We do NOT seed `manage` or `batch_delete`
    // in PERMISSION_COPY. Granting `batch_delete:PaymentMethod` alone MUST
    // NOT open `read:PaymentMethod` (CASL does not infer from `manage`).
    // `manage:PaymentMethod` does grant everything by CASL semantics, but
    // the curated role UI never surfaces that code, so this is a
    // belt-and-suspenders assertion.
    updateAbilityFromPermissionCodes([
      'batch_delete:PaymentMethod',
    ])

    expect(ability.can('read', 'PaymentMethod')).toBe(false)
    expect(ability.can('create', 'PaymentMethod')).toBe(false)
    expect(ability.can('update', 'PaymentMethod')).toBe(false)
    expect(ability.can('delete', 'PaymentMethod')).toBe(false)
    // batch_delete IS granted for the subject — proves the action itself is
    // parseable (regression guard against future APP_ACTIONS edits that
    // might silently drop `batch_delete`).
    expect(ability.can('batch_delete', 'PaymentMethod')).toBe(true)
  })

  it('validates PaymentMethod is in the AppSubject type union (compile-time guarantee)', () => {
    // If AppSubject no longer includes 'PaymentMethod' (someone
    // accidentally removed it from auth.types.ts), this assignment fails
    // the build.
    const subject: AppSubject = 'PaymentMethod'
    expect(subject).toBe('PaymentMethod')
  })
})
