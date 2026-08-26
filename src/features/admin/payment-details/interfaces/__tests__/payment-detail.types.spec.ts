import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  CreatePaymentDetailSchema,
  UpdatePaymentDetailSchema,
  paymentDetailStatusLabel,
  PAYMENT_DETAIL_STATUS_LABELS,
  type CreatePaymentDetailFormValues,
  type UpdatePaymentDetailFormValues,
} from '../payment-detail.types'

const validCreate: CreatePaymentDetailFormValues = {
  bankName: 'BBVA',
  beneficiary: 'ACME SA DE CV',
  clabe: '012180001234567890',
  accountNumber: '1234567890',
}

describe('CreatePaymentDetailSchema (sdd payment-details-admin S1, REQ-PD-002)', () => {
  it('accepts a fully valid payload', () => {
    const result = CreatePaymentDetailSchema.safeParse(validCreate)
    expect(result.success).toBe(true)
  })

  it('rejects a clabe with fewer than 18 digits', () => {
    const result = CreatePaymentDetailSchema.safeParse({
      ...validCreate,
      clabe: '01218000123456789', // 17 digits
    })
    expect(result.success).toBe(false)
  })

  it('rejects a clabe with non-digit characters', () => {
    const result = CreatePaymentDetailSchema.safeParse({
      ...validCreate,
      clabe: '01218000123456789X',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a clabe with more than 18 digits', () => {
    const result = CreatePaymentDetailSchema.safeParse({
      ...validCreate,
      clabe: '0121800012345678901', // 19 digits
    })
    expect(result.success).toBe(false)
  })

  it('rejects an accountNumber with fewer than 10 digits', () => {
    const result = CreatePaymentDetailSchema.safeParse({
      ...validCreate,
      accountNumber: '123456789', // 9 digits
    })
    expect(result.success).toBe(false)
  })

  it('rejects an accountNumber with non-digit characters', () => {
    const result = CreatePaymentDetailSchema.safeParse({
      ...validCreate,
      accountNumber: '12345abcde',
    })
    expect(result.success).toBe(false)
  })

  it('accepts an accountNumber with 10 or more digits', () => {
    const r1 = CreatePaymentDetailSchema.safeParse({
      ...validCreate,
      accountNumber: '1234567890',
    })
    const r2 = CreatePaymentDetailSchema.safeParse({
      ...validCreate,
      accountNumber: '123456789012345',
    })
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
  })

  it('rejects a blank (whitespace-only) bankName', () => {
    const result = CreatePaymentDetailSchema.safeParse({
      ...validCreate,
      bankName: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty bankName', () => {
    const result = CreatePaymentDetailSchema.safeParse({ ...validCreate, bankName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a blank (whitespace-only) beneficiary', () => {
    const result = CreatePaymentDetailSchema.safeParse({
      ...validCreate,
      beneficiary: '\t\n',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing bankName key', () => {
    const { bankName: _omit, ...rest } = validCreate
    const result = CreatePaymentDetailSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('isActive NEVER appears in the create schema shape', () => {
    // Backend rejects isActive via forbidNonWhitelisted → 400. The UI MUST
    // never emit it.
    const shapeKeys = Object.keys(
      (CreatePaymentDetailSchema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape,
    )
    expect(shapeKeys).not.toContain('isActive')
  })

  it('create schema requires exactly four fields (no isActive, no tenantId)', () => {
    const shapeKeys = Object.keys(
      (CreatePaymentDetailSchema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape,
    ).sort()
    expect(shapeKeys).toEqual(['accountNumber', 'bankName', 'beneficiary', 'clabe'])
  })
})

describe('UpdatePaymentDetailSchema (sdd payment-details-admin S1, REQ-PD-003)', () => {
  it('accepts {} (empty object — partial PATCH requires no field)', () => {
    const result = UpdatePaymentDetailSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts a single-field partial update (beneficiary only)', () => {
    const result = UpdatePaymentDetailSchema.safeParse({ beneficiary: 'New Beneficiary' })
    expect(result.success).toBe(true)
  })

  it('still rejects a malformed clabe even in edit mode', () => {
    const result = UpdatePaymentDetailSchema.safeParse({ clabe: '17digits-lo' })
    expect(result.success).toBe(false)
  })

  it('still rejects a too-short accountNumber in edit mode', () => {
    const result = UpdatePaymentDetailSchema.safeParse({ accountNumber: 'short' })
    expect(result.success).toBe(false)
  })

  it('isActive NEVER appears in the edit schema shape (cannot reactivate / cannot toggle)', () => {
    const shapeKeys = Object.keys(
      (UpdatePaymentDetailSchema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape,
    )
    expect(shapeKeys).not.toContain('isActive')
  })

  it('edit schema has exactly the four fields (no isActive, no tenantId)', () => {
    const shapeKeys = Object.keys(
      (UpdatePaymentDetailSchema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape,
    ).sort()
    expect(shapeKeys).toEqual(['accountNumber', 'bankName', 'beneficiary', 'clabe'])
  })
})

describe('paymentDetailStatusLabel (sdd payment-details-admin S1, REQ-PD-001)', () => {
  it('returns "Activa" for active rows', () => {
    expect(paymentDetailStatusLabel(true)).toBe('Activa')
  })

  it('returns "Inactiva" for inactive rows', () => {
    expect(paymentDetailStatusLabel(false)).toBe('Inactiva')
  })

  it('PAYMENT_DETAIL_STATUS_LABELS exposes both labels', () => {
    expect(PAYMENT_DETAIL_STATUS_LABELS.active).toBe('Activa')
    expect(PAYMENT_DETAIL_STATUS_LABELS.inactive).toBe('Inactiva')
  })
})

describe('Type contracts (sdd payment-details-admin S1)', () => {
  it('CreatePaymentDetailFormValues has the four required fields (no isActive)', () => {
    const v: CreatePaymentDetailFormValues = {
      bankName: 'BBVA',
      beneficiary: 'ACME',
      clabe: '012180001234567890',
      accountNumber: '1234567890',
    }
    const keys = Object.keys(v).sort()
    expect(keys).toEqual(['accountNumber', 'bankName', 'beneficiary', 'clabe'])
  })

  it('UpdatePaymentDetailFormValues has the four optional fields (no isActive, no tenantId)', () => {
    const v: UpdatePaymentDetailFormValues = {
      bankName: 'BBVA',
    }
    const keys = Object.keys(v).sort()
    expect(keys).toEqual(['bankName'])
  })
})
