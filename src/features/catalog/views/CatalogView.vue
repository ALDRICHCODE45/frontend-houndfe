<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CatalogHeader from '../components/CatalogHeader.vue'
import CatalogCategoryBar from '../components/CatalogCategoryBar.vue'
import CatalogFooter from '../components/CatalogFooter.vue'
import CatalogProductDetailModal from '../components/CatalogProductDetailModal.vue'
import CatalogProductGrid from '../components/CatalogProductGrid.vue'
import { useCatalogBranches } from '../composables/useCatalogBranches'
import { useCatalogProductDetail } from '../composables/useCatalogProductDetail'
import { useCatalogProducts } from '../composables/useCatalogProducts'

const route = useRoute()
const router = useRouter()
const { branches, state: branchesState, retry: retryBranches } = useCatalogBranches()
const selectedBranch = computed(() => {
  const slug = route.params.branchSlug
  return typeof slug === 'string'
    ? (branches.value.find((branch) => branch.slug === slug) ?? null)
    : null
})
const selectionState = computed<'none' | 'invalid' | 'selected'>(() => {
  const slug = route.params.branchSlug
  if (typeof slug !== 'string' || slug.trim().length === 0) return 'none'
  return selectedBranch.value ? 'selected' : 'invalid'
})
const {
  products,
  response,
  state: productsState,
  retry: retryProducts,
} = useCatalogProducts(computed(() => selectedBranch.value?.slug ?? null))

const selectedProductId = ref<string | null>(null)
const isDetailOpen = ref(false)
const priceListId = computed(() => response.value?.priceContext.priceListId ?? null)
const detailProductId = computed(() =>
  isDetailOpen.value &&
  selectionState.value === 'selected' &&
  priceListId.value !== null &&
  selectedProductId.value !== null
    ? selectedProductId.value
    : null,
)
const {
  detail,
  state: detailState,
  retry: retryDetail,
} = useCatalogProductDetail(
  computed(() => selectedBranch.value?.slug ?? null),
  detailProductId,
  priceListId,
)

type InvokerFocus = {
  element: HTMLButtonElement
  branchSlug: string
  productId: string
}
const detailInvoker = ref<InvokerFocus | null>(null)

function clearDetail(restoreFocus: boolean) {
  const invoker = detailInvoker.value
  detailInvoker.value = null
  isDetailOpen.value = false
  selectedProductId.value = null

  if (!restoreFocus || !invoker) return
  void nextTick(() => {
    if (
      selectedBranch.value?.slug === invoker.branchSlug &&
      invoker.element.isConnected &&
      !invoker.element.disabled &&
      document.contains(invoker.element)
    ) {
      invoker.element.focus()
    }
  })
}

function openDetail(productId: string, invoker: HTMLButtonElement) {
  const branchSlug = selectedBranch.value?.slug
  const hasResolvedPriceContext =
    typeof priceListId.value === 'string' && priceListId.value.length > 0
  const isCurrentProduct = products.value.some((product) => product.id === productId)
  if (
    selectionState.value !== 'selected' ||
    productsState.value !== 'populated' ||
    !branchSlug ||
    !hasResolvedPriceContext ||
    !isCurrentProduct
  ) {
    return
  }

  detailInvoker.value = { element: invoker, branchSlug, productId }
  selectedProductId.value = productId
  isDetailOpen.value = true
}

watch([() => selectedBranch.value?.slug ?? null, priceListId], () => clearDetail(false), {
  flush: 'sync',
})

async function selectBranch(slug: string) {
  try {
    await router.push({
      name: 'public-catalog',
      params: { branchSlug: slug },
      query: route.query,
      hash: route.hash,
    })
  } catch {
    // Route state remains the only selection authority when navigation is rejected.
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <CatalogHeader
      :branches="branches"
      :state="branchesState"
      :selected-branch="selectedBranch"
      @retry="retryBranches"
      @select="selectBranch"
    />
    <CatalogCategoryBar
      :categories="response?.facets.categories ?? []"
      :total="response?.meta.total ?? null"
    />

    <main class="flex-1">
      <CatalogProductGrid
        :selection-state="selectionState"
        :products="products"
        :state="productsState"
        @retry="retryProducts"
        @open-detail="openDetail"
      />
    </main>

    <CatalogFooter />
    <CatalogProductDetailModal
      :open="isDetailOpen"
      :detail="detail"
      :state="detailState"
      @close="clearDetail(true)"
      @retry="retryDetail"
    />
  </div>
</template>
