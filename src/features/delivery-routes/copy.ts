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

// Spanish copy is intentionally co-located so consumers import it.

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
    moveStop: 'Mover',
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
    transferSuccess: 'Parada movida',
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
  // T3 S3 — create-route eligible-sales selector copy. Single source for the
  // server-searched picker: labels, unavailable-row reasons, pagination and the
  // inline create-conflict alert. `{folio}` / `{from}` / `{to}` / `{total}` are
  // interpolated at render time by EligibleSalesPicker.vue.
  eligibleSales: {
    searchLabel: 'Buscar ventas',
    searchPlaceholder: 'Cliente, folio o dirección',
    empty: 'No hay ventas pendientes o enviadas',
    noResults: 'No hay ventas que coincidan con la búsqueda',
    loading: 'Cargando ventas elegibles…',
    errorFallback: 'No se pudieron cargar las ventas elegibles. Reintenta.',
    retry: 'Reintentar',
    selectedHeading: 'Ventas seleccionadas',
    remove: 'Quitar {folio}',
    available: 'Disponible',
    reasonOccupiedDraft: 'Reservada en un borrador de ruta',
    reasonOccupiedActive: 'Ya pertenece a otra ruta activa',
    reasonOccupied: 'Ya pertenece a otra ruta',
    reasonInCurrentRoute: 'Ya está en esta ruta',
    reasonMissingAddress: 'Sin dirección de envío',
    reasonDeliveryStatus: 'Estado de entrega no permitido',
    reasonUnavailable: 'No disponible',
    paginationRange: 'Mostrando {from}–{to} de {total}',
    previousPage: 'Página anterior',
    nextPage: 'Página siguiente',
    conflictTitle: 'Una o más ventas ya están en otra ruta',
    conflictBody:
      'No se creó la ruta. Revisa la disponibilidad y quita las ventas en conflicto; tu selección se mantiene.',
    conflictRefresh: 'Actualizar disponibilidad',
    conflictListLabel: 'Ventas en conflicto',
    invalidSelection:
      'Hay ventas seleccionadas que ya no están disponibles. Revísalas o actualiza la disponibilidad para continuar.',
    noCustomer: 'Cliente sin nombre',
    noAddress: 'Sin dirección registrada',
    noFolio: 'Sin folio',
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
  // T3 S2/S4 — draft-to-draft per-stop transfer dialog. The dialog owns the
  // destination selection + explicit confirmation and renders inline failures
  // (422 flat reason / 403) while staying open. `{folio}` / `{destination}` are
  // interpolated at render time by TransferDeliveryRouteStopModal.vue.
  transfer: {
    title: 'Mover parada',
    description:
      'Elige la ruta de destino. La parada se quitará de esta ruta y quedará como la última parada de la ruta elegida.',
    selectLabel: 'Ruta de destino',
    continueLabel: 'Continuar',
    backLabel: 'Volver',
    confirmTitle: 'Confirmar movimiento',
    confirmBody:
      'La parada {folio} se moverá a {destination}. Ya no estará en esta ruta.',
    confirmLabel: 'Sí, mover',
    cancelLabel: 'Cancelar',
    moveAriaLabel: 'Mover {folio} a otra ruta',
    loading: 'Cargando rutas de destino…',
    empty: 'No hay otras rutas en borrador disponibles.',
    destinationUnavailable:
      'La ruta de destino ya no está disponible como borrador. Elige otra ruta.',
    destinationsError: 'No se pudieron cargar las rutas de destino.',
    retry: 'Reintentar',
    driverFallback: 'Sin repartidor',
    routeFallback: 'Ruta {id}',
  },
  timeline: {
    routeCreated: 'Ruta creada',
    routeStarted: 'Ruta iniciada',
    stopCheckedIn: 'Parada entregada',
    routeCompleted: 'Ruta completada',
    routeCancelled: 'Ruta cancelada',
    // Route-page evolution: per-row human timestamp + invalid-date fallback.
    timestampFallback: 'Fecha no disponible',
    // Default heading of the full-history rendering (the recent section
    // passes `cockpit.recent.heading` instead).
    historyHeading: 'Historial',
  },
  cockpit: {
    // REQ-DCS-002 / REQ-DCS-007 — sticky identity + refresh controls.
    header: {
      identityFallback: 'Ruta',
      refreshAriaLabel: 'Actualizar ruta',
      // Route-page evolution: clear route-page identity title.
      title: 'Ruta de entrega',
      // Header refinement: single overflow trigger's accessible name.
      actionsLabel: 'Acciones de la ruta',
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
    // Route-page evolution: truthful summary metrics (existing data only —
    // NO package counts / ETA / duration / distance / updated-now).
    summary: {
      deliveredLabel: 'Entregadas',
      pendingLabel: 'Pendientes',
      skippedLabel: 'Omitidas',
      totalLabel: 'Total',
      progressAriaLabel: '{completed} de {total} paradas entregadas',
      emptyLabel: 'Sin paradas en esta ruta',
    },
    // Route-page evolution: per-stop-card labels. checkIn stays single-sourced
    // in actions.checkIn — do NOT duplicate it here.
    stops: {
      detailsLabel: 'Ver detalles',
      nextBadge: 'Siguiente',
      // Route-page evolution: visible stop-list heading + supporting line
      // above the ordered rich cards (the ONE canonical stop presentation).
      listHeading: 'Tus paradas',
      listSubheading: 'Sigue el orden recomendado',
    },
    // Route-page evolution: compact recent-activity section heading (the
    // timeline component renders it via its `heading` prop).
    recent: {
      heading: 'Actividad reciente',
    },
    // Route-page evolution: lifecycle context built ONLY from existing route
    // timestamps (startedAt / completedAt / cancelledAt). No zone, no
    // scheduled date — the backend does not supply them.
    lifecycle: {
      started: 'Iniciada {date}',
      completed: 'Completada {date}',
      cancelled: 'Cancelada {date}',
    },
    // REQ-DCK-002 — drawer titles + close label. `{N}`/`{customer}` interpolated.
    drawer: {
      stopTitle: 'Parada {N} — {customer}',
      historyTitle: 'Historial de la ruta',
      close: 'Cerrar',
    },
    // REQ-DCK-005 — ordered map/copy/email labels + unified settled-result copy:
    //   - success*: one unified handler toasts these on QuickActionResult.ok
    //   - failure*: byte-for-byte mirror of driverCockpitQuickActions.QUICK_ACTION_FAILURE_MESSAGES
    quickActions: {
      map: 'Ver en mapa',
      copyAddress: 'Copiar dirección',
      email: 'Email',
      successMap: 'Mapa abierto',
      successCopy: 'Dirección copiada',
      successEmail: 'Enviando correo',
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
