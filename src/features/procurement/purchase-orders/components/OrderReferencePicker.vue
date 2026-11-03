<script setup lang="ts">
import { computed } from 'vue'
export interface OrderReferenceOption { id: string; label: string }
const props = defineProps<{
  modelValue: OrderReferenceOption | null
  items: OrderReferenceOption[]
  searchTerm: string
  placeholder: string
  searchPlaceholder: string
  clearLabel?: string
  loading?: boolean
  disabled?: boolean
  error?: boolean
  hasPrevious?: boolean
  hasNext?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: OrderReferenceOption | null]
  'update:searchTerm': [value: string]
  previous: []; next: []; retry: []
}>()
// Keep the selected label even when server search or cursor pagination changes
// the page. Only the persisted supplier may contribute an archived option.
const options = computed(() => [
  ...(props.clearLabel ? [{ id: '', label: props.clearLabel }] : []),
  ...(props.modelValue && !props.items.some(item => item.id === props.modelValue?.id) ? [props.modelValue] : []),
  ...props.items,
])
function select(id: string) {
  if (!props.disabled) emit('update:modelValue', options.value.find(item => item.id === id && item.id !== '') ?? null)
}
</script>

<template>
  <USelectMenu :model-value="modelValue?.id ?? ''" :search-term="searchTerm" :items="options"
    value-key="id" label-key="label" :ignore-filter="true" :loading="loading" :disabled="disabled"
    :placeholder="placeholder" :search-input="{ placeholder: searchPlaceholder }" class="w-full"
    :ui="{ content: 'hf-theme hf-ui purchase-orders-portal' }"
    @update:model-value="select" @update:search-term="emit('update:searchTerm', $event)">
    <template #empty><span>{{ loading ? 'Buscando…' : 'No hay resultados para esta búsqueda.' }}</span></template>
    <template #content-bottom>
      <div v-if="error" role="alert" class="order-picker-footer">No se pudieron cargar las opciones. <UButton type="button" color="neutral" variant="outline" :disabled="loading || disabled" @click="emit('retry')">Reintentar</UButton></div>
      <div v-if="hasPrevious || hasNext" class="order-picker-footer order-actions" aria-label="Páginas de opciones">
        <UButton type="button" color="neutral" variant="outline" :disabled="!hasPrevious || loading || disabled" @click="emit('previous')">Anteriores</UButton>
        <UButton type="button" data-testid="picker-next" color="neutral" variant="outline" :disabled="!hasNext || loading || disabled" @click="emit('next')">Siguientes</UButton>
      </div>
    </template>
  </USelectMenu>
</template>
