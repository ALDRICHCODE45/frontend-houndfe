import { computed, readonly, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { petApi } from './pet.api'
import { readPetError, type PetErrorInfo } from './petErrors'
import type {
  CreatePetPayload,
  Pet,
  PetListStatus,
  PetWriteResponse,
  UpdatePetPayload,
} from './pet.types'

export const petQueryKeys = {
  all: (tenantId: string, customerId: string) =>
    ['customers', tenantId, 'pets', customerId] as const,
  list: (tenantId: string, customerId: string, status: PetListStatus) =>
    ['customers', tenantId, 'pets', customerId, status] as const,
}

/** Pets reuse the `Customer` subject (§1): read lists, update writes, delete erases. */
export function usePetAccess() {
  const auth = useAuthStore()
  const tenantId = useSafeTenantId()
  return {
    tenantId,
    canRead: computed(() => auth.userCan('read', 'Customer')),
    canUpdate: computed(() => auth.userCan('update', 'Customer')),
    canDelete: computed(() => auth.userCan('delete', 'Customer')),
  }
}

/** `GET /customers/:id/pets?status=`; refetched whenever the card opens (the bot edits pets too, §9). */
export function usePetsList(
  customerId: MaybeRefOrGetter<string | null | undefined>,
  status: MaybeRefOrGetter<PetListStatus>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const { tenantId, canRead } = usePetAccess()
  return useQuery({
    queryKey: computed(() =>
      petQueryKeys.list(tenantId.value, toValue(customerId) ?? '', toValue(status)),
    ),
    queryFn: () => petApi.list(toValue(customerId)!, toValue(status)),
    enabled: computed(() => !!toValue(customerId) && canRead.value && toValue(enabled)),
    refetchOnMount: 'always',
  })
}

export type PetWriteOutcome =
  | { status: 'ignored' }
  | { status: 'saved'; pet: Pet; duplicateName: boolean }
  | { status: 'failed'; error: PetErrorInfo }

export type PetEraseOutcome =
  | { status: 'ignored' }
  | { status: 'erased' }
  | { status: 'failed'; error: PetErrorInfo }

const byName = (a: Pet, b: Pet) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
const byArchivedDesc = (a: Pet, b: Pet) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')

function placeIn(list: Pet[], pet: Pet, status: PetListStatus): Pet[] {
  const rest = list.filter((item) => item.id !== pet.id)
  if (status === 'ALL') {
    const index = list.findIndex((item) => item.id === pet.id)
    return index < 0 ? [pet, ...list] : list.map((item) => (item.id === pet.id ? pet : item))
  }
  if (pet.status !== status) return rest
  return [...rest, pet].sort(status === 'ACTIVE' ? byName : byArchivedDesc)
}

/**
 * Pet writes. Each returns an outcome and never throws. A write response replaces the cached copy
 * (no refetch, §2); a conflict or a vanished pet reloads the lists so the card shows the truth (§3.7).
 */
export function usePetMutations(customerId: MaybeRefOrGetter<string>) {
  const client = useQueryClient()
  const { tenantId, canUpdate, canDelete } = usePetAccess()
  const isPending = ref(false)

  const allKey = () => petQueryKeys.all(tenantId.value, toValue(customerId))

  function setLists(update: (list: Pet[], status: PetListStatus) => Pet[]) {
    for (const status of ['ACTIVE', 'ARCHIVED', 'ALL'] as const) {
      client.setQueryData<Pet[]>(
        petQueryKeys.list(tenantId.value, toValue(customerId), status),
        (old) => (old ? update(old, status) : old),
      )
    }
  }

  async function run<T>(
    allowed: boolean,
    write: () => Promise<T>,
    done: (value: T) => PetWriteOutcome | PetEraseOutcome,
  ) {
    if (!allowed || isPending.value) return { status: 'ignored' as const }
    isPending.value = true
    try {
      return done(await write())
    } catch (err) {
      const error = readPetError(err)
      if (error.reload) await client.invalidateQueries({ queryKey: allKey() })
      return { status: 'failed' as const, error }
    } finally {
      isPending.value = false
    }
  }

  function saved({ warnings, ...pet }: PetWriteResponse): PetWriteOutcome {
    setLists((list, status) => placeIn(list, pet, status))
    return { status: 'saved', pet, duplicateName: (warnings ?? []).includes('PET_NAME_DUPLICATE') }
  }

  const id = () => toValue(customerId)

  return {
    isPending: readonly(isPending),
    create: (payload: CreatePetPayload) =>
      run(canUpdate.value, () => petApi.create(id(), payload), saved) as Promise<PetWriteOutcome>,
    update: (pet: Pet, payload: UpdatePetPayload) =>
      run(
        canUpdate.value,
        () => petApi.update(id(), pet.id, payload),
        saved,
      ) as Promise<PetWriteOutcome>,
    archive: (pet: Pet, reason?: string) => {
      const text = reason?.trim()
      const body = { version: pet.version, ...(text ? { reason: text } : {}) }
      return run(
        canUpdate.value,
        () => petApi.archive(id(), pet.id, body),
        saved,
      ) as Promise<PetWriteOutcome>
    },
    restore: (pet: Pet) =>
      run(
        canUpdate.value,
        () => petApi.restore(id(), pet.id, { version: pet.version }),
        saved,
      ) as Promise<PetWriteOutcome>,
    erase: (pet: Pet) =>
      run(
        canDelete.value,
        () => petApi.remove(id(), pet.id, pet.version),
        () => {
          setLists((list) => list.filter((item) => item.id !== pet.id))
          return { status: 'erased' }
        },
      ) as Promise<PetEraseOutcome>,
  }
}
