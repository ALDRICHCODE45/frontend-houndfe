<script setup lang="ts">
import '../styles/product-images.css'
/**
 * VariantImagesPopover — The variant's photo in its table row (artboard 01): a
 * 44px thumbnail with the photo count that opens a small popover (a bottom
 * sheet on phones) with that variant's own photos. It uploads to the variant,
 * marks the main photo, deletes with a confirm and opens a photo whole; it does
 * not pick existing product photos (there is no API for that).
 *
 * Props:
 *   productId, variant, label (row label, «Talla: S»), canUpdate, canDelete
 *   v-model:open — the row ⋮ «Fotos» opens it from the owner
 */
import { computed, ref, watch } from 'vue'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import { useQuery } from '@tanstack/vue-query'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
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
  variant: ProductVariant
  label: string
  canUpdate: boolean
  canDelete: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const tenantId = useSafeTenantId()
const productId = computed(() => props.productId)
const isPhone = useMediaQuery('(max-width: 639px)')
const [DefinePanel, ReusePanel] = createReusableTemplate()
const headingId = computed(() => `variant-photos-${props.variant.id}`)

const { data: images } = useQuery({
  queryKey: computed(() => productQueryKeys.images(tenantId.value, props.productId)),
  queryFn: () => productApi.getImages(props.productId),
  enabled: computed(() => props.productId.length > 0),
  refetchOnWindowFocus: false,
})

const variantImages = computed(() => (images.value ?? []).filter((img) => img.variantId === props.variant.id))
const thumbImage = computed(() => variantImages.value.find((img) => img.isMain) ?? variantImages.value[0] ?? null)
const count = computed(() => variantImages.value.length)

const triggerLabel = computed(() => {
  if (count.value === 0) return props.canUpdate ? `${props.label}: sin fotos. Agregar fotos` : `${props.label}: sin fotos`
  return `Fotos de ${props.label}: ${count.value === 1 ? '1 foto' : `${count.value} fotos`}`
})

const subtitle = computed(() => {
  if (count.value === 0) return 'Aún no tiene fotos propias.'
  return isPhone.value
    ? `${count.value === 1 ? '1 foto' : `${count.value} fotos`} · la marcada es la principal`
    : 'Se muestran al elegir esta variante en la venta y el catálogo.'
})

const actions = useProductImageActions(productId)

const { dropZoneRef, isOverDropZone, openPicker, uploads, retry, discard, replace, reset } = useImageUpload({
  productId,
  variantId: computed(() => props.variant.id),
  enabled: computed(() => props.canUpdate),
  onSuccess: actions.invalidateImages,
})

function setPanelRef(el: unknown) {
  dropZoneRef.value = (el as HTMLElement | null) ?? null
}

// Failed files are cleared when the popover closes; uploads in flight finish.
watch(open, (isOpen) => {
  if (!isOpen) reset()
})

function photoName(image: ProductImage): string {
  return `foto ${variantImages.value.findIndex((img) => img.id === image.id) + 1} de ${props.label}`
}

const pendingDelete = ref<ProductImage | null>(null)
const previewImage = ref<ProductImage | null>(null)

function confirmDelete() {
  if (pendingDelete.value) actions.remove.mutate(pendingDelete.value.id)
  pendingDelete.value = null
}

function handleSetMain(image: ProductImage) {
  if (!image.isMain) actions.setMain.mutate(image.id)
}

/** While a confirm or the whole photo is open, the popover stays put under it. */
const dismissible = computed(() => pendingDelete.value === null && previewImage.value === null)
</script>

