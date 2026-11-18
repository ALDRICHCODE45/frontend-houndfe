<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { PromotionTargetItemFormEntry } from '../../interfaces/promotion.types'
import { PROMOTION_TARGET_TYPE } from '../../constants/promotion.constants'
import { HfSelectableRows, type HfSelectableRowItem } from '@/core/shared/components/selection'

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
  enabled: computed(() => props.dataSource === PROMOTION_TARGET_TYPE.CATEGORIES),
})

const { data: brands } = useQuery({
  queryKey: ['flat-checklist', 'brands'] as const,
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    return productApi.getBrands()
  },
  enabled: computed(() => props.dataSource === PROMOTION_TARGET_TYPE.BRANDS),
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
  enabled: computed(() => props.dataSource === PROMOTION_TARGET_TYPE.PRODUCTS),
})

// ── Computed list (raw = unfiltered, filtered = client-side for cats/brands) ─

interface ChecklistRow {
  id: string
  name: string
}

const rawRows = computed<ChecklistRow[]>(() => {
  if (props.dataSource === PROMOTION_TARGET_TYPE.CATEGORIES) {
    return (categories.value ?? []).map((c) => ({ id: c.id, name: c.name }))
  }
  if (props.dataSource === PROMOTION_TARGET_TYPE.BRANDS) {
    return (brands.value ?? []).map((b) => ({ id: b.id, name: b.name }))
  }
  return (products.value ?? []).map((p) => ({ id: p.id, name: p.name }))
})

// For CATEGORIES/BRANDS we filter the full list client-side (the API returns
// the full taxonomy). For PRODUCTS the search is server-side; we just render
// whatever the backend returned for the current query.
const visibleRows = computed<ChecklistRow[]>(() => {
  if (props.dataSource === PROMOTION_TARGET_TYPE.PRODUCTS) return rawRows.value
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

// ── Selectable rows (Selección sin checkboxes) ───────────────────────────────

const rowItems = computed<HfSelectableRowItem[]>(() =>
  visibleRows.value.map((row) => ({ value: row.id, label: row.name })),
)

/** Every staged id, so entries hidden by the search keep their place. */
const stagedIdList = computed(() => props.staged.map((s) => s.targetId))

/** Apply the one toggled visible row through the same add/remove as before. */
function onSelectionUpdate(next: string[]) {
  const after = new Set(next)
  const row = visibleRows.value.find((r) => stagedIds.value.has(r.id) !== after.has(r.id))
  if (row) toggleRow(row)
}

// Exposed for parent tests/automation if ever needed.
defineExpose({ toggleRow, isStaged })

// ── Display helpers ─────────────────────────────────────────────────────────

const dataSourceLabel: Record<typeof props.dataSource, string> = {
  [PROMOTION_TARGET_TYPE.CATEGORIES]: 'categorías',
  [PROMOTION_TARGET_TYPE.BRANDS]: 'marcas',
  [PROMOTION_TARGET_TYPE.PRODUCTS]: 'productos',
}

const searchPlaceholder = computed(() => `Buscar ${dataSourceLabel[props.dataSource]}...`)

const listLabel: Record<typeof props.dataSource, string> = {
  [PROMOTION_TARGET_TYPE.CATEGORIES]: 'Categorías',
  [PROMOTION_TARGET_TYPE.BRANDS]: 'Marcas',
  [PROMOTION_TARGET_TYPE.PRODUCTS]: 'Productos',
}

const countNouns: Record<typeof props.dataSource, [string, string, string]> = {
  [PROMOTION_TARGET_TYPE.CATEGORIES]: ['categoría', 'categorías', 'seleccionada'],
  [PROMOTION_TARGET_TYPE.BRANDS]: ['marca', 'marcas', 'seleccionada'],
  [PROMOTION_TARGET_TYPE.PRODUCTS]: ['producto', 'productos', 'seleccionado'],
}

/** Counts every staged entry, the ones hidden by the search included. */
function countLabel(selected: number): string {
  const [one, many, chosen] = countNouns[props.dataSource]
  return selected === 1 ? `1 ${one} ${chosen}` : `${selected} ${many} ${chosen}s`
}
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

    <!-- Selectable rows: the whole row is the target, a round mark shows the state. -->
    <HfSelectableRows
      v-if="visibleRows.length > 0"
      class="promotions-scroll-rows"
      :items="rowItems"
      :model-value="stagedIdList"
      :label="listLabel[dataSource]"
      :count-label="countLabel"
      @update:model-value="onSelectionUpdate"
    />

    <p
      v-else
      class="text-sm text-muted italic"
      data-testid="checklist-empty"
    >
      No hay {{ dataSourceLabel[dataSource] }} disponibles.
    </p>
  </div>
</template>
