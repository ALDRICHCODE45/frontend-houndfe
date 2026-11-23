import { http } from '@/core/shared/api/http'
import type {
  ArchivePetPayload,
  CreatePetPayload,
  Pet,
  PetListStatus,
  PetWriteResponse,
  RestorePetPayload,
  UpdatePetPayload,
} from './pet.types'

const base = (customerId: string) => `/customers/${customerId}/pets`

/** `/customers/:customerId/pets` (handoff 27 §3). */
export const petApi = {
  async list(customerId: string, status: PetListStatus): Promise<Pet[]> {
    const { data } = await http.get<Pet[]>(base(customerId), { params: { status } })
    return data
  },

  async create(customerId: string, payload: CreatePetPayload): Promise<PetWriteResponse> {
    const { data } = await http.post<PetWriteResponse>(base(customerId), payload)
    return data
  },

  async update(
    customerId: string,
    petId: string,
    payload: UpdatePetPayload,
  ): Promise<PetWriteResponse> {
    const { data } = await http.patch<PetWriteResponse>(`${base(customerId)}/${petId}`, payload)
    return data
  },

  async archive(
    customerId: string,
    petId: string,
    payload: ArchivePetPayload,
  ): Promise<PetWriteResponse> {
    const { data } = await http.post<PetWriteResponse>(
      `${base(customerId)}/${petId}/archive`,
      payload,
    )
    return data
  },

  async restore(
    customerId: string,
    petId: string,
    payload: RestorePetPayload,
  ): Promise<PetWriteResponse> {
    const { data } = await http.post<PetWriteResponse>(
      `${base(customerId)}/${petId}/restore`,
      payload,
    )
    return data
  },

  /** Real erasure: `version` is a query parameter, never a body (§3.5). → 204. */
  async remove(customerId: string, petId: string, version: number): Promise<void> {
    await http.delete(`${base(customerId)}/${petId}`, { params: { version } })
  },
}
