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
 * PUBLICO is the system-wide default price list. It is ALWAYS active —
 * there is no "no list" state. When the backend sees `globalPriceListId: null`,
 * it resolves to PUBLICO automatically. This component uses a sentinel value
 * for the PUBLICO menu option so UInputMenu can bind to it, then emits `null`
 * upstream (the backend contract is `null`, not a hardcoded UUID).
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
 * Active-list display:
 *   The "Lista: <name>" badge with `i-lucide-tags` icon is ALWAYS visible
 *   because PUBLICO is always active. When `globalPriceListId` is null we
 *   render "Lista: PUBLICO" as the default.
 */
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { productApi } from '@/features/POS/products/api/product.api'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { GlobalPriceList } from '@/features/POS/products/interfaces/product.types'
import type { Sale } from '../interfaces/sale.types'

// Sentinel for the PUBLICO menu entry. UInputMenu needs a non-null value to
// bind the selected state, but the backend contract uses `null` for "default
// list". We map this sentinel → `null` in mapValueToEmit before emitting.
const PUBLICO_SENTINEL = '__publico__'
const PUBLICO_LABEL = 'PUBLICO'

const props = defineProps<{
  activeDraft: Sale | null
  isMutating: boolean
}>()

const emit = defineEmits<{
  'change-price-list': [globalPriceListId: string | null]
  'request-confirm': [globalPriceListId: string | null]
}>()

// 5min staleTime avoids re-fetching on every tab switch.
const priceListsQuery = useQuery({
  queryKey: productQueryKeys.globalPriceLists(),
  queryFn: () => productApi.getGlobalPriceLists(),
  staleTime: 5 * 60 * 1000,
})

const priceLists = computed<GlobalPriceList[]>(
  () => priceListsQuery.data.value ?? [],
)

// Menu items: PUBLICO (default) first, then the custom lists.
const menuItems = computed(() => [
  { label: PUBLICO_LABEL, value: PUBLICO_SENTINEL },
  ...priceLists.value.map((list) => ({ label: list.name, value: list.id })),
])

// UInputMenu model binding. When globalPriceListId is null the draft is
// using PUBLICO (the system default), so we bind to the PUBLICO sentinel.
const modelValue = computed<string | null>(() =>
  props.activeDraft?.globalPriceListId ?? PUBLICO_SENTINEL,
)

// Always display the active list label — PUBLICO is always active.
const activeListName = computed<string>(() => {
  const id = props.activeDraft?.globalPriceListId
  if (id) {
    return priceLists.value.find((list) => list.id === id)?.name ?? id
  }
  return PUBLICO_LABEL
})

function mapValueToEmit(raw: unknown): string | null {
  // PUBLICO sentinel → null (backend default-list contract)
  if (raw === PUBLICO_SENTINEL) return null
  if (raw === null || raw === undefined) return null
  return String(raw)
}

function handleUpdate(raw: unknown) {
  const id = mapValueToEmit(raw)
  // Empty sale → apply immediately. Sale with items → ask parent to confirm.
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
      Active-list badge: ALWAYS shown because PUBLICO is always the active
      default. When a custom list is assigned we resolve its name from the
      query; otherwise we render "PUBLICO".
    -->
    <div
      data-testid="price-list-active-label"
      class="flex items-center gap-1 text-xs text-muted"
    >
      <UIcon name="i-lucide-tags" class="size-3.5" />
      <span>Lista: <strong class="font-semibold">{{ activeListName }}</strong></span>
    </div>

    <!--
      Query-failure state: when the price-lists endpoint is unreachable
      the dropdown stays disabled so the cashier can't pick a list from
      stale/missing data. PUBLICO remains always reachable via the sentinel.
    -->
    <UInputMenu
      :model-value="modelValue"
      :items="menuItems"
      :placeholder="'Cambiar lista'"
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