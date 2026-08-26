import { describe, it, expect } from 'vitest'
import {
  usePaymentMethodForm,
  type CreatePaymentMethodFormValues,
  type UpdatePaymentMethodFormValues,
} from '../usePaymentMethodForm'

describe('usePaymentMethodForm (sdd custom-payment-methods S3A, REQ-PM-002/003)', () => {
  describe('create mode', () => {
    it('exposes the create schema (name + category required, subtitle optional)', () => {
      const { schema } = usePaymentMethodForm('create')
      expect(schema).toBeDefined()
      expect(typeof (schema.value as { parse?: unknown }).parse).toBe('function')

      const result = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        name: 'Mercado Pago',
        category: 'transfer',
      })
      expect(result.success).toBe(true)
    })

    it('initializes createState with empty fields (name, category, subtitle)', () => {
      const { createState } = usePaymentMethodForm('create')

      const expected: CreatePaymentMethodFormValues = {
        name: '',
        category: undefined,
        subtitle: '',
      }
      expect(createState.name).toBe('')
      expect(createState.subtitle).toBe('')
    })

    it('initializes editState even in create mode (no surprises across modes)', () => {
      const { editState } = usePaymentMethodForm('create')
      expect(editState.name).toBe('')
      expect(editState.subtitle).toBe('')
    })

    it('create schema rejects an empty name', () => {
      const { schema } = usePaymentMethodForm('create')
      const result = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        name: '',
        category: 'cash',
      })
      expect(result.success).toBe(false)
    })

    it('create schema rejects an unknown category (REQ-PM-008)', () => {
      const { schema } = usePaymentMethodForm('create')
      const result = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        name: 'Mercado Pago',
        category: 'pix',
      })
      expect(result.success).toBe(false)
    })

    it('resetForm clears createState back to empty fields', () => {
      const { createState, resetForm } = usePaymentMethodForm('create')
      createState.name = 'Mercado Pago'
      createState.subtitle = 'Link'

      resetForm()

      expect(createState.name).toBe('')
      expect(createState.subtitle).toBe('')
    })
  })

  describe('edit mode', () => {
    it('exposes the edit schema (all fields optional, partial PATCH)', () => {
      const { schema } = usePaymentMethodForm('edit')

      // {} is valid in edit mode (partial PATCH).
      const empty = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({})
      expect(empty.success).toBe(true)

      const partial = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        name: 'NEW',
      })
      expect(partial.success).toBe(true)
    })

    it('edit schema accepts { isActive: false } (REQ-PM-003 REVERSAL pin)', () => {
      const { schema } = usePaymentMethodForm('edit')
      const result = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        isActive: false,
      })
      expect(result.success).toBe(true)
    })

    it('edit schema accepts { isActive: true } (REQ-PM-003 reactivate path)', () => {
      const { schema } = usePaymentMethodForm('edit')
      const result = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        isActive: true,
      })
      expect(result.success).toBe(true)
    })

    it('initializes editState with all empty fields', () => {
      const { editState } = usePaymentMethodForm('edit')

      const expected: UpdatePaymentMethodFormValues = {
        name: '',
        category: undefined,
        subtitle: '',
        isActive: undefined,
      }
      expect(editState.name).toBe('')
      expect(editState.subtitle).toBe('')
    })

    it('resetForm clears editState back to all-empty fields', () => {
      const { editState, resetForm } = usePaymentMethodForm('edit')
      editState.name = 'NEW'
      editState.subtitle = 'NEW SUB'

      resetForm()

      expect(editState.name).toBe('')
      expect(editState.subtitle).toBe('')
    })

    it('setValues() prefills editState with partial values, filling the rest with defaults', () => {
      const { editState, setValues } = usePaymentMethodForm('edit')

      setValues({ name: 'Mercado Pago', subtitle: 'Link' })

      expect(editState.name).toBe('Mercado Pago')
      expect(editState.subtitle).toBe('Link')
      // category stays undefined, isActive stays undefined (only name + subtitle provided).
      expect(editState.category).toBeUndefined()
      expect(editState.isActive).toBeUndefined()
    })

    it('setValues() with a complete payload writes name + category + subtitle + isActive', () => {
      const { editState, setValues } = usePaymentMethodForm('edit')

      setValues({
        name: 'Mercado Pago',
        category: 'transfer',
        subtitle: 'Link',
        isActive: true,
      })

      expect(editState.name).toBe('Mercado Pago')
      expect(editState.category).toBe('transfer')
      expect(editState.subtitle).toBe('Link')
      expect(editState.isActive).toBe(true)
    })

    // REQ-PM-003 REVERSAL — setValues() FORWARDS isActive so the slideover's
    // toggle works on edit. Unlike PaymentDetail, this is allowed.
    it('setValues() forwards isActive (REQ-PM-003 REVERSAL pin)', () => {
      const { editState, setValues } = usePaymentMethodForm('edit')

      setValues({ name: 'NEW', isActive: false })

      expect(editState.isActive).toBe(false)
    })

    // REQ-PM-002 — setValues() never introduces tenantId, id, createdAt, or
    // updatedAt into the editState (the backend forbids them).
    it('setValues() does NOT introduce tenantId / id / createdAt / updatedAt into editState (REQ-PM-002)', () => {
      const { editState, setValues } = usePaymentMethodForm('edit')

      setValues({
        name: 'NEW',
        id: 'evil',
        tenantId: 'evil',
        createdAt: '2000-01-01T00:00:00.000Z',
        updatedAt: '2000-01-01T00:00:00.000Z',
      } as unknown as UpdatePaymentMethodFormValues)

      const raw = editState as unknown as Record<string, unknown>
      expect(raw.tenantId).toBeUndefined()
      expect(raw.id).toBeUndefined()
      expect(raw.createdAt).toBeUndefined()
      expect(raw.updatedAt).toBeUndefined()
      expect(editState.name).toBe('NEW')
    })

    it('edit schema still rejects an empty name (when name is provided)', () => {
      const { schema } = usePaymentMethodForm('edit')
      const result = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        name: '',
      })
      expect(result.success).toBe(false)
    })
  })
})