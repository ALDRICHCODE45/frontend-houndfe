<script setup lang="ts">
import '../styles/product-images.css'
/**
 * ProductImageGallery — The «Imágenes» card of Presentaciones (artboard 01
 * «Tira compacta»): the main photo large on the left and the rest in a strip
 * with an inline «Agregar» tile. Toggle chips (Todas / Producto / each variant)
 * filter the strip and also choose where new photos go; in «Todas» each photo
 * says where it belongs. Files can be dropped anywhere on the card. Each file
 * shows its own progress, and a file that fails stays beside the strip with
 * what to do. Without edit rights there is no «Agregar», ⋯ or drop.
 */
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { productApi } from '../api/product.api'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { ProductImage, ProductVariant } from '../interfaces/product.types'
import { useImageUpload, useProductImageActions } from '../composables/useImageUpload'
import ProductImageLightbox from './ProductImageLightbox.vue'
import ProductImageStripTile from './ProductImageStripTile.vue'
import ProductImageStripUploadTile from './ProductImageStripUploadTile.vue'
import ProductImageStripUploadAlerts from './ProductImageStripUploadAlerts.vue'

const props = defineProps<{
  productId: string
  variants: ProductVariant[]
  canUpdate: boolean
  canDelete: boolean
}>()

const tenantId = useSafeTenantId()
const productId = computed(() => props.productId)

// ── Query ──────────────────────────────────────────────────

const { data: images, isLoading, isFetching, isError, refetch } = useQuery({
  queryKey: computed(() => productQueryKeys.images(tenantId.value, props.productId)),
  queryFn: () => productApi.getImages(props.productId),
  enabled: computed(() => props.productId.length > 0),
  refetchOnWindowFocus: false,
})

const allImages = computed(() => images.value ?? [])

// ── Scope chips (also the upload destination) ──────────────

type ImageScope = 'all' | 'product' | string

const activeScope = ref<ImageScope>('all')

function variantLabel(variant: ProductVariant): string {
  return variant.value?.trim() || variant.name
}

/** Short name of where a photo belongs: «Producto» or the variant's value. */
function destinationOf(variantId: string | null): string {
  if (!variantId) return 'Producto'
  const found = props.variants.find((variant) => variant.id === variantId)
  return found ? variantLabel(found) : 'Variante'
}

const scopeOptions = computed(() => [
  { label: 'Todas', value: 'all' as ImageScope, count: allImages.value.length },
  { label: 'Producto', value: 'product' as ImageScope, count: allImages.value.filter((img) => !img.variantId).length },
  ...props.variants.map((variant) => ({
    label: variantLabel(variant),
    value: variant.id as ImageScope,
    count: allImages.value.filter((img) => img.variantId === variant.id).length,
  })),
])

const isVariantScope = computed(() => activeScope.value !== 'all' && activeScope.value !== 'product')

const filteredImages = computed(() => {
  if (activeScope.value === 'all') return allImages.value
  if (activeScope.value === 'product') return allImages.value.filter((img) => !img.variantId)
  return allImages.value.filter((img) => img.variantId === activeScope.value)
})

/** The large tile: the scope's main photo (the product's in «Todas»), else the first. */
const leadImage = computed<ProductImage | null>(() => {
  const list = filteredImages.value
  const main =
    activeScope.value === 'all'
      ? list.find((img) => img.isMain && !img.variantId)
      : list.find((img) => img.isMain)
  return main ?? list[0] ?? null
})

const railImages = computed(() => filteredImages.value.filter((img) => img.id !== leadImage.value?.id))

const uploadVariantId = computed(() => (isVariantScope.value ? activeScope.value : null))
const destinationLabel = computed(() => destinationOf(uploadVariantId.value))
/** «al producto» / «a Talla S», for the hint under the strip. */
const destinationPhrase = computed(() =>
  uploadVariantId.value ? { prefix: 'a', name: destinationLabel.value } : { prefix: 'al', name: 'producto' },
)

// ── Upload ─────────────────────────────────────────────────

const actions = useProductImageActions(productId)

const { dropZoneRef, isOverDropZone, openPicker, uploads, progressLabel, retry, discard, replace } = useImageUpload({
  productId,
  variantId: uploadVariantId,
  enabled: computed(() => props.canUpdate),
  onSuccess: actions.invalidateImages,
})

const scopeUploads = computed(() => {
  if (activeScope.value === 'all') return uploads.value
  return uploads.value.filter((item) => item.variantId === uploadVariantId.value)
})

