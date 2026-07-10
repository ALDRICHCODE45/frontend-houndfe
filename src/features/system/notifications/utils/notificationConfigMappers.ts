// notificationConfigMappers.ts — PURE helpers, ZERO side-effects.
//
// These six functions are the unit-tested boundary that hides every backend
// asymmetry (GET `recipients` ↔ PUT `recipientUserIds`) and the only place
// the frontend knows about backend error codes. Keeping them pure means
// the test suite can prove correctness without spinning up QueryClient,
// Pinia, http, components, or any other heavy machinery.
//
// Design rationale (notification-config/design.md):
// - field-name asymmetry isolated here so `forbidNonWhitelisted` on the
//   backend DTO can never be defeated by a typo at the call site.
// - dirty tracking, canSave, and zero-recipient violation are pure so they
//   can be tested as plain functions; the form composable just wraps them
//   in reactivity (extract-before-mock).
// - mapNotificationConfigError returns `{field?, toast?}` (NOT a plain
//   string) so the view can render either an inline message OR a toast
//   without coupling one to the other.

import type {
  NotificationConfigForm,
  NotificationConfigPutBody,
  NotificationConfigResponse,
} from '../interfaces/notification-config.types'

/**
 * Hydrate the form model from a GET response.
 *
 * `recipients` (GET) is renamed to `recipientUserIds` (form/PUT) here.
 * Stale ids are intentionally preserved so the user can decide whether
 * to remove them — never auto-stripped.
 *
 * Defaults are identity for never-configured responses (the backend already
 * returns `{enabled:false, recipients:[], enabledActions:[]}`), so this
 * mapper does not need to fabricate defaults itself.
 */
export function fromConfigResponse(view: NotificationConfigResponse): NotificationConfigForm {
  return {
    enabled: view.enabled,
    recipientUserIds: [...view.recipients],
    enabledActions: [...view.enabledActions],
  }
}

/**
 * Build the PUT body from the form model. Returns EXACTLY the 3 whitelisted
 * keys (`enabled`, `recipientUserIds`, `enabledActions`) — the backend DTO
 * uses `forbidNonWhitelisted`, so any extra property would be rejected.
 *
 * Returning a fresh literal (not the form reference) is intentional: the
 * mutation body must not share identity with the reactive form snapshot.
 */
export function toPutBody(form: NotificationConfigForm): NotificationConfigPutBody {
  return {
    enabled: form.enabled,
    recipientUserIds: [...form.recipientUserIds],
    enabledActions: [...form.enabledActions],
  }
}

/**
 * Snapshot diff for Save-guards.
 *
 * Compared per spec with deep-equal on the three primitive-key arrays and
 * the boolean, in that order. Empty arrays compare equal to empty arrays
 * — there is no spurious "dirty on hydration" behaviour.
 */
export function isDirty(
  current: NotificationConfigForm,
  pristine: NotificationConfigForm,
): boolean {
  if (current.enabled !== pristine.enabled) return true
  if (current.recipientUserIds.length !== pristine.recipientUserIds.length) return true
  if (current.enabledActions.length !== pristine.enabledActions.length) return true
  for (let i = 0; i < current.recipientUserIds.length; i++) {
    if (current.recipientUserIds[i] !== pristine.recipientUserIds[i]) return true
  }
  for (let i = 0; i < current.enabledActions.length; i++) {
    if (current.enabledActions[i] !== pristine.enabledActions[i]) return true
  }
  return false
}

// ─── Error mapping ───────────────────────────────────────────────────────────

/** Neutral Spanish copy lives in one place so strings never drift. */
const ERROR_COPY = {
  invalidRecipientField:
    'Uno de los usuarios seleccionados no pertenece a esta cuenta',
  unknownActionToast: 'Una o más acciones seleccionadas no están disponibles',
  unauthorized: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  forbidden: 'No tienes permisos para guardar esta configuración',
  classValidator: 'Revisa los datos ingresados e inténtalo de nuevo',
  fallback: 'No pudimos guardar la configuración. Inténtalo de nuevo.',
} as const

