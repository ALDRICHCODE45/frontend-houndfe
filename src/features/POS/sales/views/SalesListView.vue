<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AppDataTable } from '@/core/shared/components/DataTable'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useConfirmedSales } from '../composables/useConfirmedSales'
import { useSalesColumns } from '../composables/useSalesColumns'
import SalesListTabs from '../components/SalesListTabs.vue'
import { formatSaleDate } from '../utils/saleDate.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { getDeliveryStatusBadge, getPaymentStatusBadge } from '../utils/saleStatus.utils'
import { formatPaymentMethod, getPaymentMethodColor } from '../utils/salePaymentMethod.utils'

const router = useRouter()
const authStore = useAuthStore()
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))

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
} = useConfirmedSales()

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

      <div class="px-6 py-5">
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
          search-placeholder="Buscar ventas..."
          empty="No hay ventas todavía"
          @refresh="refresh"
        >
          <template #filters>
            <SalesListTabs :counts="counts" @change="setDeliveryStatusFilter" />
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
            <UButton color="primary" icon="i-lucide-plus" @click="goToNewSale">
              Nueva Venta
            </UButton>
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
            <div class="flex flex-wrap gap-1">
              <template v-if="row.original.paymentMethods.length > 0">
                <UBadge
                  v-for="method in row.original.paymentMethods"
                  :key="method"
                  variant="subtle"
                  :color="getPaymentMethodColor(method)"
                  size="md"
                >
                  {{ formatPaymentMethod(method) }}
                </UBadge>
              </template>
              <UBadge v-else-if="row.original.paymentStatus === 'CREDIT'" variant="subtle" color="error" size="md">
                Crédito
              </UBadge>
              <span v-else>—</span>
            </div>
          </template>

          <template #totalCents-cell="{ row }">
            {{ formatCentsMXN(row.original.totalCents) }}
          </template>

          <template #debtCents-cell="{ row }">
            {{ row.original.debtCents > 0 ? formatCentsMXN(row.original.debtCents) : '—' }}
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
