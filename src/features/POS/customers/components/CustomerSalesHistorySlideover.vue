<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Customer } from '../interfaces/customer.types'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import { useCustomerSalesHistory } from '@/features/POS/sales/composables/useCustomerSalesHistory'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import SalesHistoryList from './SalesHistoryList.vue'
import SalesHistoryMetrics from './SalesHistoryMetrics.vue'

declare const useToast: () => { add: (options: { title: string; description?: string; color?: 'error' }) => void }

const props = defineProps<{ open: boolean; customer: Customer | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const page = shallowRef(1)
watch(() => props.customer?.id, () => { page.value = 1 }, { flush: 'sync' })

const history = useCustomerSalesHistory({
  customerId: () => props.customer?.id,
  page,
  open: () => props.open,
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

function httpStatus(value: unknown): number | undefined {
  const candidate = value as {
    response?: { status?: number }; status?: number; statusCode?: number
  } | null
  return candidate?.response?.status ?? candidate?.status ?? candidate?.statusCode
}

// Defensive 403: one toast, close, no retry. Deduplicated per error object.
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
  <USlideover
    :open="open"
    title="Historial de ventas"
    :description="description"
    side="right"
    inset
    :close="{ 'aria-label': 'Cerrar historial de ventas' }"
    :ui="{
      content: 'w-full !max-w-none sm:!max-w-[520px]',
      body: 'p-0',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #title>
      <div class="flex min-w-0 items-center gap-3">
        <EntityAvatar
          v-if="customer"
          :name="customer.fullName"
          :seed="customer.id"
          size="md"
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
      <div :aria-busy="initialLoading || undefined">
        <div v-if="initialLoading" aria-hidden="true">
          <div class="grid grid-cols-1 divide-y divide-default sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div v-for="index in 3" :key="index" data-testid="metric-skeleton" class="space-y-2 px-4 py-3">
              <USkeleton class="h-3 w-24" />
              <USkeleton class="h-7 w-20" />
            </div>
          </div>
          <div class="divide-y divide-default">
            <div v-for="index in 5" :key="index" data-testid="row-skeleton" class="space-y-2 px-4 py-3">
              <USkeleton class="h-4 w-full" />
              <USkeleton class="h-3 w-2/3" />
            </div>
          </div>
        </div>

        <div v-else-if="normalizedError" role="alert" class="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <UIcon name="i-lucide-alert-circle" class="size-10 text-error" aria-hidden="true" />
          <p class="max-w-xs text-sm text-muted">{{ normalizedError.message }}</p>
          <UButton label="Reintentar" size="sm" @click="refetch()" />
        </div>

        <template v-else-if="response">
          <SalesHistoryMetrics :summary="response.summary" />
          <div v-if="response.summary.salesCount === 0" role="status" class="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <UIcon name="i-lucide-inbox" class="size-10 text-dimmed" aria-hidden="true" />
            <p class="text-sm text-muted">Este cliente aún no tiene ventas confirmadas.</p>
          </div>
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
        v-if="response && response.summary.salesCount > 0"
        data-testid="history-pagination"
        :data-disabled="String(isFetching)"
      >
        <UPagination
          v-model:page="page"
          :items-per-page="10"
          :total="response.pagination.total"
          :disabled="isFetching"
          show-edges
          :sibling-count="1"
        />
      </div>
    </template>
  </USlideover>
</template>
