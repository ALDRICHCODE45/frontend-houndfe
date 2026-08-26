import { describe, it, expect } from 'vitest'
import type { PaymentDetailResponse, PaymentDetailTableRow } from '../../interfaces/payment-detail.types'
import {
  isLastActivePaymentDetail,
  buildPaymentDetailDeactivateDescription,
  buildPaymentDetailRowActions,
} from '../payment-detail-actions.utils'

function makeRow(overrides: Partial<PaymentDetailResponse> = {}): PaymentDetailTableRow {
  return {
    id: 'pd-1',
    tenantId: 'tenant-1',
    bankName: 'BBVA',
    beneficiary: 'Acme S.A.',
    clabe: '012180001234567890',
    accountNumber: '1234567890',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('isLastActivePaymentDetail (sdd payment-details-admin S2, REQ-PD-005)', () => {
  it('is true for the sole active row in a 1-active + N-inactive list', () => {
    const rows: PaymentDetailResponse[] = [
      makeRow({ id: 'a', isActive: true }),
      makeRow({ id: 'b', isActive: false }),
      makeRow({ id: 'c', isActive: false }),
    ]
    expect(isLastActivePaymentDetail(rows, 'a')).toBe(true)
  })

  it('is false when another active row also exists', () => {
    const rows: PaymentDetailResponse[] = [
      makeRow({ id: 'a', isActive: true }),
      makeRow({ id: 'b', isActive: true }),
    ]
    expect(isLastActivePaymentDetail(rows, 'a')).toBe(false)
  })

  it('is false when the target is already inactive (cannot escalate)', () => {
    const rows: PaymentDetailResponse[] = [
      makeRow({ id: 'a', isActive: false }),
      makeRow({ id: 'b', isActive: true }),
    ]
    expect(isLastActivePaymentDetail(rows, 'a')).toBe(false)
  })

  it('is false when the list has no active rows at all', () => {
    const rows: PaymentDetailResponse[] = [
      makeRow({ id: 'a', isActive: false }),
      makeRow({ id: 'b', isActive: false }),
    ]
    expect(isLastActivePaymentDetail(rows, 'a')).toBe(false)
  })

  it('is false for an unknown target id even if it is the only active row', () => {
    const rows: PaymentDetailResponse[] = [makeRow({ id: 'a', isActive: true })]
    expect(isLastActivePaymentDetail(rows, 'unknown')).toBe(false)
  })
})

describe('buildPaymentDetailDeactivateDescription (sdd payment-details-admin S2, REQ-PD-005)', () => {
  const rows: PaymentDetailResponse[] = [
    makeRow({ id: 'a', bankName: 'BBVA', beneficiary: 'Acme SA', isActive: true }),
    makeRow({ id: 'b', bankName: 'Banorte', beneficiary: 'Banorte SA', isActive: false }),
  ]

  it('returns the base copy for a non-last-active row', () => {
    const row = makeRow({
      id: 'a',
      bankName: 'BBVA',
      beneficiary: 'Acme SA',
      isActive: true,
    })
    // Append a second active so 'a' is NOT the last-active.
    rows.push(makeRow({ id: 'c', isActive: true }))

    const desc = buildPaymentDetailDeactivateDescription(row, rows)

    expect(desc).toContain('¿Desactivar la cuenta de BBVA (Acme SA)?')
    expect(desc).toContain('El bot dejará de mostrarla')
    // No last-active escalation when other active rows exist.
    expect(desc).not.toContain('única cuenta activa')
  })

  it('strengthens the copy when the target is the last active account', () => {
    const singleList = rows.filter((r) => r.id === 'a') // only the active one
    const row = singleList[0]!

    const desc = buildPaymentDetailDeactivateDescription(row, singleList)

    expect(desc).toContain('¿Desactivar la cuenta de BBVA (Acme SA)?')
    expect(desc).toContain('Es la única cuenta activa')
    expect(desc).toContain('sucursal quedará sin una cuenta')
  })

  it('always renders the standard confirmation language, even when escalating', () => {
    const row = makeRow({ id: 'a', bankName: 'BBVA', beneficiary: 'Acme SA', isActive: true })
    const desc = buildPaymentDetailDeactivateDescription(row, [row])
    expect(desc).toContain('bot dejará de mostrarla')
  })
})

describe('buildPaymentDetailRowActions (sdd payment-details-admin S2, REQ-PD-007)', () => {
  const row = makeRow()

  it('returns only the edit section when canUpdate=true and canDelete=false', () => {
    const sections = buildPaymentDetailRowActions(row, {
      canUpdate: true,
      canDelete: false,
      onEdit: () => {},
      onDelete: () => {},
    })
    expect(sections).toHaveLength(1)
    expect(sections[0]![0]!.label).toBe('Editar')
  })

  it('returns only the destructive section when canUpdate=false and canDelete=true', () => {
    const sections = buildPaymentDetailRowActions(row, {
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
    const sections = buildPaymentDetailRowActions(row, {
      canUpdate: true,
      canDelete: true,
      onEdit: () => {},
      onDelete: () => {},
    })
    expect(sections).toHaveLength(2)
    expect(sections[0]![0]!.label).toBe('Editar')
    expect(sections[1]![0]!.label).toBe('Desactivar')
  })

  it('returns an empty array when neither permission is held (kebab hidden)', () => {
    const sections = buildPaymentDetailRowActions(row, {
      canUpdate: false,
      canDelete: false,
      onEdit: () => {},
      onDelete: () => {},
    })
    expect(sections).toEqual([])
  })

  it('invokes the supplied onEdit callback when "Editar" is selected', () => {
    let captured: PaymentDetailTableRow | null = null
    const sections = buildPaymentDetailRowActions(row, {
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
    let captured: PaymentDetailTableRow | null = null
    const sections = buildPaymentDetailRowActions(row, {
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
