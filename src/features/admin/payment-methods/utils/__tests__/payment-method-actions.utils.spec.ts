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
  const row = makeRow()

  it('returns only the edit section when canUpdate=true and canDelete=false', () => {
    const sections = buildPaymentMethodRowActions(row, {
      canUpdate: true,
      canDelete: false,
      onEdit: () => {},
      onDelete: () => {},
    })
    expect(sections).toHaveLength(1)
    expect(sections[0]![0]!.label).toBe('Editar')
  })

  it('returns only the destructive section when canUpdate=false and canDelete=true', () => {
    const sections = buildPaymentMethodRowActions(row, {
      canUpdate: false,
      canDelete: true,
      onEdit: () => {},
      onDelete: () => {},
    })
    expect(sections).toHaveLength(1)
    expect(sections[0]![0]!.label).toBe('Desactivar')
    expect(sections[0]![0]!.color).toBe('error')
  })

  it('returns two sections (edit + deactivate) when both permissions are held', () => {
    const sections = buildPaymentMethodRowActions(row, {
      canUpdate: true,
      canDelete: true,
      onEdit: () => {},
      onDelete: () => {},
    })
    expect(sections).toHaveLength(2)
    expect(sections[0]![0]!.label).toBe('Editar')
    expect(sections[1]![0]!.label).toBe('Desactivar')
  })

  it('returns an empty array when neither permission is held (kebab hidden entirely)', () => {
    const sections = buildPaymentMethodRowActions(row, {
      canUpdate: false,
      canDelete: false,
      onEdit: () => {},
      onDelete: () => {},
    })
    expect(sections).toEqual([])
  })

  // REQ-PM-005 — reactivation lives in the edit slideover's isActive toggle,
  // NOT as a separate kebab entry. The kebab MUST NOT offer "Reactivar".
  it('does NOT offer a "Reactivar" kebab entry (REQ-PM-005)', () => {
    const sections = buildPaymentMethodRowActions(row, {
      canUpdate: true,
      canDelete: true,
      onEdit: () => {},
      onDelete: () => {},
    })
    const flatLabels = sections.flat().map((s) => s.label)
    expect(flatLabels).not.toContain('Reactivar')
    expect(flatLabels).not.toContain('Activar')
  })

  // REQ-PM-005 — hard delete is not supported, the kebab MUST NOT offer it.
  it('does NOT offer an "Eliminar definitivamente" / hard-delete entry (REQ-PM-005)', () => {
    const sections = buildPaymentMethodRowActions(row, {
      canUpdate: true,
      canDelete: true,
      onEdit: () => {},
      onDelete: () => {},
    })
    const flatLabels = sections.flat().map((s) => s.label)
    expect(flatLabels).not.toContain('Eliminar definitivamente')
    expect(flatLabels).not.toContain('Eliminar')
  })

  it('invokes the supplied onEdit callback when "Editar" is selected', () => {
    let captured: PaymentMethodTableRow | null = null
    const sections = buildPaymentMethodRowActions(row, {
      canUpdate: true,
      canDelete: false,
      onEdit: (r) => {
        captured = r
      },
      onDelete: () => {},
    })
    sections[0]![0]!.onSelect()
    expect(captured).toEqual(row)
  })

  it('invokes the supplied onDelete callback when "Desactivar" is selected', () => {
    let captured: PaymentMethodTableRow | null = null
    const sections = buildPaymentMethodRowActions(row, {
      canUpdate: false,
      canDelete: true,
      onEdit: () => {},
      onDelete: (r) => {
        captured = r
      },
    })
    sections[0]![0]!.onSelect()
    expect(captured).toEqual(row)
  })
})