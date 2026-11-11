<script setup lang="ts">
import { computed } from 'vue'
import {
  RouterLink,
  useRoute,
  useRouter,
  type LocationQuery,
  type RouteLocationRaw,
} from 'vue-router'
import CatalogHeader from '../components/CatalogHeader.vue'
import CatalogFooter from '../components/CatalogFooter.vue'
import CatalogDetailContent from '../components/CatalogDetailContent.vue'
import CatalogDetailNotice from '../components/CatalogDetailNotice.vue'
import CatalogDetailSkeleton from '../components/CatalogDetailSkeleton.vue'
import { useCatalogBranches } from '../composables/useCatalogBranches'
import { useCatalogBranchDetail } from '../composables/useCatalogBranchDetail'
import { useCatalogPriceContexts } from '../composables/useCatalogPriceContexts'
import { useCatalogProductDetail } from '../composables/useCatalogProductDetail'
import { buildSharePreviewUrl } from '../utils/whatsapp'
import '../styles/catalog-detail.css'

const route = useRoute()
const router = useRouter()

function routeParam(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}
const branchSlug = computed(() => routeParam(route.params.branchSlug))
const productId = computed(() => routeParam(route.params.productId))

const { branches, state: branchesState, retry: retryBranches } = useCatalogBranches()
const selectedBranch = computed(
  () => branches.value.find((branch) => branch.slug === branchSlug.value) ?? null,
)
/** The branch card is an extra: a failure or a backend without it simply leaves it out. */
const { branch: branchDetail } = useCatalogBranchDetail(() => selectedBranch.value?.slug ?? null)
const whatsappNumber = computed(
  () => selectedBranch.value?.whatsappNumber || branchDetail.value?.whatsappNumber || null,
)
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const branchesSettled = computed(
  () => branchesState.value === 'populated' || branchesState.value === 'empty',
)

/** Price lists are only discovered for a branch that publishes its catalog. */
const {
  contexts,
  state: contextsState,
  retry: retryContexts,
} = useCatalogPriceContexts(computed(() => selectedBranch.value?.slug ?? null))

/** The listing's price list travels in the query; without one, the branch default applies. */
const requestedPriceListId = computed(() => routeParam(route.query.priceListId))
const defaultPriceListId = computed(
  () => contexts.value.find((context) => context.isCatalogDefault)?.priceListId ?? null,
)
const priceListId = computed(() => requestedPriceListId.value ?? defaultPriceListId.value)

const {
  detail,
  state: detailState,
  retry: retryDetail,
} = useCatalogProductDetail(
  computed(() => selectedBranch.value?.slug ?? null),
  computed(() => (selectedBranch.value ? productId.value : null)),
  priceListId,
)

type PageState =
  | 'loading'
  | 'branches-error'
  | 'branch-unavailable'
  | 'contexts-error'
  | 'no-price-list'
  | 'not-found'
  | 'detail-error'
  | 'populated'

const pageState = computed<PageState>(() => {
  if (!branchesSettled.value) {
    return branchesState.value === 'loading' || branchesState.value === 'retry-pending'
      ? 'loading'
      : 'branches-error'
  }
  if (!selectedBranch.value) return 'branch-unavailable'
  if (requestedPriceListId.value === null) {
    switch (contextsState.value) {
      case 'idle':
      case 'loading':
      case 'retry-pending':
        return 'loading'
      case 'rate-limit':
      case 'network':
      case 'server':
        return 'contexts-error'
      default:
        if (defaultPriceListId.value === null) return 'no-price-list'
    }
  }
  switch (detailState.value) {
    case 'populated':
      return detail.value ? 'populated' : 'loading'
    case 'not-found':
      return 'not-found'
    case 'rate-limit':
    case 'network':
    case 'server':
      return 'detail-error'
    default:
      return 'loading'
  }
})

const detailErrorCopy = computed(() => {
  switch (detailState.value) {
    case 'rate-limit':
      return 'Hay muchas consultas seguidas. Espera unos segundos y vuelve a intentarlo.'
    case 'network':
      return 'Revisa tu conexión e inténtalo de nuevo.'
    default:
      return 'Algo falló de nuestro lado. Inténtalo de nuevo en un momento.'
  }
})

/** Only the price list survives into links that start a new listing (crumbs, share). */
const priceListQuery = computed<LocationQuery>(() => {
  const query: LocationQuery = {}
  if (requestedPriceListId.value) query.priceListId = requestedPriceListId.value
  return query
})
const listingParams = computed(() => ({ branchSlug: branchSlug.value ?? '' }))
/** The back link returns to the exact listing the card came from: its whole query travels along. */
const backTo = computed<RouteLocationRaw>(() => ({
  name: 'public-catalog',
  params: listingParams.value,
  query: route.query,
}))
const catalogTo = computed<RouteLocationRaw>(() => ({
  name: 'public-catalog',
  params: listingParams.value,
  query: priceListQuery.value,
}))
const categoryCrumb = computed(() => {
  const category = detail.value?.category
  if (!category) return null
  return {
    name: category.name,
    to: {
      name: 'public-catalog',
      params: listingParams.value,
      query: { ...priceListQuery.value, categoryId: category.id },
    } satisfies RouteLocationRaw,
  }
})
const backLabel = computed(() => {
  const category = detail.value?.category
  return category && route.query.categoryId === category.id
    ? `Volver a ${category.name}`
    : 'Volver al catálogo'
})

