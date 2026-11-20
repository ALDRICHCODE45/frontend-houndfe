<script setup lang="ts">
/**
 * BackordersListView — «Pedidos por reposición» (ODD restock-backorder T1, S1/S3), route
 * `pos-backorders`. The staff view of the restock queue: status tabs with counts, search, a
 * `scheduledAt` date range, server sort and paging. The URL query is the single source of truth.
 *
 * Needs `read:Backorder` (route guard, plus the forbidden state here). Opening a row goes to the
 * detail, where the only action («Cancelar pedido») lives; there is no staff creation in v1.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import type { TableColumn } from '@nuxt/ui'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import SortableHeader from '@/core/shared/components/DataTable/SortableHeader.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useTablePreferences } from '@/core/shared/composables/useTablePreferences'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import BackorderDateFilter from '../components/BackorderDateFilter.vue'
import BackorderProductThumb from '../components/BackorderProductThumb.vue'
import BackorderStatusCell from '../components/BackorderStatusCell.vue'
import BackorderStatusTabs from '../components/BackorderStatusTabs.vue'
import { useBackorderAccess } from '../composables/useBackorderAccess'
import { useBackorderList } from '../composables/useBackorderList'
import type { BackorderStaff, BackorderStatus } from '../interfaces/backorder.types'
import {
  BACKORDER_EMPTY_COPY,
  backorderPrice,
  backorderStatusLabel,
  backorderStatusTone,
  chatbotRequestPath,
  productLabel,
} from '../utils/backorderView'
import {
  PAGE_SIZE_OPTIONS,
  SEARCH_MAX_LENGTH,
  clearListFilters,
  defaultSortFor,
  hasActiveFilters,
  listParamsOf,
  mergeListQuery,
  parseListQuery,
  setListTab,
  type BackorderListState,
} from '../utils/listQuery'
import '../styles/backorders.css'

const SEARCH_DEBOUNCE_MS = 300

const route = useRoute()
const router = useRouter()
const { canRead } = useBackorderAccess()

// ── State: the URL is the single source of truth ─────────────────────────────
const state = computed<BackorderListState>(() => parseListQuery(route.query))

function update(next: BackorderListState) {
  void router.replace({ query: mergeListQuery(route.query, next) as Record<string, string> })
}

const search = ref(state.value.q)
watch(
  () => state.value.q,
  (q) => {
    if (q !== search.value.trim().slice(0, SEARCH_MAX_LENGTH)) search.value = q
  },
)
watchDebounced(
  search,
  (value) => {
    const q = value.trim().slice(0, SEARCH_MAX_LENGTH)
    if (q !== state.value.q) update({ ...state.value, q, page: 1 })
  },
  { debounce: SEARCH_DEBOUNCE_MS },
)

const setTab = (tab: BackorderStatus) => update(setListTab(state.value, tab))
const setFrom = (from: string) => update({ ...state.value, from, page: 1 })
const setTo = (to: string) => update({ ...state.value, to, page: 1 })
const clearFilters = () => update(clearListFilters(state.value))

// ── Data ─────────────────────────────────────────────────────────────────────
const list = useBackorderList(() => listParamsOf(state.value))
const filtersActive = computed(() => hasActiveFilters(state.value))
const activeFilterCount = computed(() => (state.value.from ? 1 : 0) + (state.value.to ? 1 : 0))
const emptyCopy = computed(() => BACKORDER_EMPTY_COPY[state.value.tab])

const pagination = computed({
  get: () => ({ pageIndex: state.value.page - 1, pageSize: state.value.limit }),
  set: (next: { pageIndex: number; pageSize: number }) => {
    const sizeChanged = next.pageSize !== state.value.limit
    update({ ...state.value, limit: next.pageSize, page: sizeChanged ? 1 : next.pageIndex + 1 })
  },
})

// Only two columns map to a backend `sortBy`: the scheduling date, and (Apartados) the deadline.
const sorting = computed({
  get: () => [
    {
      id: state.value.sortBy === 'reservedUntil' ? 'info' : 'scheduledAt',
      desc: state.value.sortOrder === 'desc',
    },
  ],
  set: (next: Array<{ id: string; desc: boolean }>) => {
    const first = next[0]
    if (!first) {
      update({ ...state.value, sortBy: defaultSortFor(state.value.tab), sortOrder: 'asc', page: 1 })
      return
    }
    update({
      ...state.value,
      sortBy: first.id === 'info' ? 'reservedUntil' : 'scheduledAt',
      sortOrder: first.desc ? 'desc' : 'asc',
      page: 1,
    })
  },
})

const pageCount = computed(() => Math.max(1, Math.ceil(list.total.value / state.value.limit)))
const showingFrom = computed(() => (list.total.value === 0 ? 0 : (state.value.page - 1) * state.value.limit + 1))
const showingTo = computed(() => (list.total.value === 0 ? 0 : (state.value.page - 1) * state.value.limit + list.items.value.length))

// ── Columns ──────────────────────────────────────────────────────────────────
const right = { th: 'text-right', td: 'text-right' }
// `minSize` is the floor the table shrinks to at 1440 with the sidebar: no-wrap columns keep room
// for «BO-000012» and «16 nov, 22:45»; product and follow-up wrap (`bo-wrap`, product clamps to 2 lines).
const columns = computed<TableColumn<BackorderStaff>[]>(() => [
  { id: 'folio', header: 'Folio', enableSorting: false, size: 120, minSize: 112 },
  { id: 'customer', header: 'Cliente', enableSorting: false, meta: { primary: true } },
  {
    id: 'product',
    header: 'Producto',
    enableSorting: false,
    size: 248,
    minSize: 192,
    meta: { class: { th: '', td: 'bo-wrap' } },
  },
  { id: 'quantity', header: 'Cantidad', enableSorting: false, size: 96, minSize: 80, meta: { class: right } },
  { id: 'price', header: 'Precio final', enableSorting: false, size: 152, minSize: 136, meta: { class: right } },
  { id: 'scheduledAt', header: 'Agendado', enableSorting: true, size: 144, minSize: 128 },
  { id: 'eta', header: 'Llegada estimada', enableSorting: false, size: 160, minSize: 128 },
  // Sortable only in Apartados (`sortBy=reservedUntil`); on the other tabs the order is by `scheduledAt`.
  {
    id: 'info',
    header: 'Seguimiento',
    enableSorting: state.value.tab === 'RESERVED',
    size: 208,
    minSize: 176,
    meta: { class: { th: '', td: 'bo-wrap' } },
  },
  { id: 'actions', header: 'Acciones', enableSorting: false, meta: { class: { th: 'w-16', td: 'w-16 text-right' } } },
])

// Column layout saved per user in this browser (order, pins, widths, visibility, density).
const layout = useTablePreferences({
  persistKey: 'pos-backorders',
  columnIds: ['folio', 'customer', 'product', 'quantity', 'price', 'scheduledAt', 'eta', 'info', 'actions'],
})
const { columnOrder, columnPinning, columnSizing, columnVisibility, density } = layout

// ── Row actions ──────────────────────────────────────────────────────────────
function actionsFor(row: BackorderStaff): RowAction[] {
  return [
    { key: 'open', label: 'Ver pedido', icon: 'i-lucide-eye' },
    ...(chatbotRequestPath(row)
      ? [{ key: 'request', label: 'Ver solicitud del chatbot', icon: 'i-lucide-message-square-text' }]
      : []),
    ...(row.saleId ? [{ key: 'sale', label: 'Ver venta', icon: 'i-lucide-receipt-text' }] : []),
  ]
}

function open(row: BackorderStaff) {
  void router.push({ name: 'pos-backorder-detail', params: { id: row.id } })
}

function onAction(key: string, row: BackorderStaff) {
  if (key === 'open') open(row)
  else if (key === 'request') {
    const path = chatbotRequestPath(row)
    if (path) void router.push(path)
  }
  else if (key === 'sale' && row.saleId) void router.push(`/pos/ventas/${row.saleId}`)
}

const rowLabel = (row: BackorderStaff) => `${row.folio}, ${row.customer.name}`
const when = (iso: string) => formatShortDateTime(iso)
</script>

<template>
  <div class="hf-theme hf-ui bo-page flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10" data-testid="backorders-list">
    <header class="hf-page-header">
      <h1 class="hf-page-title">Pedidos por reposición</h1>
      <p class="hf-page-subtitle">La fila de espera de mostrador, producto por producto.</p>
    </header>

    <EmptyState
      v-if="!canRead"
      kind="forbidden"
      title="No tienes permiso para ver los pedidos por reposición"
      description="Pide a un administrador el permiso «Ver pedidos por reposición» (read:Backorder)."
    />

    <UCard
      v-else
      :ui="{ body: 'p-0 sm:p-0' }"
      class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm"
    >
      <div class="hf-table-content w-full min-w-0 space-y-4 px-3 py-3 sm:px-4 sm:py-4">
        <BackorderStatusTabs :tab="state.tab" :counts="list.counts.value" @update:tab="setTab" />

        <AppDataTable
          v-model:pagination="pagination"
          v-model:sorting="sorting"
          v-model:global-filter="search"
          v-model:column-order="columnOrder"
          v-model:column-pinning="columnPinning"
          v-model:column-sizing="columnSizing"
          v-model:column-visibility="columnVisibility"
          v-model:density="density"
          :persist-layout="true"
          :columns="columns"
          :data="list.items.value"
          :loading="list.isLoading.value"
          :fetching="list.isFetching.value"
          :error="list.isError.value"
          error-message="No se pudieron cargar los pedidos"
          :empty-state="emptyCopy"
          :filtered="filtersActive"
          :active-filter-count="activeFilterCount"
          :page-count="pageCount"
          :total-count="list.total.value"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="PAGE_SIZE_OPTIONS"
          :row-open="open"
          display-mode="auto"
          mobile-render="cards"
          search-placeholder="Buscar por cliente, teléfono o producto"
          class="hf-data-table"
          portal-class="hf-theme hf-ui bo-portal"
          pagination-portal-class="hf-theme hf-ui bo-portal"
          @refresh="list.refetch()"
          @clear-filters="clearFilters"
          @reset-columns="layout.reset"
        >
          <template #filters>
            <BackorderDateFilter :from="state.from" :to="state.to" @update:from="setFrom" @update:to="setTo" />
          </template>

          <template #scheduledAt-header="{ column }">
            <SortableHeader :column="column" label="Agendado" />
          </template>
          <template #info-header="{ column }">
            <SortableHeader v-if="state.tab === 'RESERVED'" :column="column" label="Apartado hasta" />
            <span v-else>Seguimiento</span>
          </template>

          <template #folio-cell="{ row }">
            <button
              type="button"
              class="hf-row-primary text-left"
              data-testid="backorder-folio"
              @click.stop="open(row.original)"
            >
              {{ row.original.folio }}
            </button>
          </template>

          <template #customer-cell="{ row }">
            <span class="bo-stack" data-testid="backorder-customer">
              <span class="hf-row-primary">{{ row.original.customer.name }}</span>
              <span v-if="row.original.customer.phone" class="hf-row-secondary">{{ row.original.customer.phone }}</span>
            </span>
          </template>

          <template #product-cell="{ row }">
            <span class="bo-product" data-testid="backorder-product">
              <BackorderProductThumb :src="row.original.productImageUrl" :alt="row.original.productName" />
              <span class="bo-stack">
                <span class="hf-row-primary bo-clamp">{{ productLabel(row.original).name }}</span>
                <span v-if="productLabel(row.original).variant" class="hf-row-secondary">{{
                  productLabel(row.original).variant
                }}</span>
              </span>
            </span>
          </template>

          <template #quantity-cell="{ row }">
            <span class="hf-figure" data-testid="backorder-quantity">{{ row.original.quantity }}</span>
          </template>

          <template #price-cell="{ row }">
            <span class="bo-stack bo-stack--end" data-testid="backorder-price">
              <span class="hf-figure bo-final">{{ backorderPrice(row.original).final }}</span>
              <span v-for="note in backorderPrice(row.original).notes" :key="note" class="hf-row-secondary hf-figure">{{ note }}</span>
            </span>
          </template>

          <template #scheduledAt-cell="{ row }">
            <span data-testid="backorder-scheduled">{{ when(row.original.scheduledAt) }}</span>
          </template>

          <template #eta-cell="{ row }">
            <span class="bo-stack">
              <span data-testid="backorder-eta">{{ when(row.original.estimatedAt) }}</span>
              <span v-if="row.original.etaOverdue" class="bo-warning" data-testid="backorder-eta-overdue">Atrasado</span>
            </span>
          </template>

          <template #info-cell="{ row }">
            <BackorderStatusCell :backorder="row.original" />
          </template>

          <template #actions-header><span class="sr-only">Acciones</span></template>
          <template #actions-cell="{ row }">
            <RowActionsMenu
              :actions="actionsFor(row.original)"
              :row-label="rowLabel(row.original)"
              portal-class="bo-portal"
              @select="onAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <article class="bo-card" data-testid="backorder-card" @click="open(row)">
              <div class="bo-card__top">
                <button type="button" class="bo-card__folio" @click.stop="open(row)">{{ row.folio }}</button>
                <StatusBadge :label="backorderStatusLabel(row.status)" :tone="backorderStatusTone(row.status)" />
                <RowActionsMenu
                  class="bo-card__menu"
                  :actions="actionsFor(row)"
                  :row-label="rowLabel(row)"
                  portal-class="bo-portal"
                  @select="onAction($event, row)"
                />
              </div>
              <p class="bo-card__customer">{{ [row.customer.name, row.customer.phone].filter(Boolean).join(' · ') }}</p>
              <div class="bo-product">
                <BackorderProductThumb :src="row.productImageUrl" :alt="row.productName" />
                <span class="bo-stack">
                  <span class="hf-row-primary bo-clamp">{{ productLabel(row).name }}</span>
                  <span v-if="productLabel(row).variant" class="hf-row-secondary">{{ productLabel(row).variant }}</span>
                </span>
              </div>
              <div class="bo-card__money">
                <span>{{ row.quantity }} × <span class="hf-figure bo-final">{{ backorderPrice(row).final }}</span></span>
                <span v-for="note in backorderPrice(row).notes" :key="note" class="hf-row-secondary hf-figure">{{ note }}</span>
              </div>
              <div class="bo-card__foot">
                <BackorderStatusCell :backorder="row" />
                <span class="hf-row-secondary">
                  Llega {{ when(row.estimatedAt) }}
                  <span v-if="row.etaOverdue" class="bo-warning">· Atrasado</span>
                </span>
              </div>
            </article>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
