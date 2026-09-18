<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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

/**
 * A published product may carry no description and no variants at all. Those two fields are the only
 * density the panel can offer, so the panel states the absence instead of leaving a blank region.
 */
const hasDescription = computed(() => Boolean(props.detail?.description?.trim()))
const hasVariants = computed(() => (props.detail?.variants.length ?? 0) > 0)
const showEmptyDetailNote = computed(
  () => props.detail !== null && !hasDescription.value && !hasVariants.value,
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

/**
 * Read-only image preview. It is a sibling dialog that reuses the URL the detail already delivered:
 * opening it issues no request, and it never participates in the detail's own close lifecycle.
 */
interface PreviewImage {
  url: string
  alt: string
  /** Identity phrase used by the preview fallback label, so the failure names what failed. */
  subject: string
}

const previewImage = ref<PreviewImage | null>(null)
const previewImageUrl = computed(() => previewImage.value?.url ?? null)
const previewAlt = computed(() => previewImage.value?.alt ?? '')
/**
 * The enlarged surface itself. It is the only proof that a preview really reached the screen, so a reset
 * can tell a dismissal that will produce its own `after:leave` from an activation that never mounted and
 * therefore never leaves.
 */
const previewSurfaceElement = ref<HTMLElement | null>(null)

/** The preview failure is keyed to the exact URL that failed, so another URL is still attempted. */
const failedPreviewImageUrl = ref<string | null>(null)
const previewImageFailed = computed(
  () => previewImageUrl.value !== null && failedPreviewImageUrl.value === previewImageUrl.value,
)
const previewFallbackLabel = computed(() =>
  previewImage.value === null
    ? 'Imagen no disponible en la vista ampliada'
    : `Imagen no disponible en la vista ampliada de ${previewImage.value.subject}`,
)

/** The invoking control that owns the focus restore for the preview currently on screen. */
let previewTrigger: HTMLButtonElement | null = null
/**
 * The exact trigger dismissed by the last close: only that element may take focus once the preview
 * it belongs to actually leaves the layout.
 */
let dismissedPreviewTrigger: HTMLButtonElement | null = null

/**
 * The application root the enlarged view isolates. The portal that paints the preview lives outside
 * it, so the storefront shell, the product grid and the detail dialog behind the preview all leave the
 * accessibility tree together while the preview owns the surface.
 */
const APP_ROOT_ID = 'app'

/**
 * The exact attribute state of `#app` before this component isolated it. Both attributes come back
 * verbatim when the isolation ends, so an outer owner that already carried `inert` or an explicit
 * `aria-hidden` value keeps it.
 */
interface BackgroundIsolationSnapshot {
  readonly inert: string | null
  readonly ariaHidden: string | null
}

let backgroundIsolation: BackgroundIsolationSnapshot | null = null
/** Guards `#app` while this component owns the isolation: the modal stack may rewrite it at any time. */
let backgroundIsolationObserver: MutationObserver | null = null

function appRootElement(): HTMLElement | null {
  // Isolation is a browser-only concern: server rendering owns no document to isolate.
  if (typeof document === 'undefined') return null
  return document.getElementById(APP_ROOT_ID)
}

/** Writes the isolation without queuing a redundant mutation for the observer below. */
function applyBackgroundIsolation(root: HTMLElement) {
  if (root.getAttribute('inert') !== '') root.setAttribute('inert', '')
  if (root.getAttribute('aria-hidden') !== 'true') root.setAttribute('aria-hidden', 'true')
}

function acquireBackgroundIsolation() {
  const root = appRootElement()
  if (root === null || backgroundIsolation !== null) return
  backgroundIsolation = {
    inert: root.getAttribute('inert'),
    ariaHidden: root.getAttribute('aria-hidden'),
  }
  applyBackgroundIsolation(root)
  // The modal stack rewrites `#app` while the enlarged dialog mounts, leaves, or hands over to
  // another dialog, so the isolation is re-applied for as long as this component owns it.
  if (typeof MutationObserver !== 'undefined') {
    backgroundIsolationObserver = new MutationObserver(() => reassertBackgroundIsolation())
    backgroundIsolationObserver.observe(root, {
      attributes: true,
      attributeFilter: ['inert', 'aria-hidden'],
    })
  }
}

/** Re-assertion never invents a lock: without an owned snapshot it does nothing. */
function reassertBackgroundIsolation() {
  if (backgroundIsolation === null) return
  const root = appRootElement()
  if (root === null) return
  applyBackgroundIsolation(root)
}

/**
 * Releases exactly the isolation this component owns, restoring the recorded presence and value of
 * both attributes. Anything an outer owner had in place survives untouched.
 */
function releaseBackgroundIsolation() {
  const snapshot = backgroundIsolation
  if (snapshot === null) return
  backgroundIsolation = null
  backgroundIsolationObserver?.disconnect()
  backgroundIsolationObserver = null
  const root = appRootElement()
  if (root === null) return
  if (snapshot.inert === null) root.removeAttribute('inert')
  else root.setAttribute('inert', snapshot.inert)
  if (snapshot.ariaHidden === null) root.removeAttribute('aria-hidden')
  else root.setAttribute('aria-hidden', snapshot.ariaHidden)
}

/**
 * The preview transition is strictly serial: one dismissal has to complete before another preview may
 * open. While a leave is pending the surface is isolated and inert, so no open attempt is honoured.
 */
let previewLeavePending = false

function openPreview(trigger: EventTarget | null, preview: PreviewImage) {
  // A pending dismissal still owns the surface: the attempt is refused, and both the pending leave and
  // the trigger that owns its focus restore stay untouched.
  if (previewLeavePending) return
  previewTrigger = trigger instanceof HTMLButtonElement ? trigger : null
  // A real click focuses the invoking button first: that anchor is what the dialog's own focus scope
  // returns to, and the button has to own focus while its application root is still interactive.
  previewTrigger?.focus()
  acquireBackgroundIsolation()
  previewImage.value = preview
}

function closePreview() {
  if (previewImage.value === null) return
  previewImage.value = null
  // The dismissed dialog is still on screen: the transition stays closed until it leaves, and only its
  // own trigger is captured, for the focus restore that this dismissal alone may perform.
  previewLeavePending = true
  dismissedPreviewTrigger = previewTrigger
  previewTrigger = null
}

/**
 * Restores focus exactly once, and only to the control that opened the dismissal which just left: a
 * leave that ends a reset finds no dismissed trigger to consume.
 */
function restorePreviewFocus() {
  const trigger = dismissedPreviewTrigger
  dismissedPreviewTrigger = null
  trigger?.focus()
}

/**
 * The single end-of-preview path, and the only way the transition reopens. It clears the pending gate
 * and restores the state this component owns, while a leave that ends a reset never moves stale focus.
 */
function handlePreviewLeave() {
  if (!previewLeavePending) return
  previewLeavePending = false
  releaseBackgroundIsolation()
  restorePreviewFocus()
}

/**
 * Drops the whole preview lifecycle at once: used when the detail identity changes and when the outer
 * detail closes programmatically. The preview, both trigger references and the focus ownership are
 * dropped and the isolation this component owns is released immediately. A dismissal that still owns a
 * mounted surface keeps the transition closed until its own leave really ends, while an activation that
 * was reset before it ever mounted produced no leave at all and must not wedge the transition closed.
 */
function resetPreview() {
  previewLeavePending = previewLeavePending || previewSurfaceElement.value !== null
  previewImage.value = null
  previewTrigger = null
  dismissedPreviewTrigger = null
  releaseBackgroundIsolation()
}

function handlePreviewOpen(value: boolean) {
  if (!value) closePreview()
}

function markPreviewImageFailed() {
  failedPreviewImageUrl.value = previewImageUrl.value
}

function openMainPreview(event: MouseEvent) {
  const url = displayImageUrl.value
  if (url === null || props.detail === null) return
  openPreview(event.currentTarget, {
    url,
    alt: `Imagen de ${props.detail.name}`,
    subject: props.detail.name,
  })
}

function openVariantPreview(
  variant: { name: string; imageUrl: string | null; imageAlt: string },
  event: MouseEvent,
) {
  const url = variant.imageUrl
  if (url === null) return
  openPreview(event.currentTarget, {
    url,
    alt: variant.imageAlt,
    subject: `la variante ${variant.name}`,
  })
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
    // A new detail identity is a new media set: stale failures never suppress the next product's media.
    failedMainImageUrl.value = null
    failedVariantImageUrls.value = {}
    // The preview belongs to the previous identity: its open state, keyed failure, both trigger
    // references and the isolation it owned are dropped at once, so no stale leave callback can move
    // focus onto the new media or keep the storefront isolated.
    failedPreviewImageUrl.value = null
    resetPreview()
  },
  // Teardown may not wait for a render: a preview that was open has to keep the transition closed from
  // the very turn its identity is replaced, before anything can attempt to open another one.
  { flush: 'sync' },
)

