import { ref, computed, watch } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { PosCatalogItem } from '../interfaces/sale.types'

export interface CategoryChip {
  id: string
  name: string
  count: number
}

export function useProductSearch() {
  const tenantId = useSafeTenantId()
  const query = ref('')
  const debouncedQuery = refDebounced(query, 250)
  const categoryId = ref<string | undefined>(undefined)

  // Main search query (filtered)
  const { data, isLoading, isError } = useQuery({
    queryKey: computed(() =>
      saleQueryKeys.posCatalog(tenantId.value, {
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

  // Separate unfiltered query for category chips (never filtered by categoryId)
  const { data: allData } = useQuery({
    queryKey: computed(() =>
      saleQueryKeys.posCatalog(tenantId.value, { q: undefined, limit: 50, offset: 0 })
    ),
    queryFn: async () => {
      return saleApi.searchPosCatalog({ q: undefined, limit: 50, offset: 0 })
    },
    staleTime: 60_000,
  })

  const categories = computed<CategoryChip[]>(() => {
    const allItems = allData.value?.items ?? []
    const catMap = new Map<string, CategoryChip>()
    for (const item of allItems) {
      if (item.category) {
        const existing = catMap.get(item.category.id)
        if (existing) {
          existing.count++
        } else {
          catMap.set(item.category.id, { id: item.category.id, name: item.category.name, count: 1 })
        }
      }
    }
    return Array.from(catMap.values()).sort((a, b) => b.count - a.count)
  })

  const totalUnfiltered = computed(() => allData.value?.total ?? 0)

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
    categories,
    totalUnfiltered,
  }
}
