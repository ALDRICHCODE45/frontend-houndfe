// notificationPermissionGate.ts — PURE helper for the in-view permission
// gate (WU-12).
//
// The view renders different affordances based on three orthogonal
// permission predicates. This helper derives the rendering tokens from
// them so the template can read a single ref instead of branching on
// three separate flags.
//
// Per spec:
//   - read:NotificationConfig  → the route is reachable; the view loads
//   - update:NotificationConfig → Save is enabled; no "no perm" notice
//   - Without read perm         → route redirects to /403 (handled by the
//                                 router, not the view)
//   - Without update perm       → Save stays disabled AND the view shows
//                                 the Spanish "No tienes permisos para
//                                 guardar cambios" notice
//
// Keeping this pure means the rendering tokens are testable without
// mounting the view or touching Pinia.

export type NoticeTone = 'warning' | 'neutral'

export interface PermissionGateTokens {
  /** Whether to render the Save button enabled (i.e. canSave-style gate). */
  saveEnabled: boolean
  /** Whether to show the "no update perm" inline notice. */
  showNoUpdateNotice: boolean
  /** Notice tone — 'warning' (default) when the user simply lacks the perm). */
  noticeTone: NoticeTone
}

export function computePermissionGateTokens(input: {
  canRead: boolean
  canUpdate: boolean
  isDirty: boolean
  isPending: boolean
  zeroRecipientViolation: boolean
}): PermissionGateTokens {
  const saveEnabled =
    input.canUpdate &&
    input.canRead &&
    input.isDirty &&
    !input.isPending &&
    !input.zeroRecipientViolation

  const showNoUpdateNotice = !input.canUpdate && input.canRead

  return {
    saveEnabled,
    showNoUpdateNotice,
    noticeTone: 'warning',
  }
}