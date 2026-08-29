/**
 * copy.ts — Single Spanish copy source for the delivery-routes feature.
 *
 * Locked contract (sdd delivery-routes, design.md §3, §10):
 *   - This is the ONLY Spanish copy source. Views/components/composables MUST
 *     import labels from here, never hardcode them inline (lint-level invariant
 *     lives in the bounded-review gate, not here).
 *   - The tree shape is the public contract: S4b/S4c/S5a/S5b/S6a/S6b reference
 *     it by path. Adding/removing a key is a one-line change here.
 *   - Toast strings match the action verbs the user just performed
 *     ("Ruta creada", "Cambios guardados", "Orden guardado" …). Error toasts
 *     are short, one-line, and either domain-stamped (startConflict /
 *     notFound / invalidTransition) or fallback via normalizeApiError.
 *
 * S3 additions (driver-route-cockpit-redesign, design §6-§8/§11): additive
 * `cockpit.*` subtree (header / operational / drawer / quickActions / confirm
 * / footer) + `toasts.refreshFailed`. Tree shape unchanged; actions.checkIn
 * remains the source for "Marcar entregada" so S7 (footer) and S8 (stop panel)
 * share one vocabulary.
 */

/* eslint-disable max-lines */ // Spanish copy is intentionally co-located so consumers import it.

export const DELIVERY_ROUTE_COPY = {
  list: {
    title: 'Rutas de entrega',
    managerTabs: {
      all: 'Todas',
    },
    driverHeader: 'Mis rutas activas',
  },
  detail: {
    title: 'Detalle de ruta',
    driverTitle: 'Detalle de parada',
  },
  actions: {
    create: 'Nueva ruta',
    edit: 'Editar',
    delete: 'Eliminar',
    start: 'Iniciar ruta',
    cancel: 'Cancelar ruta',
    appendStop: 'Agregar parada',
    reorderStops: 'Reordenar paradas',
    // S3 contract: S7 + S8 read this key verbatim. Do NOT duplicate under `cockpit.*`.
    checkIn: 'Marcar entregada',
  },
  toasts: {
    createSuccess: 'Ruta creada',
    updateSuccess: 'Cambios guardados',
    deleteSuccess: 'Ruta eliminada',
    startSuccess: 'Ruta iniciada',
    cancelSuccess: 'Ruta cancelada',
    appendSuccess: 'Parada agregada',
    reorderSuccess: 'Orden guardado',
    checkInSuccess: 'Entrega registrada',
    // Domain errors — surface verbatim from DELIVERY_ROUTE_ERROR_MAP when the
    // mutation composable routes through extractDeliveryRouteErrorCode.
    startConflict:
      'Una de las ventas ya pertenece a otra ruta activa.',
    notFound: 'Ruta no encontrada.',
    invalidTransition:
      'La ruta no permite esta acción en su estado actual.',
    // REQ-DCS-007 / REQ-DRC-110 — manual refresh failure toast.
    refreshFailed: 'No se pudo actualizar la ruta',
  },
  validation: {
    selectAtLeastOneSale: 'Selecciona al menos una venta',
    notesMaxLength: 'Máximo 280 caracteres',
    selectDriver: 'Selecciona un repartidor',
  },
  empty: {
    manager: 'No hay rutas de entrega',
    driver: 'No tienes rutas activas en este momento.',
    noEligibleSales:
      'No hay ventas pendientes o enviadas disponibles para asignar.',
  },
  confirm: {
    delete: {
      title: 'Eliminar ruta',
      body: 'Esta ruta está vacía y se eliminará permanentemente.',
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'Cancelar',
    },
    cancel: {
      title: 'Cancelar ruta',
      body: 'La ruta quedará en estado cancelada y no podrá iniciarse de nuevo.',
      confirmLabel: 'Sí, cancelar',
      cancelLabel: 'Volver',
    },
    start: {
      title: '¿Iniciar la ruta?',
      body: 'La ruta pasará a Activa y no podrá editarse ni eliminar la composición de paradas.',
      confirmLabel: 'Sí, iniciar',
      cancelLabel: 'Volver',
    },
  },
  timeline: {
    routeCreated: 'Ruta creada',
    routeStarted: 'Ruta iniciada',
    stopCheckedIn: 'Parada entregada',
    routeCompleted: 'Ruta completada',
    routeCancelled: 'Ruta cancelada',
  },
  cockpit: {
    // REQ-DCS-002 / REQ-DCS-007 — sticky identity + refresh controls.
    header: {
      identityFallback: 'Ruta',
      refreshAriaLabel: 'Actualizar ruta',
    },
    // REQ-DCS-003 / REQ-DCS-004 / REQ-DRC-112 — current + next + empty copy.
    operational: {
      currentFallback: 'Sin parada activa',
      customerFallback: 'Cliente sin nombre',
      notesLabel: 'Notas de la ruta',
      // B2 shell review: shared 1-based position label used by S5 current
      // header AND S6 spine visible text. Interpolated as `Parada {N}`.
      positionLabel: 'Parada {N}',
      // `{N}` is the 1-based stop position; component interpolates inline.
      nextLabel: 'Siguiente · Parada {N}',
      nextLastStop: 'Última parada',
      nextNoMore: 'No hay más pendientes',
      emptySpine: 'Sin paradas',
    },
    // B2 shell review: REQ-DCS-005 spine a11y — root aria + per-node aria
    // template. Both literals are pinned verbatim so screen-reader output
    // never drifts. Placeholders {N} / {status} / {customer} are interpolated
    // at render time from `DELIVERY_ROUTE_STOP_STATUS_LABELS` + stop fields.
    spine: {
      rootAriaLabel: 'Recorrido de la ruta',
      nodeAriaLabel: 'Parada {N}: {status} — {customer}',
    },
    // REQ-DCK-002 — drawer titles + close label. `{N}`/`{customer}` interpolated.
    drawer: {
      stopTitle: 'Parada {N} — {customer}',
      historyTitle: 'Historial de la ruta',
      close: 'Cerrar',
    },
    // REQ-DCK-005 — ordered map/copy/email labels + failure messages that mirror
    // driverCockpitQuickActions.QUICK_ACTION_FAILURE_MESSAGES byte-for-byte.
    quickActions: {
      map: 'Ver en mapa',
      copyAddress: 'Copiar dirección',
      email: 'Email',
      failureMap: 'No se pudo abrir el mapa',
      failureCopy: 'No se pudo copiar la dirección',
      failureEmail: 'No se pudo abrir el correo',
    },
    // REQ-DCK-006 / REQ-DRC-104 — confirmation modal copy. `{customer}`/`{N}`/`{folio}`
    // interpolated at confirmation time; irreversible statement pinned verbatim.
    confirm: {
      title: 'Confirmar entrega',
      body: 'Entrega para {customer} — Parada {N} ({folio}). Esta acción registra la entrega y no se puede deshacer.',
      confirmLabel: 'Confirmar entrega',
      cancelLabel: 'Cancelar',
    },
    // REQ-DCS-008 — four-mode footer terminal copy. `{completed}`/`{total}` interpolated.
    footer: {
      completedTitle: 'Ruta completada',
      completedSummary: 'Entregaste {completed} de {total} paradas.',
      cancelledTitle: 'Ruta cancelada',
      cancelledSummary: 'Esta ruta fue cancelada.',
      viewHistory: 'Ver historial',
    },
  },
} as const

export type DeliveryRouteCopy = typeof DELIVERY_ROUTE_COPY
