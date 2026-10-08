<script setup lang="ts">
/**
 * EligibleSalesPicker — advanced create-route sale selector (T3 S3 + S2).
 *
 * Contract (backend `GET /delivery-routes/eligible-sales`):
 *   - Server SEARCH (`q`) and server PAGINATION (page/limit); the client never
 *     filters or paginates locally.
 *   - Rich rows: PRIMARY = client name + shipping address (label/street);
 *     SECONDARY = folio / date / amount / product summary, so two look-alike
 *     sales (same folio suffix, parent customer) are distinguishable.
 *   - Unavailable rows (IN_CURRENT_ROUTE / OCCUPIED / INELIGIBLE) are rendered
 *     DISABLED with a human reason. Availability is authoritative from the
 *     server; the client only decides selectability.
 *   - Selection + its resolved labels are RETAINED across search and page
 *     changes (snapshot map keyed by sale id) — a selected sale never vanishes
 *     from the chips just because it scrolled out of the current page.
 *   - Inline create-conflict (409 `..._ALREADY_ON_ACTIVE_ROUTE`) alert listing
 *     the conflicting folios with an actionable "refresh availability" control.
 *     The selection is NEVER silently removed.
 *
 * Emits `update:selected` + `update:modelValue` (both `string[]`) so the
 * slideover can bind either.
 */

import { computed, reactive, ref, watch } from 'vue'
import { refDebounced } from '@vueuse/core'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import { formatSaleDueDate } from '@/features/POS/sales/utils/saleDate.utils'
import { DELIVERY_ROUTE_COPY } from '../copy'
import {
  DEFAULT_ELIGIBLE_SALES_PAGE_SIZE,
  useEligibleSales,
  useLegacyConfirmedEligibleSales,
  type EligibleSalesRefreshResult,
} from '../composables/useEligibleSales'
import {
  isEligibleSaleSelectable,
  type EligibleSaleRow,
} from '../interfaces/eligible-sales.types'

const props = withDefaults(
  defineProps<{
    /** Selected sale ids, or `[]` when no selection. */
    modelValue: readonly string[]
    /** Visual required marker — does not gate validation (slideover owns zod). */
    required?: boolean
    /** Whether the picker is disabled. */
    disabled?: boolean
    /**
     * Data source. `create` uses the authoritative eligible-sales endpoint
     * (requires read:Sale + create:DeliveryRoute). `append` keeps the LEGACY
     * confirmed-sales path (only the append/update contract) and makes NO
     * authoritative availability claim.
     */
    source?: 'create' | 'append'
    /** Optional placeholder text for the search input. */
    placeholder?: string
    /** Optional inline field error. */
    error?: string
    /** Suppress the error ring (Nuxt UI validation highlight). */
    highlight?: boolean
    /** Optional current route id — forwarded as `contextRouteId` to the server. */
    contextRouteId?: string
    /** Sale ids the backend rejected as already on another route (409). */
    conflictSaleIds?: readonly string[]
    /** True when a create attempt failed as a conflict (even with no ids). */
    conflictActive?: boolean
    /**
     * Monotonic attempt signal, incremented by the parent on EVERY 409. Lets a
     * repeated EMPTY-id conflict reblock without relying on array identity.
     */
    conflictAttempt?: number
  }>(),
  {
    required: false,
    disabled: false,
    source: 'create',
    placeholder: DELIVERY_ROUTE_COPY.eligibleSales.searchPlaceholder,
    error: '',
    highlight: true,
    contextRouteId: '',
    conflictSaleIds: () => [],
    conflictActive: false,
    conflictAttempt: 0,
  },
)

const emit = defineEmits<{
  'update:selected': [value: string[]]
  'update:modelValue': [value: string[]]
  'update:validity': [value: { valid: boolean, invalidSaleIds: string[] }]
  'update:conflictActive': [value: boolean]
}>()

const copy = DELIVERY_ROUTE_COPY.eligibleSales

// ─── Server query state ──────────────────────────────────────────────────────
const search = ref('')
const debouncedSearch = refDebounced(search, 300)
const page = ref(1)
const limit = ref(DEFAULT_ELIGIBLE_SALES_PAGE_SIZE)

// A new query always starts from the first page (server-side).
watch(debouncedSearch, () => {
  page.value = 1
})

const isAuthoritative = computed(() => props.source === 'create')

