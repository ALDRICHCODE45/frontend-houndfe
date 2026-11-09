<script setup lang="ts">
import type { AxiosError } from 'axios'
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { productApi } from '../api/product.api'
import { mapDomainError, type DomainApiError } from '@/core/shared/utils/error.utils'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { ProductImage, ProductVariant } from '../interfaces/product.types'
import { useImageUpload } from '../composables/useImageUpload'
import ProductImageLightbox from './ProductImageLightbox.vue'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const props = defineProps<{
  productId: string
  variants: ProductVariant[]
  canUpdate: boolean
  canDelete: boolean
}>()

const toast = useToast()
const queryClient = useQueryClient()
const tenantId = useSafeTenantId()

// ── Queries ────────────────────────────────────────────────

const { data: images, isFetching, isError, refetch } = useQuery({
  queryKey: computed(() => productQueryKeys.images(tenantId.value, props.productId)),
  queryFn: () => productApi.getImages(props.productId),
  enabled: computed(() => props.productId.length > 0),
  refetchOnWindowFocus: false,
})

const allImages = computed(() => images.value ?? [])

// ── Scope tabs ─────────────────────────────────────────────

type ImageScope = 'all' | 'product' | string

const activeScope = ref<ImageScope>('all')

const scopeOptions = computed(() => {
  const options: { label: string; value: ImageScope }[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Producto', value: 'product' },
  ]

  for (const variant of props.variants) {
    options.push({ label: variant.name, value: variant.id })
  }

  return options
})

const filteredImages = computed(() => {
  if (activeScope.value === 'all') return allImages.value
  if (activeScope.value === 'product') return allImages.value.filter((img) => !img.variantId)
  return allImages.value.filter((img) => img.variantId === activeScope.value)
})

// ── Dropzone upload (reactive to scope) ────────────────────

// The variantId for upload is determined by the active scope
const uploadVariantId = computed(() => {
  if (activeScope.value === 'all' || activeScope.value === 'product') {
    return null // Upload to product level
  }
  return activeScope.value // Upload to this variant
})

const { dropZoneRef, isOverDropZone, openPicker, isUploading } = useImageUpload({
  productId: computed(() => props.productId),
  variantId: uploadVariantId,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: productQueryKeys.images(tenantId.value, props.productId) })
  },
})

// ── Upload target label ────────────────────────────────────

const uploadTargetLabel = computed(() => {
  if (activeScope.value === 'all' || activeScope.value === 'product') {
    return 'Producto'
  }
  const variant = props.variants.find((v) => v.id === activeScope.value)
  return variant?.name ?? 'Variante'
})

// ── Confirm modal ──────────────────────────────────────────

const confirmState = ref({
  open: false,
  description: '',
  onConfirm: () => {},
})

function openConfirm(description: string, onConfirm: () => void) {
  confirmState.value = { open: true, description, onConfirm }
}

function handleConfirm() {
  confirmState.value.onConfirm()
  confirmState.value.open = false
}

// ── Mutations ──────────────────────────────────────────────

async function invalidateImages() {
  await queryClient.invalidateQueries({ queryKey: productQueryKeys.images(tenantId.value, props.productId) })
}

const setMainMutation = useMutation({
  mutationFn: (imageId: string) => productApi.setMainImage(props.productId, imageId),
  onSuccess: async () => {
    toast.add({ title: 'Imagen principal actualizada', color: 'success' })
    await invalidateImages()
  },
  onError: (error) => {
    toast.add({
      title: 'Error al cambiar imagen principal',
      description: mapDomainError(error as AxiosError<DomainApiError>),
      color: 'error',
    })
  },
})

const deleteMutation = useMutation({
  mutationFn: (imageId: string) => productApi.removeImage(props.productId, imageId),
  onSuccess: async () => {
    toast.add({ title: 'Imagen eliminada', color: 'success' })
    await invalidateImages()
  },
  onError: (error) => {
    toast.add({
      title: 'Error al eliminar imagen',
      description: mapDomainError(error as AxiosError<DomainApiError>),
      color: 'error',
    })
  },
})

// ── Handlers ───────────────────────────────────────────────

function handleDropzoneClick() {
  openPicker()
}

function handleDropzoneKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openPicker()
  }
}

function handleSetMain(image: ProductImage) {
  if (image.isMain) return
  setMainMutation.mutate(image.id)
}