const countLabel = computed(() => {
  const count = allImages.value.length
  if (count === 0) return 'Sin fotos'
  return count === 1 ? '1 foto' : `${count} fotos`
})

const isReadOnly = computed(() => !props.canUpdate && !props.canDelete)
const showEmpty = computed(() => filteredImages.value.length === 0 && scopeUploads.value.length === 0)

const emptyTitle = computed(() =>
  isVariantScope.value ? `${destinationLabel.value} aún no tiene fotos propias` : 'Aún no hay fotos',
)
const emptyDescription = computed(() =>
  isVariantScope.value
    ? 'Se muestran al elegir esta variante en la venta y el catálogo. También puedes arrastrarlas aquí.'
    : 'La primera que subas será la principal: la que ven en la venta y el catálogo. También puedes arrastrarlas aquí.',
)

// ── Names ──────────────────────────────────────────────────

/** «foto 2 de Talla S» / «foto 1 del producto», numbered within its destination. */
function photoName(image: ProductImage): string {
  const siblings = allImages.value.filter((img) => img.variantId === image.variantId)
  const position = siblings.findIndex((img) => img.id === image.id) + 1
  return image.variantId ? `foto ${position} de ${destinationOf(image.variantId)}` : `foto ${position} del producto`
}

function leadName(image: ProductImage): string {
  return image.isMain ? `${photoName(image)}, principal` : photoName(image)
}

// ── Actions ────────────────────────────────────────────────

const pendingDelete = ref<ProductImage | null>(null)

function handleSetMain(image: ProductImage) {
  if (image.isMain) return
  actions.setMain.mutate(image.id)
}

function handleDelete(image: ProductImage) {
  pendingDelete.value = image
}

function confirmDelete() {
  if (pendingDelete.value) actions.remove.mutate(pendingDelete.value.id)
  pendingDelete.value = null
}

const previewImage = ref<ProductImage | null>(null)

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
</script>

