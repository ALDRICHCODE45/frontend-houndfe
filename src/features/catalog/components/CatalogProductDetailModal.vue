<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { CatalogProductDetailState } from '../composables/useCatalogProductDetail'
import type {
  PublicCatalogProductDetailAvailability,
  PublicCatalogProductDetailDto,
  PublicCatalogProductDetailStockPresentationDto,
} from '../interfaces/public-catalog-product-detail.types'

const props = defineProps<{
  open: boolean
  detail: PublicCatalogProductDetailDto | null
  state: CatalogProductDetailState
}>()
const emit = defineEmits<{
  close: []
  retry: []
}>()

/** Variant media failures are tracked per variant and keyed by the exact URL that failed. */
const failedVariantImageUrls = ref<Record<string, string>>({})

function markVariantImageFailed(variantId: string, url: string | null) {
  if (url === null) return
  failedVariantImageUrls.value = { ...failedVariantImageUrls.value, [variantId]: url }
}

const displayImage = computed(() => {
  if (!props.detail) return null
  return props.detail.images.find((image) => image.isMain) ?? props.detail.images[0] ?? null
})
/**
 * The main image failure is keyed to the exact URL that failed, so a different display image under the
 * same detail identity is attempted instead of staying suppressed by a stale failure.
 */
const failedMainImageUrl = ref<string | null>(null)
const displayImageUrl = computed(() => displayImage.value?.url ?? null)
const mainImageFailed = computed(
  () => displayImageUrl.value !== null && failedMainImageUrl.value === displayImageUrl.value,
)

function markMainImageFailed() {
  failedMainImageUrl.value = displayImageUrl.value
}
const isLoading = computed(() => props.state === 'loading' || props.state === 'retry-pending')
const canRetry = computed(() => ['rate-limit', 'network', 'server'].includes(props.state))

/**
 * Availability is a semantic status, never a commerce affordance: the tinted pill only repeats the
 * strict DTO status, and the dot always travels with the written label.
 */
const availabilityConfig = {
  available: {
    label: 'Disponible',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    pill: 'bg-emerald-50 ring-emerald-200/80 dark:bg-emerald-950/40 dark:ring-emerald-900',
  },
  low_stock: {
    label: 'Pocas piezas',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    pill: 'bg-amber-50 ring-amber-200/80 dark:bg-amber-950/40 dark:ring-amber-900',
  },
  out_of_stock: {
    label: 'Agotado',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
    pill: 'bg-red-50 ring-red-200/80 dark:bg-red-950/40 dark:ring-red-900',
  },
} as const

function displayAvailability(
  presentation: PublicCatalogProductDetailStockPresentationDto,
  availability: PublicCatalogProductDetailAvailability,
) {
  if (presentation.mode === 'HIDDEN' || availability === null) return null
  return availabilityConfig[availability]
}

function displayQuantity(presentation: PublicCatalogProductDetailStockPresentationDto) {
  return presentation.mode === 'CUSTOM_QUANTITY' && presentation.customQuantity !== null
    ? `${presentation.customQuantity} unidades`
    : null
}

function displayPrice(price: { priceCents: number | null; hidden: boolean }) {
  return !price.hidden && price.priceCents !== null ? formatCentsMXN(price.priceCents) : null
}

const detailPrice = computed(() =>
  props.detail ? displayPrice(props.detail.price) : (null as string | null),
)
const detailQuantity = computed(() =>
  props.detail ? displayQuantity(props.detail.stockPresentation) : (null as string | null),
)
const detailAvailability = computed(() =>
  props.detail
    ? displayAvailability(props.detail.stockPresentation, props.detail.availability)
    : null,
)

/** Read-only variant cards. Only the branch selected by the route resolution is reported. */
const variants = computed(() =>
  (props.detail?.variants ?? []).map((variant) => {
    const selectedBranch = variant.availabilityByBranch.find((entry) => entry.isSelected) ?? null
    const imageUrl = variant.image?.url ?? null
    return {
      id: variant.id,
      name: variant.name,
      optionValue: [variant.option, variant.value].filter(Boolean).join(': '),
      imageUrl,
      imageAlt: `Imagen de la variante ${variant.name}`,
      imageFailed: imageUrl !== null && failedVariantImageUrls.value[variant.id] === imageUrl,
      price: displayPrice(variant.price),
      quantity: displayQuantity(variant.stockPresentation),
      availability: displayAvailability(
        variant.stockPresentation,
        selectedBranch?.availability ?? null,
      ),
    }
  }),
)

