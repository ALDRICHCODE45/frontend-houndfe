<script setup lang="ts">
/**
 * PendingRefundsView — «Reembolsos pendientes» (design/refund-settlements/01-pending-inbox.html).
 *
 * Money the branch still owes customers for cancelled sales, oldest first. Needs SaleRefund
 * read (route guard, plus the forbidden state here); «Liquidar…» and the whole-row open need
 * SaleRefund update. Folio and customer come from the cancelled sales (handoff 06 §9).
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import SettleRefundSlideover from '../components/SettleRefundSlideover.vue'
import {
  usePendingRefundsList,
  type PendingRefundListRow,
} from '../composables/usePendingRefundsList'
import {
  refundAgeLabel,
  refundCanceledAgo,
  refundCanceledDay,
  refundMethodLabel,
  refundReasonLabel,
} from '../utils/refundLabels'
import '../styles/refunds-visual.css'

const authStore = useAuthStore()
const router = useRouter()

const canRead = computed(() => authStore.userCan('read', 'SaleRefund'))
const canSettle = computed(() => authStore.userCan('update', 'SaleRefund'))

const pagination = ref({ pageIndex: 0, pageSize: 20 })
const search = ref('')

const list = usePendingRefundsList({
  tenantId: () => authStore.currentTenantId,
  enabled: () => canRead.value,
  page: () => pagination.value.pageIndex + 1,
  limit: () => pagination.value.pageSize,
  search,
})

// A settlement can empty the last page; step back instead of showing an empty page.
watch(
  () => [list.totalPages.value, list.isInitialLoading.value] as const,
  ([pages, loading]) => {
    if (!loading && pages > 0 && pagination.value.pageIndex >= pages) {
      pagination.value = { ...pagination.value, pageIndex: pages - 1 }
    }
  },
)

const total = computed(() => list.total.value)
const countLabel = computed(() => `${total.value} ${total.value === 1 ? 'pendiente' : 'pendientes'}`)
const onePage = computed(() => list.totalPages.value <= 1)
const showingFrom = computed(() =>
  total.value === 0 ? 0 : pagination.value.pageIndex * pagination.value.pageSize + 1,
)
const showingTo = computed(() =>
  total.value === 0 ? 0 : pagination.value.pageIndex * pagination.value.pageSize + list.rows.value.length,
)

const columns: TableColumn<PendingRefundListRow>[] = [
  { id: 'sale', header: 'Venta' },
  { id: 'reason', header: 'Motivo', meta: { class: { th: 'refund-col-reason', td: 'refund-col-reason' } } },
  { id: 'method', header: 'Pagó con' },
  { id: 'amountCents', header: 'Total', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'settledCents', header: 'Devuelto', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'outstandingCents', header: 'Pendiente', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'actions', header: 'Acciones', meta: { class: { th: 'w-16', td: 'w-16 text-right' } } },
]

const rowActions = computed<RowAction[]>(() => [
  ...(canSettle.value ? [{ key: 'settle', label: 'Liquidar…', icon: 'i-lucide-hand-coins' }] : []),
  { key: 'sale', label: 'Ver venta', icon: 'i-lucide-receipt-text' },
])

const panelOpen = ref(false)
const selectedId = ref<string | null>(null)
// The panel follows the refetched row, so a partial return shows the new balance.
const selected = computed(
  () => list.rows.value.find((row) => row.id === selectedId.value) ?? lastSelected.value,
)
const lastSelected = ref<PendingRefundListRow | null>(null)

function openSettle(row: PendingRefundListRow) {
  if (!canSettle.value) return
  selectedId.value = row.id
  lastSelected.value = row
  panelOpen.value = true
}

// The detail opens cancelled sales too, with their refunds (BE ae0e951).
function showSale(row: PendingRefundListRow) {
  void router.push(`/pos/ventas/${row.saleId}`)
}

function onAction(key: string, row: PendingRefundListRow) {
  if (key === 'settle') openSettle(row)
  else if (key === 'sale') showSale(row)
}

const rowOpen = computed(() => (canSettle.value ? openSettle : undefined))
const rowLabel = (row: PendingRefundListRow) => `${row.folioLabel}, ${row.customerLabel}`
</script>

<template>
  <div class="hf-theme hf-ui flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <header class="hf-page-header">
      <div class="refunds-title-row">
        <h1 class="hf-page-title">Reembolsos pendientes</h1>
        <StatusBadge
          v-if="canRead && total > 0"
          data-testid="refunds-count"
          :label="countLabel"
          tone="warning"
          aria-prefix=""
        />
      </div>
      <p class="hf-page-subtitle">
        Dinero por devolver de ventas canceladas, los más antiguos primero.
      </p>
    </header>

    <EmptyState
      v-if="!canRead"
      kind="forbidden"
      title="No tienes permiso para ver reembolsos"
      description="Pide a un administrador que te dé acceso a los reembolsos de esta sucursal."
    />

    <UCard
      v-else
      :ui="{ body: 'p-0 sm:p-0' }"
      class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm"
    >
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        <!-- The pending endpoint takes only page and limit (no search or filters), so the
             search runs locally over the loaded page. -->
        <AppDataTable
          v-model:pagination="pagination"
          v-model:global-filter="search"
          :columns="columns"
          :data="list.visibleRows.value"
          :loading="list.isInitialLoading.value"
          :fetching="list.isFetching.value"
          :error="list.isError.value"
          error-message="No se pudieron cargar los reembolsos"
          :empty-state="{
            title: 'No hay reembolsos pendientes',
            description: 'Cuando canceles una venta pagada, aquí verás el dinero que falta devolver.',
          }"
          :filtered="search.trim() !== ''"
          :page-count="list.totalPages.value"
          :total-count="list.total.value"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="[10, 20, 50]"
          :row-open="rowOpen"
          display-mode="auto"
          mobile-render="cards"
          search-placeholder="Buscar por venta o cliente"
          class="hf-data-table"
          portal-class="hf-theme hf-ui"
          pagination-portal-class="hf-theme hf-ui"
          @refresh="list.refetch()"
          @clear-filters="search = ''"
        >
          <template v-if="total > 0" #actions>
            <span class="refunds-owed" data-testid="refunds-owed">
              {{ onePage ? 'Por devolver:' : 'Por devolver en esta página:' }}
              <strong>{{ formatCentsMXN(list.outstandingOnPage.value) }}</strong>
            </span>
          </template>

          <template #sale-cell="{ row }">
            <span class="refund-primary-line">
              <button
                v-if="canSettle"
                type="button"
                class="hf-row-primary text-left"
                @click="openSettle(row.original)"
              >
                {{ row.original.folioLabel }}
              </button>
              <span v-else class="hf-row-primary">{{ row.original.folioLabel }}</span>
              <StatusBadge v-if="row.original.settledCents > 0" label="Parcial" tone="info" />
            </span>
            <span class="hf-row-secondary">{{ row.original.customerLabel }}</span>
          </template>

          <template #reason-cell="{ row }">
            <span class="refund-reason">{{ refundReasonLabel(row.original.reason) }}</span>
            <span
              class="hf-row-secondary refund-reason-when"
              :title="`Cancelada el ${refundCanceledDay(row.original.createdAt)}`"
            >{{ refundCanceledAgo(row.original.createdAt) }}</span>
          </template>

          <template #method-cell="{ row }">
            <StatusBadge :label="refundMethodLabel(row.original.method)" tone="neutral" aria-prefix="Método:" />
          </template>

          <template #amountCents-cell="{ row }">
            <span class="refund-cell-figure">{{ formatCentsMXN(row.original.amountCents) }}</span>
          </template>

          <template #settledCents-cell="{ row }">
            <span class="refund-cell-figure">
              <template v-if="row.original.settledCents">{{ formatCentsMXN(row.original.settledCents) }}</template>
              <span v-else class="refund-dash" aria-label="Nada">—</span>
            </span>
          </template>

          <template #outstandingCents-cell="{ row }">
            <span class="refund-cell-figure refund-owe">{{ formatCentsMXN(row.original.outstandingCents) }}</span>
          </template>

          <template #actions-header><span class="sr-only">Acciones</span></template>

          <template #actions-cell="{ row }">
            <RowActionsMenu
              :actions="rowActions"
              :row-label="rowLabel(row.original)"
              @select="onAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <article class="refund-card" data-testid="refund-card">
              <div class="refund-card__top">
                <button
                  v-if="canSettle"
                  type="button"
                  class="refund-card__link"
                  @click="openSettle(row)"
                >
                  {{ row.folioLabel }}
                </button>
                <span v-else class="refund-card__link">{{ row.folioLabel }}</span>
                <StatusBadge v-if="row.settledCents > 0" label="Parcial" tone="info" />
              </div>
              <div class="refund-card__menu">
                <RowActionsMenu
                  :actions="rowActions"
                  :row-label="rowLabel(row)"
                  @select="onAction($event, row)"
                />
              </div>
              <p class="refund-card__secondary">
                {{ row.customerLabel }} · {{ refundReasonLabel(row.reason) }} · {{ refundMethodLabel(row.method) }}
              </p>
              <div class="refund-card__foot">
                <span class="refund-card__owed">
                  <span>Pendiente</span>
                  <span>
                    <span class="refund-owe">{{ formatCentsMXN(row.outstandingCents) }}</span>
                    de {{ formatCentsMXN(row.amountCents) }}
                  </span>
                </span>
                <span>{{ refundAgeLabel(row.createdAt) }}</span>
              </div>
            </article>
          </template>
        </AppDataTable>
      </div>
    </UCard>

    <SettleRefundSlideover
      v-if="canSettle"
      v-model:open="panelOpen"
      :refund="selected"
    />
  </div>
</template>