function handleDelete(image: ProductImage) {
  openConfirm('¿Quieres eliminar esta imagen?', () => {
    deleteMutation.mutate(image.id)
  })
}

function getVariantName(variantId: string | null): string {
  if (!variantId) return 'Producto'
  const found = props.variants.find((v) => v.id === variantId)
  return found?.name ?? 'Variante'
}

// ── Image preview modal ────────────────────────────────────

const previewImage = ref<ProductImage | null>(null)

function openPreview(image: ProductImage) {
  if (isImageBroken(image.id)) return
  previewImage.value = image
}

function closePreview() {
  previewImage.value = null
}

// ── Image error fallback ───────────────────────────────────

const brokenImages = ref<Set<string>>(new Set())

function onImageError(imageId: string) {
  brokenImages.value.add(imageId)
}

function isImageBroken(imageId: string): boolean {
  return brokenImages.value.has(imageId)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-col gap-3">
        <h3 class="text-base font-semibold text-highlighted">Imágenes</h3>

        <!-- Scope filter tabs -->
        <div v-if="variants.length > 0" class="flex flex-wrap gap-2">
          <UButton
            v-for="opt in scopeOptions"
            :key="opt.value"
            :label="opt.label"
            size="sm"
            :variant="activeScope === opt.value ? 'soft' : 'ghost'"
            :color="activeScope === opt.value ? 'primary' : 'neutral'"
            :aria-pressed="activeScope === opt.value"
            class="transition-colors duration-200"
            @click="activeScope = opt.value"
          />
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-6">
      <!-- Dropzone - PRIMARY affordance -->
      <div
        v-if="canUpdate"
        ref="dropZoneRef"
        data-dropzone
        role="button"
        tabindex="0"
        class="relative rounded-lg border-2 transition-all duration-200 cursor-pointer"
        :class="[
          isOverDropZone
            ? 'border-solid border-(--hf-active) bg-(--hf-active-soft)'
            : 'border-dashed border-default bg-default hover:border-(--hf-active) hover:bg-(--hf-active-soft)',
          isUploading ? 'pointer-events-none' : '',
        ]"
        @click="handleDropzoneClick"
        @keydown="handleDropzoneKeydown"
      >
        <div class="flex flex-col items-center justify-center py-10 px-4">
          <UIcon
            :name="isOverDropZone ? 'i-lucide-upload-cloud' : 'i-lucide-image-plus'"
            class="text-5xl mb-3 transition-colors duration-200"
            :class="isOverDropZone ? 'text-(--hf-active)' : 'text-muted'"
          />
          <p class="text-base font-medium mb-1">
            Arrastra tus imágenes aquí o haz clic para elegir
          </p>
          <p class="text-sm text-muted mb-2">JPG, PNG, WEBP o GIF — máx 10 MB</p>
          <div class="mt-2 flex items-center gap-2 text-xs font-medium text-muted">
            <UIcon name="i-lucide-folder-input" class="text-sm" aria-hidden="true" />
            <span>Subiendo a: {{ uploadTargetLabel }}</span>
          </div>
        </div>

        <!-- Upload progress overlay -->
        <div
          v-if="isUploading"
          class="absolute inset-0 bg-elevated/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-lg"
        >
          <UIcon name="i-lucide-loader-2" class="text-4xl text-(--hf-active) animate-spin" />
          <p class="text-sm font-medium">Subiendo imágenes...</p>
          <UProgress :value="100" animation="carousel" class="w-48" />
        </div>
      </div>

      <!-- Failed read: never shown as an empty gallery -->
      <EmptyState
        v-if="isError && allImages.length === 0"
        kind="error"
        title="No se pudieron cargar las imágenes"
        action-label="Reintentar"
        :action-loading="isFetching"
        @action="refetch()"
      />

      <!-- Loading -->
      <div
        v-else-if="isFetching"
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        data-testid="gallery-skeleton"
        aria-busy="true"
      >
        <USkeleton v-for="n in 4" :key="n" class="aspect-square w-full rounded-lg" />
      </div>

      <!-- Empty state -->
      <EmptyState
        v-else-if="filteredImages.length === 0"
        icon="i-lucide-image-off"
        :title="activeScope === 'all' ? 'Sin imágenes' : 'Sin imágenes en esta categoría'"
        :description="canUpdate ? 'Sube las primeras con el área de arriba.' : undefined"
      />

      <!-- Image gallery grid -->
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="image in filteredImages"
          :key="image.id"
          class="group relative rounded-lg border border-default overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer"
          :class="{ 'ring-2 ring-(--hf-active) ring-offset-2': image.isMain }"
        >
          <!-- Scope label (only in "Todas") and the Principal badge share one row that wraps, so they never overlap -->
          <div
            v-if="image.isMain || activeScope === 'all'"
            class="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start justify-between gap-1"
            data-testid="gallery-card-labels"
          >
            <span
              v-if="activeScope === 'all'"
              class="min-w-0 truncate rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm"
            >
              {{ getVariantName(image.variantId) }}
            </span>
            <StatusBadge v-if="image.isMain" class="ml-auto" label="Principal" tone="info" aria-prefix="Imagen:" />
          </div>

          <!-- Image or broken fallback -->
          <div class="aspect-square bg-elevated" @click="openPreview(image)">
            <div
              v-if="isImageBroken(image.id)"
              class="flex h-full w-full items-center justify-center"
            >
              <UIcon name="i-lucide-image-off" class="text-4xl text-muted" />
            </div>
            <img
              v-else
              :src="image.url"
              :alt="`Imagen ${getVariantName(image.variantId)} - ${image.sortOrder + 1}`"
              class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
              @error="onImageError(image.id)"
            />
          </div>

          <!-- Action buttons overlay (on hover/focus) -->
          <div
            class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex items-center justify-end gap-2"
          >
            <UTooltip v-if="canUpdate && !image.isMain" text="Marcar como principal">
              <UButton
                icon="i-lucide-star"
                color="primary"
                variant="solid"
                size="sm"
                aria-label="Marcar como imagen principal"
                :loading="setMainMutation.isPending.value"
                class="shadow-lg"
                @click.stop="handleSetMain(image)"
              />
            </UTooltip>

            <UTooltip v-if="canUpdate && image.isMain" text="Esta es la imagen principal">
              <UButton
                icon="i-lucide-star"
                color="primary"
                variant="solid"
                size="sm"
                disabled
                aria-label="Esta es la imagen principal"
                class="opacity-50"
              />
            </UTooltip>

            <UTooltip v-if="canDelete" text="Eliminar imagen">
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="solid"
                size="sm"
                aria-label="Eliminar imagen"
                :loading="deleteMutation.isPending.value"
                class="shadow-lg"
                @click.stop="handleDelete(image)"
              />
            </UTooltip>
          </div>
        </div>
      </div>
    </div>
  </UCard>

  <ConfirmModal
    :open="confirmState.open"
    :description="confirmState.description"
    confirm-label="Eliminar"
    confirm-color="error"
    :loading="deleteMutation.isPending.value"
    :ui="{ overlay: 'z-[60]', content: 'z-[61]' }"
    @update:open="confirmState.open = $event"
    @confirm="handleConfirm"
  />

  <!-- Image preview modal (lightbox) -->
  <ProductImageLightbox
    :open="previewImage !== null"
    :src="previewImage?.url ?? null"
    :alt="previewImage ? `Imagen ${getVariantName(previewImage.variantId)}` : ''"
    @close="closePreview"
  >
    <template #footer>
      <!-- Footer info -->
      <div v-if="previewImage" class="flex items-center justify-between w-full px-4 py-3">
        <div class="flex items-center gap-2">
          <StatusBadge v-if="previewImage.isMain" label="Principal" tone="info" aria-prefix="Imagen:" />
          <span class="text-sm text-muted">{{ getVariantName(previewImage.variantId) }}</span>
        </div>

        <div class="flex items-center gap-2">
          <UTooltip v-if="canUpdate && !previewImage.isMain" text="Marcar como principal">
            <UButton
              icon="i-lucide-star"
              color="primary"
              variant="soft"
              size="sm"
              aria-label="Marcar como imagen principal"
              :loading="setMainMutation.isPending.value"
              @click="handleSetMain(previewImage!)"
            />
          </UTooltip>
          <UTooltip v-if="canDelete" text="Eliminar imagen">
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              aria-label="Eliminar imagen"
              :loading="deleteMutation.isPending.value"
              @click="handleDelete(previewImage!)"
            />
          </UTooltip>
        </div>
      </div>
    </template>
  </ProductImageLightbox>
</template>
