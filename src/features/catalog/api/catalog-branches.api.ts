import type { PublicBranchDto } from '../interfaces/catalog.types'

export type CatalogBranchesErrorKind = 'rate-limit' | 'server' | 'network'

export class CatalogBranchesError extends Error {
  readonly kind: CatalogBranchesErrorKind
  readonly status?: number

  constructor(kind: CatalogBranchesErrorKind = 'server', status?: number) {
    super(kind === 'rate-limit' ? 'Too many requests' : kind === 'network' ? 'Network failure' : 'Server failure')
    this.name = 'CatalogBranchesError'
    this.kind = kind
    if (status !== undefined) this.status = status
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

function isPublicBranch(value: unknown): value is PublicBranchDto {
  if (!value || typeof value !== 'object') return false
  const branch = value as Record<string, unknown>
  return typeof branch.id === 'string'
    && typeof branch.name === 'string'
    && typeof branch.slug === 'string'
    && (branch.address === null || typeof branch.address === 'string')
    && (branch.phone === null || typeof branch.phone === 'string')
}

export async function fetchCatalogBranches(signal?: AbortSignal): Promise<PublicBranchDto[]> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/public/catalog/branches`, { method: 'GET', credentials: 'omit', signal })
  } catch {
    throw new CatalogBranchesError('network')
  }
  try {
    if (response.status === 429) throw new CatalogBranchesError('rate-limit', 429)
    if (response.status !== 200) throw new CatalogBranchesError('server', response.status)
    const body: unknown = await response.json()
    if (!Array.isArray(body) || !body.every(isPublicBranch)) throw new CatalogBranchesError('server', response.status)
    return body
  } catch (error) {
    if (error instanceof CatalogBranchesError) throw error
    throw new CatalogBranchesError('server', response.status)
  }
}
