<script setup lang="ts">
import type { AxiosError } from 'axios'
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import draggable from 'vuedraggable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { productApi } from '../api/product.api'
import { mapDomainError, type DomainApiError } from '@/core/shared/utils/error.utils'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { CreateImagePayload, ProductImage, ProductVariant } from '../interfaces/product.types'

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

// ── Filter tabs ────────────────────────────────────────────

type ImageScope = 'all' | 'product' | string

const PRODUCT_IMAGE_SCOPE_VALUE = '__product__'

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

const addImageVariantItems = computed(() => [
  { label: 'Producto', value: PRODUCT_IMAGE_SCOPE_VALUE },
  ...props.variants.map((variant) => ({
    label: variant.value?.trim() || variant.name,
    value: variant.id,
  })),
])

const filteredImages = computed(() => {
  if (activeScope.value === 'all') return allImages.value
  if (activeScope.value === 'product') return allImages.value.filter((img) => !img.variantId)
  return allImages.value.filter((img) => img.variantId === activeScope.value)
})

// Draggable model — wraps filteredImages for drag reorder
const sortableImages = computed({
  get: () => [...filteredImages.value],
  set: () => {
    // Reorder is visual-only in this phase; backend doesn't have a bulk reorder endpoint
  },
})

// ── Add image form ─────────────────────────────────────────

const newImageUrl = ref('')
const newImageVariantId = ref<string>(PRODUCT_IMAGE_SCOPE_VALUE)
const newImageIsMain = ref(false)
const urlError = ref('')
const previewUrl = ref('')
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

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function onUrlInput() {
  urlError.value = ''
  if (newImageUrl.value.trim() && isValidUrl(newImageUrl.value.trim())) {
    previewUrl.value = newImageUrl.value.trim()
  } else {
    previewUrl.value = ''
  }
}

function resetAddForm() {
  newImageUrl.value = ''
  newImageVariantId.value = PRODUCT_IMAGE_SCOPE_VALUE
  newImageIsMain.value = false
  urlError.value = ''
  previewUrl.value = ''
}

// ── Mutations ──────────────────────────────────────────────

async function invalidateImages() {
  await queryClient.invalidateQueries({ queryKey: productQueryKeys.images(props.productId) })
}

const createMutation = useMutation({
  mutationFn: (payload: CreateImagePayload) => productApi.createImage(props.productId, payload),
  onSuccess: async () => {
    resetAddForm()
    toast.add({
      title: 'Imagen agregada',
      description: 'La imagen se agregó correctamente.',
      color: 'success',
    })
    await invalidateImages()
  },
  onError: (error) => {
    toast.add({
      title: 'Error al agregar imagen',
      description: mapDomainError(error as AxiosError<DomainApiError>),
      color: 'error',
    })
  },
})

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

function handleAddImage() {
  const url = newImageUrl.value.trim()
  if (!url) {
    urlError.value = 'La URL es obligatoria.'
    return
  }
  if (!isValidUrl(url)) {
    urlError.value = 'Ingresá una URL válida (https://...).'
    return
  }
  urlError.value = ''

  const nextSortOrder = allImages.value.length

  createMutation.mutate({
    url,
    isMain: newImageIsMain.value,
    sortOrder: nextSortOrder,
    ...(newImageVariantId.value !== PRODUCT_IMAGE_SCOPE_VALUE
      ? { variantId: newImageVariantId.value }
      : {}),
  })
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
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-xl font-semibold">Imágenes</h3>
          <p class="text-sm text-muted">Gestioná las imágenes del producto y sus variantes.</p>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-5">
      <!-- Add image form -->
      <div v-if="canUpdate" class="rounded-lg border border-dashed border-default p-4">
        <p class="text-sm font-medium mb-3">Agregar imagen por URL</p>

        <div class="flex flex-col gap-3">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
            <div>
              <UInput
                v-model="newImageUrl"
                placeholder="https://cdn.ejemplo.com/imagen.jpg"
                size="lg"
                :disabled="createMutation.isPending.value"
                @input="onUrlInput"
              >
                <template #leading>
                  <UIcon name="i-lucide-link" class="text-muted" />
                </template>
              </UInput>
              <p v-if="urlError" class="mt-1 text-sm text-error">{{ urlError }}</p>
            </div>

            <USelect
              v-if="variants.length > 0"
              v-model="newImageVariantId"
              :items="addImageVariantItems"
              size="lg"
              class="w-full"
              :disabled="createMutation.isPending.value"
            />

            <UButton
              label="Agregar"
              icon="i-lucide-image-plus"
              :loading="createMutation.isPending.value"
              @click="handleAddImage"
            />
          </div>

          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <UCheckbox v-model="newImageIsMain" :disabled="createMutation.isPending.value" />
              <span>Marcar como imagen principal</span>
            </label>
          </div>

          <!-- URL Preview -->
          <div v-if="previewUrl" class="flex items-center gap-3 rounded-md bg-elevated p-3">
            <img
              :src="previewUrl"
              alt="Preview"
              class="h-16 w-16 rounded-md object-cover border border-default"
              @error="previewUrl = ''"
            />
            <p class="text-sm text-muted truncate flex-1">{{ previewUrl }}</p>
          </div>
        </div>
      </div>

      <!-- Scope filter tabs -->
      <div v-if="variants.length > 0" class="flex flex-wrap gap-1">
        <UButton
          v-for="opt in scopeOptions"
          :key="opt.value"
          :label="opt.label"
          size="xs"
          :variant="activeScope === opt.value ? 'solid' : 'ghost'"
          :color="activeScope === opt.value ? 'primary' : 'neutral'"
          @click="activeScope = opt.value"
        />
      </div>

      <!-- Loading -->
      <div v-if="isFetching" class="text-sm text-muted">Cargando imágenes...</div>

      <!-- Empty state -->
      <div
        v-else-if="filteredImages.length === 0"
        class="flex flex-col items-center justify-center py-8 text-center"
      >
        <UIcon name="i-lucide-image-off" class="text-4xl text-muted mb-2" />
        <p class="text-sm text-muted">
          {{
            activeScope === 'all' ? 'Sin imágenes registradas.' : 'Sin imágenes en esta categoría.'
          }}
        </p>
      </div>

      <!-- Image gallery -->
      <draggable
        v-else
        :list="sortableImages"
        item-key="id"
        class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
        ghost-class="opacity-30"
        handle=".drag-handle"
        animation="200"
      >
        <template #item="{ element: image }">
          <div
            class="group relative rounded-lg border border-default overflow-hidden transition-shadow hover:shadow-md"
            :class="{ 'ring-2 ring-primary ring-offset-2': image.isMain }"
          >
            <!-- Drag handle -->
            <div
              class="drag-handle absolute top-1.5 left-1.5 z-10 cursor-grab rounded bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <UIcon name="i-lucide-grip-vertical" class="text-white text-xs" />
            </div>

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
                {{ getVariantName(image.variantId) }}
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
        </template>
      </draggable>
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
</template>
