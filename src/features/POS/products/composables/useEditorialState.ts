import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { z } from 'zod'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { editorialApi, EditorialApiError } from '../api/product-editorial.api'
import { canReadEditorial } from '../authorization/editorial-access'
import { editorialQueryKeys } from '../constants/product-editorial-query-keys'
import { decodeEditorialDocument } from '../utils/product-editorial-document'

const revision = z.number().int().positive()
const stateSchema = z.object({
  cycle: revision.nullable(),
  draft: z.object({ revision, basePublishedRevision: revision.nullable(), document: z.unknown() }).nullable(),
  published: z.object({ revision, document: z.unknown() }).nullable(),
})
let readerSequence = 0

export function useEditorialState(productId: MaybeRefOrGetter<string>) {
  const auth = useAuthStore()
  // Reader lifetime + context generation prevents reuse of historical cached state
  // after remount, logout/login or a permissions transition. Never key by tokens.
  const reader = ++readerSequence
  const generation = shallowRef(0)
  const context = computed(() => JSON.stringify([
    auth.isAuthenticated, auth.authPhase, auth.user?.id, auth.currentTenant?.id,
    auth.permissionsLoaded, canReadEditorial(auth.permissionCodes), toValue(productId),
  ]))
  watch(context, () => { generation.value++ }, { flush: 'sync' })
  const enabled = computed(() => Boolean(auth.isAuthenticated && auth.authPhase === 'authenticated' && auth.user?.id &&
    auth.currentTenant?.id && auth.permissionsLoaded &&
    canReadEditorial(auth.permissionCodes) && toValue(productId)))
  const queryKey = computed(() => editorialQueryKeys.state({
    tenantId: auth.currentTenant?.id ?? '',
    authScope: JSON.stringify([auth.user?.id ?? '', reader, generation.value]),
  }, toValue(productId)))
  const identity = computed(() => JSON.stringify(queryKey.value))
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      // Also protect manual refetch and deferred observer scheduling.
      if (!enabled.value) throw new EditorialApiError(403, null)
      const requestedIdentity = identity.value
      const state = stateSchema.parse(await editorialApi.getState(toValue(productId)))
      return { identity: requestedIdentity, state }
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    gcTime: 0,
  })
  const state = computed(() => enabled.value && !query.isError.value &&
    query.data.value?.identity === identity.value ? query.data.value.state : null)
  const sections = computed(() => {
    if (!state.value) return []
    return ([['draft', 'Borrador'], ['published', 'Publicado']] as const).map(([key, label]) => {
      const entry = state.value![key]
      return { key, label, revision: entry?.revision ?? null,
        decoded: entry ? decodeEditorialDocument(entry.document) : null }
    })
  })
  const errorMessage = computed(() => {
    if (!enabled.value) return 'No tienes acceso al contenido editorial en el contexto actual.'
    if (!query.isError.value) return null
    const error = query.error.value
    if (error instanceof EditorialApiError) {
      if (error.status === 403) return 'No tienes acceso al contenido editorial de este producto.'
      if (error.status === 401) return 'Tu sesión ya no permite consultar este contenido. Vuelve a iniciar sesión.'
      if (error.status === 404) return 'No se encontró contenido editorial para este producto.'
    }
    return 'No se pudo consultar el contenido editorial. Puedes actualizar para intentar de nuevo.'
  })
  async function refresh() {
    if (enabled.value && !query.isFetching.value) await query.refetch()
  }
  return { state, sections, errorMessage, enabled,
    isFetching: query.isFetching, refresh }
}