/** The storefront URL of this page: what a WhatsApp message names. */
const pageUrl = computed(() => {
  const href = router.resolve({
    name: 'public-catalog-product',
    params: { branchSlug: branchSlug.value ?? '', productId: productId.value ?? '' },
    query: priceListQuery.value,
  }).href
  return new URL(href, window.location.origin).href
})
/** Sharing uses the backend preview route (API host), so crawlers read the Open Graph tags. */
const shareUrl = computed(() =>
  buildSharePreviewUrl(
    apiBase,
    branchSlug.value ?? '',
    productId.value ?? '',
    requestedPriceListId.value,
  ),
)

const selectedPriceListId = computed(
  () => detail.value?.priceContext.priceListId ?? priceListId.value,
)

async function selectBranch(slug: string) {
  try {
    await router.push({ name: 'public-catalog', params: { branchSlug: slug } })
  } catch {
    // The committed route stays authoritative.
  }
}

async function selectPriceContext(id: string) {
  if (id.trim().length === 0) return
  try {
    await router.replace({ query: { ...route.query, priceListId: id }, hash: route.hash })
  } catch {
    // The committed route stays authoritative.
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <CatalogHeader
      :branches="branches"
      :state="branchesState"
      :selected-branch="selectedBranch"
      :price-context-options="contexts"
      :price-contexts-state="contextsState"
      :selected-price-list-id="selectedPriceListId"
      @retry="retryBranches"
      @select="selectBranch"
      @select-price-context="selectPriceContext"
      @retry-price-contexts="retryContexts"
    />
    <main id="contenido" class="catalog-main catalog-pdp-main flex-1" tabindex="-1">
      <div class="catalog-container">
        <CatalogDetailSkeleton v-if="pageState === 'loading'" />

        <CatalogDetailContent
          v-else-if="pageState === 'populated' && detail"
          :detail="detail"
          :branch-name="selectedBranch?.name ?? null"
          :catalog-to="catalogTo"
          :category="categoryCrumb"
          :back-to="backTo"
          :back-label="backLabel"
          :share-url="shareUrl"
          :page-url="pageUrl"
          :whatsapp-number="whatsappNumber"
          :branch-detail="branchDetail"
        />

        <CatalogDetailNotice
          v-else-if="pageState === 'not-found'"
          title="Este producto ya no está disponible"
          description="Pudo haberse retirado o cambiado de sucursal. Mira lo que hay disponible hoy."
        >
          <RouterLink class="catalog-pdp-button catalog-pdp-button--primary" :to="backTo">
            Ver el catálogo
          </RouterLink>
        </CatalogDetailNotice>

        <CatalogDetailNotice
          v-else-if="pageState === 'branch-unavailable'"
          icon="i-lucide-store"
          title="Esta sucursal aún no publica su catálogo"
          :description="
            branches.length > 0
              ? 'Puedes ver el catálogo de otra sucursal.'
              : 'Por ahora no hay sucursales con catálogo publicado.'
          "
        >
          <RouterLink
            v-for="branch in branches"
            :key="branch.id"
            class="catalog-pdp-button"
            :to="{ name: 'public-catalog', params: { branchSlug: branch.slug } }"
          >
            Ver catálogo de {{ branch.name }}
          </RouterLink>
        </CatalogDetailNotice>

        <CatalogDetailNotice
          v-else-if="pageState === 'no-price-list'"
          icon="i-lucide-tags"
          title="Esta sucursal aún no publica precios"
          description="Mira el catálogo de la sucursal mientras tanto."
        >
          <RouterLink class="catalog-pdp-button catalog-pdp-button--primary" :to="backTo">
            Ver el catálogo
          </RouterLink>
        </CatalogDetailNotice>

        <CatalogDetailNotice
          v-else
          tone="alert"
          icon="i-lucide-triangle-alert"
          :title="
            pageState === 'branches-error'
              ? 'No pudimos cargar las sucursales'
              : pageState === 'contexts-error'
                ? 'No pudimos cargar las listas de precios'
                : 'No pudimos cargar el producto'
          "
          :description="
            pageState === 'detail-error'
              ? detailErrorCopy
              : 'Revisa tu conexión e inténtalo de nuevo.'
          "
        >
          <button
            data-testid="catalog-detail-retry"
            class="catalog-pdp-button catalog-pdp-button--primary"
            type="button"
            @click="
              pageState === 'branches-error'
                ? retryBranches()
                : pageState === 'contexts-error'
                  ? retryContexts()
                  : retryDetail()
            "
          >
            <UIcon name="i-lucide-rotate-ccw" class="size-4" aria-hidden="true" />
            Reintentar
          </button>
        </CatalogDetailNotice>
      </div>
    </main>
    <CatalogFooter :branch-name="selectedBranch?.name ?? null" />
  </div>
</template>
