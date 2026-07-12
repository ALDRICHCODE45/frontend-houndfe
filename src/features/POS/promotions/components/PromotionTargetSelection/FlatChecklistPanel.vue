<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type {
  PromotionTargetItemFormEntry,
  PromotionTargetType,
} from '../../interfaces/promotion.types'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  /** Which flat catalog to render. Branches by API call (REQ-1, REQ-5). */
  dataSource: 'CATEGORIES' | 'BRANDS' | 'PRODUCTS'
  /** v-model: current staged entries. Parent confirms/cancels. */
  staged: PromotionTargetItemFormEntry[]
}>()

const emit = defineEmits<{
  'update:staged': [items: PromotionTargetItemFormEntry[]]
}>()

// ── Search state ─────────────────────────────────────────────────────────────

const search = ref('')

// PRODUCTS uses server-side search (REQ-5): the debounce should be small so
// the user sees server results quickly while typing. 200ms is the convention
// for the rest of the promotions app (matches ProductVariantSelector).
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const debouncedSearch = ref('')

watch(search, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = value
  }, 200)
})

// ── Catalog queries ──────────────────────────────────────────────────────────

const { data: categories } = useQuery({
  queryKey: ['flat-checklist', 'categories'] as const,
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    return productApi.getCategories()
  },
  enabled: computed(() => props.dataSource === 'CATEGORIES'),
})

const { data: brands } = useQuery({
  queryKey: ['flat-checklist', 'brands'] as const,
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    return productApi.getBrands()
  },
  enabled: computed(() => props.dataSource === 'BRANDS'),
})

const { data: products } = useQuery({
  queryKey: computed(
    () =>
      ['flat-checklist', 'products', debouncedSearch.value] as const,
  ),
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    const result = await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 20,
      sorting: [{ id: 'name', desc: false }],
      globalFilter: debouncedSearch.value || undefined,
    })
    return result.data ?? []
  },
  enabled: computed(() => props.dataSource === 'PRODUCTS'),
})

// ── Computed list (raw = unfiltered, filtered = client-side for cats/brands) ─

interface ChecklistRow {
  id: string
  name: string
}

const rawRows = computed<ChecklistRow[]>(() => {
  if (props.dataSource === 'CATEGORIES') {
    return (categories.value ?? []).map((c) => ({ id: c.id, name: c.name }))
  }
  if (props.dataSource === 'BRANDS') {
    return (brands.value ?? []).map((b) => ({ id: b.id, name: b.name }))
  }
  return (products.value ?? []).map((p) => ({ id: p.id, name: p.name }))
})

// For CATEGORIES/BRANDS we filter the full list client-side (the API returns
// the full taxonomy). For PRODUCTS the search is server-side; we just render
// whatever the backend returned for the current query.
const visibleRows = computed<ChecklistRow[]>(() => {
  if (props.dataSource === 'PRODUCTS') return rawRows.value
  const q = search.value.trim().toLowerCase()
  if (!q) return rawRows.value
  return rawRows.value.filter((r) => r.name.toLowerCase().includes(q))
})

// ── Staged helpers ───────────────────────────────────────────────────────────

const stagedIds = computed(() => new Set(props.staged.map((s) => s.targetId)))

function isStaged(id: string): boolean {
  return stagedIds.value.has(id)
}

function toggleRow(row: ChecklistRow) {
  const existing = props.staged.find((s) => s.targetId === row.id)
  if (existing) {
    emit(
      'update:staged',
      props.staged.filter((s) => s.targetId !== row.id),
    )
    return
  }
  emit('update:staged', [
    ...props.staged,
    { targetId: row.id, name: row.name },
  ])
}

// Exposed for parent tests/automation if ever needed.
defineExpose({ toggleRow, isStaged })

// ── Display helpers ─────────────────────────────────────────────────────────

const dataSourceLabel: Record<typeof props.dataSource, string> = {
  CATEGORIES: 'categorías',
  BRANDS: 'marcas',
  PRODUCTS: 'productos',
}

const searchPlaceholder = computed(() => `Buscar ${dataSourceLabel[props.dataSource]}...`)

// Suppress unused-type warning while keeping the type available for future
// type-specific formatting (Slice 3 may add per-type badges / icons).
type _ReservedType = PromotionTargetType
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Search input -->
    <UInput
      v-model="search"
      :placeholder="searchPlaceholder"
      leading-icon="i-lucide-search"
      data-testid="checklist-search"
    />

    <!-- Checklist rows. The checkbox sits OUTSIDE the row button so that
         clicking the checkbox does NOT also trigger the row's click handler
         (event bubbling would otherwise toggle the row twice). The label
         for=id links the click target to the checkbox. -->
    <div
      v-if="visibleRows.length > 0"
      class="rounded-lg border border-default bg-default max-h-72 overflow-y-auto"
    >
      <div
        v-for="row in visibleRows"
        :key="row.id"
        class="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-elevated/60 transition-colors duration-150"
        :data-testid="`checklist-row`"
        :data-row-id="row.id"
      >
        <UCheckbox
          :model-value="isStaged(row.id)"
          :aria-label="row.name"
          @update:model-value="toggleRow(row)"
        />
        <button
          type="button"
          class="flex-1 cursor-pointer text-left"
          :data-testid="`checklist-row-button`"
          @click="toggleRow(row)"
        >
          {{ row.name }}
        </button>
      </div>
    </div>

    <p
      v-else
      class="text-sm text-muted italic"
      data-testid="checklist-empty"
    >
      No hay {{ dataSourceLabel[dataSource] }} disponibles.
    </p>
  </div>
</template>