const authoritativeQuery = useEligibleSales(
  () => ({
    page: page.value,
    limit: limit.value,
    q: debouncedSearch.value,
    contextRouteId: props.contextRouteId || undefined,
  }),
  { enabled: isAuthoritative },
)

// Legacy append path: only enabled when the picker is NOT on the authoritative
// create source (a disabled query issues no request).
const legacyQuery = useLegacyConfirmedEligibleSales(
  () => ({ page: page.value, limit: limit.value, q: debouncedSearch.value }),
  { enabled: computed(() => !isAuthoritative.value) },
)

const activeQuery = computed(() => (isAuthoritative.value ? authoritativeQuery : legacyQuery))

const sales = computed(() => activeQuery.value.data.value)
const totalCount = computed(() => activeQuery.value.totalCount.value)
const pageCount = computed(() => activeQuery.value.pageCount.value)
const isLoading = computed(() => activeQuery.value.isLoading.value)
const isFetching = computed(() => activeQuery.value.isFetching.value)
const isError = computed(() => activeQuery.value.isError.value)
const fetchError = computed(() => activeQuery.value.error.value)

function refresh(): Promise<EligibleSalesRefreshResult> {
  return activeQuery.value.refresh()
}

// ─── Retained selection labels ───────────────────────────────────────────────
// Snapshots by sale id so a selected row keeps its label even when it is not in
// the currently fetched page/search result.
const snapshots = reactive<Record<string, EligibleSaleRow>>({})

watch(
  [sales, () => props.modelValue],
  () => {
    for (const row of sales.value) {
      if (props.modelValue.includes(row.id)) snapshots[row.id] = row
    }
  },
  { immediate: true },
)

const isSelected = (id: string) => props.modelValue.includes(id)

function emitSelection(next: string[]): void {
  emit('update:selected', next)
  emit('update:modelValue', next)
}

function toggle(row: EligibleSaleRow): void {
  if (props.disabled) return
  if (!selectable(row)) return
  if (isSelected(row.id)) {
    emitSelection(props.modelValue.filter((id) => id !== row.id))
    return
  }
  snapshots[row.id] = row
  emitSelection([...props.modelValue, row.id])
}

function removeSale(id: string): void {
  if (props.disabled) return
  emitSelection(props.modelValue.filter((existing) => existing !== id))
}

interface SelectedChip {
  id: string
  label: string
  secondary: string
}

const selectedChips = computed<SelectedChip[]>(() =>
  props.modelValue.map((id) => {
    const row = snapshots[id]
    if (!row) return { id, label: id.slice(0, 8), secondary: '' }
    return { id, label: row.folio ?? copy.noFolio, secondary: rowCustomerName(row) }
  }),
)

// ─── Row presentation ────────────────────────────────────────────────────────
function rowCustomerName(row: EligibleSaleRow): string {
  return row.customer?.name ?? copy.noCustomer
}

function rowAddress(row: EligibleSaleRow): string | null {
  // The legacy append API omits the field entirely — never assert it is missing.
  if (!isAuthoritative.value) return null
  return row.shippingAddress ? formatAddress(row.shippingAddress) : copy.noAddress
}

function rowSecondaryParts(row: EligibleSaleRow): string[] {
  const parts: string[] = [row.folio ?? copy.noFolio]
  const dateIso = row.confirmedAt ?? row.dueDate
  if (dateIso) parts.push(formatSaleDueDate(dateIso))
  parts.push(formatCentsMXN(row.totalCents))
  if (row.productSummary.length > 0) parts.push(row.productSummary.join(' · '))
  return parts
}

function availabilityReason(row: EligibleSaleRow): string | null {
  // The legacy append path has NO authoritative availability — never claim one.
  if (!isAuthoritative.value) return null
  const availability = row.availability
  if (!availability) return null
  switch (availability.state) {
    case 'AVAILABLE':
      return null
    case 'IN_CURRENT_ROUTE':
      return copy.reasonInCurrentRoute
    case 'OCCUPIED':
      if (availability.occupiedRoute?.status === 'DRAFT') return copy.reasonOccupiedDraft
      if (availability.occupiedRoute?.status === 'ACTIVE') return copy.reasonOccupiedActive
      return copy.reasonOccupied
    case 'INELIGIBLE':
      return availability.reason === 'MISSING_ADDRESS'
        ? copy.reasonMissingAddress
        : copy.reasonDeliveryStatus
    default:
      return copy.reasonUnavailable
  }
}

