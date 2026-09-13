import type { PublicBranchDto } from '../interfaces/catalog.types'

export class CatalogBranchesError extends Error {
  readonly kind = 'server'
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

export async function fetchCatalogBranches(): Promise<PublicBranchDto[]> {
  try {
    const response = await fetch(`${apiBase}/public/catalog/branches`, { method: 'GET', credentials: 'omit' })
    if (!response.ok || response.status !== 200) throw new CatalogBranchesError()
    const body: unknown = await response.json()
    if (!Array.isArray(body) || !body.every(isPublicBranch)) throw new CatalogBranchesError()
    return body
  } catch (error) {
    if (error instanceof CatalogBranchesError) throw error
    throw new CatalogBranchesError()
  }
}
