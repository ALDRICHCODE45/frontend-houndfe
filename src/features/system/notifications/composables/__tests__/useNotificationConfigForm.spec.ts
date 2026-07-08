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

import { describe, it, expect, vi, afterEach } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import {
  buildDefaultForm,
  computeFormState,
  useNotificationConfigForm,
  type FormStateInputs,
} from '../useNotificationConfigForm'
import type {
  NotificationConfigForm,
  NotificationConfigResponse,
} from '../../interfaces/notification-config.types'

// The reactive wrapper pulls in the auth store (Pinia) and the update
// mutation (which itself calls useQueryClient + useToast). We stub both at
// the module boundary so the hydration behaviour can be tested in isolation,
// mirroring the extract-before-mock harness used across the feature.
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: () => true,
  }),
}))

vi.mock('../useUpdateNotificationConfigMutation', () => ({
  useUpdateNotificationConfigMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: ref(false),
    error: ref(null),
  }),
}))

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

describe('useNotificationConfigForm (source-driven hydration)', () => {
  let scope: ReturnType<typeof effectScope> | undefined

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  /** Run the composable inside an effect scope so its `watch` runs. */
  function withForm<T>(
    fn: (api: ReturnType<typeof useNotificationConfigForm>) => T,
    source: ReturnType<typeof ref<NotificationConfigResponse | undefined>>,
  ): T {
    scope = effectScope()
    return scope.run(() => fn(useNotificationConfigForm(source)))!
  }

  it('hydrates the form when the GET source resolves (undefined → value)', async () => {
    const source = ref<NotificationConfigResponse | undefined>(undefined)
    const api = withForm((a) => a, source)

    // Before resolution: form stays at defaults.
    expect(api.form.enabled).toBe(false)
    expect(api.form.recipientUserIds).toEqual([])
    expect(api.form.enabledActions).toEqual([])

    // GET resolves.
    source.value = {
      enabled: true,
      recipients: ['u1', 'u2'],
      enabledActions: ['LOW_STOCK'],
    }
    await nextTick()

    expect(api.form.enabled).toBe(true)
    expect(api.form.recipientUserIds).toEqual(['u1', 'u2'])
    expect(api.form.enabledActions).toEqual(['LOW_STOCK'])
    // Hydration sets pristine in the same snapshot — no spurious dirty state.
    expect(api.isDirty.value).toBe(false)
  })

  it('hydrates immediately when the source already has a value on setup', async () => {
    const source = ref<NotificationConfigResponse | undefined>({
      enabled: true,
      recipients: ['u9'],
      enabledActions: ['LOW_STOCK'],
    })
    const api = withForm((a) => a, source)
    await nextTick()

    expect(api.form.enabled).toBe(true)
    expect(api.form.recipientUserIds).toEqual(['u9'])
    expect(api.isDirty.value).toBe(false)
  })

  it('re-hydrates when the source changes to a new value', async () => {
    const source = ref<NotificationConfigResponse | undefined>({
      enabled: false,
      recipients: [],
      enabledActions: [],
    })
    const api = withForm((a) => a, source)
    await nextTick()

    source.value = {
      enabled: true,
      recipients: ['u3'],
      enabledActions: ['LOW_STOCK'],
    }
    await nextTick()

    expect(api.form.enabled).toBe(true)
    expect(api.form.recipientUserIds).toEqual(['u3'])
    expect(api.isDirty.value).toBe(false)
  })
})
