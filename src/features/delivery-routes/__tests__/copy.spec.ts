import { describe, it, expect } from 'vitest'
import { DELIVERY_ROUTE_COPY } from '../copy'

/**
 * copy.ts is the single Spanish copy source for the entire feature (S4b/S4c/S5/S6
 * reference it). The data shape is locked by `design.md §3` and the UI placeholders
 * pinned by the create/edit/list/reorder/detail flows. Specs assert the public
 * invariants: Spanish labels, the four canonical action keys, the validation
 * message surface, and the empty/confirm copy per REQ-DR-* / REQ-DNS-* wording.
 */
describe('copy.ts — single Spanish copy source (design.md §3)', () => {
  it('exposes a tree (no module-level side-effects, no Vue refs)', () => {
    expect(typeof DELIVERY_ROUTE_COPY).toBe('object')
    expect(DELIVERY_ROUTE_COPY).not.toBeNull()
  })

  it('contains the route list title + tab labels (manager) and driver branch header', () => {
    expect(DELIVERY_ROUTE_COPY.list.title).toBe('Rutas de entrega')
    expect(DELIVERY_ROUTE_COPY.list.managerTabs.all).toBe('Todas')
    expect(DELIVERY_ROUTE_COPY.list.driverHeader).toBe('Mis rutas activas')
  })

  it('contains the action labels used by the slideover + reorder panel + detail view', () => {
    // REQ-DR-002 wording: action verbs in infinitive / noun phrases for table cells.
    expect(DELIVERY_ROUTE_COPY.actions.create).toBe('Nueva ruta')
    expect(DELIVERY_ROUTE_COPY.actions.edit).toBe('Editar')
    expect(DELIVERY_ROUTE_COPY.actions.delete).toBe('Eliminar')
    expect(DELIVERY_ROUTE_COPY.actions.start).toBe('Iniciar ruta')
    expect(DELIVERY_ROUTE_COPY.actions.cancel).toBe('Cancelar ruta')
    expect(DELIVERY_ROUTE_COPY.actions.appendStop).toBe('Agregar parada')
    expect(DELIVERY_ROUTE_COPY.actions.reorderStops).toBe('Reordenar paradas')
    expect(DELIVERY_ROUTE_COPY.actions.checkIn).toBe('Marcar entregada')
  })

  it('contains the toast strings (success + error) referenced by every mutation composable', () => {
    expect(DELIVERY_ROUTE_COPY.toasts.createSuccess).toBe('Ruta creada')
    expect(DELIVERY_ROUTE_COPY.toasts.updateSuccess).toBe('Cambios guardados')
    expect(DELIVERY_ROUTE_COPY.toasts.deleteSuccess).toMatch(/elimin/i)
    expect(DELIVERY_ROUTE_COPY.toasts.startSuccess).toMatch(/inici/i)
    expect(DELIVERY_ROUTE_COPY.toasts.cancelSuccess).toMatch(/cancelad/i)
    expect(DELIVERY_ROUTE_COPY.toasts.appendSuccess).toMatch(/parada agregada/i)
    expect(DELIVERY_ROUTE_COPY.toasts.reorderSuccess).toBe('Orden guardado')
    expect(DELIVERY_ROUTE_COPY.toasts.checkInSuccess).toBe('Entrega registrada')
    // Generic failure surfaces via normalizeApiError — copy only lists the domain ones.
    expect(DELIVERY_ROUTE_COPY.toasts.startConflict).toMatch(/otra ruta activa/i)
    expect(DELIVERY_ROUTE_COPY.toasts.notFound).toMatch(/encontrada/i)
    expect(DELIVERY_ROUTE_COPY.toasts.invalidTransition).toMatch(/estado actual/i)
  })

  it('contains the validation messages used by the zod schemas + slideover form', () => {
    // These mirror CreateDeliveryRouteSchema's `min(1)` + max(280) literals so the
    // slideover can present them inline.
    expect(DELIVERY_ROUTE_COPY.validation.selectAtLeastOneSale).toMatch(/al menos una venta/i)
    expect(DELIVERY_ROUTE_COPY.validation.notesMaxLength).toMatch(/280/i)
  })

  it('contains the empty states for the list view (manager + driver)', () => {
    expect(DELIVERY_ROUTE_COPY.empty.manager).toBe('No hay rutas de entrega')
    expect(DELIVERY_ROUTE_COPY.empty.driver).toMatch(/no tienes rutas activas/i)
  })

  it('contains the confirm copy (delete/cancel/start) per REQ-DR-007', () => {
    // Titles include a leading inverted question mark (Spanish convention).
    expect(DELIVERY_ROUTE_COPY.confirm.delete.title).toBe('Eliminar ruta')
    expect(DELIVERY_ROUTE_COPY.confirm.cancel.title).toBe('Cancelar ruta')
    expect(DELIVERY_ROUTE_COPY.confirm.start.title).toMatch(/iniciar.*ruta/i)
    // Each confirm has a confirm/cancel label pair.
    expect(DELIVERY_ROUTE_COPY.confirm.delete.confirmLabel).toBeTruthy()
    expect(DELIVERY_ROUTE_COPY.confirm.delete.cancelLabel).toBeTruthy()
  })

  it('aligns confirm copy bodies with the spec verbatim (S7 verify remediation, REQ-DRM-010/011/012)', () => {
    // sdd delivery-routes S7 verify remediation — the spec mandates verbatim
    // strings for the destructive / transitional action confirmations. Drift
    // from these strings fails the verify contract (UI Copy section).
    expect(DELIVERY_ROUTE_COPY.confirm.delete.body).toBe(
      'Esta ruta está vacía y se eliminará permanentemente.',
    )
    expect(DELIVERY_ROUTE_COPY.confirm.start.body).toBe(
      'La ruta pasará a Activa y no podrá editarse ni eliminar la composición de paradas.',
    )
  })
})
