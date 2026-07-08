// copy.ts — Spanish UI copy for the notification-config feature.
//
// All visible strings live here so they're testable as plain constants and
// don't drift between the view, the composables, and the spec.

export const NOTIFICATION_CONFIG_COPY = {
  // ── Sections ──
  masterLabel: 'Notificaciones',
  masterDescription: 'Activa o desactiva el envío de notificaciones',
  recipientsLabel: 'Usuarios a notificar',
  recipientsDescription: 'Estos usuarios recibirán las notificaciones seleccionadas',
  actionsLabel: 'Acciones a notificar',
  actionsDescription: 'Selecciona las acciones que dispararán una notificación',

  // ── Toasts ──
  success: 'Configuración de notificaciones guardada',

  // ── Field errors ──
  zeroRecipient: 'Selecciona al menos un usuario a notificar',
  noUpdatePerm: 'No tienes permisos para guardar cambios',
  recipientFieldInvalid: 'Uno de los usuarios seleccionados no pertenece a esta cuenta',

  // ── Stale / missing ──
  staleRecipient: 'Usuario no disponible',

  // ── Save button ──
  save: 'Guardar cambios',
  saving: 'Guardando…',
} as const

export type NotificationConfigCopy = typeof NOTIFICATION_CONFIG_COPY
