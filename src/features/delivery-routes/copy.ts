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
} as const

export type DeliveryRouteCopy = typeof DELIVERY_ROUTE_COPY
