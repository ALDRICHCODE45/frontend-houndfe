import { describe, it, expect } from 'vitest'
import type { PaymentMethodResponse, PaymentMethodTableRow } from '../../interfaces/payment-method.types'
import {
  buildPaymentMethodDeactivateDescription,
  buildPaymentMethodRowActions,
} from '../payment-method-actions.utils'

function makeRow(overrides: Partial<PaymentMethodResponse> = {}): PaymentMethodTableRow {
  return {
    id: 'pm-1',
    tenantId: 'tenant-1',
    name: 'Mercado Pago',
    category: 'transfer',
    subtitle: 'Link',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildPaymentMethodDeactivateDescription (sdd custom-payment-methods S3A, REQ-PM-004)', () => {
  it('returns the Spanish copy that mentions the method name (REQ-PM-004)', () => {
    const row = makeRow({ name: 'Mercado Pago', isActive: true })
    const desc = buildPaymentMethodDeactivateDescription(row, [row])
    expect(desc).toContain('Mercado Pago')
    expect(desc).toContain('Ya no aparecerá al cobrar')
  })

  it('renders the base copy without last-active escalation when other active rows exist', () => {
    const rows: PaymentMethodTableRow[] = [
      makeRow({ id: 'a', name: 'Mercado Pago', isActive: true }),
      makeRow({ id: 'b', name: 'SPEI', isActive: true }),
    ]
    const desc = buildPaymentMethodDeactivateDescription(rows[0]!, rows)
    expect(desc).toContain('Mercado Pago')
    expect(desc).toContain('Ya no aparecerá al cobrar')
    expect(desc).not.toContain('único método activo')
  })
})

describe('buildPaymentMethodRowActions (sdd custom-payment-methods S3A, REQ-PM-005/006)', () => {
  const labels = (ctx: Parameters<typeof buildPaymentMethodRowActions>[0]) =>
    buildPaymentMethodRowActions(ctx).map((action) => action.label)

  it('returns no actions when canUpdate=true and canDelete=false: "Editar" alone would repeat the row click', () => {
    expect(buildPaymentMethodRowActions({ canUpdate: true, canDelete: false })).toEqual([])
  })

  it('returns only the destructive entry when canUpdate=false and canDelete=true', () => {
    const actions = buildPaymentMethodRowActions({ canUpdate: false, canDelete: true })
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ key: 'delete', label: 'Desactivar…', destructive: true })
  })

  it('returns Editar first and Desactivar… last when both permissions are held', () => {
    const actions = buildPaymentMethodRowActions({ canUpdate: true, canDelete: true })
    expect(actions.map((action) => action.label)).toEqual(['Editar', 'Desactivar…'])
    expect(actions[1]!.destructive).toBe(true)
  })

  it('returns an empty array when neither permission is held (no ⋮)', () => {
    expect(buildPaymentMethodRowActions({ canUpdate: false, canDelete: false })).toEqual([])
  })

  // REQ-PM-005 — reactivation lives in the edit slideover's isActive toggle,
  // NOT as a separate menu entry. The menu MUST NOT offer "Reactivar".
  it('does NOT offer a "Reactivar" entry (REQ-PM-005)', () => {
    const flat = labels({ canUpdate: true, canDelete: true })
    expect(flat).not.toContain('Reactivar')
    expect(flat).not.toContain('Activar')
  })

  // REQ-PM-005 — hard delete is not supported, the menu MUST NOT offer it.
  it('does NOT offer an "Eliminar definitivamente" / hard-delete entry (REQ-PM-005)', () => {
    const flat = labels({ canUpdate: true, canDelete: true })
    expect(flat).not.toContain('Eliminar definitivamente')
    expect(flat).not.toContain('Eliminar')
  })
})
