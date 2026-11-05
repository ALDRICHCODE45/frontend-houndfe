// copy.ts — Spanish UI copy for the notification-config feature.
//
// All visible strings live here so they're testable as plain constants and
// don't drift between the view, the composables, and the spec.

export const NOTIFICATION_CONFIG_COPY = {
  // ── Page header ──
  pageTitle: 'Configuración de notificaciones',

  // ── Sections ──
  masterLabel: 'Notificaciones',
  recipientsLabel: 'Usuarios a notificar',
  actionsLabel: 'Acciones a notificar',
  loadError: 'No se pudo cargar la configuración de notificaciones',

  // ── Toasts ──
  success: 'Configuración de notificaciones guardada',

  // ── Field errors ──
  addRecipients: 'Agregar usuarios',
  searchRecipients: 'Buscar usuarios…',
  noAssignableUsers: 'No hay usuarios para asignar',
  usersLoadError: 'No se pudieron cargar los usuarios',
  retry: 'Reintentar',

  zeroRecipient: 'Selecciona al menos un usuario a notificar',
  noUpdatePerm: 'No tienes permisos para guardar cambios',
  recipientFieldInvalid: 'Uno de los usuarios seleccionados no pertenece a esta cuenta',

  // ── Stale / missing ──
  staleRecipient: 'Usuario no disponible',

  // ── Save button ──
  save: 'Guardar cambios',
  saving: 'Guardando…',
} as const
