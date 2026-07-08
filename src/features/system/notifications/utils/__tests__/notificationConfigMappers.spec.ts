/**
 * notificationConfigMappers.spec.ts — PURE unit tests, ZERO mocks.
 *
 * These six helpers are the unit-tested boundary that hides every backend
 * asymmetry (GET 'recipients' ↔ PUT 'recipientUserIds') and the only place
 * the frontend knows about backend error codes. Keeping them pure means
 * the test suite can prove correctness without spinning up QueryClient,
 * Pinia, http, components, or any other heavy machinery.
 */
import { describe, it, expect } from 'vitest'
import {
  fromConfigResponse,
  toPutBody,
  isDirty,
  mapNotificationConfigError,
  computeCanSave,
  computeZeroRecipientViolation,
} from '../notificationConfigMappers'
import type { NotificationConfigForm } from '../../interfaces/notification-config.types'

const baseForm: NotificationConfigForm = {
  enabled: true,
  recipientUserIds: ['u1'],
  enabledActions: ['LOW_STOCK'],
}

describe('fromConfigResponse', () => {
  it('renames GET recipients → form recipientUserIds (the field asymmetry)', () => {
    const view = {
      enabled: true,
      recipients: ['u1', 'u2'],
      enabledActions: ['LOW_STOCK'] as Array<'LOW_STOCK'>,
    }

    const form = fromConfigResponse(view)

    expect(form).toEqual({
      enabled: true,
      recipientUserIds: ['u1', 'u2'],
      enabledActions: ['LOW_STOCK'],
    })
  })

  it('returns defaults (OFF / empty) for never-configured response', () => {
    const form = fromConfigResponse({
      enabled: false,
      recipients: [],
      enabledActions: [],
    })

    expect(form).toEqual({
      enabled: false,
      recipientUserIds: [],
      enabledActions: [],
    })
  })

  it('passes enabledActions through as identity (no reshape)', () => {
    const form = fromConfigResponse({
      enabled: true,
      recipients: ['u1'],
      enabledActions: ['LOW_STOCK'],
    })
    expect(form.enabledActions).toEqual(['LOW_STOCK'])
  })

  it('preserves stale recipient ids so the user can decide (no auto-strip)', () => {
    const form = fromConfigResponse({
      enabled: true,
      recipients: ['ghost-user'],
      enabledActions: ['LOW_STOCK'],
    })
    expect(form.recipientUserIds).toEqual(['ghost-user'])
  })

  it('does NOT propagate the GET key "recipients" into the form (no leak)', () => {
    const form = fromConfigResponse({
      enabled: true,
      recipients: ['u1'],
      enabledActions: ['LOW_STOCK'],
    })
    expect((form as unknown as Record<string, unknown>).recipients).toBeUndefined()
  })
})

describe('toPutBody', () => {
  it('passes enabled, recipientUserIds, enabledActions identity', () => {
    const body = toPutBody(baseForm)
    expect(body).toEqual({
      enabled: true,
      recipientUserIds: ['u1'],
      enabledActions: ['LOW_STOCK'],
    })
  })

  it('produces EXACTLY 3 keys — no extras, no missing (forbidNonWhitelisted guard)', () => {
    const body = toPutBody({
      enabled: false,
      recipientUserIds: [],
      enabledActions: ['LOW_STOCK'],
    })
    expect(Object.keys(body)).toEqual(['enabled', 'recipientUserIds', 'enabledActions'])
    expect(Object.keys(body)).toHaveLength(3)
  })

  it('does NOT include the GET view key "recipients" in the PUT body', () => {
    const body = toPutBody(baseForm) as unknown as Record<string, unknown>
    expect(body.recipients).toBeUndefined()
  })

  it('emits empty arrays unchanged when no recipients / actions are configured', () => {
    const body = toPutBody({
      enabled: false,
      recipientUserIds: [],
      enabledActions: [],
    })
    expect(body).toEqual({
      enabled: false,
      recipientUserIds: [],
      enabledActions: [],
    })
  })

  it('preserves stale id "ghost-user" through the PUT body unchanged', () => {
    const body = toPutBody({
      enabled: true,
      recipientUserIds: ['ghost-user'],
      enabledActions: ['LOW_STOCK'],
    })
    expect(body.recipientUserIds).toEqual(['ghost-user'])
  })
})

describe('isDirty (snapshot diff)', () => {
  it('returns false when current and pristine are structurally identical', () => {
    const pristine: NotificationConfigForm = {
      enabled: false,
      recipientUserIds: [],
      enabledActions: [],
    }
    const current: NotificationConfigForm = {
      enabled: false,
      recipientUserIds: [],
      enabledActions: [],
    }
    expect(isDirty(current, pristine)).toBe(false)
  })

  it('returns true when enabled flipped', () => {
    expect(
      isDirty({ enabled: true, recipientUserIds: [], enabledActions: [] }, baseForm),
    ).toBe(true)
  })

  it('returns true when recipientUserIds differ', () => {
    expect(
      isDirty(
        { enabled: true, recipientUserIds: ['u2'], enabledActions: ['LOW_STOCK'] },
        baseForm,
      ),
    ).toBe(true)
  })

  it('returns true when enabledActions differ', () => {
    expect(
      isDirty({ enabled: true, recipientUserIds: ['u1'], enabledActions: [] }, baseForm),
    ).toBe(true)
  })

  it('returns false when arrays are both empty (no spurious dirty)', () => {
    const pristine: NotificationConfigForm = {
      enabled: false,
      recipientUserIds: [],
      enabledActions: [],
    }
    const current: NotificationConfigForm = {
      enabled: false,
      recipientUserIds: [],
      enabledActions: [],
    }
    expect(isDirty(current, pristine)).toBe(false)
  })
})

