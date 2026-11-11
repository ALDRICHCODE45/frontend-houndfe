<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import CatalogHeader from '../components/CatalogHeader.vue'
import CatalogHero from '../components/CatalogHero.vue'
import CatalogFacetFilters from '../components/CatalogFacetFilters.vue'
import CatalogFooter from '../components/CatalogFooter.vue'
import CatalogListingActiveFilters, {
  type CatalogActiveFilterChip,
} from '../components/CatalogListingActiveFilters.vue'
import CatalogListingCategoryMenu from '../components/CatalogListingCategoryMenu.vue'
import CatalogListingHeading from '../components/CatalogListingHeading.vue'
import CatalogListingHeroBar from '../components/CatalogListingHeroBar.vue'
import CatalogListingNoResults from '../components/CatalogListingNoResults.vue'
import CatalogListingPager, { resultsRangeLabel } from '../components/CatalogListingPager.vue'
import CatalogListingSearch from '../components/CatalogListingSearch.vue'
import CatalogListingSort from '../components/CatalogListingSort.vue'
import CatalogProductGrid, {
  type CatalogProductContextState,
} from '../components/CatalogProductGrid.vue'
import { useCatalogBranches } from '../composables/useCatalogBranches'
import { useCatalogProducts } from '../composables/useCatalogProducts'
import { useCatalogPriceContexts } from '../composables/useCatalogPriceContexts'
import type { PublicCatalogPriceContextDto } from '../interfaces/public-catalog-price-context.types'
import type {
  CatalogProductsSort,
  PublicCatalogAttributeFacetDto,
} from '../interfaces/public-catalog-products.types'
import { mergeFacetOptions } from '../utils/facet-options'

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
const search = computed(() => {
  const raw = route.query.q
  return raw === undefined ? '' : typeof raw === 'string' ? raw : null
})
/**
 * Attribute facet tokens from the URL (`facet=<definition>:<option>`, repeatable). Malformed
 * values are ignored rather than blocking the listing; duplicates collapse and at most 50 are sent.
 */
const FACET_TOKEN = /^[A-Za-z0-9._-]{1,120}:[A-Za-z0-9._-]{1,120}$/
const MAX_FACETS = 50
const facetTokens = computed<string[]>(() => {
  const raw = route.query.facet
  const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
  const tokens: string[] = []
  for (const value of values) {
    if (typeof value !== 'string' || !FACET_TOKEN.test(value) || tokens.includes(value)) continue
    tokens.push(value)
    if (tokens.length === MAX_FACETS) break
  }
  return tokens
})
const searchDraft = shallowRef('')
watch(
  () => route.fullPath,
  () => {
    searchDraft.value = search.value ?? ''
  },
  { immediate: true },
)
async function commitSearch(value: string) {
  const query = { ...route.query }
  delete query.page
  if (value === '') delete query.q
  else query.q = value
  try {
    await router.push({ query, hash: route.hash })
  } catch {
    // Rejected and aborted navigation never commits a draft or requests products.
  } finally {
    searchDraft.value = search.value ?? ''
  }
}
const filterError = computed(() => {
  if (search.value === null) return 'search'
  if (route.query.categoryId !== undefined && categoryId.value === null) return 'category'
  return page.value === null ? 'page' : null
})
/** Only the two price orders travel; anything else (absent, `newest`, unknown) is the default. */
const sort = computed<CatalogProductsSort>(() => {
  const raw = route.query.sort
  return raw === 'price_asc' || raw === 'price_desc' ? raw : 'newest'
})
const listingOptions = computed(() => ({
  ...(search.value !== null && search.value !== '' ? { q: search.value } : {}),
  ...(categoryId.value !== null ? { categoryId: categoryId.value } : {}),
  ...(page.value !== null && page.value !== 1 ? { page: page.value } : {}),
  ...(facetTokens.value.length > 0 ? { facets: facetTokens.value } : {}),
  ...(sort.value !== 'newest' ? { sort: sort.value } : {}),
}))
/**
 * The full hero belongs to the unfiltered first page. Any filter, search or page past the
 * first shrinks it to a bar so the listing moves up; the order alone is not a filter.
 */
const isHome = computed(
  () =>
    page.value === 1 &&
    (route.query.q === undefined || route.query.q === '') &&
    route.query.categoryId === undefined &&
    facetTokens.value.length === 0,
)
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
/**
 * The categories come from the same listing as the products: when the listing
 * already shows its failure, the categories do not say it a second time, and the
 * one Reintentar recovers both.
 */
const FAILED_STATES = ['unavailable', 'rate-limit', 'server', 'network']
const listingFailed = computed(
  () => readyBranch.value !== null && FAILED_STATES.includes(productsState.value),
)
function retryListing() {
  retryProducts()
  if (FAILED_STATES.includes(baselineState.value)) retryBaseline()
}

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
/** A catalog with no product at all (no search, no category, in range): its filters have nothing to filter. */
const isCatalogEmpty = computed(
  () =>
    readyBranch.value !== null &&
    productsState.value === 'empty' &&
    filterError.value === null &&
    route.query.q === undefined &&
    route.query.categoryId === undefined &&
    facetTokens.value.length === 0 &&
    !isPageOutOfRange.value,
)

