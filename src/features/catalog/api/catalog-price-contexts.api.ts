import type { PublicCatalogPriceContextDto } from '../interfaces/public-catalog-price-context.types'

export type CatalogPriceContextsErrorKind = 'unavailable' | 'rate-limit' | 'server' | 'network'

export class CatalogPriceContextsError extends Error {
  readonly kind: CatalogPriceContextsErrorKind
  readonly status?: number

  constructor(kind: CatalogPriceContextsErrorKind = 'server', status?: number) {
    super(
      kind === 'unavailable'
        ? 'Catalog unavailable'
        : kind === 'rate-limit'
          ? 'Too many requests'
          : kind === 'network'
            ? 'Network failure'
            : 'Server failure',
    )
    this.name = 'CatalogPriceContextsError'
    this.kind = kind
    if (status !== undefined) this.status = status
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const priceContextKeys = new Set(['priceListId', 'name', 'isCatalogDefault'])

function hasExactPriceContextShape(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value)
  return keys.length === priceContextKeys.size && keys.every((key) => priceContextKeys.has(key))
}

function isPriceContextRow(value: unknown): value is PublicCatalogPriceContextDto {
  return (
    isRecord(value) &&
    hasExactPriceContextShape(value) &&
    isNonEmptyString(value.priceListId) &&
    isNonEmptyString(value.name) &&
    typeof value.isCatalogDefault === 'boolean'
  )
}

function isPriceContextsResponse(value: unknown): value is PublicCatalogPriceContextDto[] {
  if (!Array.isArray(value)) return false

  const priceListIds = new Set<string>()
  const names = new Set<string>()
  let defaultCount = 0

  for (const row of value) {
    if (!isPriceContextRow(row)) return false
    if (priceListIds.has(row.priceListId)) return false
    // GlobalPriceList.name is globally unique in the backend, so a duplicate
    // name indicates a malformed or mixed discovery payload.
    if (names.has(row.name)) return false
    priceListIds.add(row.priceListId)
    names.add(row.name)
    if (row.isCatalogDefault) {
      defaultCount += 1
      if (defaultCount > 1) return false
    }
  }

  return true
}

export async function fetchCatalogPriceContexts(
  tenantSlug: string,
  signal?: AbortSignal,
): Promise<PublicCatalogPriceContextDto[]> {
  let response: Response
  try {
    const init = signal
      ? { method: 'GET' as const, credentials: 'omit' as const, signal }
      : { method: 'GET' as const, credentials: 'omit' as const }
    response = await fetch(
      `${apiBase}/public/catalog/${encodeURIComponent(tenantSlug)}/price-contexts`,
      init,
    )
  } catch {
    throw new CatalogPriceContextsError('network')
  }

  try {
    if (response.status === 404) throw new CatalogPriceContextsError('unavailable', 404)
    if (response.status === 429) throw new CatalogPriceContextsError('rate-limit', 429)
    if (response.status !== 200) throw new CatalogPriceContextsError('server', response.status)
    const body: unknown = await response.json()
    if (!isPriceContextsResponse(body))
      throw new CatalogPriceContextsError('server', response.status)
    return body
  } catch (error) {
    if (error instanceof CatalogPriceContextsError) throw error
    throw new CatalogPriceContextsError('server', response.status)
  }
}
