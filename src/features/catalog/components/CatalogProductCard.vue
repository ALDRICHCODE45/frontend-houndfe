<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import CatalogWhatsappLink from './CatalogWhatsappLink.vue'
import { useCachedCatalogBranch } from '../composables/useCatalogBranches'
import { catalogAvailabilityConfig } from '../utils/availability'
import { exactQuantityLabel } from '../utils/detail-presentation'
import { normalizeWhatsappNumber, productInquiryMessage } from '../utils/whatsapp'
import type { PublicCatalogProductDto } from '../interfaces/public-catalog-products.types'
import '../styles/catalog-extras.css'

const props = defineProps<{ product: PublicCatalogProductDto }>()
const emit = defineEmits<{
  /** Kept for listeners of the former in-page detail; the link itself performs the navigation. */
  'open-detail': [productId: string, invoker: HTMLElement]
}>()
const route = useRoute()
const router = useRouter()

/**
 * The card opens the product page of the branch being browsed. The listing query (price list,
 * category, search, page, facets) travels along so the page keeps the price list and can lead
 * back to the same listing.
 */
const productLocation = computed<RouteLocationRaw | null>(() => {
  const branchSlug = route.params.branchSlug
  if (typeof branchSlug !== 'string' || branchSlug.length === 0) return null
  return {
    name: 'public-catalog-product',
    params: { branchSlug, productId: props.product.id },
    query: route.query,
  }
})
/**
 * The failure is keyed to the exact URL that failed, so a new URL on the same mounted card is always
 * attempted instead of staying suppressed by a stale failure.
 */
const failedImageUrl = ref<string | null>(null)
const productImageUrl = computed(() => props.product.image?.url ?? null)
const showImage = computed(
  () => productImageUrl.value !== null && failedImageUrl.value !== productImageUrl.value,
)

watch(
  () => props.product.id,
  () => {
    // A different product is a different media set: a stale failure must never suppress its image.
    failedImageUrl.value = null
  },
)

function markImageFailed() {
  failedImageUrl.value = productImageUrl.value
}

const priceCents = computed(() => {
  const value = props.product.price.fromPriceCents ?? props.product.price.priceCents
  return typeof value === 'number' && Number.isInteger(value) ? value : null
})
const formattedPrice = computed(() => {
  const cents = priceCents.value
  return !props.product.price.hidden && cents !== null ? formatCentsMXN(cents) : null
})
const availability = computed(() => {
  const presentation = props.product.stockPresentation
  if (presentation.mode === 'HIDDEN' || presentation.status === null) return null
  const config = catalogAvailabilityConfig[presentation.status]
  // The real quantity (opt-in exact mode) replaces the generic low-stock wording.
  const exact = exactQuantityLabel(presentation)
  return exact ? { ...config, label: exact } : config
})
const isOut = computed(() => props.product.stockPresentation.status === 'out_of_stock')

/** WhatsApp: the number and branch name come from the cached branches query, never a prop. */
const branchSlug = computed(() => {
  const slug = route.params.branchSlug
  return typeof slug === 'string' && slug.length > 0 ? slug : null
})
const { branch } = useCachedCatalogBranch(branchSlug)
const hasWhatsapp = computed(() => normalizeWhatsappNumber(branch.value?.whatsappNumber) !== null)
const pageUrl = computed(() => {
  if (!branchSlug.value) return ''
  const priceListId = route.query.priceListId
  const href = router.resolve({
    name: 'public-catalog-product',
    params: { branchSlug: branchSlug.value, productId: props.product.id },
    query: typeof priceListId === 'string' && priceListId ? { priceListId } : {},
  }).href
  return new URL(href, window.location.origin).href
})
const whatsappMessage = computed(() =>
  productInquiryMessage({
    productName: props.product.name,
    presentationName: null,
    branchName: branch.value?.name ?? null,
    url: pageUrl.value,
    outOfStock: isOut.value,
  }),
)
const whatsappLabel = computed(() => (isOut.value ? 'Preguntar' : 'Pedir'))
const presentationQuantity = computed(() => {
  const presentation = props.product.stockPresentation
  return presentation.mode === 'CUSTOM_QUANTITY' && presentation.customQuantity !== null
    ? `${presentation.customQuantity} unidades`
    : null
})