describe('mapNotificationConfigError', () => {
  it('INVALID_RECIPIENT → attaches Spanish message to recipients field, NO toast', () => {
    const result = mapNotificationConfigError({ code: 'INVALID_RECIPIENT' })
    expect(result.field).toBe('recipients')
    expect(result.toast).toBeUndefined()
    // Spanish copy comes from the spec
    expect(result.field).toBeDefined()
  })

  it('lowercase invalid_recipient is normalised and still maps to field', () => {
    const result = mapNotificationConfigError({ code: 'invalid_recipient' })
    expect(result.field).toBe('recipients')
    expect(result.toast).toBeUndefined()
  })

  it('UNKNOWN_ACTION_KEY → Spanish toast, no field error', () => {
    const result = mapNotificationConfigError({ code: 'UNKNOWN_ACTION_KEY' })
    expect(result.toast).toBeDefined()
    expect(typeof result.toast).toBe('string')
    expect(result.toast!.length).toBeGreaterThan(0)
    expect(result.field).toBeUndefined()
  })

  it('401 status → Spanish toast, no field error', () => {
    const result = mapNotificationConfigError({ status: 401 })
    expect(result.toast).toBeDefined()
    expect(result.field).toBeUndefined()
  })

  it('403 status → Spanish toast, no field error', () => {
    const result = mapNotificationConfigError({ status: 403 })
    expect(result.toast).toBeDefined()
    expect(result.field).toBeUndefined()
  })

  it('class-validator 400 (no backend domain code) → Spanish toast, no field error', () => {
    const result = mapNotificationConfigError({
      status: 400,
      code: 'class-validator-failed',
    })
    expect(result.toast).toBeDefined()
    expect(result.field).toBeUndefined()
  })

  it('unknown error code → Spanish fallback toast (never returns empty shape)', () => {
    const result = mapNotificationConfigError({ code: 'WEIRD_NEW_CODE' })
    expect(result.toast).toBeDefined()
    expect(typeof result.toast).toBe('string')
    expect(result.toast!.length).toBeGreaterThan(0)
    expect(result.field).toBeUndefined()
  })

  it('null / undefined input → Spanish fallback toast, no crash', () => {
    const nullResult = mapNotificationConfigError(null)
    const undefinedResult = mapNotificationConfigError(undefined)
    expect(nullResult.toast).toBeDefined()
    expect(undefinedResult.toast).toBeDefined()
  })

  it('plain code string accepted as input (string overload)', () => {
    const result = mapNotificationConfigError('INVALID_RECIPIENT')
    expect(result.field).toBe('recipients')
  })

  it('does NOT collapse to a plain string — always returns the {field?,toast?} shape', () => {
    const r = mapNotificationConfigError({ status: 401 })
    expect(typeof r).toBe('object')
    expect(r).not.toBe(null)
    // exactly the two documented keys (object shape, not a string)
    const keys = Object.keys(r).sort()
    expect(keys.every((k) => k === 'field' || k === 'toast')).toBe(true)
  })
})

describe('computeZeroRecipientViolation', () => {
  it('no actions → not a violation (master off is fine)', () => {
    expect(
      computeZeroRecipientViolation({ enabledActions: [], recipientUserIds: [] }),
    ).toBe(false)
  })

  it('actions enabled, no recipients → violation', () => {
    expect(
      computeZeroRecipientViolation({
        enabledActions: ['LOW_STOCK'],
        recipientUserIds: [],
      }),
    ).toBe(true)
  })

  it('actions enabled + recipients present → not a violation', () => {
    expect(
      computeZeroRecipientViolation({
        enabledActions: ['LOW_STOCK'],
        recipientUserIds: ['u1'],
      }),
    ).toBe(false)
  })

  it('actions enabled + stale recipient id → not a violation (still selectable)', () => {
    expect(
      computeZeroRecipientViolation({
        enabledActions: ['LOW_STOCK'],
        recipientUserIds: ['ghost-user'],
      }),
    ).toBe(false)
  })
})

describe('computeCanSave (pure, no auth-store coupling)', () => {
  it('all gates passed → true', () => {
    expect(
      computeCanSave({
        isDirty: true,
        isPending: false,
        zeroRecipientViolation: false,
        canUpdate: true,
      }),
    ).toBe(true)
  })

  it('not dirty → false', () => {
    expect(
      computeCanSave({
        isDirty: false,
        isPending: false,
        zeroRecipientViolation: false,
        canUpdate: true,
      }),
    ).toBe(false)
  })

  it('mutation pending → false', () => {
    expect(
      computeCanSave({
        isDirty: true,
        isPending: true,
        zeroRecipientViolation: false,
        canUpdate: true,
      }),
    ).toBe(false)
  })

  it('zero-recipient violation → false', () => {
    expect(
      computeCanSave({
        isDirty: true,
        isPending: false,
        zeroRecipientViolation: true,
        canUpdate: true,
      }),
    ).toBe(false)
  })

  it('no update perm → false', () => {
    expect(
      computeCanSave({
        isDirty: true,
        isPending: false,
        zeroRecipientViolation: false,
        canUpdate: false,
      }),
    ).toBe(false)
  })

  it('all gates failed → false', () => {
    expect(
      computeCanSave({
        isDirty: false,
        isPending: true,
        zeroRecipientViolation: true,
        canUpdate: false,
      }),
    ).toBe(false)
  })
})
