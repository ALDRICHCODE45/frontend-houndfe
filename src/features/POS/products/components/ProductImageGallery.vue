<script setup lang="ts">
import type { AxiosError } from 'axios'
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { productApi } from '../api/product.api'
import { mapDomainError, type DomainApiError } from '@/core/shared/utils/error.utils'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { ProductImage, ProductVariant } from '../interfaces/product.types'
import { useImageUpload } from '../composables/useImageUpload'

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

// ── Queries ────────────────────────────────────────────────

const { data: images, isFetching } = useQuery({
  queryKey: computed(() => productQueryKeys.images(props.productId)),
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
    await queryClient.invalidateQueries({ queryKey: productQueryKeys.images(props.productId) })
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
  await queryClient.invalidateQueries({ queryKey: productQueryKeys.images(props.productId) })
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
  openConfirm('¿Querés eliminar esta imagen?', () => {
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
        <div>
          <h3 class="text-xl font-semibold">Imágenes</h3>
          <p class="text-sm text-muted">
            Subí y gestioná las imágenes del producto y sus variantes mediante arrastrar y soltar.
          </p>
        </div>

        <!-- Scope filter tabs -->
        <div v-if="variants.length > 0" class="flex flex-wrap gap-2">
          <UButton
            v-for="opt in scopeOptions"
            :key="opt.value"
            :label="opt.label"
            size="sm"
            :variant="activeScope === opt.value ? 'solid' : 'ghost'"
            :color="activeScope === opt.value ? 'primary' : 'neutral'"
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
            ? 'border-solid border-primary bg-primary/10'
            : 'border-dashed border-default bg-default hover:border-primary/50 hover:bg-primary/5',
          isUploading ? 'pointer-events-none' : '',
        ]"
        @click="handleDropzoneClick"
        @keydown="handleDropzoneKeydown"
      >
        <div class="flex flex-col items-center justify-center py-10 px-4">
          <UIcon
            :name="isOverDropZone ? 'i-lucide-upload-cloud' : 'i-lucide-image-plus'"
            class="text-5xl mb-3 transition-colors duration-200"
            :class="isOverDropZone ? 'text-primary' : 'text-muted'"
          />
          <p class="text-base font-medium mb-1">
            Arrastrá tus imágenes aquí o hacé click para elegir
          </p>
          <p class="text-sm text-muted mb-2">JPG, PNG, WEBP o GIF — máx 10 MB</p>
          <div class="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-primary/10">
            <UIcon name="i-lucide-folder-input" class="text-sm text-primary" />
            <span class="text-xs font-medium text-primary">
              Subiendo a: {{ uploadTargetLabel }}
            </span>
          </div>
        </div>

        <!-- Upload progress overlay -->
        <div
          v-if="isUploading"
          class="absolute inset-0 bg-elevated/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-lg"
        >
          <UIcon name="i-lucide-loader-2" class="text-4xl text-primary animate-spin" />
          <p class="text-sm font-medium">Subiendo imágenes...</p>
          <UProgress :value="100" animation="carousel" class="w-48" />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isFetching" class="flex items-center justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="text-3xl text-primary animate-spin" />
        <span class="ml-3 text-sm text-muted">Cargando imágenes...</span>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="filteredImages.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <div class="w-16 h-16 rounded-full bg-elevated flex items-center justify-center mb-4">
          <UIcon name="i-lucide-image-off" class="text-3xl text-muted" />
        </div>
        <p class="text-base font-medium mb-1">
          {{ activeScope === 'all' ? 'Sin imágenes' : 'Sin imágenes en esta categoría' }}
        </p>
        <p class="text-sm text-muted max-w-sm">
          {{
            canUpdate
              ? 'Subí tus primeras imágenes usando el área de arrastrar y soltar de arriba.'
              : 'No hay imágenes disponibles en esta sección.'
          }}
        </p>
      </div>

      <!-- Image gallery grid -->
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="image in filteredImages"
          :key="image.id"
          class="group relative rounded-lg border border-default overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30 cursor-pointer"
          :class="{ 'ring-2 ring-primary ring-offset-2': image.isMain }"
        >
          <!-- Main badge - prominent when active -->
          <div
            v-if="image.isMain"
            class="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-md bg-primary shadow-sm"
          >
            <UIcon name="i-lucide-star" class="text-xs text-white" />
            <span class="text-xs font-semibold text-white">Principal</span>
          </div>

          <!-- Scope label (only in "Todas" view) -->
          <div
            v-if="activeScope === 'all'"
            class="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm"
          >
            <span class="text-xs font-medium text-white">
              {{ getVariantName(image.variantId) }}
            </span>
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
                color="warning"
                variant="solid"
                size="sm"
                :loading="setMainMutation.isPending.value"
                class="shadow-lg"
                @click.stop="handleSetMain(image)"
              />
            </UTooltip>

            <UTooltip v-if="canUpdate && image.isMain" text="Esta es la imagen principal">
              <UButton
                icon="i-lucide-star"
                color="warning"
                variant="solid"
                size="sm"
                disabled
                class="opacity-50"
              />
            </UTooltip>

            <UTooltip v-if="canDelete" text="Eliminar imagen">
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="solid"
                size="sm"
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
    @update:open="confirmState.open = $event"
    @confirm="handleConfirm"
  />

  <!-- Image preview modal (lightbox) -->
  <UModal
    :open="previewImage !== null"
    @update:open="(val: boolean) => { if (!val) closePreview() }"
  >
    <template #content>
      <div class="relative flex flex-col items-center">
        <!-- Close button -->
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="lg"
          class="absolute top-3 right-3 z-10"
          @click="closePreview"
        />

        <!-- Image -->
        <img
          v-if="previewImage"
          :src="previewImage.url"
          :alt="`Imagen ${getVariantName(previewImage.variantId)}`"
          class="max-h-[80vh] w-full object-contain rounded-lg"
        />

        <!-- Footer info -->
        <div v-if="previewImage" class="flex items-center justify-between w-full px-4 py-3">
          <div class="flex items-center gap-2">
            <UBadge v-if="previewImage.isMain" color="primary" variant="solid" size="sm">
              <UIcon name="i-lucide-star" class="mr-1" />
              Principal
            </UBadge>
            <UBadge color="neutral" variant="subtle" size="sm">
              {{ getVariantName(previewImage.variantId) }}
            </UBadge>
          </div>

          <div class="flex items-center gap-2">
            <UTooltip v-if="canUpdate && !previewImage.isMain" text="Marcar como principal">
              <UButton
                icon="i-lucide-star"
                color="warning"
                variant="ghost"
                size="sm"
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
                :loading="deleteMutation.isPending.value"
                @click="handleDelete(previewImage!)"
              />
            </UTooltip>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
