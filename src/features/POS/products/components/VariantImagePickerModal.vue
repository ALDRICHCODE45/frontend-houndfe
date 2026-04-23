<script setup lang="ts">
import type { AxiosError } from 'axios'
import { computed, ref, watch } from 'vue'
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

interface Props {
  open: boolean
  productId: string
  productName: string
  variant: ProductVariant
  canUpdate: boolean
  canDelete: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const toast = useToast()
const queryClient = useQueryClient()

// ── Variant images query ────────────────────────────────────

const { data: images, isFetching } = useQuery({
  queryKey: computed(() => productQueryKeys.images(props.productId)),
  queryFn: () => productApi.getImages(props.productId),
  enabled: computed(() => props.open && props.productId.length > 0),
  refetchOnWindowFocus: false,
})

// Filter images for this variant
const variantImages = computed(() => {
  if (!images.value) return []
  return images.value.filter((img) => img.variantId === props.variant.id)
})

// ── Dropzone upload ────────────────────────────────────────

async function invalidateImages() {
  await queryClient.invalidateQueries({ queryKey: productQueryKeys.images(props.productId) })
}

const { dropZoneRef, isOverDropZone, openPicker, isUploading, reset } = useImageUpload({
  productId: computed(() => props.productId),
  variantId: computed(() => props.variant.id),
  onSuccess: invalidateImages,
})

// Reset upload state when modal closes
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      reset()
    }
  }
)

// ── Mutations ──────────────────────────────────────────────

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

function handleSetMain(image: ProductImage) {
  if (image.isMain) return
  setMainMutation.mutate(image.id)
}

function handleDelete(image: ProductImage) {
  openConfirm('¿Querés eliminar esta imagen?', () => {
    deleteMutation.mutate(image.id)
  })
}

function handleClose() {
  emit('update:open', false)
}

// ── Image error fallback ───────────────────────────────────

const brokenImages = ref<Set<string>>(new Set())

function onImageError(imageId: string) {
  brokenImages.value.add(imageId)
}

function isImageBroken(imageId: string): boolean {
  return brokenImages.value.has(imageId)
}

const modalTitle = computed(() => {
  return `Elegir Fotos de ${props.productName} ${props.variant.value || props.variant.name}`
})
</script>

<template>
  <UModal
    :open="open"
    :title="modalTitle"
    :content="{ class: 'sm:max-w-5xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-5">
      <!-- Dropzone - variant-scoped -->
      <div
        v-if="canUpdate"
        ref="dropZoneRef"
        data-dropzone
        role="button"
        tabindex="0"
        class="relative rounded-lg border transition-all cursor-pointer"
        :class="[
          isOverDropZone
            ? 'border-solid border-primary bg-primary/10'
            : 'border-dashed border-default bg-default',
          isUploading ? 'pointer-events-none' : '',
        ]"
        @click="handleDropzoneClick"
        @keydown="handleDropzoneKeydown"
      >
        <div class="flex flex-col items-center justify-center py-12 px-4">
          <UIcon
            :name="isOverDropZone ? 'i-lucide-upload-cloud' : 'i-lucide-image-plus'"
            class="text-5xl mb-3"
            :class="isOverDropZone ? 'text-primary' : 'text-muted'"
          />
          <p class="text-base font-medium mb-1">
            Arrastrá tus imágenes aquí o hacé click para elegir
          </p>
          <p class="text-sm text-muted">JPG, PNG, WEBP o GIF — máx 10 MB</p>
        </div>

        <!-- Upload progress overlay -->
        <div
          v-if="isUploading"
          class="absolute inset-0 bg-elevated/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-lg"
        >
          <UIcon name="i-lucide-loader-2" class="text-4xl text-primary animate-spin" />
          <p class="text-sm font-medium">Subiendo imágenes...</p>
          <UProgress :value="100" animation="carousel" class="w-48" />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isFetching" class="text-sm text-muted">Cargando imágenes...</div>

      <!-- Empty state -->
      <div
        v-else-if="variantImages.length === 0"
        class="flex flex-col items-center justify-center py-8 text-center"
      >
        <UIcon name="i-lucide-image-off" class="text-4xl text-muted mb-2" />
        <p class="text-sm text-muted">Sin imágenes para esta variante.</p>
      </div>

      <!-- Variant image gallery -->
      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div
          v-for="image in variantImages"
          :key="image.id"
          class="group relative rounded-lg border border-default overflow-hidden transition-shadow hover:shadow-md"
          :class="{ 'ring-2 ring-primary ring-offset-2': image.isMain }"
        >
          <!-- Main badge -->
          <div v-if="image.isMain" class="absolute top-1.5 right-1.5 z-10">
            <UBadge color="primary" size="xs" variant="solid"> Principal </UBadge>
          </div>

          <!-- Image or broken fallback -->
          <div class="aspect-square bg-elevated">
            <div
              v-if="isImageBroken(image.id)"
              class="flex h-full w-full items-center justify-center"
            >
              <UIcon name="i-lucide-image-off" class="text-3xl text-muted" />
            </div>
            <img
              v-else
              :src="image.url"
              :alt="`Imagen ${image.sortOrder + 1}`"
              class="h-full w-full object-cover"
              loading="lazy"
              @error="onImageError(image.id)"
            />
          </div>

          <!-- Info footer -->
          <div class="flex items-center justify-between gap-1 p-2">
            <span class="text-xs text-muted truncate">
              {{ variant.value || variant.name }}
            </span>

            <div class="flex items-center gap-0.5 shrink-0">
              <UTooltip v-if="canUpdate && !image.isMain" text="Marcar como principal">
                <UButton
                  icon="i-lucide-star"
                  color="warning"
                  variant="ghost"
                  size="2xs"
                  :loading="setMainMutation.isPending.value"
                  @click="handleSetMain(image)"
                />
              </UTooltip>

              <UTooltip v-if="canDelete" text="Eliminar imagen">
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="2xs"
                  :loading="deleteMutation.isPending.value"
                  @click="handleDelete(image)"
                />
              </UTooltip>
            </div>
          </div>
        </div>
      </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cerrar" color="neutral" variant="outline" @click="handleClose" />
      </div>
    </template>
  </UModal>

  <ConfirmModal
    :open="confirmState.open"
    :description="confirmState.description"
    confirm-label="Eliminar"
    confirm-color="error"
    :loading="deleteMutation.isPending.value"
    @update:open="confirmState.open = $event"
    @confirm="handleConfirm"
  />
</template>