// Legacy append: every row is selectable (no availability info to act on).
const selectable = (row: EligibleSaleRow) =>
  isAuthoritative.value ? isEligibleSaleSelectable(row) : true
const rowAriaLabel = (row: EligibleSaleRow) => `${rowCustomerName(row)} — ${row.folio ?? copy.noFolio}`
const reasonId = (row: EligibleSaleRow) => `eligible-sales-reason-${row.id}`

// ─── Pagination ──────────────────────────────────────────────────────────────
const showPagination = computed(() => totalCount.value > 0 && pageCount.value > 1)
const canGoPrev = computed(() => page.value > 1)
const canGoNext = computed(() => page.value < pageCount.value)
const rangeFrom = computed(() =>
  totalCount.value === 0 ? 0 : (page.value - 1) * limit.value + 1,
)
const rangeTo = computed(() => Math.min(page.value * limit.value, totalCount.value))
const paginationText = computed(() =>
  copy.paginationRange
    .replace('{from}', String(rangeFrom.value))
    .replace('{to}', String(rangeTo.value))
    .replace('{total}', String(totalCount.value)),
)

function goPrev(): void {
  if (canGoPrev.value) page.value -= 1
}
function goNext(): void {
  if (canGoNext.value) page.value += 1
}

// ─── Empty / no-results / conflict ───────────────────────────────────────────
const hasQuery = computed(() => debouncedSearch.value.trim().length > 0)
const isEmpty = computed(
  () => !isLoading.value && !isError.value && sales.value.length === 0 && !hasQuery.value,
)
const isNoResults = computed(
  () => !isLoading.value && !isError.value && sales.value.length === 0 && hasQuery.value,
)

const hasConflict = computed(() => {
  if (!isAuthoritative.value) return false
  if (unresolvedConflictIds.value.length > 0) return true
  if (props.conflictSaleIds.length > 0) return false
  return props.conflictActive && !conflictReviewed.value
})
const conflictItems = computed(() =>
  props.conflictSaleIds.map((id) => ({
    id,
    label: snapshots[id]?.folio ?? id.slice(0, 8),
  })),
)

// ─── Selection validity (finding 3) ─────────────────────────────────────────
// A known-stale selection (refreshed OCCUPIED/INELIGIBLE, or a 409 conflict id)
// is INVALID: chips + ids are preserved, but the upsert must block submission
// until the ids are removed or a refresh proves them selectable again.
const conflictReviewed = ref(false)
// Ids proven AVAILABLE by FRESH post-conflict authoritative data. Never seeded
// from the pre-conflict cache.
const conflictReconciledIds = ref<Record<string, true>>({})

watch(
  // A new attempt (explicit signal) OR new conflict metadata re-opens the
  // conflict. Keyed on the attempt so a repeated EMPTY-id 409 reblocks even
  // though the conflictSaleIds content is unchanged.
  () => [props.conflictAttempt, [...props.conflictSaleIds].join(',')] as const,
  () => {
    conflictReviewed.value = false
    conflictReconciledIds.value = {}
  },
)

// Selected conflict ids not yet proven AVAILABLE by fresh data.
const unresolvedConflictIds = computed<string[]>(() =>
  props.conflictSaleIds.filter(
    (id) => props.modelValue.includes(id) && !conflictReconciledIds.value[id],
  ),
)

const invalidSaleIds = computed<string[]>(() => {
  if (!isAuthoritative.value) return []
  const ids = new Set<string>()
  for (const id of unresolvedConflictIds.value) {
    ids.add(id)
  }
  for (const id of props.modelValue) {
    const row = snapshots[id]
    if (row && !isEligibleSaleSelectable(row)) ids.add(id)
  }
  return [...ids]
})

// A 409 with no `conflictSaleIds` (race) is still a conflict: block until the
// user refreshes availability (a meaningful retry, not a permanent dead end).
const hasUnresolvedBlankConflict = computed(
  () =>
    isAuthoritative.value &&
    props.conflictActive &&
    props.conflictSaleIds.length === 0 &&
    !conflictReviewed.value,
)

const selectionValid = computed(
  () => invalidSaleIds.value.length === 0 && !hasUnresolvedBlankConflict.value,
)

