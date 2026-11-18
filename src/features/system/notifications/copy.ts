// copy.ts — Spanish UI copy for the notification-config feature.
//
// All visible strings live here so they're testable as plain constants and
// don't drift between the view, the composables, and the spec.

export const NOTIFICATION_CONFIG_COPY = {
  // ── Page header ──
  pageTitle: 'Configuración de notificaciones',
  pageSubtitle: 'Elige qué avisos se envían por correo y a quién. Nada cambia hasta que guardas.',
  loading: 'Cargando la configuración de notificaciones…',

  // ── Groups ──
  statusLabel: 'Estado',
  masterLabel: 'Notificaciones por correo',
  masterDescription:
    'Interruptor general. Apagado, no se envía ningún aviso y tu selección se conserva.',
  masterOn: 'Activadas',
  masterOff: 'Desactivadas',
  recipientsLabel: 'Usuarios a notificar',
  recipientsHint:
    'Reciben por correo todos los avisos activos, salvo los que llegan directo al cliente.',
  actionsLabel: 'Acciones a notificar',
  actionsHint: 'Toca una fila para encenderla o apagarla. Cada aviso se envía en cuanto ocurre.',
  pausedTitle: 'Acciones en pausa.',
  pausedDetail:
    'Las notificaciones están desactivadas; lo que elijas aquí se envía cuando las actives.',
  reactivate: 'Activar notificaciones',
  activateAll: 'Activar todas',
  deactivateAll: 'Desactivar todas',
  pendingPrefix: 'Al guardar: ',
  loadError: 'No se pudo cargar la configuración de notificaciones',

  // ── Toasts ──
  success: 'Configuración de notificaciones guardada',

  // ── Field errors ──
  searchRecipients: 'Buscar usuarios…',
  searchRecipientsLabel: 'Buscar usuarios',
  loadingRecipients: 'Cargando usuarios…',
  clearSearch: 'Limpiar búsqueda',
  usersLoadErrorDetail: 'Tu selección guardada no cambia.',
  noAssignableUsers: 'No hay usuarios para asignar',
  usersLoadError: 'No se pudieron cargar los usuarios',
  retry: 'Reintentar',

  zeroRecipient: 'Selecciona al menos un usuario a notificar',
  noUpdatePerm: 'No tienes permisos para guardar cambios',
  recipientFieldInvalid: 'Uno de los usuarios seleccionados no pertenece a esta cuenta',

  // ── Stale / missing ──
  staleRecipient: 'Usuario no disponible',
  staleRecipientDetail: 'Ya no está en esta cuenta. No recibirá correos; quítalo para limpiar la lista.',
  removeStale: 'Quitar',

  // ── Save bar ──
  save: 'Guardar cambios',
  saving: 'Guardando…',
  saveFailed: 'No se guardó: no hubo respuesta del servidor. Tus cambios siguen aquí; puedes reintentar.',
  saveFailedRecipients: 'No se guardó: revisa Usuarios a notificar.',
  saveBlockedRecipients: 'No se guardó: falta elegir usuarios a notificar.',
} as const
