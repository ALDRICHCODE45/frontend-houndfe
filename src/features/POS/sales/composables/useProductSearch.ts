import { ref, computed } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import type { PosCatalogItem } from '../interfaces/sale.types'

export function useProductSearch() {
  const query = ref('')
  const debouncedQuery = refDebounced(query, 250)
  const categoryId = ref<string | undefined>(undefined)

  const { data, isLoading, isError } = useQuery({
    queryKey: computed(() =>
      saleQueryKeys.posCatalog({
        q: debouncedQuery.value || undefined,
        limit: debouncedQuery.value ? 30 : 24,
        offset: 0,
        categoryId: categoryId.value,
      })
    ),
    queryFn: async () => {
      return saleApi.searchPosCatalog({
        q: debouncedQuery.value || undefined,
        limit: debouncedQuery.value ? 30 : 24,
        offset: 0,
        categoryId: categoryId.value,
      })
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

  const items = computed<PosCatalogItem[]>(() => {
    return data.value?.items ?? []
  })

  const total = computed(() => {
    return data.value?.total ?? 0
  })

  const hasQuery = computed(() => debouncedQuery.value.length > 0)

  const isEmpty = computed(() => {
    return !isLoading.value && items.value.length === 0
  })

  return {
    query,
    items,
    total,
    hasQuery,
    isLoading,
    isError,
    isEmpty,
    categoryId,
  }
}
