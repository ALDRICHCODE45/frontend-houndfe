// driverCockpitQuickActions.ts — S2 (design §8, REQ-DCK-005). Synchronous
// pure predicates + guarded helpers. Helpers NEVER throw (typed failure).
// No Vue / TanStack / toast imports — S8 wires the toast.

/** Map action input — formatted address + nullable coords. */
export interface MapActionInput {
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

/** Uniform settled result; the panel routes it through `useToast()`. */
export type QuickActionResult = { ok: boolean; message: string }

/**
 * Canonical Spanish failure messages. Exported so S3 mirrors them verbatim into
 * the `cockpit.quickActions` copy subtree. The `copy` string is spec-pinned.
 */
export const QUICK_ACTION_FAILURE_MESSAGES = {
  map: 'No se pudo abrir el mapa',
  copy: 'No se pudo copiar la dirección',
  email: 'No se pudo abrir el correo',
} as const

// ─── Private helpers ─────────────────────────────────────────────────────────

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function trim(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Google Maps query parameter encoding — spaces become `+` to match their URL convention. */
function encodeQuery(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+')
}

const GOOGLE_MAPS_BASE = 'https://www.google.com/maps/search/?api=1&query='
const MAP_FAIL: QuickActionResult = { ok: false, message: QUICK_ACTION_FAILURE_MESSAGES.map }
const COPY_FAIL: QuickActionResult = { ok: false, message: QUICK_ACTION_FAILURE_MESSAGES.copy }
const EMAIL_FAIL: QuickActionResult = { ok: false, message: QUICK_ACTION_FAILURE_MESSAGES.email }

// ─── Public predicates (REQ-DCK-005) ────────────────────────────────────────

/** True when trimmed address exists OR both coords are finite (one never sufficient). */
export function canOpenExternalMap(input: MapActionInput): boolean {
  if (trim(input.address).length > 0) return true
  return isFiniteNumber(input.latitude) && isFiniteNumber(input.longitude)
}

export function canCopyAddress(address: string | null | undefined): boolean {
  return trim(address).length > 0
}

export function canOpenEmail(email: string | null | undefined): boolean {
  return trim(email).length > 0
}

// ─── Guarded helpers (REQ-DCK-005) — never throw ─────────────────────────────

export function openExternalMap(input: MapActionInput): QuickActionResult {
  if (!canOpenExternalMap(input) || !isBrowser()) return MAP_FAIL
  const hasBothCoords = isFiniteNumber(input.latitude) && isFiniteNumber(input.longitude)
  const query = hasBothCoords ? `${input.latitude},${input.longitude}` : trim(input.address)
  const url = `${GOOGLE_MAPS_BASE}${encodeQuery(query)}`
  try {
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (opened === null) return MAP_FAIL
    return { ok: true, message: '' }
  } catch {
    return MAP_FAIL
  }
}

export async function copyAddressToClipboard(address: string): Promise<QuickActionResult> {
  const text = trim(address)
  if (text.length === 0) return COPY_FAIL
  if (typeof navigator === 'undefined') return COPY_FAIL
  const clipboard = navigator.clipboard
  if (!clipboard || typeof clipboard.writeText !== 'function') return COPY_FAIL
  try {
    await clipboard.writeText(text)
    return { ok: true, message: '' }
  } catch {
    return COPY_FAIL
  }
}

export function openEmail(email: string | null | undefined): QuickActionResult {
  const text = trim(email)
  if (text.length === 0 || !isBrowser()) return EMAIL_FAIL
  try {
    window.location.href = `mailto:${encodeQuery(text)}`
    return { ok: true, message: '' }
  } catch {
    return EMAIL_FAIL
  }
}