import { describe, it, expect } from 'vitest'
import { DELIVERY_ROUTE_COPY } from '../copy'
import { QUICK_ACTION_FAILURE_MESSAGES } from '../utils/cockpit/driverCockpitQuickActions'

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

  // ─── S3: additive cockpit/drawer/confirmation/refresh copy source ───
  // REQ-DCS-002/003/004/006/008 + REQ-DCK-002/003/005/006 + REQ-DRC-104/110/112
  // The cockpit subtree is additive — every existing assertion above MUST stay
  // green. No key is renamed; actions.checkIn remains the source for the
  // "Marcar entregada" label so S4–S10 share one vocabulary.

  it('exposes a cockpit header subtree with identity fallback + refresh aria-label (REQ-DCS-002, REQ-DCS-007)', () => {
    expect(DELIVERY_ROUTE_COPY.cockpit.header.identityFallback).toBe('Ruta')
    expect(DELIVERY_ROUTE_COPY.cockpit.header.refreshAriaLabel).toBe('Actualizar ruta')
  })

  it('exposes cockpit operational copy for current/next/customer/notes/empty (REQ-DCS-003, REQ-DCS-004, REQ-DRC-112)', () => {
    expect(DELIVERY_ROUTE_COPY.cockpit.operational.currentFallback).toBe('Sin parada activa')
    expect(DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback).toBe('Cliente sin nombre')
    expect(DELIVERY_ROUTE_COPY.cockpit.operational.notesLabel).toBe('Notas de la ruta')
    expect(DELIVERY_ROUTE_COPY.cockpit.operational.nextLabel).toBe('Siguiente · Parada {N}')
    expect(DELIVERY_ROUTE_COPY.cockpit.operational.nextLastStop).toBe('Última parada')
    expect(DELIVERY_ROUTE_COPY.cockpit.operational.nextNoMore).toBe('No hay más pendientes')
    expect(DELIVERY_ROUTE_COPY.cockpit.operational.emptySpine).toBe('Sin paradas')
  })

  it('exposes drawer titles + close label verbatim (REQ-DCK-002)', () => {
    expect(DELIVERY_ROUTE_COPY.cockpit.drawer.stopTitle).toBe('Parada {N} — {customer}')
    expect(DELIVERY_ROUTE_COPY.cockpit.drawer.historyTitle).toBe('Historial de la ruta')
    expect(DELIVERY_ROUTE_COPY.cockpit.drawer.close).toBe('Cerrar')
  })

  it('exposes quick-action labels in map/copy/email order (REQ-DCK-005)', () => {
    expect(DELIVERY_ROUTE_COPY.cockpit.quickActions.map).toBe('Ver en mapa')
    expect(DELIVERY_ROUTE_COPY.cockpit.quickActions.copyAddress).toBe('Copiar dirección')
    expect(DELIVERY_ROUTE_COPY.cockpit.quickActions.email).toBe('Email')
  })

  it('quick-action failure messages mirror S2 QUICK_ACTION_FAILURE_MESSAGES byte-for-byte (REQ-DCK-005)', () => {
    // Live cross-import pins both sides against the same source of truth —
    // drift in either file fails this assertion immediately.
    expect(DELIVERY_ROUTE_COPY.cockpit.quickActions.failureMap).toBe(QUICK_ACTION_FAILURE_MESSAGES.map)
    expect(DELIVERY_ROUTE_COPY.cockpit.quickActions.failureCopy).toBe(QUICK_ACTION_FAILURE_MESSAGES.copy)
    expect(DELIVERY_ROUTE_COPY.cockpit.quickActions.failureEmail).toBe(QUICK_ACTION_FAILURE_MESSAGES.email)
  })

  it('exposes confirmation modal copy with all required placeholders (REQ-DCK-006, REQ-DRC-104)', () => {
    expect(DELIVERY_ROUTE_COPY.cockpit.confirm.title).toBe('Confirmar entrega')
    expect(DELIVERY_ROUTE_COPY.cockpit.confirm.confirmLabel).toBe('Confirmar entrega')
    expect(DELIVERY_ROUTE_COPY.cockpit.confirm.cancelLabel).toBe('Cancelar')
    // Body template pins {customer}, {N}, {folio} in order, with the
    // irreversible statement verbatim (delivery-route-check-in UI Copy).
    expect(DELIVERY_ROUTE_COPY.cockpit.confirm.body).toBe(
      'Entrega para {customer} — Parada {N} ({folio}). Esta acción registra la entrega y no se puede deshacer.',
    )
  })

  it('exposes terminal footer copy with {completed}/{total} summary (REQ-DCS-008)', () => {
    expect(DELIVERY_ROUTE_COPY.cockpit.footer.completedTitle).toBe('Ruta completada')
    expect(DELIVERY_ROUTE_COPY.cockpit.footer.completedSummary).toBe(
      'Entregaste {completed} de {total} paradas.',
    )
    expect(DELIVERY_ROUTE_COPY.cockpit.footer.cancelledTitle).toBe('Ruta cancelada')
    expect(DELIVERY_ROUTE_COPY.cockpit.footer.cancelledSummary).toBe('Esta ruta fue cancelada.')
    expect(DELIVERY_ROUTE_COPY.cockpit.footer.viewHistory).toBe('Ver historial')
  })

  it('exposes the refresh-failure toast for the manual-refresh path (REQ-DCS-007, REQ-DRC-110)', () => {
    expect(DELIVERY_ROUTE_COPY.toasts.refreshFailed).toBe('No se pudo actualizar la ruta')
  })

  // ─── B2 correction: central positionLabel template + spine aria templates ───
  // Shell-review found hardcoded "Parada {N}" (operational) and
  // "Recorrido de la ruta" / "Parada N: Estado — Cliente" (spine) literals.
  // B2 routes both through `copy.ts` so drift fails immediately.

  it('exposes cockpit operational.positionLabel template for the current stop header (B2 shell review)', () => {
    // Single source for the 1-based "Parada {N}" label used by S5 (current
    // section) and S6 (spine visible position). Must NOT include the
    // "Siguiente · " prefix from `nextLabel` — that prefix is exclusive to
    // the next-preview header.
    expect(DELIVERY_ROUTE_COPY.cockpit.operational.positionLabel).toBe('Parada {N}')
    // `nextLabel` is a different string with the "Siguiente · " prefix;
    // both must coexist (different consumers, different semantics).
    expect(DELIVERY_ROUTE_COPY.cockpit.operational.nextLabel).not.toBe(
      DELIVERY_ROUTE_COPY.cockpit.operational.positionLabel,
    )
  })

  it('exposes cockpit.spine subtree with root + node aria-label templates (B2 shell review)', () => {
    expect(DELIVERY_ROUTE_COPY.cockpit.spine).toBeDefined()
    // Root aria pinned verbatim by REQ-DCS-005 spine a11y narrative.
    expect(DELIVERY_ROUTE_COPY.cockpit.spine.rootAriaLabel).toBe('Recorrido de la ruta')
    // Node aria template must use the spec-pinned order
    // "Parada {N}: {status} — {customer}" so it reads naturally in Spanish.
    expect(DELIVERY_ROUTE_COPY.cockpit.spine.nodeAriaLabel).toBe(
      'Parada {N}: {status} — {customer}',
    )
  })

  it('spine node aria-label template preserves {N} / {status} / {customer} order + exactly those three placeholders (B2 shell review)', () => {
    const value = DELIVERY_ROUTE_COPY.cockpit.spine.nodeAriaLabel
    let lastIdx = -1
    for (const placeholder of ['{N}', '{status}', '{customer}']) {
      const idx = value.indexOf(placeholder)
      expect(idx).toBeGreaterThan(lastIdx)
      lastIdx = idx
    }
    const placeholderPattern = /\{([^}]+)\}/g
    const found = Array.from(value.matchAll(placeholderPattern))
      .map((m) => m[1])
      .sort()
    expect(found).toEqual(['N', 'customer', 'status'])
  })

  it('keeps actions.checkIn as the single source for the "Marcar entregada" label (no duplicate key)', () => {
    // Defensive pin: S7 (footer) and S8 (stop panel) reuse actions.checkIn instead
    // of defining their own key under `cockpit.*`. Drift here would create two
    // sources of truth for the same UI label.
    expect(DELIVERY_ROUTE_COPY.actions.checkIn).toBe('Marcar entregada')
    expect((DELIVERY_ROUTE_COPY.cockpit as Record<string, unknown>).checkIn).toBeUndefined()
    expect(
      (DELIVERY_ROUTE_COPY.cockpit as Record<string, unknown>).marcarEntregada,
    ).toBeUndefined()
  })

  // ─── S3 triangulation: template placeholder structure (order + presence) ───
  // Template strings are interpolated at runtime by the cockpit children; the
  // placeholder order, presence, and exact set MUST stay stable so the rendered
  // output reads naturally in Spanish ("Entrega para Ana — Parada 3 (FOLIO-7)…").

  it.each([
    {
      label: 'confirm body lists {customer}, {N}, {folio} in spec order',
      value: DELIVERY_ROUTE_COPY.cockpit.confirm.body,
      ordered: ['{customer}', '{N}', '{folio}'],
      forbidden: ['{completed}', '{total}', '{stopId}'],
    },
    {
      label: 'completed summary lists {completed} before {total} and nothing else',
      value: DELIVERY_ROUTE_COPY.cockpit.footer.completedSummary,
      ordered: ['{completed}', '{total}'],
      forbidden: ['{customer}', '{N}', '{folio}'],
    },
  ])('$label', ({ value, ordered, forbidden }) => {
    let lastIdx = -1
    for (const placeholder of ordered) {
      const idx = value.indexOf(placeholder)
      expect(idx).toBeGreaterThan(lastIdx)
      lastIdx = idx
    }
    const forbiddenPattern = new RegExp(`\\{(${forbidden.map((p) => p.slice(1, -1)).join('|')})\\}`)
    expect(value).not.toMatch(forbiddenPattern)
  })
})
