import { describe, it, expect } from 'vitest'
import {
  usePaymentDetailForm,
  type CreatePaymentDetailFormValues,
  type UpdatePaymentDetailFormValues,
} from '../usePaymentDetailForm'

describe('usePaymentDetailForm (sdd payment-details-admin S2, REQ-PD-002/003)', () => {
  describe('create mode', () => {
    it('exposes the create schema (all fields required)', () => {
      const { schema } = usePaymentDetailForm('create')
      expect(schema).toBeDefined()
      expect(typeof (schema.value as { parse?: unknown }).parse).toBe('function')

      const result = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        bankName: 'BBVA',
        beneficiary: 'ACME SA DE CV',
        clabe: '012180001234567890',
        accountNumber: '1234567890',
      })
      expect(result.success).toBe(true)
    })

    it('initializes createState with all four empty strings', () => {
      const { createState } = usePaymentDetailForm('create')

      const expected: CreatePaymentDetailFormValues = {
        bankName: '',
        beneficiary: '',
        clabe: '',
        accountNumber: '',
      }
      expect(createState).toEqual(expected)
    })

    it('initializes editState even in create mode (no surprises across modes)', () => {
      const { editState } = usePaymentDetailForm('create')
      expect(editState.bankName).toBe('')
      expect(editState.beneficiary).toBe('')
      expect(editState.clabe).toBe('')
      expect(editState.accountNumber).toBe('')
    })

    it('create schema rejects a clabe with only 17 digits', () => {
      const { schema } = usePaymentDetailForm('create')
      const result = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        bankName: 'BBVA',
        beneficiary: 'ACME',
        clabe: '01218000123456789',
        accountNumber: '1234567890',
      })
      expect(result.success).toBe(false)
    })

    it('resetForm clears createState back to all-empty strings', () => {
      const { createState, resetForm } = usePaymentDetailForm('create')
      createState.bankName = 'BBVA'
      createState.clabe = '012180001234567890'

      resetForm()

      expect(createState.bankName).toBe('')
      expect(createState.clabe).toBe('')
    })
  })

  describe('edit mode', () => {
    it('exposes the edit schema (all fields optional)', () => {
      const { schema } = usePaymentDetailForm('edit')

      // {} is valid in edit mode (partial PATCH).
      const empty = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({})
      expect(empty.success).toBe(true)

      const partial = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        beneficiary: 'NEW',
      })
      expect(partial.success).toBe(true)
    })

    it('initializes editState with all four empty strings', () => {
      const { editState } = usePaymentDetailForm('edit')

      const expected: UpdatePaymentDetailFormValues = {
        bankName: '',
        beneficiary: '',
        clabe: '',
        accountNumber: '',
      }
      expect(editState).toEqual(expected)
    })

    it('resetForm clears editState back to all-empty strings', () => {
      const { editState, resetForm } = usePaymentDetailForm('edit')
      editState.bankName = 'BBVA'
      editState.accountNumber = '1234567890'

      resetForm()

      expect(editState.bankName).toBe('')
      expect(editState.accountNumber).toBe('')
    })

    it('setValues() prefills editState with partial values, filling the rest with defaults', () => {
      const { editState, setValues } = usePaymentDetailForm('edit')

      setValues({ beneficiary: 'Acme S.A.', bankName: 'BBVA' })

      expect(editState.bankName).toBe('BBVA')
      expect(editState.beneficiary).toBe('Acme S.A.')
      expect(editState.clabe).toBe('')
      expect(editState.accountNumber).toBe('')
    })

    it('setValues() with a complete payload writes all four fields', () => {
      const { editState, setValues } = usePaymentDetailForm('edit')

      setValues({
        bankName: 'BBVA',
        beneficiary: 'Acme SA',
        clabe: '012180001234567890',
        accountNumber: '1234567890',
      })

      expect(editState).toEqual({
        bankName: 'BBVA',
        beneficiary: 'Acme SA',
        clabe: '012180001234567890',
        accountNumber: '1234567890',
      })
    })

    it('setValues() does NOT introduce isActive or tenantId into editState (REQ-PD-003)', () => {
      const { editState, setValues } = usePaymentDetailForm('edit')

      // Cast through unknown so we can intentionally try to leak forbidden keys.
      setValues({
        bankName: 'BBVA',
        isActive: true,
        tenantId: 'evil',
      } as unknown as UpdatePaymentDetailFormValues)

      const rawEdit = editState as unknown as Record<string, unknown>
      expect(rawEdit.isActive).toBeUndefined()
      expect(rawEdit.tenantId).toBeUndefined()
      // bankName from setValues was applied
      expect(editState.bankName).toBe('BBVA')
    })

    it('edit schema still rejects malformed clabe', () => {
      const { schema } = usePaymentDetailForm('edit')
      const result = (schema.value as { safeParse: (v: unknown) => { success: boolean } }).safeParse({
        clabe: '17digits-fail',
      })
      expect(result.success).toBe(false)
    })
  })
})
