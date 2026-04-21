<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type {
  PromotionTargetItemFormEntry,
  PromotionTargetType,
} from '../interfaces/promotion.types'
import { TARGET_TYPE_OPTIONS } from '../composables/usePromotionForm'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    targetType: PromotionTargetType
    selectedItems: PromotionTargetItemFormEntry[]
    side?: 'DEFAULT' | 'BUY' | 'GET'
    label?: string
  }>(),
  {
    side: 'DEFAULT',
    label: undefined,
  },
)

const emit = defineEmits<{
  'update:targetType': [type: PromotionTargetType]
  'update:selectedItems': [items: PromotionTargetItemFormEntry[]]
}>()

// ── Search state ──────────────────────────────────────────────────────────────

const searchQuery = ref('')

// ── Catalog queries ───────────────────────────────────────────────────────────

const { data: categoryResults } = useQuery({
  queryKey: ['categories-search', searchQuery],
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    const results = await productApi.getCategories()
    if (!searchQuery.value) return results
    const q = searchQuery.value.toLowerCase()
    return results.filter((c: { name: string }) => c.name.toLowerCase().includes(q))
  },
  enabled: () => props.targetType === 'CATEGORIES',
})

const { data: brandResults } = useQuery({
  queryKey: ['brands-search', searchQuery],
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    const results = await productApi.getBrands()
    if (!searchQuery.value) return results
    const q = searchQuery.value.toLowerCase()
    return results.filter((b: { name: string }) => b.name.toLowerCase().includes(q))
  },
  enabled: () => props.targetType === 'BRANDS',
})

const { data: productResults } = useQuery({
  queryKey: ['products-search', searchQuery],
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    const result = await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 20,
      sorting: [{ id: 'name', desc: false }],
      globalFilter: searchQuery.value,
    })
    return result.data ?? []
  },
  enabled: () => props.targetType === 'PRODUCTS',
})

// ── Computed catalog items ────────────────────────────────────────────────────

const catalogItems = computed<Array<{ id: string; name: string }>>(() => {
  if (props.targetType === 'CATEGORIES') return categoryResults.value ?? []
  if (props.targetType === 'BRANDS') return brandResults.value ?? []
  if (props.targetType === 'PRODUCTS') return productResults.value ?? []
  return []
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function onTargetTypeChange(type: PromotionTargetType) {
  emit('update:targetType', type)
  emit('update:selectedItems', [])
  searchQuery.value = ''
}

function addItem(id: string, name: string) {
  if (props.selectedItems.some((i) => i.targetId === id)) return
  emit('update:selectedItems', [...props.selectedItems, { targetId: id, name }])
  searchQuery.value = ''
}

function removeItem(id: string) {
  emit(
    'update:selectedItems',
    props.selectedItems.filter((i) => i.targetId !== id),
  )
}

// ── Empty state text ──────────────────────────────────────────────────────────

const emptyStateLabel = computed(() => {
  const typeMap: Record<PromotionTargetType, string> = {
    CATEGORIES: 'categorías',
    BRANDS: 'marcas',
    PRODUCTS: 'productos',
  }
  const noun = typeMap[props.targetType]
  return `Elige los ${noun} a los que aplicará la promoción`
})

defineExpose({ addItem, removeItem, onTargetTypeChange })
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Optional label -->
    <p v-if="label" class="text-sm font-medium text-toned">
      {{ label }}
    </p>

    <!-- Target type radio group -->
    <URadioGroup
      :model-value="targetType"
      :items="TARGET_TYPE_OPTIONS"
      value-key="value"
      label-key="label"
      orientation="horizontal"
      @update:model-value="onTargetTypeChange($event as PromotionTargetType)"
    />

    <!-- Search input -->
    <UInput
      v-model="searchQuery"
      :placeholder="`Buscar ${targetType === 'CATEGORIES' ? 'categorías' : targetType === 'BRANDS' ? 'marcas' : 'productos'}...`"
      leading-icon="i-lucide-search"
      data-testid="target-search-input"
    />

    <!-- Catalog results dropdown -->
    <div
      v-if="catalogItems.length > 0"
      class="rounded-lg border border-default bg-default max-h-48 overflow-y-auto"
    >
      <button
        v-for="item in catalogItems"
        :key="item.id"
        type="button"
        class="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-elevated/60 transition-colors duration-150"
        @click="addItem(item.id, item.name)"
      >
        <span>{{ item.name }}</span>
        <UIcon name="i-lucide-plus" class="h-4 w-4 text-dimmed" />
      </button>
    </div>

    <!-- Selected items chips -->
    <div
      v-if="selectedItems.length > 0"
      data-testid="selected-items"
      class="flex flex-wrap gap-2"
    >
      <UBadge
        v-for="item in selectedItems"
        :key="item.targetId"
        variant="subtle"
        class="gap-1 pr-1"
      >
        {{ item.name || item.targetId }}
        <button
          type="button"
          class="cursor-pointer ml-1 rounded-full hover:bg-elevated transition-colors"
          @click="removeItem(item.targetId)"
        >
          <UIcon name="i-lucide-x" class="h-3 w-3" />
        </button>
      </UBadge>
    </div>

    <!-- Empty state -->
    <p
      v-if="selectedItems.length === 0"
      data-testid="empty-state"
      class="text-sm text-muted italic"
    >
      {{ emptyStateLabel }}
    </p>
  </div>
</template>
