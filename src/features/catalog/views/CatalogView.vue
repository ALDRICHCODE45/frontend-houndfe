<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CatalogHeader from '../components/CatalogHeader.vue'
import CatalogHero from '../components/CatalogHero.vue'
import CatalogCategoryBar from '../components/CatalogCategoryBar.vue'
import CatalogFooter from '../components/CatalogFooter.vue'
import CatalogProductDetailModal from '../components/CatalogProductDetailModal.vue'
import CatalogProductGrid, {
  type CatalogProductContextState,
} from '../components/CatalogProductGrid.vue'
import { useCatalogBranches } from '../composables/useCatalogBranches'
import { useCatalogProductDetail } from '../composables/useCatalogProductDetail'
import { useCatalogProducts } from '../composables/useCatalogProducts'
import { useCatalogPriceContexts } from '../composables/useCatalogPriceContexts'
import type { PublicCatalogPriceContextDto } from '../interfaces/public-catalog-price-context.types'

const route = useRoute()
const router = useRouter()
const { branches, state: branchesState, retry: retryBranches } = useCatalogBranches()

const branchSlug = computed(() => {
  const slug = route.params.branchSlug
  return typeof slug === 'string' && slug.trim().length > 0 ? slug.trim() : null
})
const selectedBranch = computed(() =>
  branchSlug.value === null
    ? null
    : (branches.value.find((branch) => branch.slug === branchSlug.value) ?? null),
)
const selectionState = computed<'none' | 'invalid' | 'selected'>(() => {
  if (branchSlug.value === null) return 'none'
  return selectedBranch.value ? 'selected' : 'invalid'
})

/**
 * Discovery is branch-scoped and never runs before a real, published branch is
 * selected. Until discovery is authoritative the catalog also refuses to request
 * products, so it can never invent or mix a price context.
 */
const {
  contexts,
  state: priceContextsState,
  retry: retryPriceContexts,
} = useCatalogPriceContexts(
  computed(() =>
    selectionState.value === 'selected' ? (selectedBranch.value?.slug ?? null) : null,
  ),
)

/**
 * The URL is only a proposal. An absent `priceListId` means the backend default;
 * a blank, array or unknown explicit id is unavailable and never falls back.
 */
type PriceContextProposal =
  | { kind: 'default' }
  | { kind: 'explicit'; id: string }
  | { kind: 'invalid' }
const priceContextProposal = computed<PriceContextProposal>(() => {
  const raw = route.query.priceListId
  if (raw === undefined) return { kind: 'default' }
  if (typeof raw !== 'string') return { kind: 'invalid' }
  // Trim is only a blank test: the original nonblank string stays the proposed id,
  // so a padded id can never silently match an unpadded discovered context.
  return raw.trim().length === 0 ? { kind: 'invalid' } : { kind: 'explicit', id: raw }
})
const discoveredDefault = computed(
  () => contexts.value.find((context) => context.isCatalogDefault) ?? null,
)
const matchedExplicitContext = computed<PublicCatalogPriceContextDto | null>(() => {
  const proposal = priceContextProposal.value
  if (proposal.kind !== 'explicit') return null
  return contexts.value.find((context) => context.priceListId === proposal.id) ?? null
})

const contextState = computed<CatalogProductContextState>(() => {
  if (selectionState.value !== 'selected') return 'context-ready'
  switch (priceContextsState.value) {
    case 'idle':
    case 'loading':
    case 'retry-pending':
      return 'context-loading'
    case 'empty':
      return 'context-empty'
    case 'unavailable':
      return 'context-unavailable'
    case 'rate-limit':
      return 'context-rate-limit'
    case 'network':
      return 'context-network'
    case 'server':
      return 'context-server'
    case 'populated':
      break
  }

  const proposal = priceContextProposal.value
  if (proposal.kind === 'invalid') return 'context-unavailable'
  if (proposal.kind === 'explicit') {
    return matchedExplicitContext.value ? 'context-ready' : 'context-unavailable'
  }
  return discoveredDefault.value ? 'context-ready' : 'context-no-default'
})