function openDetail(event: MouseEvent) {
  if (!(event.currentTarget instanceof HTMLElement)) return
  emit('open-detail', props.product.id, event.currentTarget)
}
</script>

<template>
  <article
    class="catalog-card-cell h-full min-w-0"
    :class="{ 'catalog-card-cell--wa': hasWhatsapp }"
  >
    <component
      :is="productLocation ? RouterLink : 'div'"
      :to="productLocation ?? undefined"
      :aria-label="`Ver detalles de ${product.name}`"
      :data-catalog-product-id="product.id"
      class="catalog-product-card group flex h-full w-full min-w-0 flex-col overflow-hidden border border-default bg-default text-left"
      @click="openDetail"
    >
      <div
        data-testid="catalog-product-media"
        class="catalog-product-media relative w-full shrink-0 overflow-hidden"
      >
        <img
          v-if="showImage && productImageUrl"
          class="catalog-product-image object-contain"
          :src="productImageUrl"
          :alt="`Imagen de ${product.name}`"
          @error="markImageFailed"
        />
        <div
          v-else
          data-testid="catalog-product-image-fallback"
          class="catalog-product-fallback flex size-full flex-col items-center justify-center text-center"
          :aria-label="`Imagen no disponible para ${product.name}`"
          role="img"
        >
          <!-- Honest media absence: one contained glyph and the written state, never an invented URL. -->
          <UIcon name="i-lucide-image-off" class="size-6" />
          <span class="text-xs font-medium">Imagen no disponible</span>
        </div>

        <span
          v-if="availability"
          data-testid="catalog-product-availability"
          class="catalog-availability catalog-product-availability inline-flex max-w-full items-center gap-1.5"
          :data-tone="availability.tone"
        >
          <span class="catalog-availability-dot" aria-hidden="true" />
          <span class="text-xs font-semibold">{{ availability.label }}</span>
        </span>
      </div>

      <div
        data-testid="catalog-product-body"
        class="catalog-product-body flex w-full min-w-0 flex-1 flex-col"
      >
        <p
          v-if="product.brand"
          data-testid="catalog-product-brand"
          class="catalog-product-brand break-words font-medium text-muted"
        >
          {{ product.brand.name }}
        </p>
        <h2 class="catalog-product-name break-words font-semibold text-highlighted">
          {{ product.name }}
        </h2>
        <p
          v-if="product.category"
          data-testid="catalog-product-category"
          class="catalog-product-category break-words text-sm text-muted"
        >
          {{ product.category.name }}
        </p>

        <p
          v-if="product.hasVariants && formattedPrice"
          class="catalog-product-price-note text-muted"
        >
          Desde
        </p>
        <div
          class="catalog-product-price-row flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-1"
        >
          <p
            v-if="formattedPrice"
            data-testid="catalog-product-price"
            class="catalog-product-price min-w-0 break-words font-semibold tracking-tight text-highlighted tabular-nums"
          >
            {{ formattedPrice }}
          </p>
          <p
            v-else
            data-testid="catalog-product-price"
            class="min-w-0 break-words text-sm font-medium text-muted"
          >
            Consultar precio
          </p>
          <span
            v-if="presentationQuantity"
            data-testid="catalog-product-quantity"
            class="min-w-0 break-words text-sm font-medium text-muted tabular-nums"
          >
            {{ presentationQuantity }}
          </span>
        </div>
        <!-- Quiet affordance: the whole card is the link, this only says where it leads. -->
        <span
          data-testid="catalog-product-action"
          class="catalog-product-action"
          aria-hidden="true"
        >
          <template v-if="product.hasVariants">
            <span class="hidden sm:inline">Elegir presentación</span>
            <span class="sm:hidden">Elegir</span>
          </template>
          <template v-else>
            <span class="hidden sm:inline">Ver detalle</span>
            <span class="sm:hidden">Ver</span>
          </template>
          <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0" aria-hidden="true" />
        </span>
      </div>
    </component>
    <!-- Outside the card link: a link inside a link is invalid, and the control has its own target. -->
    <CatalogWhatsappLink
      v-if="hasWhatsapp"
      class="catalog-card-wa"
      variant="icon"
      :number="branch?.whatsappNumber"
      :message="whatsappMessage"
      :label="`${whatsappLabel} por WhatsApp`"
      :aria-label="`${whatsappLabel} por WhatsApp: ${product.name}`"
      :secondary="isOut"
    />
  </article>
</template>
