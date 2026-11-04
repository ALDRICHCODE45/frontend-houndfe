<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import type { Customer } from '../interfaces/customer.types'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import { useCustomerSalesHistory } from '@/features/POS/sales/composables/useCustomerSalesHistory'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import SalesHistoryList from './SalesHistoryList.vue'
import SalesHistoryMetrics from './SalesHistoryMetrics.vue'

declare const useToast: () => { add: (options: { title: string; description?: string; color?: 'error' }) => void }

const props = defineProps<{ open: boolean; customer: Customer | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const page = shallowRef(1)
const searchQuery = shallowRef('')
const debouncedSearch = shallowRef<string | undefined>(undefined)

watch(() => props.customer?.id, () => {
  page.value = 1
  searchQuery.value = ''
  debouncedSearch.value = undefined
}, { flush: 'sync' })

watchDebounced(
  searchQuery,
  (val) => {
    page.value = 1
    debouncedSearch.value = val.trim() || undefined
  },
  { debounce: 300, maxWait: 600 },
)

const history = useCustomerSalesHistory({
  customerId: () => props.customer?.id,
  page,
  open: () => props.open,
  q: () => debouncedSearch.value,
})
const { response, isLoading, isFetching, isPageTransition, isError, error, refetch } = history

const router = useRouter()
const toast = useToast()
const lastForbiddenError = shallowRef<unknown>(null)
const description = computed(() => props.customer
  ? `Historial de ventas confirmadas de ${props.customer.fullName}`
  : 'Historial de ventas confirmadas del cliente')
const initialLoading = computed(() =>
  !response.value && !isError.value && (isLoading.value || isFetching.value),
)

const hasSearchQuery = computed(() => Boolean(searchQuery.value.trim()))

function httpStatus(value: unknown): number | undefined {
  const candidate = value as {
    response?: { status?: number }; status?: number; statusCode?: number
  } | null
  return candidate?.response?.status ?? candidate?.status ?? candidate?.statusCode
}

watch(error, (currentError) => {
  if (!currentError) {
    lastForbiddenError.value = null
    return
  }
  if (httpStatus(currentError) !== 403 || currentError === lastForbiddenError.value) return

  lastForbiddenError.value = currentError
  toast.add({
    title: 'Sin permiso para ver ventas',
    description: normalizeApiError(currentError, 'No tienes permiso para ver estas ventas.').message,
    color: 'error',
  })
  emit('update:open', false)
}, { immediate: true })

const normalizedError = computed(() =>
  isError.value && error.value && httpStatus(error.value) !== 403
    ? normalizeApiError(error.value, 'No se pudo cargar el historial de ventas. Reintenta.')
    : null,
)

function selectSale(sale: ConfirmedSaleRow) {
  void router.push({ name: 'pos-sale-detail', params: { id: sale.id } })
}
</script>

<template>
  <AppResponsiveDrawer
    :open="open"
    title="Historial de ventas"
    :description="description"
    close-aria-label="Cerrar historial de ventas"
    :desktop-ui="{
      content: 'w-full !max-w-none sm:!max-w-[520px]',
      body: 'p-0',
      header: 'border-b border-default px-4 py-4',
      footer: 'border-t border-default px-4 pb-4 pt-3',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #title>
      <div class="flex min-w-0 items-center gap-3">
        <EntityAvatar
          v-if="customer"
          :name="customer.fullName"
          size="lg"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <p class="font-semibold text-highlighted">Historial de ventas</p>
          <p class="truncate text-xs text-muted">{{ customer?.fullName }}</p>
        </div>
      </div>
    </template>

    <template #description>
      <span class="sr-only">{{ description }}</span>
    </template>

    <template #body>
      <div
        data-testid="history-content"
        :aria-busy="initialLoading || undefined"
        class="min-w-0 max-w-full overflow-x-hidden"
      >
        <div v-if="initialLoading" aria-hidden="true">
          <div class="grid grid-cols-2 gap-2 p-4">
            <div
              v-for="index in 3"
              :key="index"
              data-testid="metric-skeleton"
              class="flex items-center gap-3 rounded-xl border border-default bg-elevated/50 p-3"
              :class="{ 'col-span-2': index === 3 }"
            >
              <USkeleton class="size-9 shrink-0 !rounded-lg" />
              <div class="flex-1 space-y-1.5">
                <USkeleton class="h-3 w-20 !rounded" />
                <USkeleton class="h-5 w-12 !rounded" />
              </div>
            </div>
          </div>
          <div class="border-t border-default px-4 py-3">
            <UInput
              type="search"
              icon="i-lucide-search"
              size="lg"
              placeholder="Buscar por folio..."
              aria-label="Buscar ventas por folio"
              disabled
              class="w-full"
            />
          </div>
          <div class="divide-y divide-default">
            <div v-for="index in 5" :key="index" data-testid="row-skeleton" class="flex items-center gap-3 px-4 py-3">
              <USkeleton class="size-10 shrink-0 !rounded-lg" />
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <USkeleton class="h-3.5 w-24 !rounded" />
                <USkeleton class="h-3 w-16 !rounded" />
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <USkeleton class="h-4 w-14 !rounded" />
                <USkeleton class="h-4 w-12 !rounded" />
              </div>
            </div>
          </div>
        </div>

        <EmptyState
          v-else-if="normalizedError"
          kind="error"
          :title="normalizedError.message"
          action-label="Reintentar"
          action-test-id="history-error-retry"
          @action="refetch()"
        />

        <template v-else-if="response">
          <SalesHistoryMetrics :summary="response.summary" />
          <div class="border-t border-default px-4 py-3">
            <UInput
              v-model="searchQuery"
              type="search"
              icon="i-lucide-search"
              size="lg"
              placeholder="Buscar por folio..."
              aria-label="Buscar ventas por folio"
              class="w-full"
            />
          </div>
          <EmptyState
            v-if="response.data.length === 0 && hasSearchQuery"
            kind="no-match"
            :title="`Ningún resultado para «${searchQuery.trim()}»`"
            description="No se encontraron ventas que coincidan con la búsqueda."
            action-label="Limpiar filtros"
            @action="searchQuery = ''"
          />
          <EmptyState
            v-else-if="response.data.length === 0"
            title="Aún no hay ventas"
            description="Este cliente aún no tiene ventas confirmadas."
          />
          <div
            v-else
            :aria-busy="isPageTransition || undefined"
            :class="isPageTransition ? 'opacity-50' : undefined"
          >
            <SalesHistoryList :sales="response.data" @select="selectSale" />
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <div
        v-if="response && response.pagination.total > 0"
        class="flex min-h-14 min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:min-h-0 lg:flex-nowrap lg:gap-4 lg:p-0"
        data-testid="history-pagination"
        :data-disabled="String(isFetching)"
      >
        <span class="min-w-0 shrink-0 text-sm font-semibold text-muted">
          <template v-if="response.pagination.total === 1">1 venta</template>
          <template v-else>{{ response.pagination.total }} ventas</template>
        </span>
        <div v-if="response.pagination.totalPages > 1" data-testid="history-pagination-controls">
          <UPagination
            v-model:page="page"
            :items-per-page="10"
            :total="response.pagination.total"
            :disabled="isFetching"
            show-edges
            :sibling-count="0"
            size="sm"
          />
        </div>
      </div>
    </template>
  </AppResponsiveDrawer>
</template>