<template>
  <section ref="dropZoneRef" class="product-images" aria-labelledby="product-images-title" data-testid="product-images">
    <UCard>
      <template #header>
        <div class="product-images-head">
          <h3 id="product-images-title">Imágenes</h3>
          <span
            class="product-images-count"
            :role="progressLabel ? 'status' : undefined"
            data-testid="product-images-count"
          >{{ progressLabel ?? countLabel }}</span>
          <span v-if="isReadOnly" class="product-images-ro">
            <UIcon name="i-lucide-lock" aria-hidden="true" />Solo lectura
          </span>
          <div v-if="variants.length > 0" class="product-images-chips" role="group" aria-label="Mostrar fotos de">
            <button
              v-for="opt in scopeOptions"
              :key="opt.value"
              type="button"
              class="product-images-chip"
              :aria-pressed="activeScope === opt.value"
              @click="activeScope = opt.value"
            >
              <UIcon v-if="activeScope === opt.value" name="i-lucide-check" class="product-images-chip__check" aria-hidden="true" />
              {{ opt.label }} <span class="product-images-chip__n">{{ opt.count }}</span>
            </button>
          </div>
        </div>
      </template>

      <!-- Failed read: never shown as an empty card -->
      <div
        v-if="isError && allImages.length === 0"
        class="product-images-alert"
        role="alert"
        data-testid="product-images-load-error"
      >
        <UIcon name="i-lucide-triangle-alert" class="product-images-alert__icon" aria-hidden="true" />
        <span class="min-w-0"><b>No se pudieron cargar las imágenes.</b> Tus fotos siguen guardadas.</span>
        <span class="product-images-alert__actions">
          <UButton
            label="Reintentar"
            icon="i-lucide-rotate-cw"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="isFetching"
            @click="refetch()"
          />
        </span>
      </div>

      <div v-else-if="isLoading" class="product-images-skeleton" data-testid="gallery-skeleton" aria-busy="true">
        <USkeleton v-for="n in 4" :key="n" />
      </div>

      <template v-else>
        <div v-if="showEmpty" class="product-images-empty">
          <button
            v-if="canUpdate"
            type="button"
            class="product-images-add product-images-add--empty"
            :aria-label="`Agregar fotos a ${destinationLabel}`"
            data-testid="product-images-add"
            @click="openPicker()"
          >
            <UIcon name="i-lucide-upload" class="size-5" aria-hidden="true" />Subir fotos
          </button>
          <div>
            <span class="product-images-empty__title">{{ emptyTitle }}</span>
            <template v-if="canUpdate">
              <p>{{ emptyDescription }}</p>
              <p class="product-images-hint"><span class="whitespace-nowrap">JPG, PNG, WEBP o GIF, máx. 10 MB</span></p>
            </template>
          </div>
        </div>

        <template v-else>
          <div class="product-images-strip">
            <div v-if="leadImage" data-testid="product-images-lead">
              <ProductImageStripTile
                :image="leadImage"
                :name="leadName(leadImage)"
                lead
                :main-mark="leadImage.isMain ? 'badge' : 'none'"
                :can-set-main="canUpdate"
                :can-delete="canDelete"
                @open="previewImage = leadImage"
                @set-main="handleSetMain(leadImage)"
                @delete="handleDelete(leadImage)"
              />
            </div>
            <div class="product-images-rail" data-testid="product-images-rail">
              <ProductImageStripTile
                v-for="image in railImages"
                :key="image.id"
                :image="image"
                :name="photoName(image)"
                :main-mark="image.isMain ? 'star' : 'none'"
                :main-label="activeScope === 'all' ? `Principal de ${destinationOf(image.variantId)}` : 'Principal'"
                :star-top="activeScope === 'all'"
                :scope-label="activeScope === 'all' ? destinationOf(image.variantId) : null"
                :can-set-main="canUpdate"
                :can-delete="canDelete"
                @open="previewImage = image"
                @set-main="handleSetMain(image)"
                @delete="handleDelete(image)"
              />
              <ProductImageStripUploadTile v-for="item in scopeUploads" :key="item.id" :item="item" />
              <button
                v-if="canUpdate"
                type="button"
                class="product-images-add"
                :aria-label="`Agregar fotos a ${destinationLabel}`"
                data-testid="product-images-add"
                @click="openPicker()"
              >
                <UIcon name="i-lucide-plus" class="size-5" aria-hidden="true" />Agregar
              </button>
            </div>
          </div>
          <button v-if="canUpdate" type="button" class="product-images-upload-btn" @click="openPicker()">
            <UIcon name="i-lucide-upload" class="size-4" aria-hidden="true" />
            Subir fotos {{ destinationPhrase.prefix }} {{ destinationPhrase.name }}
          </button>
          <p v-if="canUpdate" class="product-images-hint">
            Arrastra fotos a esta tarjeta para subirlas {{ destinationPhrase.prefix }}
            <b>{{ destinationPhrase.name }}</b> · <span class="whitespace-nowrap">JPG, PNG, WEBP o GIF, máx. 10 MB</span>
          </p>
        </template>

        <ProductImageStripUploadAlerts
          :uploads="uploads"
          @retry="retry"
          @replace="replace"
          @discard="discard"
        />
      </template>
    </UCard>

    <div v-if="isOverDropZone" class="product-images-drop" role="status" data-testid="product-images-drop">
      <UIcon name="i-lucide-upload" class="size-5" aria-hidden="true" />
      Suelta para subir a {{ destinationLabel }}
      <small v-if="variants.length > 0 && !isVariantScope">
        Para una variante, elige su chip antes o suéltalas en su popover
      </small>
    </div>
  </section>

  <ConfirmModal
    :open="pendingDelete !== null"
    title="¿Eliminar esta foto?"
    :description="pendingDelete ? `Se quita de ${destinationOf(pendingDelete.variantId)} y deja de verse en la venta y el catálogo.` : ''"
    confirm-label="Eliminar"
    confirm-color="error"
    :loading="actions.remove.isPending.value"
    :ui="{ overlay: 'z-[60]', content: 'z-[61]' }"
    @update:open="(open: boolean) => { if (!open) pendingDelete = null }"
    @confirm="confirmDelete"
  />

  <ProductImageLightbox
    :open="previewImage !== null"
    :src="previewImage?.url ?? null"
    :alt="previewImage ? capitalize(photoName(previewImage)) : ''"
    @close="previewImage = null"
  >
    <template #footer>
      <div v-if="previewImage" class="flex w-full items-center justify-between gap-2 px-4 py-3">
        <div class="flex min-w-0 items-center gap-2">
          <StatusBadge v-if="previewImage.isMain" label="Principal" tone="info" aria-prefix="Imagen:" />
          <span class="truncate text-sm text-muted">{{ destinationOf(previewImage.variantId) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="canUpdate && !previewImage.isMain"
            label="Marcar como principal"
            icon="i-lucide-star"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="actions.setMain.isPending.value"
            @click="handleSetMain(previewImage!)"
          />
          <UButton
            v-if="canDelete"
            label="Eliminar…"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            @click="handleDelete(previewImage!)"
          />
        </div>
      </div>
    </template>
  </ProductImageLightbox>
</template>