watch(
  [selectionValid, invalidSaleIds],
  () => {
    emit('update:validity', {
      valid: selectionValid.value,
      invalidSaleIds: [...invalidSaleIds.value],
    })
  },
  { immediate: true },
)

// Clear the conflict once it is resolved (ids removed / refreshed + valid).
watch([invalidSaleIds, conflictReviewed, () => props.conflictActive], () => {
  if (!props.conflictActive) return
  if (invalidSaleIds.value.length === 0 && !hasUnresolvedBlankConflict.value) {
    emit('update:conflictActive', false)
  }
})

async function onRefreshAvailability(): Promise<void> {
  const outcome = await refresh()
  // A rejected promise OR a resolved error result must NOT unblock or claim
  // availability — keep the form blocked and the error retry visible.
  if (!outcome.ok) return
  conflictReviewed.value = true
  // Reconcile ONLY ids proven AVAILABLE by this fresh successful data.
  const fresh = new Map(outcome.data.map((row) => [row.id, row]))
  const reconciled: Record<string, true> = {}
  for (const id of props.conflictSaleIds) {
    if (!props.modelValue.includes(id)) continue
    const row = fresh.get(id)
    if (row && isEligibleSaleSelectable(row)) reconciled[id] = true
  }
  conflictReconciledIds.value = reconciled
}

