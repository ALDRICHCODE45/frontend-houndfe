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

const imageFailed = ref(false)
const displayImage = computed(() => {
  if (!props.detail) return null
  return props.detail.images.find((image) => image.isMain) ?? props.detail.images[0] ?? null
})
const isLoading = computed(() => props.state === 'loading' || props.state === 'retry-pending')
const canRetry = computed(() => ['rate-limit', 'network', 'server'].includes(props.state))

const availabilityConfig = {
  available: {
    label: 'Disponible',
    dot: 'bg-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  low_stock: {
    label: 'Pocas piezas',
    dot: 'bg-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
  },
  out_of_stock: { label: 'Agotado', dot: 'bg-red-400', text: 'text-red-700 dark:text-red-300' },
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

function selectedVariantAvailability(variant: PublicCatalogProductDetailDto['variants'][number]) {
  return variant.availabilityByBranch.find((availability) => availability.isSelected) ?? null
}

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
    imageFailed.value = false
  },
)
</script>

<template>
  <UModal
    :open="open"
    title="Detalle del producto"
    description="Información del producto seleccionado"
    :content="{ class: 'w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-2xl' }"
    @update:open="handleModalOpen"
  >
    <template #body>
      <div class="max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain p-1">
        <div class="flex items-start justify-between gap-4 pb-4">
          <div>
            <p class="text-sm font-medium text-muted">Detalle del producto</p>
            <p class="text-xs text-muted">Consulta información y disponibilidad.</p>
          </div>
          <button
            class="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-[background-color,color,transform] duration-150 hover:bg-elevated hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.96]"
            type="button"
            aria-label="Cerrar detalle del producto"
            @click="close"
          >
            <UIcon name="i-lucide-x" class="size-5" />
          </button>
        </div>

        <div
          v-if="isLoading"
          class="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
          aria-busy="true"
          role="status"
        >
          <USkeleton class="aspect-square w-full rounded-2xl" />
          <div class="space-y-4 py-1">
            <USkeleton class="h-3 w-24" />
            <USkeleton class="h-8 w-3/4" />
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-4 w-5/6" />
            <div class="grid grid-cols-2 gap-3 pt-3">
              <USkeleton class="h-20 rounded-xl" />
              <USkeleton class="h-20 rounded-xl" />
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
          class="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          <div class="min-w-0">
            <div
              class="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10"
            >
              <img
                v-if="displayImage && !imageFailed"
                class="size-full object-cover"
                :src="displayImage.url"
                :alt="`Imagen de ${detail.name}`"
                @error="imageFailed = true"
              />
              <div
                v-else
                data-testid="catalog-detail-image-fallback"
                class="flex size-full items-center justify-center"
                :aria-label="`Imagen no disponible para ${detail.name}`"
                role="img"
              >
                <UIcon name="i-lucide-package" class="size-16 text-gray-400/50" />
              </div>
            </div>
          </div>

          <div class="flex min-w-0 flex-col gap-5">
            <div>
              <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                <span v-if="detail.brand">{{ detail.brand.name }}</span>
                <span v-if="detail.category">{{ detail.category.name }}</span>
              </div>
              <h2 class="mt-1 break-words text-2xl font-bold leading-tight text-highlighted">
                {{ detail.name }}
              </h2>
              <p
                v-if="detail.description"
                class="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-muted"
              >
                {{ detail.description }}
              </p>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="rounded-xl bg-elevated/60 p-4 ring-1 ring-default">
                <p class="text-xs font-medium text-muted">Precio</p>
                <p
                  v-if="displayPrice(detail.price)"
                  class="mt-1 text-xl font-bold tabular-nums text-highlighted"
                >
                  {{ displayPrice(detail.price) }}
                </p>
                <p v-else class="mt-1 text-sm font-medium italic text-muted">Consultar precio</p>
              </div>
              <div class="rounded-xl bg-elevated/60 p-4 ring-1 ring-default">
                <p class="text-xs font-medium text-muted">Disponibilidad</p>
                <p
                  v-if="displayQuantity(detail.stockPresentation)"
                  class="mt-1 text-sm font-semibold text-highlighted"
                >
                  {{ displayQuantity(detail.stockPresentation) }}
                </p>
                <div
                  v-if="displayAvailability(detail.stockPresentation, detail.availability)"
                  class="mt-1 flex items-center gap-1.5"
                >
                  <span
                    class="size-2 rounded-full"
                    :class="displayAvailability(detail.stockPresentation, detail.availability)?.dot"
                  />
                  <span
                    class="text-sm font-medium"
                    :class="
                      displayAvailability(detail.stockPresentation, detail.availability)?.text
                    "
                  >
                    {{ displayAvailability(detail.stockPresentation, detail.availability)?.label }}
                  </span>
                </div>
                <p
                  v-else-if="!displayQuantity(detail.stockPresentation)"
                  class="mt-1 text-sm text-muted"
                >
                  Información no disponible
                </p>
              </div>
            </div>

            <section v-if="detail.variants.length > 0" aria-labelledby="catalog-detail-variants">
              <h3 id="catalog-detail-variants" class="text-sm font-semibold text-highlighted">
                Variantes disponibles
              </h3>
              <div class="mt-3 space-y-2">
                <div
                  v-for="variant in detail.variants"
                  :key="variant.id"
                  class="min-w-0 rounded-xl bg-elevated/40 p-3 ring-1 ring-default"
                >
                  <div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="break-words text-sm font-semibold text-highlighted">
                        {{ variant.name }}
                      </p>
                      <p
                        v-if="variant.option || variant.value"
                        class="break-words text-xs text-muted"
                      >
                        {{ [variant.option, variant.value].filter(Boolean).join(': ') }}
                      </p>
                    </div>
                    <p
                      v-if="displayPrice(variant.price)"
                      class="shrink-0 text-sm font-semibold tabular-nums text-highlighted"
                    >
                      {{ displayPrice(variant.price) }}
                    </p>
                    <p v-else class="shrink-0 text-xs italic text-muted">Consultar precio</p>
                  </div>
                  <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span
                      v-if="displayQuantity(variant.stockPresentation)"
                      class="font-medium text-muted"
                    >
                      {{ displayQuantity(variant.stockPresentation) }}
                    </span>
                    <template
                      v-if="
                        selectedVariantAvailability(variant) &&
                        displayAvailability(
                          variant.stockPresentation,
                          selectedVariantAvailability(variant)?.availability ?? null,
                        )
                      "
                    >
                      <span
                        class="size-1.5 rounded-full"
                        :class="
                          displayAvailability(
                            variant.stockPresentation,
                            selectedVariantAvailability(variant)?.availability ?? null,
                          )?.dot
                        "
                      />
                      <span
                        class="font-medium"
                        :class="
                          displayAvailability(
                            variant.stockPresentation,
                            selectedVariantAvailability(variant)?.availability ?? null,
                          )?.text
                        "
                      >
                        {{
                          displayAvailability(
                            variant.stockPresentation,
                            selectedVariantAvailability(variant)?.availability ?? null,
                          )?.label
                        }}
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div
          v-else
          class="flex min-h-56 flex-col items-center justify-center gap-3 px-4 py-8 text-center"
          role="status"
        >
          <UIcon
            :name="state === 'not-found' ? 'i-lucide-package-x' : 'i-lucide-circle-alert'"
            class="size-10 text-orange-400"
          />
          <h2 class="text-lg font-semibold text-highlighted">No pudimos mostrar este producto</h2>
          <p class="max-w-sm text-sm text-muted">{{ errorCopy(state) }}</p>
          <button
            v-if="canRetry"
            class="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-inverted transition-[background-color,transform] duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.96]"
            type="button"
            @click="emit('retry')"
          >
            Reintentar
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>
