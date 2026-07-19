<script setup lang="ts">
/**
 * PriceListSelector — pos-price-list-tiers
 *
 * Compact UInputMenu placed in the ActiveSalePanel actions bar that lets the
 * cashier pick a global price list for the active draft. The selector is a
 * pure presentational component: data + mutations live in `useSalesDrafts`
 * (`setPriceList`), this component only owns the dropdown + confirm-gate UX.
 *
 * Contract:
 *   Props ↓
 *     activeDraft: Sale | null   (drives current value + items count)
 *     isMutating:  boolean       (disables the dropdown while a mutation is in flight)
 *   Events ↑
 *     change-price-list:  [globalPriceListId: string | null]
 *         — fire when the sale has no items; the parent applies immediately.
 *     request-confirm:    [globalPriceListId: string | null]
 *         — fire when the sale has items; the parent shows a ConfirmModal.
 *
 * The "Sin lista" option always lives at the top of the dropdown — selecting
 * it emits `null` (the backend treats `null` as "clear assignment").
 *
 * Empty-sale contract (spec §"Price List Change on Empty Sale"):
 *   When `activeDraft.items.length === 0`, selecting a new list applies
 *   immediately — no confirmation dialog. We emit `change-price-list` directly.
 *
 * Non-empty-sale contract (spec §"Price List Change on Sale With Items"):
 *   When `activeDraft.items.length > 0`, we emit `request-confirm` so the
 *   parent can show its ConfirmModal. The actual `change-price-list` emit
 *   only fires after the parent confirms.
 *
 * Active-list display (spec §"Active Price List Display"):
 *   When `activeDraft.globalPriceListId` is set, render "Lista: <name>"
 *   with the `i-lucide-tags` icon to give the cashier a constant reminder of
 *   the active tier even when the dropdown is closed.
 */
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { productApi } from '@/features/POS/products/api/product.api'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { GlobalPriceList } from '@/features/POS/products/interfaces/product.types'
import type { Sale } from '../interfaces/sale.types'

// Sentinel id for the "Sin lista" option. The backend never sees this
// value — the component maps it to `null` before emitting.
const NONE_ID = '__none__'

const props = defineProps<{
  activeDraft: Sale | null
  isMutating: boolean
}>()

const emit = defineEmits<{
  'change-price-list': [globalPriceListId: string | null]
  'request-confirm': [globalPriceListId: string | null]
}>()

// 5min staleTime avoids re-fetching on every tab switch. Spec wants this.
const priceListsQuery = useQuery({
  queryKey: productQueryKeys.globalPriceLists(),
  queryFn: () => productApi.getGlobalPriceLists(),
  staleTime: 5 * 60 * 1000,
})

const priceLists = computed<GlobalPriceList[]>(
  () => priceListsQuery.data.value ?? [],
)

// UInputMenu items: the "Sin lista" option first, then the real lists.
// Each item exposes both `label` (display) and `value` (model binding) so
// we can recover the id when UInputMenu emits `update:modelValue`.
const menuItems = computed(() => [
  { label: 'Sin lista', value: NONE_ID },
  ...priceLists.value.map((list) => ({ label: list.name, value: list.id })),
])

// The value UInputMenu binds to. We pass the active draft's id directly
// (or null when there's no active list). When the user picks "Sin lista"
// we set this to null locally so the dropdown reflects the choice.
const modelValue = computed<string | null>(() => props.activeDraft?.globalPriceListId ?? null)

// Spec §"Active Price List Display": visible only when a list is active.
const activeListName = computed<string | null>(() => {
  const id = props.activeDraft?.globalPriceListId
  if (!id) return null
  return priceLists.value.find((list) => list.id === id)?.name ?? null
})

function mapValueToEmit(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === NONE_ID) return null
  return String(raw)
}

function handleUpdate(raw: unknown) {
  const id = mapValueToEmit(raw)
  // Spec §"Price List Change on Empty Sale" vs §"Price List Change on Sale
  // With Items" — the only difference is whether we ask the parent to
  // confirm first. The id itself doesn't change.
  const itemCount = props.activeDraft?.items.length ?? 0
  if (itemCount === 0) {
    emit('change-price-list', id)
  } else {
    emit('request-confirm', id)
  }
}

// Exposed for tests so the selection-flow contract can be driven without
// depending on the (unstubbable) UInputMenu popover mechanics. Not part of
// the public component surface — production callers go through the
// `change-price-list` / `request-confirm` events instead.
defineExpose({ handleUpdate })
</script>

<template>
  <div class="flex items-center gap-2" data-testid="price-list-selector">
    <!--
      Active-list badge: visible only when a list is assigned. Renders the
      list name resolved from the query (or the raw id if the list isn't in
      the cache yet — the query will resolve shortly).
    -->
    <div
      v-if="activeDraft?.globalPriceListId"
      data-testid="price-list-active-label"
      class="flex items-center gap-1 text-xs text-muted"
    >
      <UIcon name="i-lucide-tags" class="size-3.5" />
      <span>Lista: <strong class="font-semibold">{{ activeListName ?? activeDraft.globalPriceListId }}</strong></span>
    </div>

	    <!--
	      Query-failure state: when the price-lists endpoint is unreachable
	      the dropdown stays disabled so the cashier can't pick a list from
	      stale/missing data. The "Sin lista" option remains reachable via
	      the confirmation gate in ActiveSalePanel if the cashier wants to
	      explicitly clear the assignment.
	    -->
	    <UInputMenu
	      :model-value="modelValue"
	      :items="menuItems"
	      :placeholder="activeDraft?.globalPriceListId ? 'Cambiar lista' : 'Sin lista'"
	      :disabled="isMutating || priceListsQuery.isFetching.value || priceListsQuery.isError.value"
	      :loading="priceListsQuery.isFetching.value"
	      value-key="value"
	      data-testid="price-list-menu"
	      @update:model-value="handleUpdate"
	    />
	    <span
	      v-if="priceListsQuery.isError.value && !priceListsQuery.isFetching.value"
	      class="text-[11px] text-error-500 dark:text-error-400"
	    >
	      Error al cargar listas
	    </span>
  </div>
</template>