import { ref, computed } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useQuery } from '@tanstack/vue-query'
import { productApi } from '@/features/POS/products/api/product.api'
import type { SearchableProduct } from '../interfaces/sale.types'
import type { Product } from '@/features/POS/products/interfaces/product.types'

export function mapToSearchableProduct(product: Product): SearchableProduct {
  const stock = product.hasVariants && product.variantStockTotal != null
    ? product.variantStockTotal
    : product.quantity

  return {
    id: product.id,
    name: product.name,
    imageUrl: null,
    priceCents: product.priceCents,
    stock,
    sellInPos: product.sellInPos,
    hasVariants: product.hasVariants,
    variantCount: product.variantCount ?? 0,
  }
}

export function filterSellInPosProducts(products: Product[]): SearchableProduct[] {
  return products
    .filter((product) => product.sellInPos === true)
    .map(mapToSearchableProduct)
}

export function useProductSearch() {
  const query = ref('')
  const debouncedQuery = refDebounced(query, 250)

  const { data, isLoading } = useQuery({
    queryKey: computed(() => ['products', 'search', debouncedQuery.value]),
    queryFn: async () => {
      if (debouncedQuery.value.length < 1) {
        return { data: [], pagination: { pageIndex: 0, pageSize: 50, totalCount: 0, pageCount: 1 } }
      }

      return productApi.getPaginated({
        pageIndex: 0,
        pageSize: 50,
        globalFilter: debouncedQuery.value,
      })
    },
    staleTime: 30_000,
  })

  const results = computed(() => {
    if (!data.value) return []
    return filterSellInPosProducts(data.value.data)
  })

  const isEmpty = computed(() => {
    return !isLoading.value && debouncedQuery.value.length > 0 && results.value.length === 0
  })

  return {
    query,
    results,
    isLoading,
    isEmpty,
  }
}