/**
 * Spanish field-level copy is kept stable by spec REQ-6/REQ-8.
 *   INVALID_RECIPIENT  → recipient field
 *   UNKNOWN_ACTION_KEY → toast
 *   400 class-validator → toast
 *   401                → toast (re-auth)
 *   403                → toast (no perm)
 *   unknown            → toast fallback
 */
export interface NotificationConfigErrorInput {
  status?: number
  code?: string
  message?: string
}

export interface NotificationConfigErrorShape {
  field?: 'recipients'
  toast?: string
}

function normaliseCode(raw: string | undefined | null): string {
  return (raw ?? '').trim().toUpperCase()
}

function lookupDomainToast(code: string): string | undefined {
  switch (code) {
    case 'UNKNOWN_ACTION_KEY':
      return ERROR_COPY.unknownActionToast
    // Reserved for future domain codes that surface as a toast only.
    default:
      return undefined
  }
}

function lookupStatusToast(status: number | undefined): string | undefined {
  switch (status) {
    case 401:
      return ERROR_COPY.unauthorized
    case 403:
      return ERROR_COPY.forbidden
    case 400:
      return ERROR_COPY.classValidator
    default:
      return undefined
  }
}

function looksLikeClassValidator(code: string): boolean {
  // Backend class-validator errors arrive as codes like
  // `class-validator-failed` or plain `VALIDATION_FAILED` — both signal
  // "the user typed bad input" rather than a domain rule violation.
  return code === 'CLASS_VALIDATOR_FAILED' || code === 'VALIDATION_FAILED'
}

/**
 * Map a backend error into `{ field?, toast? }` for the view to consume.
 *
 * Accepts:
 *   - `string`              (a raw code, treated as domain code)
 *   - `{ code?, status?, message? }` (a structured error object)
 *   - `null` / `undefined`  (always falls back to a generic Spanish toast)
 *
 * NEVER returns a plain string (per design's `{field?,toast?}` contract).
 */
export function mapNotificationConfigError(
  error: NotificationConfigErrorInput | string | null | undefined,
): NotificationConfigErrorShape {
  if (error == null) {
    return { toast: ERROR_COPY.fallback }
  }

  const input: NotificationConfigErrorInput =
    typeof error === 'string' ? { code: error } : error

  const code = normaliseCode(input.code)
  const status = input.status

  // Domain codes that map to a field-level error take precedence.
  if (code === 'INVALID_RECIPIENT') {
    return { field: 'recipients' } // message text is the static Spanish copy
  }

  // Domain codes that surface as a toast.
  const domainToast = lookupDomainToast(code)
  if (domainToast) {
    return { toast: domainToast }
  }

  // Class-validator style 400 — generic data-shape error.
  if (looksLikeClassValidator(code) || (status === 400 && code.length > 0 && code !== 'INVALID_RECIPIENT')) {
    return { toast: ERROR_COPY.classValidator }
  }

  // HTTP status fallbacks (covers 401/403 paths that arrive without a code).
  const statusToast = lookupStatusToast(status)
  if (statusToast) {
    return { toast: statusToast }
  }

  // Final fallback — never return an empty shape.
  return { toast: ERROR_COPY.fallback }
}

// ─── Pure guards ─────────────────────────────────────────────────────────────

/**
 * Zero-recipient violation per spec REQ-6: enabledActions > 0 AND
 * recipientUserIds === 0. Master OFF with no actions is intentional and
 * never a violation.
 */
export function computeZeroRecipientViolation(form: {
  enabledActions: readonly string[]
  recipientUserIds: readonly string[]
}): boolean {
  return form.enabledActions.length > 0 && form.recipientUserIds.length === 0
}

/**
 * Pure canSave — spec REQ-6. The form composable precomputes each input
 * (isDirty, isPending, violation, permission) and feeds them here so this
 * helper stays trivially testable.
 */
export function computeCanSave(input: {
  isDirty: boolean
  isPending: boolean
  zeroRecipientViolation: boolean
  canUpdate: boolean
}): boolean {
  return (
    input.isDirty &&
    !input.isPending &&
    !input.zeroRecipientViolation &&
    input.canUpdate
  )
}
