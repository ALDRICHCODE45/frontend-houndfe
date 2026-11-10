<script setup lang="ts">
import '../styles/product-images.css'
/**
 * ProductImageStripTile — One saved photo in the image strip (artboard 01): the
 * whole tile opens the photo complete; «Principal» is a badge (lead tile) or a
 * star with its name for assistive tech, never color alone; the ⋯ menu holds
 * Ver imagen completa, Marcar como principal and a last, confirmed Eliminar….
 * Without edit rights there is no ⋯.
 *
 * Props:
 *   image      — the photo
 *   name       — how the photo is read («foto 2 de Talla S»)
 *   lead       — the large main tile of the card
 *   mainMark   — badge | star | none
 *   mainLabel  — accessible text of the star («Principal de Talla S»)
 *   starTop    — put the star at the top (the scope label takes the bottom)
 *   scopeLabel — destination shown in «Todas»
 *   canSetMain / canDelete
 *
 * Events: open, set-main, delete
 */
import { computed, ref } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { ProductImage } from '../interfaces/product.types'

const props = withDefaults(
  defineProps<{
    image: ProductImage
    name: string
    lead?: boolean
    mainMark?: 'badge' | 'star' | 'none'
    mainLabel?: string
    starTop?: boolean
    scopeLabel?: string | null
    canSetMain: boolean
    canDelete: boolean
  }>(),
  { lead: false, mainMark: 'none', mainLabel: 'Principal', starTop: false, scopeLabel: null },
)

const emit = defineEmits<{ open: []; 'set-main': []; delete: [] }>()

const broken = ref(false)

const editable = computed(() => (props.canSetMain && !props.image.isMain) || props.canDelete)

const menuItems = computed(() => {
  const regular = [
    ...(broken.value
      ? []
      : [{ label: 'Ver imagen completa', icon: 'i-lucide-maximize-2', onSelect: () => emit('open') }]),
    ...(props.canSetMain && !props.image.isMain
      ? [{ label: 'Marcar como principal', icon: 'i-lucide-star', onSelect: () => emit('set-main') }]
      : []),
  ]
  const destructive = props.canDelete
    ? [{ label: 'Eliminar…', icon: 'i-lucide-trash-2', class: 'hf-row-action-danger', onSelect: () => emit('delete') }]
    : []
  return regular.length > 0 && destructive.length > 0
    ? [...regular, { type: 'separator' as const }, ...destructive]
    : [...regular, ...destructive]
})
</script>

<template>
  <div
    class="product-images-tile"
    :class="{ 'product-images-tile--lead': lead, 'is-main': mainMark !== 'none' && lead }"
    data-testid="product-image-tile"
  >
    <span
      v-if="broken"
      class="product-images-tile__broken"
      role="img"
      :aria-label="`${name}: no se pudo mostrar`"
    >
      <UIcon name="i-lucide-image-off" class="size-6" />
    </span>
    <img v-else :src="image.url" alt="" aria-hidden="true" loading="lazy" @error="broken = true" />
    <button
      v-if="!broken"
      type="button"
      class="product-images-tile__open"
      :aria-label="`Ver imagen completa: ${name}`"
      @click="emit('open')"
    />
    <span v-if="scopeLabel" class="product-images-tile__scope" data-testid="product-image-scope">{{ scopeLabel }}</span>
    <span v-if="mainMark === 'badge'" class="product-images-tile__pin">
      <StatusBadge label="Principal" tone="info" aria-prefix="Imagen:" />
    </span>
    <span
      v-else-if="mainMark === 'star'"
      class="product-images-tile__star"
      :class="{ 'product-images-tile__star--top': starTop }"
      :title="mainLabel"
    >
      <UIcon name="i-lucide-star" aria-hidden="true" />
      <span class="sr-only">{{ mainLabel }}</span>
    </span>
    <UDropdownMenu
      v-if="editable"
      :items="menuItems"
      :content="{ align: 'end' }"
      :ui="{ content: 'hf-theme hf-ui' }"
    >
      <button type="button" class="product-images-tile__more" :aria-label="`Acciones de la ${name}`">
        <UIcon name="i-lucide-ellipsis" class="size-4" aria-hidden="true" />
      </button>
    </UDropdownMenu>
  </div>
</template>
