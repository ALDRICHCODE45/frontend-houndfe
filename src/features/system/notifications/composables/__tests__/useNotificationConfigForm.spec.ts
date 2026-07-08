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
import { handleUpdateSuccess } from '../useUpdateNotificationConfigMutation'
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

// Partial mock: stub the composable (pulls in QueryClient + toast) but keep
// the PURE `handleUpdateSuccess` export so the mutation re-hydration path can
// be tested directly without a QueryClient.
vi.mock('../useUpdateNotificationConfigMutation', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../useUpdateNotificationConfigMutation')>()
  return {
    ...actual,
    useUpdateNotificationConfigMutation: () => ({
      mutateAsync: vi.fn(),
      isPending: ref(false),
      error: ref(null),
    }),
  }
})

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
  // The `source` is the QUERY's mapped data ref. `useNotificationConfigQuery`
  // already runs `fromConfigResponse`, so `source.value` is a
  // NotificationConfigForm (`recipientUserIds`) — NOT the raw GET view
  // (`recipients`). These tests feed the REAL production shape through the
  // query→view→form seam so a second `fromConfigResponse` map would crash
  // (`[...undefined]`) or silently drop recipients. Feeding the raw view
  // shape here (as the old tests did) hid that bug.
  let scope: ReturnType<typeof effectScope> | undefined

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  /** Run the composable inside an effect scope so its `watch` runs. */
  function withForm<T>(
    fn: (api: ReturnType<typeof useNotificationConfigForm>) => T,
    source: ReturnType<typeof ref<NotificationConfigForm | undefined>>,
  ): T {
    scope = effectScope()
    return scope.run(() => fn(useNotificationConfigForm(source)))!
  }

  it('applies the already-mapped form when the GET source resolves (undefined → value)', async () => {
    const source = ref<NotificationConfigForm | undefined>(undefined)
    const api = withForm((a) => a, source)

    // Before resolution: form stays at defaults.
    expect(api.form.enabled).toBe(false)
    expect(api.form.recipientUserIds).toEqual([])
    expect(api.form.enabledActions).toEqual([])

    // GET resolves — the query hands over the mapped Form shape.
    // The current double-map code does fromConfigResponse(form as Response),
    // which reads `view.recipients` (undefined on a Form) and throws
    // TypeError on `[...undefined]`.
    expect(() => {
      source.value = {
        enabled: true,
        recipientUserIds: ['u1', 'u2'],
        enabledActions: ['LOW_STOCK'],
      }
    }).not.toThrow()
    await nextTick()

    expect(api.form.enabled).toBe(true)
    // Recipients must survive — the double-map would drop them to [].
    expect(api.form.recipientUserIds).toEqual(['u1', 'u2'])
    expect(api.form.enabledActions).toEqual(['LOW_STOCK'])
    // Hydration sets pristine in the same snapshot — no spurious dirty state.
    expect(api.isDirty.value).toBe(false)
  })

  it('applies the mapped form immediately when the source already has a value on setup', async () => {
    const source = ref<NotificationConfigForm | undefined>({
      enabled: true,
      recipientUserIds: ['u9'],
      enabledActions: ['LOW_STOCK'],
    })
    const api = withForm((a) => a, source)
    await nextTick()

    expect(api.form.enabled).toBe(true)
    expect(api.form.recipientUserIds).toEqual(['u9'])
    expect(api.isDirty.value).toBe(false)
  })

  it('re-applies when the source changes to a new mapped form', async () => {
    const source = ref<NotificationConfigForm | undefined>({
      enabled: false,
      recipientUserIds: [],
      enabledActions: [],
    })
    const api = withForm((a) => a, source)
    await nextTick()

    source.value = {
      enabled: true,
      recipientUserIds: ['u3'],
      enabledActions: ['LOW_STOCK'],
    }
    await nextTick()

    expect(api.form.enabled).toBe(true)
    expect(api.form.recipientUserIds).toEqual(['u3'])
    expect(api.isDirty.value).toBe(false)
  })
})

describe('mutation re-hydration path (raw PUT response maps EXACTLY once)', () => {
  // The mutation success path is separate from the query→view→form seam.
  // `handleUpdateSuccess` receives the RAW PUT response (`recipients`) and
  // maps it ONCE via `fromConfigResponse`, then feeds the resulting Form to
  // `setForm` (= applyFormSnapshot). This proves the raw-view branch still
  // maps correctly and lands the right `recipientUserIds`.
  it('maps a raw NotificationConfigResponse once through setForm', () => {
    const rawResponse: NotificationConfigResponse = {
      enabled: true,
      recipients: ['u1', 'u2'],
      enabledActions: ['LOW_STOCK'],
    }

    let received: NotificationConfigForm | undefined
    handleUpdateSuccess(rawResponse, {
      invalidateConfig: vi.fn(),
      setForm: (form) => {
        received = form
      },
      addToast: vi.fn(),
      setFieldError: vi.fn(),
      clearFieldError: vi.fn(),
    })

    // Exactly one map: recipients → recipientUserIds, no double-map.
    expect(received).toEqual({
      enabled: true,
      recipientUserIds: ['u1', 'u2'],
      enabledActions: ['LOW_STOCK'],
    })
  })
})
