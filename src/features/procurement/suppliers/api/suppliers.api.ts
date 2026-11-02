import { http } from '@/core/shared/api/http'
import type { Supplier, SupplierInput, SupplierListInput, SupplierPage, SupplierPatch } from '../interfaces/supplier.types'

const base = '/procurement/suppliers'

// Commands receive the immutable attempt's key from their context owner.
// Neither this adapter nor a refresh of credentials creates a new intent.
export const suppliersApi = {
  async list(input: SupplierListInput, signal?: AbortSignal): Promise<SupplierPage> {
    const { search, status, cursor, limit } = input
    const response = await http.get<SupplierPage>(base, {
      params: { search, status, cursor, limit }, signal,
    })
    return response.data
  },
  async get(id: string, signal?: AbortSignal): Promise<Supplier> {
    const response = await http.get<Supplier>(base + '/' + encodeURIComponent(id), { signal })
    return response.data
  },
  async create(input: SupplierInput, key: string): Promise<Supplier> {
    const { displayName, termsText, status } = input
    const response = await http.post<Supplier>(base, { displayName, termsText, status }, {
      headers: { 'Idempotency-Key': key },
    })
    return response.data
  },
  async update(id: string, input: SupplierPatch, key: string): Promise<Supplier> {
    const changes: Partial<SupplierInput> = {}
    for (const field of ['displayName', 'termsText', 'status'] as const) {
      if (Object.prototype.hasOwnProperty.call(input.changes, field)) {
        Object.assign(changes, { [field]: input.changes[field] })
      }
    }
    const response = await http.patch<Supplier>(base + '/' + encodeURIComponent(id),
      { expectedVersion: input.expectedVersion, changes },
      { headers: { 'Idempotency-Key': key } })
    return response.data
  },
}