watch(
  () => props.open,
  (open) => {
    // A programmatic close of the detail never leaves the enlarged view or its isolation behind.
    if (!open) resetPreview()
  },
  // Closing the detail programmatically drops the preview in the same turn, never after a render.
  { flush: 'sync' },
)

onBeforeUnmount(() => {
  // An unmount releases exactly the lock this component owns and restores the state it recorded.
  releaseBackgroundIsolation()
})
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
            <!--
              The real main image is one full-frame media control: it opens the read-only preview and
              never selects, buys or mutates anything. Without real media the frame stays inert.
            -->
            <button
              v-if="displayImageUrl && !mainImageFailed"
              data-testid="catalog-detail-image-preview-trigger"
              class="group relative size-full cursor-zoom-in transition-transform duration-200 ease-out focus-visible:ring-2 focus-visible:ring-coco-500 focus-visible:ring-inset focus-visible:outline-none active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
              type="button"
              :aria-label="`Ampliar imagen de ${detail.name}`"
              @click="openMainPreview"
            >
              <img
                class="size-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
                :src="displayImageUrl"
                :alt="`Imagen de ${detail.name}`"
                @error="markMainImageFailed"
              />
              <!--
                The always-visible zoom affordance is presentation inside the already-labelled media
                button, never a second control: `aria-hidden` keeps it out of the accessible name and
                no gradient is involved. Only real media renders it.
              -->
              <span
                aria-hidden="true"
                data-testid="catalog-detail-image-zoom-affordance"
                class="pointer-events-none absolute bottom-3 end-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-coco-700 shadow-sm ring-1 ring-black/5 dark:bg-coco-950/85 dark:text-coco-100 dark:ring-white/10"
              >
                <UIcon name="i-lucide-zoom-in" class="size-3.5" />
                Ampliar
              </span>
            </button>
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
            v-if="hasDescription"
            data-testid="catalog-detail-description"
            class="max-w-prose break-words whitespace-pre-line text-sm leading-relaxed text-muted"
          >
            {{ detail.description }}
          </p>

          <section
            v-if="hasVariants"
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
                  Read-only media thumbnail inside a read-only row: a real variant image opens the
                  preview, the honest compact no-image state stays inert otherwise.
                -->
                <!--
                  The frame is a square 72px (4.5rem) box with a modest radius — never a circle or a
                  pill — and it never shrinks, so long variant copy wraps beside it instead of
                  squeezing the media at 320px.
                -->
                <div
                  data-testid="catalog-detail-variant-image-frame"
                  class="flex size-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-default dark:bg-coco-neutral-900 dark:ring-white/10"
                >
                  <button
                    v-if="variant.imageUrl && !variant.imageFailed"
                    data-testid="catalog-detail-variant-image-preview-trigger"
                    class="group relative size-full cursor-zoom-in transition-transform duration-200 ease-out focus-visible:ring-2 focus-visible:ring-coco-500 focus-visible:ring-inset focus-visible:outline-none active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
                    type="button"
                    :aria-label="`Ampliar imagen de la variante ${variant.name}`"
                    @click="openVariantPreview(variant, $event)"
                  >
                    <img
                      class="size-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
                      :src="variant.imageUrl"
                      :alt="variant.imageAlt"
                      @error="markVariantImageFailed(variant.id, variant.imageUrl)"
                    />
                    <!--
                      A real thumbnail carries the same promise as the main image, so it repeats the
                      affordance at thumbnail scale: presentation only, labelled by the button itself.
                    -->
                    <span
                      aria-hidden="true"
                      data-testid="catalog-detail-variant-image-zoom-affordance"
                      class="pointer-events-none absolute end-0.5 bottom-0.5 inline-flex size-5 items-center justify-center rounded-full bg-white/95 text-coco-700 shadow-sm ring-1 ring-black/5 dark:bg-coco-950/85 dark:text-coco-100 dark:ring-white/10"
                    >
                      <UIcon name="i-lucide-zoom-in" class="size-3" />
                    </span>
                  </button>
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

          <!--
            A product published with neither description nor variants leaves this column nearly
            empty. The note states that real absence in the interface's own voice: contained, calm,
            never an error and never a commerce prompt. `mt-auto` settles it at the bottom of the
            sparse column instead of leaving an unexplained blank area.
          -->
          <div
            v-if="showEmptyDetailNote"
            data-testid="catalog-detail-empty-note"
            role="note"
            class="mt-auto flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl bg-elevated/40 px-6 py-8 text-center ring-1 ring-default"
          >
            <span
              aria-hidden="true"
              class="flex size-12 items-center justify-center rounded-2xl bg-coco-50 text-coco-500 ring-1 ring-coco-200/80 dark:bg-coco-950/50 dark:text-coco-300 dark:ring-coco-800/60"
            >
              <UIcon name="i-lucide-info" class="size-6" />
            </span>
            <h3 class="text-balance break-words text-sm font-semibold text-highlighted">
              Sin información adicional
            </h3>
            <p class="max-w-xs text-pretty break-words text-sm leading-relaxed text-muted">
              Por ahora no hay descripción ni variantes publicadas para este producto.
            </p>
          </div>
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

  <!--
    The read-only preview is a sibling dialog, never a nested DOM modal: it reuses the URL the detail
    already delivered, issues no request of its own, and dismisses without closing the detail behind it.
  -->
  <UModal
    :open="previewImage !== null"
    title="Vista ampliada de imagen"
    description="Imagen del producto en tamaño completo"
    :close="false"
    :ui="{
      overlay: 'z-[60] bg-coco-950/70 backdrop-blur-sm',
      content: 'z-[61] max-w-3xl overflow-hidden rounded-2xl bg-coco-950/95 ring-1 ring-white/10',
      header: 'sr-only',
      body: 'p-0 sm:p-0',
    }"
    @update:open="handlePreviewOpen"
    @after:leave="handlePreviewLeave"
  >
    <template #body>
      <div
        ref="previewSurfaceElement"
        data-testid="catalog-detail-image-preview"
        class="relative flex min-h-[40svh] w-full items-center justify-center p-4 pt-16 sm:min-h-[45svh]"
      >
        <img
          v-if="previewImageUrl && !previewImageFailed"
          data-testid="catalog-detail-image-preview-img"
          class="max-h-[60svh] w-full max-w-full object-contain sm:max-h-[75svh]"
          :src="previewImageUrl"
          :alt="previewAlt"
          @error="markPreviewImageFailed"
        />
        <!--
          The honest absence, keyed to the exact URL that failed: no gradient placeholder, no invented
          media, and the label names the enlarged view so it is never confused with the detail frame.
        -->
        <div
          v-else
          data-testid="catalog-detail-image-preview-fallback"
          class="flex w-full flex-col items-center justify-center gap-3 py-12 text-center"
          :aria-label="previewFallbackLabel"
          role="img"
        >
          <span
            class="flex size-20 items-center justify-center rounded-3xl bg-white/10 text-coco-200 ring-1 ring-white/15"
          >
            <UIcon name="i-lucide-image-off" class="size-9" />
          </span>
          <span class="text-sm font-medium text-white">Imagen no disponible</span>
        </div>

        <button
          data-testid="catalog-detail-image-preview-close"
          class="absolute end-4 top-4 inline-flex size-11 items-center justify-center rounded-full bg-white text-highlighted shadow-sm ring-1 ring-black/5 transition-[background-color,transform] duration-200 ease-out hover:bg-coco-50 focus-visible:ring-2 focus-visible:ring-coco-500 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 dark:bg-coco-neutral-900 dark:ring-white/10 dark:hover:bg-coco-neutral-800"
          type="button"
          aria-label="Cerrar vista de imagen"
          @click="closePreview"
        >
          <UIcon name="i-lucide-x" class="size-5" />
        </button>
      </div>
    </template>
  </UModal>
</template>
