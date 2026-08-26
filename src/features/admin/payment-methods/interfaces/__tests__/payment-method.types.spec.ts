import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  CreatePaymentMethodSchema,
  UpdatePaymentMethodSchema,
  type CreatePaymentMethodRequest,
  type UpdatePaymentMethodRequest,
} from '../payment-method.types'

function safeParse<T extends z.ZodTypeAny>(schema: T, value: unknown) {
  return (schema as z.ZodTypeAny).safeParse(value) as z.SafeParseReturnType<unknown, unknown>
}

describe('CreatePaymentMethodSchema (sdd custom-payment-methods S1, REQ-PM-002/008/009)', () => {
  it('accepts a minimal valid payload (name + category)', () => {
    const r = safeParse(CreatePaymentMethodSchema, { name: 'Mercado Pago', category: 'transfer' })
    expect(r.success).toBe(true)
  })

  it('accepts a payload with subtitle (REQ-PM-009)', () => {
    const r = safeParse(CreatePaymentMethodSchema, {
      name: 'Mercado Pago',
      category: 'transfer',
      subtitle: 'Link de pago',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty name after trimming (REQ-PM-002)', () => {
    const r = safeParse(CreatePaymentMethodSchema, { name: '   ', category: 'cash' })
    expect(r.success).toBe(false)
  })

  it('rejects a name longer than 60 characters (REQ-PM-002)', () => {
    const r = safeParse(CreatePaymentMethodSchema, { name: 'a'.repeat(61), category: 'cash' })
    expect(r.success).toBe(false)
  })

  it('accepts a name exactly 60 characters long (REQ-PM-002 boundary)', () => {
    const r = safeParse(CreatePaymentMethodSchema, { name: 'a'.repeat(60), category: 'cash' })
    expect(r.success).toBe(true)
  })

  it('accepts only the four category enum values (REQ-PM-008)', () => {
    for (const category of ['cash', 'card_credit', 'card_debit', 'transfer']) {
      const r = safeParse(CreatePaymentMethodSchema, { name: 'ok', category })
      expect(r.success).toBe(true)
    }
  })

  it('rejects "credit" as a category (REQ-PM-008 structural exclusion)', () => {
    const r = safeParse(CreatePaymentMethodSchema, { name: 'ok', category: 'credit' })
    expect(r.success).toBe(false)
  })

  it('rejects an unknown category', () => {
    const r = safeParse(CreatePaymentMethodSchema, { name: 'ok', category: 'pix' })
    expect(r.success).toBe(false)
  })

  it('trims the name before validation (REQ-PM-002)', () => {
    const r = safeParse(CreatePaymentMethodSchema, { name: '  valid  ', category: 'cash' })
    expect(r.success).toBe(true)
    if (r.success) {
      // After trim, leading/trailing whitespace is removed.
      expect((r.data as { name: string }).name).toBe('valid')
    }
  })

  it('rejects subtitle longer than 120 characters (REQ-PM-009)', () => {
    const r = safeParse(CreatePaymentMethodSchema, {
      name: 'ok',
      category: 'cash',
      subtitle: 'a'.repeat(121),
    })
    expect(r.success).toBe(false)
  })

  it('accepts subtitle of 120 characters (REQ-PM-009 boundary)', () => {
    const r = safeParse(CreatePaymentMethodSchema, {
      name: 'ok',
      category: 'cash',
      subtitle: 'a'.repeat(120),
    })
    expect(r.success).toBe(true)
  })

  // Request shape (REQ-PM-002): no isActive, no id, no tenantId, no createdAt, no updatedAt.
  it('inferred TS type does NOT include isActive (REQ-PM-002 pin)', () => {
    type Create = z.infer<typeof CreatePaymentMethodSchema>
    type HasIsActive = 'isActive' extends keyof Create ? true : false
    const _check: HasIsActive = false as const
    expect(_check).toBe(false)
  })

  it('CreatePaymentMethodRequest type mirrors the schema exactly (REQ-PM-002)', () => {
    const req: CreatePaymentMethodRequest = {
      name: 'Mercado Pago',
      category: 'transfer',
      subtitle: 'Link',
    }
    expect(req.name).toBe('Mercado Pago')
    expect(req.category).toBe('transfer')
  })
})

describe('UpdatePaymentMethodSchema (sdd custom-payment-methods S1, REQ-PM-003 isActive REVERSAL)', () => {
  it('accepts an empty object (partial PATCH)', () => {
    const r = safeParse(UpdatePaymentMethodSchema, {})
    expect(r.success).toBe(true)
  })

  it('accepts { isActive: false } (REQ-PM-003 REVERSAL pin)', () => {
    const r = safeParse(UpdatePaymentMethodSchema, { isActive: false })
    expect(r.success).toBe(true)
  })

  it('accepts { isActive: true } (REQ-PM-003 reactivate path)', () => {
    const r = safeParse(UpdatePaymentMethodSchema, { isActive: true })
    expect(r.success).toBe(true)
  })

  it('accepts a single-field name patch', () => {
    const r = safeParse(UpdatePaymentMethodSchema, { name: 'new name' })
    expect(r.success).toBe(true)
  })

  it('accepts a single-field subtitle patch', () => {
    const r = safeParse(UpdatePaymentMethodSchema, { subtitle: 'new subtitle' })
    expect(r.success).toBe(true)
  })

  it('inferred TS type DOES include isActive as optional (REQ-PM-003 REVERSAL pin)', () => {
    type Update = z.infer<typeof UpdatePaymentMethodSchema>
    type IsActiveKey = 'isActive' extends keyof Update ? true : false
    const _check: IsActiveKey = true as const
    expect(_check).toBe(true)
  })

  it('UpdatePaymentMethodRequest type accepts optional isActive (REQ-PM-003)', () => {
    const a: UpdatePaymentMethodRequest = { isActive: false }
    const b: UpdatePaymentMethodRequest = { name: 'updated', isActive: true }
    expect(a.isActive).toBe(false)
    expect(b.name).toBe('updated')
    expect(b.isActive).toBe(true)
  })

  it('UpdatePaymentMethodRequest does NOT include tenantId (REQ-PM-002 pin)', () => {
    type Update = UpdatePaymentMethodRequest
    type HasTenantId = 'tenantId' extends keyof Update ? true : false
    const _check: HasTenantId = false as const
    expect(_check).toBe(false)
  })

  it('rejects unknown category in update (REQ-PM-008 — same enum lock)', () => {
    const r = safeParse(UpdatePaymentMethodSchema, { category: 'credit' })
    expect(r.success).toBe(false)
  })

  it('rejects a name longer than 60 chars in update (REQ-PM-002 same rules)', () => {
    const r = safeParse(UpdatePaymentMethodSchema, { name: 'a'.repeat(61) })
    expect(r.success).toBe(false)
  })
})