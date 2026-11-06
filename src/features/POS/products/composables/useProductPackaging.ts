// useProductPackaging.ts — server state of the product and variant packaging
// sub-resources (shipping handoff §4). Keys carry the tenant, so a sucursal
// switch reads a different entry. A product write changes what every inheriting
// variant reports as `effective`, so it marks the variant entries stale.

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { productPackagingApi } from '../api/product-packaging.api'
import type {
  PackagingBody,
  ProductPackagingResponse,
  VariantPackagingResponse,
} from '../interfaces/product-packaging.types'

export const productPackagingKeys = {
  product: (tenantId: string, productId: string) =>
    ['products', tenantId, 'packaging', productId] as const,
  variants: (tenantId: string, productId: string) =>
    [...productPackagingKeys.product(tenantId, productId), 'variants'] as const,
  variant: (tenantId: string, productId: string, variantId: string) =>
    [...productPackagingKeys.variants(tenantId, productId), variantId] as const,
}

interface PackagingQueryOptions {
  enabled?: MaybeRefOrGetter<boolean>
}

export function useProductPackaging(
  productId: MaybeRefOrGetter<string>,
  options: PackagingQueryOptions = {},
) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const key = computed(() => productPackagingKeys.product(tenantId.value, toValue(productId)))

  const query = useQuery({
    queryKey: key,
    queryFn: () => productPackagingApi.getProduct(toValue(productId)),
    enabled: computed(
      () => tenantId.value.length > 0 && toValue(productId).length > 0 && toValue(options.enabled ?? true),
    ),
  })

  function installAndRefreshVariants(response: ProductPackagingResponse) {
    queryClient.setQueryData(key.value, response)
    void queryClient.invalidateQueries({
      queryKey: productPackagingKeys.variants(tenantId.value, toValue(productId)),
    })
  }

  const save = useMutation({
    mutationFn: (body: PackagingBody) => productPackagingApi.putProduct(toValue(productId), body),
    onSuccess: installAndRefreshVariants,
  })

  const remove = useMutation({
    mutationFn: () => productPackagingApi.removeProduct(toValue(productId)),
    onSuccess: () => installAndRefreshVariants({ productId: toValue(productId), packaging: null }),
  })

  return {
    packaging: computed(() => query.data.value?.packaging),
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    save,
    remove,
  }
}

export function useVariantPackaging(
  productId: MaybeRefOrGetter<string>,
  variantId: MaybeRefOrGetter<string>,
  options: PackagingQueryOptions = {},
) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const key = computed(() =>
    productPackagingKeys.variant(tenantId.value, toValue(productId), toValue(variantId)),
  )

  const query = useQuery({
    queryKey: key,
    queryFn: () => productPackagingApi.getVariant(toValue(productId), toValue(variantId)),
    enabled: computed(
      () =>
        tenantId.value.length > 0 &&
        toValue(productId).length > 0 &&
        toValue(variantId).length > 0 &&
        toValue(options.enabled ?? true),
    ),
  })

  const save = useMutation({
    mutationFn: (body: PackagingBody) =>
      productPackagingApi.putVariant(toValue(productId), toValue(variantId), body),
    onSuccess: (response: VariantPackagingResponse) => queryClient.setQueryData(key.value, response),
  })

  // DELETE answers 204: read the variant again to learn what it inherits now.
  const remove = useMutation({
    mutationFn: () => productPackagingApi.removeVariant(toValue(productId), toValue(variantId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.value }),
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    save,
    remove,
  }
}
