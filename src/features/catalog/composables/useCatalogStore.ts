import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { catalogApi } from '../api/catalog.api'
import { MOCK_CATEGORIES } from '../data/mock-catalog'
import type {
  PublicBranchDto,
  PublicCatalogProductCard,
  PublicCatalogProductDetail,
  PublicCatalogCategoryFacet,
  PublicSortOption,
  CatalogCategory,
} from '../interfaces/catalog.types'

export const useCatalogStore = defineStore('catalog', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  const branches = ref<PublicBranchDto[]>([])
  const selectedBranch = ref<PublicBranchDto | null>(null)
  const products = ref<PublicCatalogProductCard[]>([])
  const facetCategories = ref<PublicCatalogCategoryFacet[]>([])
  const totalProducts = ref(0)

  const searchQuery = ref('')
  const selectedCategoryId = ref<string | null>(null)
  const sortOption = ref<PublicSortOption>('relevance')

  const selectedProduct = ref<PublicCatalogProductDetail | null>(null)
  const isProductModalOpen = ref(false)

  const staticCategories: CatalogCategory[] = MOCK_CATEGORIES

  // ─── Computed ────────────────────────────────────────────────────────────────

  const categoriesWithCounts = computed(() => {
    const total = facetCategories.value.reduce((sum, c) => sum + c.count, 0)
    const all = {
      id: null as string | null,
      name: 'Todo',
      emoji: '🛍️',
      count: total,
    }

    const mapped = staticCategories.map((sc) => {
      const facet = facetCategories.value.find((f) => f.id === sc.id)
      return {
        id: sc.id as string | null,
        name: sc.name,
        emoji: sc.emoji,
        count: facet?.count ?? 0,
      }
    })

    return [all, ...mapped]
  })

  const sortOptions = computed(() => [
    { label: 'Relevancia', value: 'relevance' as PublicSortOption },
    { label: 'Precio: menor a mayor', value: 'price_asc' as PublicSortOption },
    { label: 'Precio: mayor a menor', value: 'price_desc' as PublicSortOption },
    { label: 'Mas recientes', value: 'newest' as PublicSortOption },
  ])

  const selectedSortLabel = computed(
    () => sortOptions.value.find((o) => o.value === sortOption.value)?.label ?? 'Relevancia',
  )

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function loadBranches() {
    branches.value = await catalogApi.getBranches()
    if (!selectedBranch.value && branches.value.length > 0) {
      selectedBranch.value = branches.value[0]!
    }
  }

  function selectBranch(branch: PublicBranchDto) {
    selectedBranch.value = branch
    // Reload products for the new branch
    void loadProducts()
  }

  async function loadProducts() {
    const slug = selectedBranch.value?.slug ?? 'centro'
    const response = await catalogApi.getProducts(slug, {
      q: searchQuery.value || undefined,
      categoryId: selectedCategoryId.value ?? undefined,
      sort: sortOption.value,
    })
    products.value = response.items
    facetCategories.value = response.facets.categories
    totalProducts.value = response.meta.total
  }

  function setCategory(categoryId: string | null) {
    selectedCategoryId.value = categoryId
    void loadProducts()
  }

  function setSearch(query: string) {
    searchQuery.value = query
    void loadProducts()
  }

  function setSort(sort: PublicSortOption) {
    sortOption.value = sort
    void loadProducts()
  }

  async function openProductDetail(productId: string) {
    const slug = selectedBranch.value?.slug ?? 'centro'
    selectedProduct.value = await catalogApi.getProductDetail(slug, productId, slug)
    isProductModalOpen.value = true
  }

  function closeProductDetail() {
    isProductModalOpen.value = false
    selectedProduct.value = null
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  async function init(branchSlug?: string) {
    await loadBranches()

    if (branchSlug) {
      const match = branches.value.find((b) => b.slug === branchSlug)
      if (match) {
        selectedBranch.value = match
      }
    }

    await loadProducts()
  }

  return {
    // State
    branches,
    selectedBranch,
    products,
    facetCategories,
    totalProducts,
    searchQuery,
    selectedCategoryId,
    sortOption,
    selectedProduct,
    isProductModalOpen,
    staticCategories,

    // Computed
    categoriesWithCounts,
    sortOptions,
    selectedSortLabel,

    // Actions
    loadBranches,
    selectBranch,
    loadProducts,
    setCategory,
    setSearch,
    setSort,
    openProductDetail,
    closeProductDetail,
    init,
  }
})
