import { computed, reactive } from 'vue'
import {
  CreatePaymentMethodSchema,
  UpdatePaymentMethodSchema,
  type CreatePaymentMethodFormValues,
  type UpdatePaymentMethodFormValues,
} from '../interfaces/payment-method.types'

// Re-export the inferred value types so callers (and tests) can `import` from
// the composable entry point without reaching into the interfaces module.
// The schemas themselves live in `interfaces/payment-method.types.ts`.
export type { CreatePaymentMethodFormValues, UpdatePaymentMethodFormValues }

/**
 * usePaymentMethodForm — Locked contracts (sdd custom-payment-methods S3A, design §9.1)
 *
 *   - Schemas are imported from `interfaces/payment-method.types.ts` (single source).
 *   - The composable owns BOTH `createState` and `editState` so the slideover
 *     can swap modes without re-instantiating the composable.
 *   - `schema` is a `computed` UForm binding that returns the appropriate
 *     schema based on the `mode` prop.
 *   - `resetForm` clears BOTH states (closing the slideover wipes whatever the
 *     user typed, regardless of mode).
 *   - `setValues` prefills editState with `UpdatePaymentMethodFormValues` and
 *     fills missing keys with the initial empty values — it NEVER introduces
 *     `id`, `tenantId`, `createdAt`, `updatedAt`, or `metadataJson` into the
 *     reactive state (REQ-PM-002).
 *
 * **`isActive` REVERSAL (REQ-PM-003).** Unlike PaymentDetail, the edit
 * schema DOES include `isActive: z.boolean().optional()`, and `setValues`
 * forwards it. This is the one structural difference from the PaymentDetail
 * form composable. Reactivation happens via the slideover's `isActive`
 * toggle, not via a separate kebab action.
 */

function getCreateInitialState(): CreatePaymentMethodFormValues {
  return {
    name: '',
    category: undefined,
    subtitle: '',
  }
}

const ALLOWED_EDIT_KEYS = ['name', 'category', 'subtitle', 'isActive'] as const

function getEditInitialState(): UpdatePaymentMethodFormValues {
  return {
    name: '',
    category: undefined,
    subtitle: '',
    isActive: undefined,
  }
}

export function usePaymentMethodForm(mode: 'create' | 'edit') {
  const createState = reactive<CreatePaymentMethodFormValues>(getCreateInitialState())
  const editState = reactive<UpdatePaymentMethodFormValues>(getEditInitialState())

  const schema = computed(() =>
    mode === 'create' ? CreatePaymentMethodSchema : UpdatePaymentMethodSchema,
  )

  function resetForm(): void {
    Object.assign(createState, getCreateInitialState())
    Object.assign(editState, getEditInitialState())
  }

  /**
   * setValues — prefill editState with the given update-shape values.
   *
   * Foreign keys (`id`, `tenantId`, `createdAt`, `updatedAt`, `metadataJson`)
   * are intentionally filtered out (REQ-PM-002: the backend returns 400 for
   * them via `forbidNonWhitelisted`). The allowed key list mirrors
   * `UpdatePaymentMethodSchema.shape` AND explicitly includes `isActive`
   * (REQ-PM-003 REVERSAL).
   */
  function setValues(values: UpdatePaymentMethodFormValues): void {
    const safe: Record<string, unknown> = {}
    for (const key of ALLOWED_EDIT_KEYS) {
      const v = (values as unknown as Record<string, unknown>)[key]
      if (v === undefined || v === null) {
        safe[key] = undefined
        continue
      }
      safe[key] = v
    }
    Object.assign(editState, getEditInitialState(), safe)
  }

  function setCreateField(key: keyof CreatePaymentMethodFormValues, value: string): void {
    ;(createState as Record<string, unknown>)[key] = value
  }

  function setEditField(key: keyof UpdatePaymentMethodFormValues, value: string | boolean | undefined): void {
    ;(editState as Record<string, unknown>)[key] = value
  }

  return {
    schema,
    createState,
    editState,
    resetForm,
    setValues,
    setCreateField,
    setEditField,
  }
}