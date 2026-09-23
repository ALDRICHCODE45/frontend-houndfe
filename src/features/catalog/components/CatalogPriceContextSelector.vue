<script setup lang="ts">
import { computed } from 'vue'
import type { CatalogPriceContextsState } from '../composables/useCatalogPriceContexts'
import type { PublicCatalogPriceContextDto } from '../interfaces/public-catalog-price-context.types'

/**
 * Price-context selector for the public catalog header.
 *
 * It is a fully controlled surface: the selected value is always derived from the
 * URL proposal in the view, and the component only relays the visitor's intent
 * through `select`. A rejected router navigation leaves the proposal untouched, so
 * this component never claims a selection by itself.
 */
const props = defineProps<{
  options: PublicCatalogPriceContextDto[]
  state: CatalogPriceContextsState
  modelValue: string | null
}>()
const emit = defineEmits<{ select: [priceListId: string]; retry: [] }>()

const isReady = computed(() => props.state === 'populated')
const isLoading = computed(() => props.state === 'loading' || props.state === 'retry-pending')

/** Neutral absence copy. The selector never invents a context for a failed discovery. */
const message = computed(() => {
  switch (props.state) {
    case 'empty':
      return 'No hay listas de precios publicadas'
    case 'unavailable':
      return 'La lista de precios no está disponible.'
    case 'rate-limit':
      return 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
    case 'network':
      return 'No se pudo conectar. Revisa tu conexión.'
    default:
      return 'No pudimos cargar las listas de precios.'
  }
})

function onSelect(value: string | null) {
  if (typeof value !== 'string' || value.trim().length === 0) return
  emit('select', value)
}
</script>

<template>
  <div
    v-if="state !== 'idle'"
    data-testid="catalog-price-context-selector"
    class="flex w-full min-w-0 flex-col gap-1 sm:w-56"
  >
    <USelectMenu
      :model-value="modelValue"
      :items="options"
      value-key="priceListId"
      label-key="name"
      :loading="isLoading"
      :disabled="!isReady"
      placeholder="Elegir lista de precios"
      class="w-full min-w-0"
      :ui="{ base: 'min-h-11' }"
      aria-label="Lista de precios"
      data-testid="catalog-price-context-menu"
      @update:model-value="onSelect"
    />

    <div
      v-if="isLoading"
      role="status"
      aria-busy="true"
      data-testid="catalog-price-context-loading"
      class="text-xs text-toned"
    >
      {{ state === 'retry-pending' ? 'Reintentando listas…' : 'Cargando listas de precios…' }}
    </div>

    <template v-else-if="!isReady">
      <p role="status" data-testid="catalog-price-context-message" class="text-xs text-toned">
        {{ message }}
      </p>
      <UButton
        color="primary"
        variant="solid"
        size="sm"
        icon="i-lucide-refresh-cw"
        aria-label="Reintentar listas de precios"
        class="min-h-11 self-start"
        @click="emit('retry')"
      >
        Reintentar
      </UButton>
    </template>
  </div>
</template>
