import type {
  PublicCatalogBranchDetailDto,
  PublicCatalogBranchHours,
} from '../interfaces/public-catalog-branch.types'

type CatalogBranchDetailErrorKind = 'not-found' | 'rate-limit' | 'server' | 'network'

export class CatalogBranchDetailError extends Error {
  readonly kind: CatalogBranchDetailErrorKind
  readonly status?: number

  constructor(kind: CatalogBranchDetailErrorKind = 'server', status?: number) {
    super(
      kind === 'not-found'
        ? 'Branch not found'
        : kind === 'rate-limit'
          ? 'Too many requests'
          : kind === 'network'
            ? 'Network failure'
            : 'Server failure',
    )
    this.name = 'CatalogBranchDetailError'
    this.kind = kind
    if (status !== undefined) this.status = status
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isHours(value: unknown): value is PublicCatalogBranchHours {
  if (!isRecord(value)) return false
  return (
    typeof value.timeZone === 'string' &&
    typeof value.summary === 'string' &&
    Array.isArray(value.days) &&
    value.days.every(
      (day) =>
        isRecord(day) &&
        typeof day.day === 'string' &&
        typeof day.label === 'string' &&
        typeof day.closed === 'boolean' &&
        Array.isArray(day.ranges) &&
        day.ranges.every(
          (range) =>
            isRecord(range) && typeof range.open === 'string' && typeof range.close === 'string',
        ),
    )
  )
}

/** Returns the DTO with the optional v0 fields normalised, or null when the shape is wrong. */
function parseBranchDetail(value: unknown): PublicCatalogBranchDetailDto | null {
  if (!isRecord(value)) return null
  const { address, hours, whatsappNumber } = value
  if (typeof value.name !== 'string' || !isNullableString(value.phone)) return null
  if (address !== null && !(isRecord(address) && typeof address.formatted === 'string')) return null
  if (hours !== null && !isHours(hours)) return null
  if (typeof value.pickupAvailable !== 'boolean' || typeof value.deliveryAvailable !== 'boolean') {
    return null
  }
  if (whatsappNumber !== undefined && !isNullableString(whatsappNumber)) return null
  return {
    name: value.name,
    phone: value.phone,
    address: address === null ? null : { formatted: (address as { formatted: string }).formatted },
    hours,
    pickupAvailable: value.pickupAvailable,
    deliveryAvailable: value.deliveryAvailable,
    whatsappNumber: whatsappNumber ?? null,
  }
}

/** GET /public/catalog/:slug/branch. A 404 means the backend has no branch card for this slug. */
export async function fetchCatalogBranchDetail(
  slug: string,
  signal?: AbortSignal,
): Promise<PublicCatalogBranchDetailDto> {
  let response: Response
  try {
    const init = signal
      ? { method: 'GET', credentials: 'omit' as const, signal }
      : { method: 'GET', credentials: 'omit' as const }
    response = await fetch(`${apiBase}/public/catalog/${encodeURIComponent(slug)}/branch`, init)
  } catch {
    throw new CatalogBranchDetailError('network')
  }
  try {
    if (response.status === 404) throw new CatalogBranchDetailError('not-found', 404)
    if (response.status === 429) throw new CatalogBranchDetailError('rate-limit', 429)
    if (response.status !== 200) throw new CatalogBranchDetailError('server', response.status)
    const parsed = parseBranchDetail(await response.json())
    if (!parsed) throw new CatalogBranchDetailError('server', response.status)
    return parsed
  } catch (error) {
    if (error instanceof CatalogBranchDetailError) throw error
    throw new CatalogBranchDetailError('server', response.status)
  }
}
