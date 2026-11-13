/**
 * Whose session an access token belongs to, read from its JWT payload.
 *
 * The signature is NOT verified (the server does that on every request): this only answers
 * «is the token that sits in the shared storage the one for the session the stream was started
 * for?». The storage is shared by every tab of the browser, so another tab's login or tenant
 * switch can replace the token under a stream that belongs to someone else.
 *
 * Claims (the same ones `features/auth` reads, `AuthJwtClaims`): `sub` = user id,
 * `tenantId` = the sucursal the token is scoped to.
 */
import type { RealtimeIdentity } from './types'

function decodeBase64Url(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/** The user and tenant a token was issued for, or `null` when it is not a decodable JWT with both. */
export function readTokenIdentity(token: string): RealtimeIdentity | null {
  const segments = token.split('.')
  if (segments.length !== 3 || !segments[1]) return null
  const json = decodeBase64Url(segments[1])
  if (json === null) return null
  let payload: unknown
  try {
    payload = JSON.parse(json)
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  const { sub, tenantId } = payload as { sub?: unknown; tenantId?: unknown }
  if (typeof sub !== 'string' || !sub || typeof tenantId !== 'string' || !tenantId) return null
  return { userId: sub, tenantId }
}

/** True only when the token decodes and both its user and its tenant are the session's. */
export function tokenBelongsTo(token: string, identity: RealtimeIdentity): boolean {
  const owner = readTokenIdentity(token)
  return owner !== null && owner.userId === identity.userId && owner.tenantId === identity.tenantId
}
