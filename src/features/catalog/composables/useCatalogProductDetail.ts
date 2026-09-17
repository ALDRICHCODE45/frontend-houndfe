import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchCatalogProductDetail } from '../api/catalog-product-detail.api'
import type { PublicCatalogProductDetailDto } from '../interfaces/public-catalog-product-detail.types'

export type CatalogProductDetailState =
  | 'idle'
  | 'loading'
  | 'populated'
  | 'not-found'
  | 'rate-limit'
  | 'network'
  | 'server'
  | 'retry-pending'

type DetailIdentity = {
  tenantSlug: string
  productId: string
  priceListId: string
}

type DetailQueryResult = {
  identity: DetailIdentity
  detail: PublicCatalogProductDetailDto
}

type DetailQueryKey = ReturnType<typeof detailQueryKey>

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

function normalizeIdentity(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

function detailQueryKey(identity: DetailIdentity | null) {
  return [
    'public-catalog',
    'product-detail',
    apiBase,
    identity?.tenantSlug ?? '',
    identity?.productId ?? '',
    identity?.priceListId ?? '',
  ] as const
}

function sameIdentity(left: DetailIdentity, right: DetailIdentity | null): boolean {
  return (
    right !== null &&
    left.tenantSlug === right.tenantSlug &&
    left.productId === right.productId &&
    left.priceListId === right.priceListId
  )
}

export function useCatalogProductDetail(
  tenantSlug: MaybeRefOrGetter<string | null | undefined>,
  productId: MaybeRefOrGetter<string | null | undefined>,
  priceListId: MaybeRefOrGetter<string | null | undefined>,
) {
  const identity = computed<DetailIdentity | null>(() => {
    const normalizedTenantSlug = normalizeIdentity(toValue(tenantSlug))
    const normalizedProductId = normalizeIdentity(toValue(productId))
    const normalizedPriceListId = normalizeIdentity(toValue(priceListId))

    if (
      normalizedTenantSlug === null ||
      normalizedProductId === null ||
      normalizedPriceListId === null
    ) {
      return null
    }

    return {
      tenantSlug: normalizedTenantSlug,
      productId: normalizedProductId,
      priceListId: normalizedPriceListId,
    }
  })
  const enabled = computed(() => identity.value !== null)
  const retryRequested = ref(false)
  const query = useQuery<DetailQueryResult, Error, DetailQueryResult, DetailQueryKey>({
    queryKey: computed(() => detailQueryKey(identity.value)),
    queryFn: async ({ queryKey, signal }) => {
      const [, , , queryTenantSlug, queryProductId, queryPriceListId] = queryKey
      if (!queryTenantSlug || !queryProductId || !queryPriceListId) {
        throw new Error(
          'A tenant slug, product id, and price list id are required before fetching product detail',
        )
      }

      const detail = await fetchCatalogProductDetail(
        queryTenantSlug,
        queryProductId,
        queryPriceListId,
        signal,
      )
      return {
        identity: {
          tenantSlug: queryTenantSlug,
          productId: queryProductId,
          priceListId: queryPriceListId,
        },
        detail,
      }
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: false,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    networkMode: 'always',
  })

  const detail = computed(() => {
    const result = query.data.value
    return result && sameIdentity(result.identity, identity.value) ? result.detail : null
  })
  const errorKind = computed(() => {
    const error = query.error.value
    if (!error || !('kind' in error)) return 'server' as const
    return (error as { kind: 'not-found' | 'rate-limit' | 'network' | 'server' }).kind
  })
  const state = computed<CatalogProductDetailState>(() => {
    if (!enabled.value) return 'idle'
    if (retryRequested.value && query.isFetching.value) return 'retry-pending'
    if (query.isPending.value || query.isFetching.value) return 'loading'
    if (query.isError.value) return errorKind.value
    return detail.value === null ? 'loading' : 'populated'
  })

  async function retry() {
    if (!enabled.value || query.isFetching.value) return
    retryRequested.value = true
    try {
      await query.refetch()
    } finally {
      retryRequested.value = false
    }
  }

  return { detail, state, retry }
}