const isContextReady = computed(() => contextState.value === 'context-ready')
const readyBranch = computed(() =>
  isContextReady.value ? (selectedBranch.value?.slug ?? null) : null,
)
const requestedPrice = computed(() =>
  isContextReady.value && priceContextProposal.value.kind === 'explicit'
    ? priceContextProposal.value.id
    : null,
)
const categoryId = computed(() => {
  const raw = route.query.categoryId
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof raw === 'string' && uuid.test(raw) ? raw : null
})
const page = computed(() => {
  const raw = route.query.page
  if (raw === undefined) return 1
  return typeof raw === 'string' && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw))
    ? Number(raw)
    : null
})
const filterError = computed(() => {
  if (route.query.categoryId !== undefined && categoryId.value === null) return 'category'
  return page.value === null ? 'page' : null
})
const listingOptions = computed(() => ({
  ...(categoryId.value !== null ? { categoryId: categoryId.value } : {}),
  ...(page.value !== null && page.value !== 1 ? { page: page.value } : {}),
}))
// Facets are context-scoped, unfiltered, first-page data. The identical initial
// listing shares this key/request; filtered responses never replace these options.
const {
  response: baseline,
  state: baselineState,
  retry: retryBaseline,
} = useCatalogProducts(readyBranch, requestedPrice)
const {
  products,
  response,
  state: productsState,
  retry: retryProducts,
} = useCatalogProducts(
  computed(() => (filterError.value === null ? readyBranch.value : null)),
  requestedPrice,
  listingOptions,
)

// Only the current successful listing can authorize navigation; baseline facets
// and card count never determine pagination boundaries.
const paginationMeta = computed(() =>
  readyBranch.value !== null &&
  filterError.value === null &&
  (productsState.value === 'populated' || productsState.value === 'empty')
    ? (response.value?.meta ?? null)
    : null,
)
const lastAvailablePage = computed(() => Math.max(1, paginationMeta.value?.totalPages ?? 0))
const isPageOutOfRange = computed(
  () => paginationMeta.value !== null && paginationMeta.value.page > lastAvailablePage.value,
)
const showPager = computed(
  () =>
    paginationMeta.value !== null && paginationMeta.value.totalPages > 0 && !isPageOutOfRange.value,
)
async function navigatePage(target: number) {
  if (!paginationMeta.value || target < 1 || target > lastAvailablePage.value) return
  const query = { ...route.query }
  if (target === 1) delete query.page
  else query.page = String(target)
  try {
    await router.push({ query, hash: route.hash })
  } catch {
    // The committed URL remains authoritative after rejected navigation.
  }
}

/** The list response context is authoritative for identity and selector display. */
const authoritativePriceContext = computed(() => response.value?.priceContext ?? null)
const priceListId = computed(() => authoritativePriceContext.value?.priceListId ?? null)
const baselineContextMismatch = computed(
  () =>
    baseline.value !== null &&
    priceListId.value !== null &&
    baseline.value.priceContext.priceListId !== priceListId.value,
)
const categoryBaseline = computed(() => (baselineContextMismatch.value ? null : baseline.value))
const selectedPriceListId = computed(() => {
  if (authoritativePriceContext.value) return authoritativePriceContext.value.priceListId
  const proposal = priceContextProposal.value
  // Only an absent query may fall back to the discovered default before a list
  // response exists. Invalid or unmatched explicit proposals stay unselected.
  if (proposal.kind === 'explicit') return matchedExplicitContext.value?.priceListId ?? null
  if (proposal.kind === 'invalid') return null
  return discoveredDefault.value?.priceListId ?? null
})
/** A stale discovery that omitted the authoritative context keeps it selectable. */
const selectorOptions = computed<PublicCatalogPriceContextDto[]>(() => {
  const authoritative = authoritativePriceContext.value
  if (!authoritative) return contexts.value
  if (contexts.value.some((context) => context.priceListId === authoritative.priceListId))
    return contexts.value
  return [...contexts.value, authoritative]
})

const selectedProductId = ref<string | null>(null)
const isDetailOpen = ref(false)
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

const priceContextProposalKey = computed(() => {
  const proposal = priceContextProposal.value
  return proposal.kind === 'explicit' ? proposal.id : proposal.kind
})
watch(
  [
    () => selectedBranch.value?.slug ?? null,
    priceContextProposalKey,
    priceListId,
    () => JSON.stringify([route.query.categoryId, route.query.page]),
  ],
  () => clearDetail(false),
  { flush: 'sync' },
)