/**
 * Facet chips come from the current filtered listing. While the next selection loads, the last
 * chips stay mounted so the pressed chip keeps focus and the band does not collapse.
 */
const displayedFacets = shallowRef<PublicCatalogAttributeFacetDto[]>([])
watch(
  response,
  (current) => {
    if (current !== null) displayedFacets.value = current.facets.attributes ?? []
  },
  { immediate: true },
)
watch([readyBranch, requestedPrice, listingFailed], ([branch, , failed], [oldBranch, oldPrice]) => {
  if (failed || branch !== oldBranch || requestedPrice.value !== oldPrice)
    displayedFacets.value = response.value?.facets.attributes ?? []
})
const showFacets = computed(
  () => readyBranch.value !== null && filterError.value === null && !isCatalogEmpty.value,
)

async function writeFacets(tokens: string[], replace = false) {
  const query = { ...route.query }
  delete query.page
  if (tokens.length === 0) delete query.facet
  else query.facet = tokens.length === 1 ? tokens[0]! : tokens
  try {
    await (replace ? router.replace : router.push)({ query, hash: route.hash })
  } catch {
    // Keep the current route authoritative.
  }
}
/** A chip carries one token, or several when same-label options were merged into it. */
function toggleFacet(chipTokens: string[]) {
  const tokens = facetTokens.value
  const pressed = chipTokens.some((token) => tokens.includes(token))
  void writeFacets(
    pressed
      ? tokens.filter((entry) => !chipTokens.includes(entry))
      : [...tokens, ...chipTokens.filter((token) => !tokens.includes(token))],
  )
}
/**
 * A vocabulary change or the switch turning off makes a facet unknown. The error carries no
 * reliable token, so every facet leaves the URL (replaced, not pushed) and the list reloads.
 */