function errorCopy(state: CatalogProductDetailState) {
  switch (state) {
    case 'not-found':
      return 'Este producto ya no está disponible en esta sucursal.'
    case 'rate-limit':
      return 'Hay muchas solicitudes en este momento. Intenta de nuevo en unos momentos.'
    case 'network':
      return 'No se pudo conectar para cargar el detalle. Revisa tu conexión.'
    default:
      return 'No pudimos cargar el detalle del producto. Intenta de nuevo.'
  }
}

function close() {
  emit('close')
}

function handleModalOpen(value: boolean) {
  if (!value) close()
}

watch(
  () => props.detail?.id,
  () => {
    // A new detail identity is a new media set: stale failures never suppress the next product's media.
    failedMainImageUrl.value = null
    failedVariantImageUrls.value = {}
  },
)
</script>

<template>
  <UModal
    :open="open"
    title="Detalle del producto"
    description="Información del producto seleccionado"
    :close="false"
    :ui="{
      overlay: 'bg-coco-950/45 backdrop-blur-sm',
      content: 'max-w-4xl rounded-2xl shadow-xl',
      header: 'sr-only',
      body: 'p-0 sm:p-0 overscroll-contain',
    }"
    @update:open="handleModalOpen"
  >
    <template #body>
      <button
        class="absolute end-4 top-4 z-10 inline-flex size-11 items-center justify-center rounded-full bg-white text-highlighted shadow-sm ring-1 ring-black/5 transition-[background-color,color,transform] duration-150 ease-out hover:bg-coco-50 focus-visible:ring-2 focus-visible:ring-coco-500 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 dark:bg-coco-neutral-900 dark:ring-white/10 dark:hover:bg-coco-neutral-800"
        type="button"
        aria-label="Cerrar detalle del producto"
        @click="close"
      >
        <UIcon name="i-lucide-x" class="size-5" />
      </button>

      <div
        v-if="isLoading"
        data-testid="catalog-detail-loading"
        class="grid min-w-0 grid-cols-1 md:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]"
        aria-busy="true"
        role="status"
      >
        <div
          data-testid="catalog-detail-media-skeleton"
          class="flex min-w-0 flex-col items-center justify-center gap-4 bg-coco-50 px-6 py-8 dark:bg-coco-950/40"
        >
          <USkeleton class="h-6 w-24 rounded-full" />
          <USkeleton class="aspect-square w-full max-w-[15rem] rounded-2xl md:max-w-[17rem]" />
        </div>
        <div
          data-testid="catalog-detail-details-skeleton"
          class="flex min-w-0 flex-col gap-5 p-6 md:p-8 md:pt-16"
        >
          <div class="flex flex-wrap items-center gap-2">
            <USkeleton class="h-6 w-20 rounded-full" />
            <USkeleton class="h-6 w-24 rounded-full" />
          </div>
          <USkeleton class="h-8 w-3/4 rounded-lg" />
          <USkeleton class="h-9 w-32 rounded-lg" />
          <USkeleton class="h-4 w-full rounded" />
          <USkeleton class="h-4 w-5/6 rounded" />
          <div class="flex flex-col gap-2 pt-1">
            <USkeleton class="h-16 rounded-xl" />
            <USkeleton class="h-16 rounded-xl" />
          </div>
        </div>
        <p class="sr-only">
          {{
            state === 'retry-pending'
              ? 'Reintentando detalle del producto'
              : 'Cargando detalle del producto'
          }}
        </p>
      </div>

      <div
        v-else-if="detail"
        data-testid="catalog-detail-split"
        class="grid min-w-0 grid-cols-1 md:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]"
      >
        <div
          data-testid="catalog-detail-media-panel"
          class="flex min-w-0 flex-col items-center justify-center gap-4 bg-coco-50 px-6 py-8 dark:bg-coco-950/40"
        >
          <!--
            Below md the absolute close control overlays the panel's top-right corner, so the badge
            starts at the safe cross-start edge and caps its width by that 44px control plus its 16px
            inset. The real brand always wraps instead of being truncated.
          -->
          <p
            v-if="detail.brand"
            data-testid="catalog-detail-brand"
            class="max-w-[calc(100%_-_3.75rem)] min-w-0 self-start break-words rounded-full bg-white/80 px-3 py-1 text-center text-[11px] font-semibold tracking-[0.14em] text-coco-700 uppercase ring-1 ring-coco-200 md:max-w-full md:self-center dark:bg-coco-900/70 dark:text-coco-100 dark:ring-coco-800"
          >
            {{ detail.brand.name }}
          </p>
          <div
            data-testid="catalog-detail-image-frame"
            class="flex aspect-square w-full max-w-[15rem] items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 md:max-w-[17rem] dark:bg-coco-neutral-900 dark:ring-white/10"
          >
            <img
              v-if="displayImageUrl && !mainImageFailed"
              class="size-full object-cover"
              :src="displayImageUrl"
              :alt="`Imagen de ${detail.name}`"
              @error="markMainImageFailed"
            />
            <div
              v-else
              data-testid="catalog-detail-image-fallback"
              class="flex size-full flex-col items-center justify-center gap-3 bg-coco-50 px-6 text-center dark:bg-coco-950/40"
              :aria-label="`Imagen no disponible para ${detail.name}`"
              role="img"
            >
              <!--
                The same honest media absence as the listing cards, scaled to the detail composition:
                a cobalt-tinted surface, one contained glyph and the written state. No invented URL.
              -->
              <span
                class="flex size-20 items-center justify-center rounded-3xl bg-white/80 text-coco-500 ring-1 ring-coco-200/80 dark:bg-coco-900/50 dark:text-coco-300 dark:ring-coco-800/60"
              >
                <UIcon name="i-lucide-image-off" class="size-9" />
              </span>
              <span class="text-sm font-medium text-coco-700 dark:text-coco-200">
                Imagen no disponible
              </span>
            </div>
          </div>
        </div>

        <div
          data-testid="catalog-detail-details-panel"
          class="flex min-w-0 flex-col gap-5 p-6 md:p-8"
        >
          <div class="flex min-w-0 flex-wrap items-center gap-2 pr-16">
            <span
              v-if="detail.category"
              data-testid="catalog-detail-category"
              class="rounded-full bg-coco-50 px-3 py-1 text-xs font-medium text-coco-700 ring-1 ring-coco-200 dark:bg-coco-950/60 dark:text-coco-200 dark:ring-coco-900"
            >
              {{ detail.category.name }}
            </span>
            <span
              v-if="detailAvailability"
              data-testid="catalog-detail-availability"
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1"
              :class="detailAvailability.pill"
            >
              <span class="size-1.5 rounded-full" :class="detailAvailability.dot" />
              <span class="text-xs font-semibold" :class="detailAvailability.text">
                {{ detailAvailability.label }}
              </span>
            </span>
          </div>

          <h2
            data-testid="catalog-detail-name"
            class="break-words text-2xl leading-tight font-bold tracking-tight text-highlighted sm:text-3xl"
          >
            {{ detail.name }}
          </h2>

          <div class="flex min-w-0 flex-col gap-1.5">
            <p
              v-if="detailPrice"
              data-testid="catalog-detail-price"
              class="break-words text-3xl font-bold tracking-tight text-highlighted tabular-nums"
            >
              {{ detailPrice }}
            </p>
            <p
              v-else
              data-testid="catalog-detail-price"
              class="break-words text-lg font-medium text-muted"
            >
              Consultar precio
            </p>
            <p
              v-if="detailQuantity"
              data-testid="catalog-detail-quantity"
              class="break-words text-sm font-medium text-muted tabular-nums"
            >
              {{ detailQuantity }}
            </p>
            <p v-else-if="!detailAvailability" class="text-sm text-muted">
              Información no disponible
            </p>
          </div>

          <p
            v-if="detail.description"
            data-testid="catalog-detail-description"
            class="max-w-prose break-words whitespace-pre-line text-sm leading-relaxed text-muted"
          >
            {{ detail.description }}
          </p>

          <section
            v-if="detail.variants.length > 0"
            aria-labelledby="catalog-detail-variants"
            class="flex min-w-0 flex-col gap-3"
          >
            <h3 id="catalog-detail-variants" class="text-sm font-semibold text-highlighted">
              Variantes disponibles
            </h3>
            <ul class="flex min-w-0 flex-col gap-2">
              <li
                v-for="variant in variants"
                :key="variant.id"
                data-testid="catalog-detail-variant"
                class="flex min-w-0 items-start gap-3 rounded-xl bg-elevated/40 p-3 ring-1 ring-default"
              >
                <!--
                  Read-only media thumbnail inside a read-only row: a real variant image when the
                  strict DTO carries one, the honest compact no-image state otherwise.
                -->
                <div
                  class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-default dark:bg-coco-neutral-900 dark:ring-white/10"
                >
                  <img
                    v-if="variant.imageUrl && !variant.imageFailed"
                    class="size-full object-cover"
                    :src="variant.imageUrl"
                    :alt="variant.imageAlt"
                    @error="markVariantImageFailed(variant.id, variant.imageUrl)"
                  />
                  <div
                    v-else
                    data-testid="catalog-detail-variant-image-fallback"
                    class="flex size-full items-center justify-center bg-coco-50 text-coco-500 dark:bg-coco-950/40 dark:text-coco-300"
                    :aria-label="`Imagen no disponible para la variante ${variant.name}`"
                    role="img"
                  >
                    <UIcon name="i-lucide-image-off" class="size-5" />
                  </div>
                </div>

                <div class="flex min-w-0 flex-1 flex-col">
                  <div class="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <div class="min-w-0">
                      <p class="break-words text-sm font-semibold text-highlighted">
                        {{ variant.name }}
                      </p>
                      <p v-if="variant.optionValue" class="break-words text-xs text-muted">
                        {{ variant.optionValue }}
                      </p>
                    </div>
                    <p
                      v-if="variant.price"
                      data-testid="catalog-detail-variant-price"
                      class="min-w-0 max-w-full break-words text-sm font-semibold text-highlighted tabular-nums"
                    >
                      {{ variant.price }}
                    </p>
                    <p
                      v-else
                      data-testid="catalog-detail-variant-price"
                      class="min-w-0 max-w-full break-words text-xs font-medium text-muted"
                    >
                      Consultar precio
                    </p>
                  </div>
                  <div
                    v-if="variant.quantity || variant.availability"
                    class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                  >
                    <span
                      v-if="variant.quantity"
                      data-testid="catalog-detail-variant-quantity"
                      class="min-w-0 max-w-full break-words font-medium text-muted tabular-nums"
                    >
                      {{ variant.quantity }}
                    </span>
                    <span
                      v-if="variant.availability"
                      data-testid="catalog-detail-variant-availability"
                      class="inline-flex items-center gap-1.5"
                    >
                      <span class="size-1.5 rounded-full" :class="variant.availability.dot" />
                      <span class="font-medium" :class="variant.availability.text">
                        {{ variant.availability.label }}
                      </span>
                    </span>
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <div
        v-else
        data-testid="catalog-detail-error"
        class="flex min-h-72 flex-col items-center justify-center gap-3 px-6 py-12 text-center"
        role="status"
      >
        <UIcon
          :name="state === 'not-found' ? 'i-lucide-package-x' : 'i-lucide-circle-alert'"
          class="size-10 text-coco-500"
        />
        <h2 class="text-lg font-semibold text-highlighted">No pudimos mostrar este producto</h2>
        <p class="max-w-sm text-sm text-muted">{{ errorCopy(state) }}</p>
        <button
          v-if="canRetry"
          data-testid="catalog-detail-retry"
          class="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-coco-600 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-coco-700 focus-visible:ring-2 focus-visible:ring-coco-500 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
          type="button"
          @click="emit('retry')"
        >
          Reintentar
        </button>
      </div>
    </template>
  </UModal>
</template>