// Human-readable list error (block, not toast). NEVER surface the raw
// AxiosError message — `normalizeApiError` surfaces the backend envelope's own
// `message` when present, else the friendly fallback.
const errorMessage = computed(() =>
  normalizeApiError(fetchError.value, copy.errorFallback).message,
)
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="eligible-sales-picker">
    <!-- Search (server-side `q`) -->
    <div data-testid="eligible-sales-picker-search">
      <UInput
        v-model="search"
        :disabled="disabled"
        icon="i-lucide-search"
        :placeholder="placeholder"
        :aria-label="copy.searchLabel"
        class="w-full"
      />
    </div>

    <!-- Inline conflict alert (S2): actionable + selection-preserving. -->
    <div
      v-if="hasConflict"
      data-testid="eligible-sales-picker-conflict"
      class="flex flex-col gap-2 rounded-lg border border-error bg-error/5 p-3"
      role="alert"
    >
      <UAlert
        color="error"
        variant="soft"
        :title="copy.conflictTitle"
        :description="copy.conflictBody"
      />
      <div v-if="conflictItems.length > 0" data-testid="eligible-sales-picker-conflict-body">
        <p class="text-xs font-medium text-muted">{{ copy.conflictListLabel }}</p>
        <ul class="flex flex-wrap gap-2">
          <li
            v-for="item in conflictItems"
            :key="item.id"
            :data-testid="`eligible-sales-picker-conflict-item-${item.id}`"
            class="rounded-full border border-error/40 px-2 py-0.5 text-xs"
          >
            {{ item.label }}
          </li>
        </ul>
      </div>
      <div>
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-refresh-cw"
          :label="copy.conflictRefresh"
          :loading="isFetching"
          data-testid="eligible-sales-picker-conflict-refresh"
          @click="onRefreshAvailability"
        />
      </div>
    </div>

    <!-- Results list -->
    <ul
      v-if="sales.length > 0 && !isError"
      class="flex max-h-72 flex-col gap-1 overflow-y-auto"
      data-testid="eligible-sales-picker-list"
    >
      <li
        v-for="row in sales"
        :key="row.id"
        :data-testid="`eligible-sales-picker-row-${row.id}`"
        class="flex flex-col gap-1 rounded-lg border border-default p-2"
      >
        <div class="flex items-start gap-3">
          <UCheckbox
            :model-value="isSelected(row.id)"
            :disabled="disabled || !selectable(row)"
            :aria-label="rowAriaLabel(row)"
            :aria-describedby="availabilityReason(row) ? reasonId(row) : undefined"
            :data-testid="`eligible-sales-picker-row-checkbox-${row.id}`"
            @update:model-value="toggle(row)"
          />
          <button
            type="button"
            class="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
            :disabled="disabled || !selectable(row)"
            :data-testid="`eligible-sales-picker-row-toggle-${row.id}`"
            @click="toggle(row)"
          >
            <span
              :data-testid="`eligible-sales-picker-row-primary-${row.id}`"
              class="flex flex-col gap-0.5"
            >
              <span class="truncate font-medium text-default">{{ rowCustomerName(row) }}</span>
              <span
                v-if="rowAddress(row)"
                :data-testid="`eligible-sales-picker-row-address-${row.id}`"
                class="truncate text-xs text-muted"
              >
                {{ rowAddress(row) }}
              </span>
            </span>
            <span
              :data-testid="`eligible-sales-picker-row-secondary-${row.id}`"
              class="flex flex-wrap gap-x-2 text-xs text-muted"
            >
              <span v-for="part in rowSecondaryParts(row)" :key="part">{{ part }}</span>
            </span>
          </button>
        </div>
        <p
          v-if="availabilityReason(row)"
          :id="reasonId(row)"
          :data-testid="`eligible-sales-picker-row-reason-${row.id}`"
          class="text-xs text-warning"
        >
          {{ availabilityReason(row) }}
        </p>
      </li>
    </ul>

    <!-- Pagination (server-side) -->
    <div
      v-if="showPagination"
      class="flex items-center justify-between gap-2"
      data-testid="eligible-sales-picker-pagination"
    >
      <span
        class="text-xs text-muted"
        data-testid="eligible-sales-picker-pagination-range"
      >
        {{ paginationText }}
      </span>
      <div class="flex gap-1">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-chevron-left"
          :aria-label="copy.previousPage"
          :disabled="!canGoPrev || isFetching"
          data-testid="eligible-sales-picker-pagination-prev"
          @click="goPrev"
        />
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-chevron-right"
          :aria-label="copy.nextPage"
          :disabled="!canGoNext || isFetching"
          data-testid="eligible-sales-picker-pagination-next"
          @click="goNext"
        />
      </div>
    </div>

    <!-- Empty / no-results -->
    <p
      v-if="isEmpty"
      class="text-center text-sm text-muted"
      data-testid="eligible-sales-picker-empty-inline"
    >
      {{ copy.empty }}
    </p>
    <p
      v-if="isNoResults"
      class="text-center text-sm text-muted"
      data-testid="eligible-sales-picker-no-results"
    >
      {{ copy.noResults }}
    </p>

    <!-- Selected chips (retained labels) -->
    <div
      v-if="selectedChips.length > 0"
      class="flex flex-col gap-1"
      data-testid="eligible-sales-picker-chips"
    >
      <p class="text-xs font-medium text-muted">{{ copy.selectedHeading }}</p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="chip in selectedChips"
          :key="chip.id"
          class="inline-flex items-center gap-1 rounded-full border border-default bg-elevated/50 px-2 py-1 text-xs"
          :data-testid="`eligible-sales-picker-chip-${chip.id}`"
        >
          <span
            :data-testid="`eligible-sales-picker-chip-label-${chip.id}`"
            class="flex flex-col"
          >
            <span class="font-medium">{{ chip.label }}</span>
            <span v-if="chip.secondary" class="text-[10px] text-muted">{{ chip.secondary }}</span>
          </span>
          <button
            type="button"
            :aria-label="copy.remove.replace('{folio}', chip.label)"
            :disabled="disabled"
            class="inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
            :data-testid="`eligible-sales-picker-chip-clear-${chip.id}`"
            @click="removeSale(chip.id)"
          >
            <UIcon name="i-lucide-x" class="size-4" />
          </button>
        </span>
      </div>
    </div>

    <div
      v-if="isLoading"
      class="text-xs text-muted"
      data-testid="eligible-sales-picker-loading"
      aria-busy="true"
    >
      {{ copy.loading }}
    </div>

    <div
      v-if="isError"
      class="flex flex-col gap-2"
      data-testid="eligible-sales-picker-error"
    >
      <p class="text-xs text-error">{{ errorMessage }}</p>
      <div>
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          size="sm"
          :label="copy.retry"
          icon="i-lucide-refresh-cw"
          data-testid="eligible-sales-picker-error-retry"
          @click="onRefreshAvailability"
        />
      </div>
    </div>

    <p
      v-if="required"
      class="text-xs text-muted"
      data-testid="eligible-sales-picker-required"
    >
      Requerido
    </p>

    <p
      v-if="props.error"
      class="text-xs text-error"
      data-testid="eligible-sales-picker-error-inline"
    >
      {{ props.error }}
    </p>
  </div>
</template>