watch(
  () => productsState.value === 'facet-unavailable',
  (stale) => {
    if (stale) void writeFacets([], true)
  },
)
/** A stale facet is recovered by navigation, never shown as a product failure. */
const gridState = computed(() =>
  productsState.value === 'facet-unavailable' ? 'loading' : productsState.value,
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

/** Pushes a query built from the current one; the committed URL stays authoritative on rejection. */
async function pushQuery(edit: (query: Record<string, unknown>) => void) {
  const query = { ...route.query } as Record<string, unknown>
  edit(query)
  try {
    await router.push({ query: query as typeof route.query, hash: route.hash })
  } catch {
    // Keep the current route authoritative.
  }
}

/** A new order starts again at the first page. */
function selectSort(next: CatalogProductsSort) {
  void pushQuery((query) => {
    delete query.page
    if (next === 'newest') delete query.sort
    else query.sort = next
  })
}

/** The selected category's name comes from the real facets or the cards; never a raw id. */
const selectedCategoryName = computed(() => {
  if (categoryId.value === null) return null
  const facet = categoryBaseline.value?.facets.categories.find(
    (category) => category.id === categoryId.value,
  )
  if (facet) return facet.name
  return products.value.find((product) => product.category?.id === categoryId.value)?.category?.name ?? null
})
/** Selected facet tokens grouped as the chips show them; tokens no facet labels stay one chip. */
const facetChips = computed<CatalogActiveFilterChip[]>(() => {
  const selected = new Set(facetTokens.value)
  const chips: CatalogActiveFilterChip[] = []
  const labelled = new Set<string>()
  for (const definition of displayedFacets.value) {
    for (const option of mergeFacetOptions(definition)) {
      const tokens = option.tokens.filter((token) => selected.has(token))
      if (tokens.length === 0) continue
      tokens.forEach((token) => labelled.add(token))
      chips.push({ kind: 'facet', key: tokens[0]!, label: option.label, tokens })
    }
  }
  const rest = facetTokens.value.filter((token) => !labelled.has(token))
  if (rest.length > 0)
    chips.push({ kind: 'facet', key: 'facet-rest', label: 'Otros filtros', tokens: rest })
  return chips
})
const activeChips = computed<CatalogActiveFilterChip[]>(() => [
  ...(route.query.categoryId !== undefined
    ? [{ kind: 'category' as const, key: 'category', label: selectedCategoryName.value ?? 'Categoría' }]
    : []),
  ...facetChips.value,
  ...(search.value ? [{ kind: 'search' as const, key: 'search', label: search.value }] : []),
])
const filterChips = computed(() => activeChips.value.filter((chip) => chip.kind !== 'search'))

function removeChip(chip: CatalogActiveFilterChip) {
  if (chip.kind === 'search') void commitSearch('')
  else if (chip.kind === 'category') void selectCategory(null)
  else void writeFacets(facetTokens.value.filter((token) => !chip.tokens?.includes(token)))
}
/** «Limpiar todo» drops every filter and the search; the order and the price list stay. */
function clearAll() {
  void pushQuery((query) => {
    for (const key of ['q', 'categoryId', 'facet', 'page']) delete query[key]
  })
}
function removeOnlyFilter() {
  const [chip] = filterChips.value
  if (chip) removeChip(chip)
}

const listingReady = computed(
  () => readyBranch.value !== null && filterError.value === null && !isCatalogEmpty.value,
)
const showNoResults = computed(
  () =>
    readyBranch.value !== null &&
    filterError.value === null &&
    productsState.value === 'empty' &&
    !isPageOutOfRange.value &&
    activeChips.value.length > 0,
)
const rangeLabel = computed(() =>
  paginationMeta.value && productsState.value === 'populated'
    ? resultsRangeLabel(paginationMeta.value)
    : null,
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
    >
      <template v-if="readyBranch !== null && !isCatalogEmpty" #categories>
        <CatalogListingCategoryMenu
          :categories="categoryBaseline?.facets.categories ?? []"
          :all-total="categoryBaseline?.meta.total ?? null"
          :selected-id="categoryId"
          :state="baselineState"
          :context-mismatch="baselineContextMismatch"
          :combined-error="listingFailed"
          @select="selectCategory"
          @retry="retryBaseline"
        />
      </template>
      <template v-if="readyBranch !== null && !isCatalogEmpty" #search>
        <CatalogListingSearch v-model="searchDraft" @submit="commitSearch" />
      </template>
    </CatalogHeader>
    <main class="catalog-main flex-1">
      <div class="catalog-container">
        <CatalogHero v-if="isHome" :branch-name="selectedBranch?.name ?? null" />
        <CatalogListingHeroBar v-else :branch-name="selectedBranch?.name ?? null" />
      </div>
      <section
        id="catalogo"
        tabindex="-1"
        aria-label="Catálogo de productos"
        class="catalog-listing"
      >
        <div class="catalog-container">
          <CatalogListingHeading
            :total="filterError || isCatalogEmpty ? null : (response?.meta.total ?? null)"
            :branch-name="selectedBranch?.name ?? null"
          />
          <CatalogFacetFilters
            v-if="showFacets"
            :facets="displayedFacets"
            :selected="facetTokens"
            @toggle="toggleFacet"
            @clear="writeFacets([])"
          />
          <div v-if="listingReady" class="catalog-results-toolbar">
            <CatalogListingActiveFilters
              v-if="activeChips.length > 0"
              :chips="activeChips"
              @remove="removeChip"
              @clear="clearAll"
            />
            <p v-else-if="rangeLabel" class="catalog-results-range">{{ rangeLabel }}</p>
            <CatalogListingSort :model-value="sort" @update:model-value="selectSort" />
          </div>
        </div>
        <div v-if="filterError && readyBranch" class="catalog-container">
          <EmptyState
            kind="empty"
            :title="
              filterError === 'search'
                ? 'Búsqueda no válida.'
                : filterError === 'category'
                  ? 'Categoría no válida.'
                  : 'Página no válida.'
            "
            :action-label="
              filterError === 'search'
                ? 'Limpiar búsqueda'
                : filterError === 'category'
                  ? 'Limpiar categoría'
                  : 'Restablecer página'
            "
            action-icon="i-lucide-rotate-ccw"
            action-test-id="catalog-filter-recover"
            @action="
              filterError === 'search'
                ? commitSearch('')
                : filterError === 'category'
                  ? selectCategory(null)
                  : recoverPage()
            "
          />
        </div>
        <div v-else-if="isPageOutOfRange" class="catalog-container">
          <EmptyState
            kind="empty"
            title="Página fuera de rango"
            action-label="Ir a la última página disponible"
            action-icon="i-lucide-chevrons-right"
            action-test-id="catalog-filter-recover"
            @action="navigatePage(lastAvailablePage)"
          />
        </div>
        <div v-else-if="showNoResults" class="catalog-container py-6 lg:py-8">
          <CatalogListingNoResults
            :search="search ?? ''"
            :filter-labels="filterChips.map((chip) => chip.label)"
            :categories="categoryBaseline?.facets.categories ?? []"
            :selected-category-id="categoryId"
            @clear-all="clearAll"
            @remove-filter="removeOnlyFilter"
            @clear-search="commitSearch('')"
            @select-category="selectCategory"
          />
        </div>
        <CatalogProductGrid
          v-else
          :selection-state="selectionState"
          :branches-state="branchesState"
          :branches="branches"
          :products="products"
          :state="gridState"
          :context-state="contextState"
          @retry="retryListing"
          @retry-branches="retryBranches"
          @retry-context="retryPriceContexts"
          @select-branch="selectBranch"
        />
        <div v-if="showPager && paginationMeta" class="catalog-container">
          <CatalogListingPager
            :page="paginationMeta.page"
            :total-pages="paginationMeta.totalPages"
            :total="paginationMeta.total"
            :limit="paginationMeta.limit"
            @navigate="navigatePage"
          />
        </div>
      </section>
    </main>

    <CatalogFooter :branch-name="selectedBranch?.name ?? null" />
  </div>
</template>
