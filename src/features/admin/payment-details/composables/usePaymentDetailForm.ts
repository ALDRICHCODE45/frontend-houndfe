import { computed, reactive } from 'vue'
import {
  CreatePaymentDetailSchema,
  UpdatePaymentDetailSchema,
  type CreatePaymentDetailFormValues,
  type UpdatePaymentDetailFormValues,
} from '../interfaces/payment-detail.types'

// Re-export the inferred value types so callers (and tests) can `import` from
// the composable entry point without reaching into the interfaces module.
// The schemas themselves live in `interfaces/payment-detail.types.ts`.
export type { CreatePaymentDetailFormValues, UpdatePaymentDetailFormValues }

/**
 * usePaymentDetailForm — Locked contracts (sdd payment-details-admin, design.md §9.1)
 *
 *   - Schemas are imported from `interfaces/payment-detail.types.ts` (single source).
 *   - The composable owns BOTH `createState` and `editState` so the slideover
 *     can swap modes without re-instantiating the composable.
 *   - `schema` is a `computed` UForm binding that returns the appropriate
 *     schema based on the `mode` prop.
 *   - `resetForm` clears BOTH states (closing the slideover wipes whatever the
 *     user typed, regardless of mode).
 *   - `setValues` prefills editState with `UpdatePaymentDetailFormValues` and
 *     fills missing keys with the initial empty string — it NEVER introduces
 *     `isActive` or `tenantId` into the reactive state (REQ-PD-003).
 *
 * `isActive` is never present in either state because both schema infers omit
 * it by construction. `tenantId` is only ever typed by the response DTO.
 */

function getCreateInitialState(): CreatePaymentDetailFormValues {
  return { bankName: '', beneficiary: '', clabe: '', accountNumber: '' }
}

const ALLOWED_EDIT_KEYS = ['bankName', 'beneficiary', 'clabe', 'accountNumber'] as const

function getEditInitialState(): UpdatePaymentDetailFormValues {
  return { bankName: '', beneficiary: '', clabe: '', accountNumber: '' }
}

export function usePaymentDetailForm(mode: 'create' | 'edit') {
  const createState = reactive<CreatePaymentDetailFormValues>(getCreateInitialState())
  const editState = reactive<UpdatePaymentDetailFormValues>(getEditInitialState())

  const schema = computed(() =>
    mode === 'create' ? CreatePaymentDetailSchema : UpdatePaymentDetailSchema,
  )

  function resetForm(): void {
    Object.assign(createState, getCreateInitialState())
    Object.assign(editState, getEditInitialState())
  }

  /**
   * setValues — prefill editState with the given update-shape values, defaulting
   * missing keys to the initial empty string. Foreign keys (`isActive`,
   * `tenantId`, …) are intentionally filtered out (REQ-PD-003: the backend
   * returns 400 for them). The allowed key list mirrors `UpdatePaymentDetailSchema.shape`.
   */
  function setValues(values: UpdatePaymentDetailFormValues): void {
    const safe: Record<string, string> = {}
    for (const key of ALLOWED_EDIT_KEYS) {
      const v = (values as unknown as Record<string, string | undefined>)[key]
      safe[key] = typeof v === 'string' ? v : ''
    }
    Object.assign(editState, getEditInitialState(), safe)
  }

  function setCreateField(key: keyof CreatePaymentDetailFormValues, value: string): void {
    createState[key] = value
  }

  function setEditField(key: keyof UpdatePaymentDetailFormValues, value: string): void {
    editState[key] = value
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
