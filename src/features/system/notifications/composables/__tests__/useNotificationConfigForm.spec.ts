// useNotificationConfigForm.spec.ts — RED-first tests for the form-state
// composable's PURE CORE.
//
// The composable has two parts:
//   1. PURE helpers (no reactivity, no Pinia, no QueryClient):
//        - buildDefaultForm()      — fresh never-configured snapshot
//        - computeFormState(...)   — given current/pristine/pending/update perm,
//                                    returns { isDirty, canSave, zeroRecipientViolation }
//   2. REACTIVE wrapper (useNotificationConfigForm) — wraps the helpers
//      with Vue's reactive() and provides save().
//
// This spec covers the pure helpers — the reactive wrapper just wires them
// up. The pure helpers are the load-bearing logic: spec REQ-6 dictates the
// canSave gate, REQ-7 the save round-trip.

import { describe, it, expect } from 'vitest'
import {
  buildDefaultForm,
  computeFormState,
  type FormStateInputs,
} from '../useNotificationConfigForm'
import type { NotificationConfigForm } from '../../interfaces/notification-config.types'

describe('buildDefaultForm (never-configured snapshot)', () => {
  it('returns the OFF / empty defaults', () => {
    const defaults = buildDefaultForm()
    expect(defaults).toEqual({
      enabled: false,
      recipientUserIds: [],
      enabledActions: [],
    })
  })

  it('returns a FRESH object on every call (no shared state)', () => {
    const a = buildDefaultForm()
    const b = buildDefaultForm()
    expect(a).not.toBe(b)
    expect(a.recipientUserIds).not.toBe(b.recipientUserIds)
    a.recipientUserIds.push('u1')
    expect(b.recipientUserIds).toEqual([])
  })
})

describe('computeFormState (pure core: isDirty, canSave, zeroRecipientViolation)', () => {
  const defaults: NotificationConfigForm = buildDefaultForm()

  function inputs(overrides: Partial<FormStateInputs> = {}): FormStateInputs {
    return {
      current: defaults,
      pristine: defaults,
      isPending: false,
      canUpdate: true,
      ...overrides,
    }
  }

  describe('isDirty', () => {
    it('false when current === pristine (defaults)', () => {
      const state = computeFormState(inputs())
      expect(state.isDirty).toBe(false)
    })

    it('true when enabled was flipped', () => {
      const state = computeFormState(
        inputs({ current: { ...defaults, enabled: true } }),
      )
      expect(state.isDirty).toBe(true)
    })

    it('true when recipientUserIds differ', () => {
      const state = computeFormState(
        inputs({
          current: { ...defaults, recipientUserIds: ['u1'] },
          pristine: defaults,
        }),
      )
      expect(state.isDirty).toBe(true)
    })

    it('true when enabledActions differ', () => {
      const state = computeFormState(
        inputs({
          current: { ...defaults, enabledActions: ['LOW_STOCK'] },
          pristine: defaults,
        }),
      )
      expect(state.isDirty).toBe(true)
    })
  })

  describe('zeroRecipientViolation', () => {
    it('false when no actions enabled (master-off is fine)', () => {
      const state = computeFormState(
        inputs({
          current: { ...defaults, enabledActions: [], recipientUserIds: [] },
        }),
      )
      expect(state.zeroRecipientViolation).toBe(false)
    })

    it('true when actions enabled but no recipients', () => {
      const state = computeFormState(
        inputs({
          current: { ...defaults, enabledActions: ['LOW_STOCK'], recipientUserIds: [] },
        }),
      )
      expect(state.zeroRecipientViolation).toBe(true)
    })

    it('false when actions + recipients present', () => {
      const state = computeFormState(
        inputs({
          current: { ...defaults, enabledActions: ['LOW_STOCK'], recipientUserIds: ['u1'] },
        }),
      )
      expect(state.zeroRecipientViolation).toBe(false)
    })
  })

  describe('canSave (all gates)', () => {
    it('true when all gates pass', () => {
      const state = computeFormState(
        inputs({
          current: { enabled: true, recipientUserIds: ['u1'], enabledActions: ['LOW_STOCK'] },
          isPending: false,
          canUpdate: true,
        }),
      )
      expect(state.canSave).toBe(true)
    })

    it('false when not dirty', () => {
      const state = computeFormState(inputs({ isPending: false, canUpdate: true }))
      expect(state.canSave).toBe(false)
    })

    it('false when mutation pending', () => {
      const state = computeFormState(
        inputs({
          current: { enabled: true, recipientUserIds: ['u1'], enabledActions: ['LOW_STOCK'] },
          isPending: true,
          canUpdate: true,
        }),
      )
      expect(state.canSave).toBe(false)
    })

    it('false on zero-recipient violation', () => {
      const state = computeFormState(
        inputs({
          current: { enabled: true, recipientUserIds: [], enabledActions: ['LOW_STOCK'] },
          isPending: false,
          canUpdate: true,
        }),
      )
      expect(state.canSave).toBe(false)
    })

    it('false when no update perm', () => {
      const state = computeFormState(
        inputs({
          current: { enabled: true, recipientUserIds: ['u1'], enabledActions: ['LOW_STOCK'] },
          isPending: false,
          canUpdate: false,
        }),
      )
      expect(state.canSave).toBe(false)
    })
  })

  describe('triangulation: state transitions as the user edits', () => {
    it('initial render: !dirty, canSave false (cannot save unchanged form)', () => {
      const state = computeFormState(inputs())
      expect(state.isDirty).toBe(false)
      expect(state.canSave).toBe(false)
    })

    it('after master flip: dirty=true, canSave TRUE (no violation — no actions enabled)', () => {
      // Zero-recipient violation fires only when enabledActions > 0 AND
      // recipientUserIds === 0. Master-on alone is NOT a violation, so
      // canSave stays true as soon as canUpdate is granted.
      const state = computeFormState(
        inputs({ current: { ...defaults, enabled: true } }),
      )
      expect(state.isDirty).toBe(true)
      expect(state.zeroRecipientViolation).toBe(false)
      expect(state.canSave).toBe(true)
    })

    it('after enabling action: violation true, canSave false', () => {
      const state = computeFormState(
        inputs({
          current: { enabled: true, recipientUserIds: [], enabledActions: ['LOW_STOCK'] },
        }),
      )
      expect(state.isDirty).toBe(true)
      expect(state.zeroRecipientViolation).toBe(true)
      expect(state.canSave).toBe(false)
    })

    it('after adding a recipient: violation clears, canSave true', () => {
      const state = computeFormState(
        inputs({
          current: { enabled: true, recipientUserIds: ['u1'], enabledActions: ['LOW_STOCK'] },
        }),
      )
      expect(state.isDirty).toBe(true)
      expect(state.zeroRecipientViolation).toBe(false)
      expect(state.canSave).toBe(true)
    })
  })
})