/** Only committed route state changes selection, including rejected navigation. */
async function selectCategory(id: string | null) {
  const query = { ...route.query }
  delete query.page
  if (id === null) delete query.categoryId
  else query.categoryId = id
  try {
    await router.push({ query, hash: route.hash })
  } catch {
    // Keep the current route authoritative.
  }
}
async function recoverPage() {
  const query = { ...route.query }
  delete query.page
  try {
    await router.push({ query, hash: route.hash })
  } catch {
    // Keep the current route authoritative.
  }
}

/** Branch selection drops the previous `priceListId` but preserves unrelated query/hash. */
async function selectBranch(slug: string) {
  const query = { ...route.query }
  delete query.priceListId
  try {
    await router.push({
      name: 'public-catalog',
      params: { branchSlug: slug },
      query,
      hash: route.hash,
    })
  } catch {
    // Route state remains the only selection authority when navigation is rejected.
  }
}

/** Selecting a context writes its exact id; a rejected push never claims it. */
async function selectPriceContext(priceListIdToSelect: string) {
  if (typeof priceListIdToSelect !== 'string' || priceListIdToSelect.trim().length === 0) return
  try {
    await router.push({
      name: 'public-catalog',
      params: route.params,
      query: { ...route.query, priceListId: priceListIdToSelect },
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
      :price-context-options="selectorOptions"
      :price-contexts-state="priceContextsState"
      :selected-price-list-id="selectedPriceListId"
      @retry="retryBranches"
      @select="selectBranch"
      @select-price-context="selectPriceContext"
      @retry-price-contexts="retryPriceContexts"
    />
    <main class="catalog-main flex-1">
      <div class="catalog-container"><CatalogHero /></div>
      <section
        id="catalogo"
        tabindex="-1"
        aria-label="Catálogo de productos"
        class="catalog-listing"
      >
        <div class="catalog-container">
          <CatalogCategoryBar
            :categories="categoryBaseline?.facets.categories ?? []"
            :all-total="categoryBaseline?.meta.total ?? null"
            :context-mismatch="baselineContextMismatch"
            :total="filterError ? null : (response?.meta.total ?? null)"
            :selected-id="categoryId"
            :has-category="route.query.categoryId !== undefined"
            :ready="readyBranch !== null"
            :state="baselineState"
            @select="selectCategory"
            @retry="retryBaseline"
          />
        </div>
        <div v-if="filterError && readyBranch" class="catalog-container py-6" role="status">
          <p>{{ filterError === 'category' ? 'Categoría no válida.' : 'Página no válida.' }}</p>
          <button
            v-if="filterError === 'category'"
            type="button"
            class="catalog-filter-button"
            @click="selectCategory(null)"
          >
            Limpiar categoría
          </button>
          <button v-else type="button" class="catalog-filter-button" @click="recoverPage">
            Restablecer página
          </button>
        </div>
        <div
          v-else-if="isPageOutOfRange"
          class="catalog-container catalog-range-recovery"
          role="status"
        >
          <h2>Página fuera de rango</h2>
          <button
            type="button"
            class="catalog-filter-button"
            @click="navigatePage(lastAvailablePage)"
          >
            Ir a la última página disponible
          </button>
        </div>
        <CatalogProductGrid
          v-else
          :selection-state="selectionState"
          :branches-state="branchesState"
          :products="products"
          :state="productsState"
          :context-state="contextState"
          @retry="retryProducts"
          @retry-branches="retryBranches"
          @retry-context="retryPriceContexts"
          @open-detail="openDetail"
        />
        <div v-if="showPager && paginationMeta" class="catalog-container">
          <nav class="catalog-pagination" aria-label="Paginación del catálogo">
            <button
              type="button"
              class="catalog-filter-button"
              :disabled="paginationMeta.page <= 1"
              @click="navigatePage(paginationMeta.page - 1)"
            >
              Anterior
            </button>
            <span role="status" aria-live="polite">
              Página {{ paginationMeta.page }} de {{ paginationMeta.totalPages }}
            </span>
            <button
              type="button"
              class="catalog-filter-button"
              :disabled="paginationMeta.page >= paginationMeta.totalPages"
              @click="navigatePage(paginationMeta.page + 1)"
            >
              Siguiente
            </button>
          </nav>
        </div>
      </section>
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
