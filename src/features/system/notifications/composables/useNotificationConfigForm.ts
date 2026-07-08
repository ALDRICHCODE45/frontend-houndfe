// useNotificationConfigForm.ts — form-state composable for the
// notification-config screen.
//
// Architecture (extract-before-mock, create-adaptable-composable):
//   - PURE CORE (no Vue, no Pinia, no QueryClient):
//       buildDefaultForm()         — fresh never-configured snapshot
//       computeFormState(inputs)   — { isDirty, canSave, zeroRecipientViolation }
//       hydrateForm(response)      — apply a server response to the form + pristine
//   - REACTIVE WRAPPER (useNotificationConfigForm):
//       Owns the reactive form snapshot + pristine snapshot
//       Exposes the computed gates as readonly computeds
//       Provides save() that calls toPutBody + the mutation
//
// The reactive wrapper is intentionally thin — the load-bearing logic
// lives in the pure core so unit tests can prove it without spinning up
// QueryClient, Pinia, or Vue's reactivity runtime.

import { computed, reactive, readonly, watch, type Ref } from 'vue'
import {
  computeCanSave,
  computeZeroRecipientViolation,
  fromConfigResponse,
  isDirty,
  toPutBody,
} from '../utils/notificationConfigMappers'
import { useUpdateNotificationConfigMutation } from './useUpdateNotificationConfigMutation'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type {
  ActionKey,
  NotificationConfigForm,
  NotificationConfigResponse,
} from '../interfaces/notification-config.types'

// ─── Pure core ────────────────────────────────────────────────────────────────

/**
 * Fresh never-configured snapshot. Pure — returns a new object on every call.
 */
export function buildDefaultForm(): NotificationConfigForm {
  return {
    enabled: false,
    recipientUserIds: [],
    enabledActions: [],
  }
}

/**
 * Inputs for `computeFormState`. The reactive wrapper feeds each
 * computed gate as one of these fields.
 */
export interface FormStateInputs {
  current: NotificationConfigForm
  pristine: NotificationConfigForm
  isPending: boolean
  canUpdate: boolean
}

/**
 * Output of `computeFormState` — the three reactive gates the view
 * reads to decide whether to enable Save, show an inline violation
 * message, or render the dirty state.
 */
export interface FormStateOutputs {
  isDirty: boolean
  canSave: boolean
  zeroRecipientViolation: boolean
}

/**
 * Pure derivation of the three gates. Delegates to the mapper helpers
 * (`isDirty`, `computeCanSave`, `computeZeroRecipientViolation`) so the
 * exact spec semantics are owned in ONE place.
 */
export function computeFormState(inputs: FormStateInputs): FormStateOutputs {
  const dirty = isDirty(inputs.current, inputs.pristine)
  const violation = computeZeroRecipientViolation(inputs.current)
  const canSave = computeCanSave({
    isDirty: dirty,
    isPending: inputs.isPending,
    zeroRecipientViolation: violation,
    canUpdate: inputs.canUpdate,
  })
  return {
    isDirty: dirty,
    canSave,
    zeroRecipientViolation: violation,
  }
}

// ─── Reactive wrapper ────────────────────────────────────────────────────────

/**
 * Reactive wrapper that owns the form snapshot + pristine snapshot and
 * exposes the three gates as readonly computeds. `save()` builds the
 * whitelisted PUT body and triggers the mutation.
 *
 * The `source` argument is the GET response that hydrates the form on
 * mount. It can be reactive (ref/computed) or a plain value — the
 * composable reads it once on each change via a `watch`-like pattern
 * inside the composable.
 */
/**
 * The composable accepts EITHER shape:
 *   - `NotificationConfigResponse` (raw GET view: `recipients`)
 *   - `NotificationConfigForm`     (already mapped: `recipientUserIds`)
 *
 * The query composable returns the mapped form shape; legacy callers may
 * still pass the raw view. The watch handler routes both through
 * `fromConfigResponse` so the field asymmetry is invisible to the form.
 */
export function useNotificationConfigForm(
  source: Ref<NotificationConfigResponse | NotificationConfigForm | undefined>,
) {
  const authStore = useAuthStore()

  const form = reactive<NotificationConfigForm>(buildDefaultForm())
  const pristine = reactive<NotificationConfigForm>(buildDefaultForm())

  // Field-level error state (used by the view to render an inline message).
  // Kept here because the mutation needs to clear/set it on the SAME
  // lifecycle that owns the form snapshot.
  const fieldErrors = reactive<{ recipients: string | null }>({ recipients: null })

  // Re-hydrate the form + pristine whenever the source changes. `immediate`
  // covers the case where the GET has already resolved by the time this
  // composable runs; subsequent changes (e.g. tenant switch) re-hydrate too.
  // Hydration goes through `hydrate()` so form + pristine are set in the same
  // snapshot — no spurious "dirty on hydration".
  watch(
    source,
    (value) => {
      if (value) hydrate(value)
    },
    { immediate: true },
  )

  const mutation = useUpdateNotificationConfigMutation({
    setForm: (next: NotificationConfigForm) => applyFormSnapshot(form, pristine, next),
    setFieldError: (_field, message) => {
      fieldErrors.recipients = message
    },
    clearFieldError: (_field) => {
      fieldErrors.recipients = null
    },
  })

  // canUpdate is reactive to the auth store's permission state.
  const canUpdate = computed(() => authStore.userCan('update', 'NotificationConfig'))

  const isDirtyRef: Ref<boolean> = computed(() => isDirty(form, pristine))
  const zeroRecipientViolation: Ref<boolean> = computed(() =>
    computeZeroRecipientViolation(form),
  )
  const isPending: Ref<boolean> = computed(() => mutation.isPending.value)
  const canSave: Ref<boolean> = computed(() =>
    computeFormState({
      current: form,
      pristine,
      isPending: isPending.value,
      canUpdate: canUpdate.value,
    }).canSave,
  )

  /**
   * Trigger the PUT round-trip. Builds the whitelisted body and calls
   * `mutateAsync`. Throws on error — the view's @error handler is the
   * canonical place to render toasts/field errors.
   */
  async function save(): Promise<void> {
    const body = toPutBody(form)
    await mutation.mutateAsync(body)
  }

  /**
   * Replace the form + pristine snapshots. Used by:
   *   - the view on initial GET hydration
   *   - the mutation onSuccess (re-hydrate from server response)
   */
  function hydrate(response: NotificationConfigResponse | NotificationConfigForm): void {
    const next = fromConfigResponse(response as NotificationConfigResponse)
    applyFormSnapshot(form, pristine, next)
    fieldErrors.recipients = null
  }

  return {
    form,
    pristine: readonly(pristine),
    isDirty: isDirtyRef,
    canSave,
    isPending,
    canUpdate,
    zeroRecipientViolation,
    fieldErrors: readonly(fieldErrors),
    save,
    hydrate,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Copy a fresh form snapshot into both the reactive `form` and `pristine`.
 * Done with a single object identity per array so dirty tracking stays
 * correct (the pristine IS the snapshot at hydration time, not a reference
 * to the same array as `form`).
 */
function applyFormSnapshot(
  form: NotificationConfigForm,
  pristine: NotificationConfigForm,
  next: NotificationConfigForm,
): void {
  form.enabled = next.enabled
  form.recipientUserIds = [...next.recipientUserIds]
  form.enabledActions = [...next.enabledActions] as ActionKey[]

  pristine.enabled = next.enabled
  pristine.recipientUserIds = [...next.recipientUserIds]
  pristine.enabledActions = [...next.enabledActions] as ActionKey[]
}
