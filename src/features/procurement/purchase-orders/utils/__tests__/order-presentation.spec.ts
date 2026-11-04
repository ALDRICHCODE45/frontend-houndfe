import { describe, expect, it } from 'vitest'
import { avisoLabel, orderHeaderActions, orderRowActions, orderRowLabel, orderTotals, statusLabels, statusTones } from '../order-presentation'
import type { PurchaseOrderSummary } from '../../interfaces/purchase-order.types'
const row = (patch: Partial<PurchaseOrderSummary> = {}): PurchaseOrderSummary => ({
  id: 'order-id', version: 1, status: 'DRAFT', supplierDisplaySnapshot: { id: 's', displayName: 'Distribuidora del Norte', status: 'ACTIVE' },
  lineCount: 2, issueCount: 0, note: null, locationDetail: null, totals: null, createdAt: '', updatedAt: '', ...patch,
})
const all = { canEdit: true, canConfirm: true, canCancel: true, canDelete: true }
const keys = (actions: Array<{ key: string }>) => actions.map(action => action.key)

describe('status presentation', () => {
  it('maps each status to its label and badge tone (Borrador warning, Confirmada success, Cancelada neutral)', () => {
    expect(statusLabels).toEqual({ DRAFT: 'Borrador', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada' })
    expect(statusTones).toEqual({ DRAFT: 'warning', CONFIRMED: 'success', CANCELLED: 'neutral' })
  })
  it('counts avisos in Spanish', () => {
    expect(avisoLabel(1)).toBe('1 aviso')
    expect(avisoLabel(3)).toBe('3 avisos')
  })
  it('names the row for assistive tech without ids', () => {
    expect(orderRowLabel(row())).toBe('la orden de Distribuidora del Norte, borrador')
    expect(orderRowLabel(row({ status: 'CANCELLED', supplierDisplaySnapshot: null }))).toBe('la orden sin proveedor, cancelada')
  })
})

describe('list total', () => {
  it('has no entries for null totals (the cell reads a dash) or for a legacy row without the field', () => {
    expect(orderTotals(row({ totals: null }))).toEqual([])
    expect(orderTotals({ ...row(), totals: undefined } as never)).toEqual([])
  })
  it('shows one total as one unlabelled amount, formatted from the server decimal', () => {
    expect(orderTotals(row({ totals: [{ amount: '1540.00', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' }] }))).toEqual([{ key: 'EXCLUDES_TAX', text: '$1,540.00', label: null }])
  })
  it('keeps two bases apart, in server order, each labelled and never summed', () => {
    const entries = orderTotals(row({ totals: [{ amount: '1000.50', currency: 'MXN', taxBasis: 'EXCLUDES_TAX' }, { amount: '580.00', currency: 'MXN', taxBasis: 'INCLUDES_TAX' }] }))
    expect(entries).toEqual([{ key: 'EXCLUDES_TAX', text: '$1,000.50', label: 'sin imp.' }, { key: 'INCLUDES_TAX', text: '$580.00', label: 'con imp.' }])
  })
})

describe('row ⋮ menu by status and permission', () => {
  it('drafts: Continuar, Confirmar…, Cancelar…, then the destructive Descartar borrador', () => {
    const actions = orderRowActions(row(), all)
    expect(actions.map(action => action.label)).toEqual(['Continuar', 'Confirmar…', 'Cancelar…', 'Descartar borrador'])
    expect(keys(actions)).toEqual(['open', 'confirm', 'cancel', 'discard'])
    expect(actions.filter(action => action.destructive).map(action => action.key)).toEqual(['discard'])
  })
  it('offers Ver orden instead of Continuar when the user cannot edit', () => {
    expect(orderRowActions(row(), { ...all, canEdit: false })[0]!.label).toBe('Ver orden')
  })
  it('hides Confirmar… without the confirm permission, Cancelar… without cancel and Descartar without delete', () => {
    expect(keys(orderRowActions(row(), { ...all, canConfirm: false }))).toEqual(['open', 'cancel', 'discard'])
    expect(keys(orderRowActions(row(), { ...all, canCancel: false }))).toEqual(['open', 'confirm', 'discard'])
    expect(keys(orderRowActions(row(), { ...all, canDelete: false }))).toEqual(['open', 'confirm', 'cancel'])
    expect(keys(orderRowActions(row(), { canEdit: false, canConfirm: false, canCancel: false, canDelete: false }))).toEqual(['open'])
  })
  it('disables Confirmar… while the draft still has avisos, since the server cannot confirm it', () => {
    const confirm = (patch: Partial<PurchaseOrderSummary>) => orderRowActions(row(patch), all).find(action => action.key === 'confirm')!
    expect(confirm({ issueCount: 0 }).disabled).toBeFalsy()
    expect(confirm({ issueCount: 2 }).disabled).toBe(true)
  })
  it('confirmed orders: Ver orden and Cancelar…; cancelled: Ver orden only; never Continuar, Confirmar… or Descartar', () => {
    expect(orderRowActions(row({ status: 'CONFIRMED' }), all).map(action => action.label)).toEqual(['Ver orden', 'Cancelar…'])
    expect(orderRowActions(row({ status: 'CONFIRMED' }), { ...all, canCancel: false }).map(action => action.label)).toEqual(['Ver orden'])
    expect(orderRowActions(row({ status: 'CANCELLED' }), all).map(action => action.label)).toEqual(['Ver orden'])
  })
  it('disables every item while the workspace is locked', () => {
    expect(orderRowActions(row(), { ...all, disabled: true }).every(action => action.disabled)).toBe(true)
  })
})

describe('open-order header ⋮ menu', () => {
  const gates = { canCancel: true, canDelete: true, cancelEnabled: true, busy: false }
  it('draft: Cancelar orden… then the separated destructive Descartar borrador', () => {
    const actions = orderHeaderActions('DRAFT', gates)
    expect(actions.map(action => action.label)).toEqual(['Cancelar orden…', 'Descartar borrador'])
    expect(actions[1]!.destructive).toBe(true)
  })
  it('confirmed: only Cancelar orden…; cancelled: nothing at all', () => {
    expect(orderHeaderActions('CONFIRMED', gates).map(action => action.label)).toEqual(['Cancelar orden…'])
    expect(orderHeaderActions('CANCELLED', gates)).toEqual([])
  })
  it('follows the permissions and disables Cancelar while unsaved changes or a lock block it', () => {
    expect(orderHeaderActions('DRAFT', { ...gates, canCancel: false }).map(action => action.key)).toEqual(['discard'])
    expect(orderHeaderActions('DRAFT', { ...gates, canDelete: false }).map(action => action.key)).toEqual(['cancel'])
    expect(orderHeaderActions('DRAFT', { ...gates, cancelEnabled: false }).find(action => action.key === 'cancel')!.disabled).toBe(true)
    expect(orderHeaderActions('DRAFT', { ...gates, busy: true }).find(action => action.key === 'discard')!.disabled).toBe(true)
    expect(orderHeaderActions('CONFIRMED', { ...gates, canDelete: false, canCancel: false })).toEqual([])
  })
})
