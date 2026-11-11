<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

export interface CatalogDetailGalleryImage {
  url: string
  alt: string
  /** Set only on the image that belongs to the selected presentation. */
  caption: string | null
}

/**
 * The product gallery. The first image follows the selected presentation (the parent puts the
 * presentation image first); the others are the product images. Failures are keyed by URL, so a
 * failed image never suppresses a different one, and the enlarged view reuses the shown URL.
 */
const props = defineProps<{
  productName: string
  images: CatalogDetailGalleryImage[]
}>()

const activeIndex = shallowRef(0)
const failedUrls = ref<Set<string>>(new Set())

const active = computed(() => props.images[activeIndex.value] ?? props.images[0] ?? null)
const activeUrl = computed(() =>
  active.value && !failedUrls.value.has(active.value.url) ? active.value.url : null,
)
const showThumbs = computed(() => props.images.length > 1)

// A new first image means a new presentation: the gallery returns to it.
watch(
  () => props.images[0]?.url ?? null,
  () => {
    activeIndex.value = 0
  },
)

function markFailed(url: string) {
  failedUrls.value = new Set(failedUrls.value).add(url)
}

const preview = shallowRef<{ url: string; alt: string } | null>(null)
const previewFailed = shallowRef(false)

function openPreview() {
  if (!active.value || activeUrl.value === null) return
  previewFailed.value = false
  preview.value = { url: activeUrl.value, alt: active.value.alt }
}

function closePreview() {
  preview.value = null
}

function handlePreviewOpen(open: boolean) {
  if (!open) closePreview()
}
</script>

<template>
  <section class="catalog-pdp-gallery" aria-label="Galería de imágenes">
    <div class="catalog-pdp-gallery-main">
      <span
        v-if="active?.caption && activeUrl"
        data-testid="catalog-detail-gallery-caption"
        class="catalog-pdp-gallery-caption"
      >
        {{ active.caption }}
      </span>
      <img
        v-if="activeUrl && active"
        data-testid="catalog-detail-main-image"
        class="catalog-pdp-gallery-image"
        :src="activeUrl"
        :alt="active.alt"
        @error="markFailed(activeUrl)"
      />
      <div
        v-else
        data-testid="catalog-detail-image-fallback"
        class="catalog-pdp-gallery-fallback"
        role="img"
        :aria-label="`Imagen no disponible para ${productName}`"
      >
        <span class="catalog-pdp-gallery-fallback-icon" aria-hidden="true">
          <UIcon name="i-lucide-image-off" class="size-9" />
        </span>
        <span>Imagen no disponible</span>
      </div>
      <button
        v-if="activeUrl"
        data-testid="catalog-detail-zoom"
        class="catalog-pdp-zoom"
        type="button"
        :aria-label="`Ampliar imagen de ${productName}`"
        @click="openPreview"
      >
        <UIcon name="i-lucide-zoom-in" class="size-4" aria-hidden="true" />
        Ampliar imagen
      </button>
    </div>

    <div v-if="showThumbs" class="catalog-pdp-thumbs">
      <button
        v-for="(image, index) in images"
        :key="image.url"
        data-testid="catalog-detail-thumb"
        class="catalog-pdp-thumb"
        type="button"
        :aria-label="`Ver imagen ${index + 1} de ${images.length}`"
        :aria-current="index === activeIndex ? 'true' : undefined"
        @click="activeIndex = index"
      >
        <img
          v-if="!failedUrls.has(image.url)"
          :src="image.url"
          alt=""
          @error="markFailed(image.url)"
        />
        <UIcon v-else name="i-lucide-image-off" class="size-5" aria-hidden="true" />
      </button>
    </div>

    <UModal
      :open="preview !== null"
      title="Vista ampliada de imagen"
      description="Imagen del producto en tamaño completo"
      :close="false"
      :ui="{
        overlay: 'catalog-pdp-preview-overlay z-[60] backdrop-blur-sm',
        content: 'catalog-pdp-preview-dialog z-[61] max-w-3xl overflow-hidden rounded-2xl',
        header: 'sr-only',
        body: 'p-0 sm:p-0',
      }"
      @update:open="handlePreviewOpen"
    >
      <template #body>
        <div data-testid="catalog-detail-image-preview" class="catalog-pdp-preview">
          <img
            v-if="preview && !previewFailed"
            data-testid="catalog-detail-image-preview-img"
            class="catalog-pdp-preview-image"
            :src="preview.url"
            :alt="preview.alt"
            @error="previewFailed = true"
          />
          <div
            v-else
            data-testid="catalog-detail-image-preview-fallback"
            class="catalog-pdp-gallery-fallback"
            role="img"
            :aria-label="`Imagen no disponible en la vista ampliada de ${productName}`"
          >
            <span class="catalog-pdp-gallery-fallback-icon" aria-hidden="true">
              <UIcon name="i-lucide-image-off" class="size-9" />
            </span>
            <span>Imagen no disponible</span>
          </div>
          <button
            data-testid="catalog-detail-image-preview-close"
            class="catalog-pdp-preview-close"
            type="button"
            aria-label="Cerrar vista de imagen"
            @click="closePreview"
          >
            <UIcon name="i-lucide-x" class="size-5" />
          </button>
        </div>
      </template>
    </UModal>
  </section>
</template>
