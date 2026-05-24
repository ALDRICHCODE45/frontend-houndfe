<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AppDataTable } from '@/core/shared/components/DataTable'
import DataTableFilters from '@/core/shared/components/data-table-filters/DataTableFilters.vue'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useConfirmedSales } from '../composables/useConfirmedSales'
import { useSalesColumns } from '../composables/useSalesColumns'
import SalesListTabs from '../components/SalesListTabs.vue'
import SaleCard from '../components/SaleCard.vue'
import PaymentMethodPills from '../components/PaymentMethodPills.vue'
import { salesFiltersSchema } from '../config/salesFiltersSchema'
import { formatSaleDate, formatSaleDueDate } from '../utils/saleDate.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { getDeliveryStatusBadge, getPaymentStatusBadge } from '../utils/saleStatus.utils'

const router = useRouter()
const authStore = useAuthStore()
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))
const filters = ref<Record<string, unknown>>({})

const {
  pagination,
  sorting,
  globalFilter,
  rowSelection,
  columnPinning,
  columnVisibility,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
  counts,
  setDeliveryStatusFilter,
  filterErrors,
} = useConfirmedSales(filters)

const { columns } = useSalesColumns()

const sortValue = ref<'confirmedAt:desc' | 'totalCents:asc' | 'createdAt:desc'>('confirmedAt:desc')

watch(sortValue, (value) => {
  const [id, order] = value.split(':')
  sorting.value = [{ id: id ?? 'confirmedAt', desc: order === 'desc' }]
})

function goToNewSale() {
  void router.push('/pos/ventas/nueva')
}

function goToSaleDetail(id: string) {
  void router.push(`/pos/ventas/${id}`)
}

const baseFilterIds = new Set(['q', 'confirmedFrom', 'confirmedTo', 'cashierUserId', 'customerId', 'customerIncludeNull'])
const activeExtendedFiltersCount = computed(() => Object.entries(filters.value).filter(([key, value]) => {
  if (baseFilterIds.has(key)) return false
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && value !== '' && value !== false
}).length)

watch(filters, () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
}, { deep: true })
</script>

<template>
  <div class="flex flex-col gap-6 px-10">
    <UCard v-if="canReadSales" :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <TableHeaderDescription
          title="Ventas"
          description="Listado de ventas confirmadas"
        />
      </template>

      <div class="px-6 py-5 space-y-4">
        <div class="overflow-x-auto">
          <DataTableFilters
            v-model="filters"
            :schema="salesFiltersSchema"
            :errors="filterErrors"
          />
        </div>
        <div v-if="activeExtendedFiltersCount > 0" class="text-xs text-muted" data-testid="extended-filters-indicator">
          Filtros activos: {{ activeExtendedFiltersCount }} · Limpiar
        </div>

        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          v-model:row-selection="rowSelection"
          :columns="columns"
          :data="data"
          :loading="isLoading"
          :fetching="isFetching"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :enable-row-selection="false"
          mobile-render="cards"
          enable-column-visibility
          search-placeholder="Buscar ventas..."
          empty="No hay ventas todavía"
          @refresh="refresh"
        >
          <template #filters>
            <div class="flex w-full flex-col gap-3">
              <div class="overflow-x-auto">
                <SalesListTabs :counts="counts" @change="setDeliveryStatusFilter" />
              </div>
            </div>
            <USelect
              v-model="sortValue"
              :items="[
                { label: 'Más recientes', value: 'confirmedAt:desc' },
                { label: 'Total menor a mayor', value: 'totalCents:asc' },
                { label: 'Creación reciente', value: 'createdAt:desc' },
              ]"
              class="w-56"
            />
          </template>

          <template #actions>
            <UButton color="primary" icon="i-lucide-plus" class="w-full sm:w-auto" @click="goToNewSale">
              Nueva Venta
            </UButton>
          </template>

          <template #mobile-card="{ row }">
            <SaleCard :sale="row" />
          </template>

          <template #venta-cell="{ row }">
            <UButton
              variant="link"
              color="primary"
              :data-testid="`sale-link-${row.original.id}`"
              @click="goToSaleDetail(row.original.id)"
            >
              {{ extractFolioNumber(row.original.folio) }}
            </UButton>
          </template>

          <template #confirmedAt-cell="{ row }">
            {{ formatSaleDate(row.original.confirmedAt) }}
          </template>

          <template #customer-cell="{ row }">
            {{ row.original.customer?.name ?? 'Público en General' }}
          </template>

          <template #paymentStatus-cell="{ row }">
            <AppBadge :tone="getPaymentStatusBadge(row.original.paymentStatus).color">
              {{ getPaymentStatusBadge(row.original.paymentStatus).label }}
            </AppBadge>
          </template>

          <template #paymentMethods-cell="{ row }">
            <PaymentMethodPills :methods="row.original.paymentMethods" />
          </template>

          <template #totalCents-cell="{ row }">
            {{ formatCentsMXN(row.original.totalCents) }}
          </template>

          <template #debtCents-cell="{ row }">
            {{ row.original.debtCents > 0 ? formatCentsMXN(row.original.debtCents) : '—' }}
          </template>

          <template #dueDate-cell="{ row }">
            {{ row.original.dueDate ? formatSaleDueDate(row.original.dueDate) : '—' }}
          </template>

          <template #deliveryStatus-cell="{ row }">
            <AppBadge :tone="getDeliveryStatusBadge(row.original.deliveryStatus).color">
              {{ getDeliveryStatusBadge(row.original.deliveryStatus).label }}
            </AppBadge>
          </template>

          <template #cashier-cell="{ row }">
            {{ row.original.cashier.name }}
          </template>

          <template #seller-cell="{ row }">
            {{ row.original.seller?.name ?? '' }}
          </template>

          <template #channel-cell>Punto de Venta</template>
          <template #invoice-cell></template>
        </AppDataTable>
      </div>
    </UCard>

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="No tenés permisos para ver ventas"
    />
  </div>
</template>