<template>
  <DefinePanel>
    <div :ref="setPanelRef" class="product-images-panel" data-testid="variant-photos-panel">
      <div class="product-images-panel__head">
        <div>
          <h4 :id="headingId" :aria-hidden="isPhone ? 'true' : undefined">Fotos de {{ label }}</h4>
          <p>{{ subtitle }}</p>
        </div>
        <button
          type="button"
          class="product-images-panel__close"
          :aria-label="`Cerrar fotos de ${label}`"
          @click="open = false"
        >
          <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
        </button>
      </div>
      <div class="product-images-rail">
        <ProductImageStripTile
          v-for="image in variantImages"
          :key="image.id"
          :image="image"
          :name="photoName(image)"
          :main-mark="image.isMain ? 'star' : 'none'"
          :can-set-main="canUpdate"
          :can-delete="canDelete"
          @open="previewImage = image"
          @set-main="handleSetMain(image)"
          @delete="pendingDelete = image"
        />
        <ProductImageStripUploadTile v-for="item in uploads" :key="item.id" :item="item" />
        <button
          v-if="canUpdate"
          type="button"
          class="product-images-add"
          :aria-label="`Agregar fotos a ${label}`"
          @click="openPicker()"
        >
          <UIcon name="i-lucide-plus" class="size-5" aria-hidden="true" />Agregar
        </button>
      </div>
      <ProductImageStripUploadAlerts :uploads="uploads" @retry="retry" @replace="replace" @discard="discard" />
      <button v-if="canUpdate" type="button" class="product-images-upload-btn" @click="openPicker()">
        <UIcon name="i-lucide-upload" class="size-4" aria-hidden="true" />Subir fotos a {{ label }}
      </button>
      <p v-if="canUpdate" class="product-images-hint">
        También puedes arrastrar fotos aquí · <span class="whitespace-nowrap">JPG, PNG, WEBP o GIF, máx. 10 MB</span>
      </p>
      <div v-if="isOverDropZone" class="product-images-drop" role="status">
        <UIcon name="i-lucide-upload" class="size-5" aria-hidden="true" />Suelta para subir a {{ label }}
      </div>
    </div>
  </DefinePanel>

  <UDrawer
    v-if="isPhone"
    v-model:open="open"
    direction="bottom"
    :title="`Fotos de ${label}`"
    :description="subtitle"
    :dismissible="dismissible"
    :ui="{ content: 'hf-theme hf-ui product-images-sheet' }"
  >
    <button
      type="button"
      class="product-images-vthumb"
      :class="{ 'is-empty': count === 0 }"
      :aria-label="triggerLabel"
      data-testid="variant-photos-trigger"
    >
      <img v-if="thumbImage" :src="thumbImage.url" alt="" aria-hidden="true" />
      <UIcon v-else :name="canUpdate ? 'i-lucide-plus' : 'i-lucide-image-off'" class="size-4" aria-hidden="true" />
      <span v-if="count > 1" class="product-images-vthumb__n" aria-hidden="true">{{ count }}</span>
    </button>
    <template #content>
      <ReusePanel />
    </template>
  </UDrawer>

  <UPopover
    v-else
    v-model:open="open"
    arrow
    :dismissible="dismissible"
    :content="{ side: 'bottom', align: 'start', 'aria-labelledby': headingId }"
    :ui="{ content: 'hf-theme hf-ui product-images-popover' }"
  >
    <button
      type="button"
      class="product-images-vthumb"
      :class="{ 'is-empty': count === 0 }"
      :aria-label="triggerLabel"
      data-testid="variant-photos-trigger"
    >
      <img v-if="thumbImage" :src="thumbImage.url" alt="" aria-hidden="true" />
      <UIcon v-else :name="canUpdate ? 'i-lucide-plus' : 'i-lucide-image-off'" class="size-4" aria-hidden="true" />
      <span v-if="count > 1" class="product-images-vthumb__n" aria-hidden="true">{{ count }}</span>
    </button>
    <template #content>
      <ReusePanel />
    </template>
  </UPopover>

  <ConfirmModal
    :open="pendingDelete !== null"
    title="¿Eliminar esta foto?"
    :description="`Se quita de ${label} y deja de verse en la venta y el catálogo.`"
    confirm-label="Eliminar"
    confirm-color="error"
    :loading="actions.remove.isPending.value"
    :ui="{ overlay: 'z-[60]', content: 'z-[61]' }"
    @update:open="(value: boolean) => { if (!value) pendingDelete = null }"
    @confirm="confirmDelete"
  />

  <ProductImageLightbox
    :open="previewImage !== null"
    :src="previewImage?.url ?? null"
    :alt="previewImage ? `Foto ${variantImages.findIndex((img) => img.id === previewImage!.id) + 1} de ${label}` : ''"
    @close="previewImage = null"
  />
</template>
