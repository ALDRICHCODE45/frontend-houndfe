<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { breakpointsTailwind, useBreakpoints, watchDebounced } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import type { Customer } from '../interfaces/customer.types'
import {
  useCustomerSalesHistory,
  type CustomerHistoryStatusFilter,
} from '@/features/POS/sales/composables/useCustomerSalesHistory'
import { useCustomerSalesMonthly } from '@/features/POS/sales/composables/useCustomerSalesMonthly'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { formatSaleDueDate } from '@/features/POS/sales/utils/saleDate.utils'
import type { SaleHistoryChargeRequest } from '@/features/POS/sales/components/history/SaleHistoryRowDetail.vue'
import DebtPaymentModal from '@/features/POS/sales/components/DebtPaymentModal.vue'
import { usePetsList } from '../pets/usePets'
import { readPetError } from '../pets/petErrors'
import { formatCustomerPhone } from '../utils/customerPhone.utils'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import SalesHistoryList from './SalesHistoryList.vue'
import SalesHistoryMetrics from './SalesHistoryMetrics.vue'
import SalesHistoryMonthlyChart from './SalesHistoryMonthlyChart.vue'
import SalesHistoryPetFilter from './SalesHistoryPetFilter.vue'
import SalesHistoryStatusFilter from './SalesHistoryStatusFilter.vue'
import CustomerStatementDownload from './CustomerStatementDownload.vue'
import CustomerCollectionSlideover from './CustomerCollectionSlideover.vue'

declare const useToast: () => { add: (options: { title: string; description?: string; color?: 'error' }) => void }

const props = defineProps<{ open: boolean; customer: Customer | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const PAGE_SIZE = 10
// Sales history redesign T1: the panel shares the seller report width (45vw ≈ 650px at 1440).
const DESKTOP_UI = {
  content: 'w-full !max-w-none sm:!max-w-[max(45vw,640px)]',
  body: 'p-0',
  header: 'border-b border-default px-4 py-4',
  footer: 'border-t border-default px-4 pb-4 pt-3',
}
const STATUS_EMPTY_COPY: Record<Exclude<CustomerHistoryStatusFilter, 'all'>, string> = {
  'with-debt': 'No hay ventas con saldo',
  'not-delivered': 'No hay ventas sin entregar',
  overdue: 'No hay ventas vencidas',
}
const STATUS_LABELS: Record<Exclude<CustomerHistoryStatusFilter, 'all'>, string> = {
  'with-debt': 'Con saldo',
  'not-delivered': 'Sin entregar',
  overdue: 'Vencidas',
}

const page = shallowRef(1)
const searchQuery = shallowRef('')
const debouncedSearch = shallowRef<string | undefined>(undefined)
const petId = shallowRef<string | null>(null)
const petNotice = shallowRef<string | null>(null)
const status = shallowRef<CustomerHistoryStatusFilter>('all')

watch(() => props.customer?.id, () => {
  page.value = 1
  searchQuery.value = ''
  debouncedSearch.value = undefined
  petId.value = null
  petNotice.value = null
  status.value = 'all'
  chargeRequest.value = null
  collectionOpen.value = false
}, { flush: 'sync' })

watch(petId, (selected) => {
  page.value = 1
  if (selected) petNotice.value = null
}, { flush: 'sync' })

watch(status, () => {
  page.value = 1
}, { flush: 'sync' })

// Customer pets §7: ACTIVE and ARCHIVED pets can filter the history (archived ones keep their sales).
const petsQuery = usePetsList(() => props.customer?.id, 'ALL', () => props.open)
const pets = computed(() => petsQuery.data.value ?? [])
const selectedPet = computed(() => pets.value.find((pet) => pet.id === petId.value) ?? null)
const isPetNotFound = (value: unknown) => !!value && readPetError(value).code === 'PET_NOT_FOUND'

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
  petId: () => petId.value,
  status: () => status.value,
})
const { response, customerSummary, customerCounts, isLoading, isFetching, isPageTransition, isError, error, refetch } = history

// Handoff 28 §4: the customer's last 12 months (read:Sale; hidden without it or on error).
const monthly = useCustomerSalesMonthly({
  customerId: () => props.customer?.id,
  open: () => props.open,
  months: 12,
})
const { months: monthlyMonths, isError: monthlyFailed } = monthly
const monthlyCanRead = computed(() => monthly.canRead.value)

const toast = useToast()
const queryClient = useQueryClient()
const authStore = useAuthStore()
// At phone width the table becomes cards (design 04): no sideways scroll.
const isPhone = useBreakpoints(breakpointsTailwind).smaller('md')
const listLayout = computed(() => (isPhone.value ? 'cards' : 'table'))
const lastForbiddenError = shallowRef<unknown>(null)
const description = computed(() => props.customer
  ? `Historial de ventas confirmadas de ${props.customer.fullName}`
  : 'Historial de ventas confirmadas del cliente')
const initialLoading = computed(() =>
  !response.value && !isError.value && (isLoading.value || isFetching.value),
)

const phone = computed(() => {
  const value = props.customer?.phone?.trim()
  if (!value || !props.customer) return null
  const code = props.customer.phoneCountryCode?.replace(/[^\d]/g, '') ?? ''
  return {
    label: formatCustomerPhone(props.customer.phoneCountryCode, value),
    href: `tel:${code ? `+${code}` : ''}${value.replace(/[^\d+]/g, '')}`,
  }
})

const customerSince = computed(() => {
  const createdAt = props.customer?.createdAt
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).formatToParts(date)
  const month = parts.find((part) => part.type === 'month')?.value.replace(/\.$/, '') ?? ''
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  return `${month} ${year}`.trim()
})

const hasSearchQuery = computed(() => Boolean(searchQuery.value.trim()))
const hasListFilter = computed(() => Boolean(petId.value) || status.value !== 'all')
const hasAnyFilter = computed(() => hasListFilter.value || hasSearchQuery.value || Boolean(debouncedSearch.value))
/** A customer with no sale at all: real zeros, no search or filters that cannot help (design 04 · 3). */
const customerHasNoSales = computed(() =>
  !!response.value &&
  response.value.data.length === 0 &&
  !hasAnyFilter.value &&
  (customerSummary.value?.salesCount ?? 0) === 0,
)
const hasDebt = computed(() => (customerSummary.value?.outstandingDebtCents ?? 0) > 0)
/**
 * Handoff 28 §2.2-§3: «2 vencidas · $610.00 · la más antigua el 10/11/2026» from the customer-wide
 * counts/summary. The oldest due day is formatted like the row's due date (no time zone shift).
 */
const overdueLabel = computed(() => {
  const count = customerCounts.value?.overdue ?? 0
  if (count <= 0) return null
  const summary = customerSummary.value
  const parts = [`${count} ${count === 1 ? 'vencida' : 'vencidas'}`]
  if (typeof summary?.overdueDebtCents === 'number') parts.push(formatCentsMXN(summary.overdueDebtCents))
  if (summary?.oldestOverdueDueDate) {
    parts.push(`la más antigua el ${formatSaleDueDate(summary.oldestOverdueDueDate)}`)
  }
  return parts.join(' · ')
})
const showDebtBanner = computed(() => listLayout.value === 'cards' && (hasDebt.value || !!overdueLabel.value))
const showMonthlyChart = computed(() => monthlyCanRead.value && !customerHasNoSales.value)
// Handoff 29: the statement PDF needs read:Sale, the same check as the monthly chart.
const showStatementDownload = computed(() => monthlyCanRead.value && !!props.customer?.id)
// «Cobrar todo» (handoff 30 §1): collecting needs update:Sale, and only a customer with open debt.
const canCollect = computed(
  () => typeof authStore.userCan === 'function' && authStore.userCan('update', 'Sale'),
)
const showCollectAction = computed(() => canCollect.value && hasDebt.value && !!props.customer?.id)
const pendingPaymentsLabel = computed(() => {
  const count = customerCounts.value?.pendingPayments ?? 0
  return count > 0 ? `${count} ${count === 1 ? 'venta' : 'ventas'} por cobrar` : null
})

const rangeLabel = computed(() => {
  const pagination = response.value?.pagination
  if (!pagination || pagination.total === 0) return null
  const first = (pagination.page - 1) * pagination.limit + 1
  const last = Math.min(pagination.page * pagination.limit, pagination.total)
  const noun = pagination.total === 1 ? 'venta' : 'ventas'
  return `${first}–${last} de ${pagination.total} ${noun}`
})

/** Totals of every sale the active filters match (not only the page), straight from the backend. */
const filterSummaryLabel = computed(() => {
  const summary = response.value?.filterSummary
  if (!summary || !hasAnyFilter.value) return null
  const scope = [selectedPet.value?.name, status.value !== 'all' ? STATUS_LABELS[status.value] : null]
    .filter(Boolean)
    .join(' · ')
  const prefix = scope ? `${scope}: ` : 'Filtro: '
  return `${prefix}${formatCentsMXN(summary.totalCents)} vendido · ${formatCentsMXN(summary.debtCents)} de saldo`
})

function httpStatus(value: unknown): number | undefined {
  const candidate = value as {
    response?: { status?: number }; status?: number; statusCode?: number
  } | null
  return candidate?.response?.status ?? candidate?.status ?? candidate?.statusCode
}

// `404 PET_NOT_FOUND`: the pet was erased meanwhile — say so, go back to «Todas» and reload the pets.
watch(error, (currentError) => {
  if (!petId.value || !isPetNotFound(currentError)) return
  petNotice.value = 'Esa mascota ya no existe. Mostramos todas las ventas del cliente.'
  petId.value = null
  void petsQuery.refetch()
}, { flush: 'sync' })

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
  isError.value && error.value && httpStatus(error.value) !== 403 && !isPetNotFound(error.value)
    ? normalizeApiError(error.value, 'No se pudo cargar el historial de ventas.')
    : null,
)

// «Cobrar» (expanded row) opens the same DebtPaymentModal as the sale detail page. That modal
// invalidates the sale detail and the Ventas list; the customer history key is refreshed here.
const chargeRequest = shallowRef<SaleHistoryChargeRequest | null>(null)
const chargeOpen = computed({
  get: () => chargeRequest.value !== null,
  set: (value: boolean) => {
    if (!value) chargeRequest.value = null
  },
})

function onCharge(request: SaleHistoryChargeRequest) {
  chargeRequest.value = request
}

// «Cobrar todo»: its own open state, so the sheet survives the refreshed history losing its debt.
// The collection itself refreshes the history, monthly chart, sales lists and sale details.
const collectionOpen = shallowRef(false)

function onChargeSuccess() {
  chargeRequest.value = null
  const customerId = props.customer?.id
  if (!customerId) return
  void queryClient.invalidateQueries({
    queryKey: saleQueryKeys.customerHistoryPrefix(authStore.currentTenantId, customerId),
  })
}
</script>

<template>
  <AppResponsiveDrawer
    :open="open"
    title="Historial de ventas"
    :description="description"
    close-aria-label="Cerrar historial de ventas"
    :desktop-ui="DESKTOP_UI"
    @update:open="emit('update:open', $event)"
  >
    <template #title>
      <div data-testid="history-header" class="flex min-w-0 items-start gap-3">
        <EntityAvatar
          v-if="customer"
          :name="customer.fullName"
          size="lg"
          class="hidden sm:inline-flex"
          aria-hidden="true"
        />
        <div class="grid min-w-0 gap-0.5">
          <p class="flex flex-wrap items-center gap-x-2 text-[13px] font-normal text-[var(--hf-muted)]">
            <span>Historial de ventas</span>
            <span v-if="customerSince">· cliente desde {{ customerSince }}</span>
          </p>
          <p
            data-testid="history-customer-name"
            class="break-words text-[17px] font-semibold leading-tight text-[var(--hf-heading)] sm:text-[22px]"
          >
            {{ customer?.fullName }}
          </p>
          <a
            v-if="phone"
            :href="phone.href"
            class="inline-flex w-fit items-center gap-1 text-[13px] font-normal text-[var(--hf-action)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hf-focus)]"
          >
            <UIcon name="i-lucide-phone" class="size-3.5" aria-hidden="true" />
            <span class="hf-figure">{{ phone.label }}</span>
          </a>
        </div>
        <div
          v-if="(showStatementDownload || (showCollectAction && listLayout === 'table')) && customer"
          class="ml-auto flex shrink-0 items-center gap-2"
        >
          <UButton
            v-if="showCollectAction && listLayout === 'table'"
            data-testid="history-collect-all"
            icon="i-lucide-hand-coins"
            class="hf-primary-control"
            @click="collectionOpen = true"
          >
            Cobrar todo
          </UButton>
          <CustomerStatementDownload v-if="showStatementDownload" :key="customer.id" :customer-id="customer.id" />
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
        class="grid min-w-0 max-w-full gap-3 overflow-x-hidden p-4"
      >
        <div v-if="initialLoading" aria-hidden="true" class="grid gap-3">
          <span class="sr-only" role="status">Cargando el historial de ventas…</span>
          <div class="grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--hf-border)] sm:grid-cols-3">
            <div
              v-for="index in 3"
              :key="index"
              data-testid="metric-skeleton"
              class="grid gap-1.5 px-4 py-3"
              :class="{ 'col-span-2 sm:col-span-1': index === 3 }"
            >
              <USkeleton class="h-3 w-20 !rounded" />
              <USkeleton class="h-5 w-24 !rounded" />
            </div>
          </div>
          <UInput
            type="search"
            icon="i-lucide-search"
            size="lg"
            placeholder="Buscar por folio..."
            aria-label="Buscar ventas por folio"
            disabled
            class="w-full"
          />
          <div class="grid gap-2">
            <div
              v-for="index in 5"
              :key="index"
              data-testid="row-skeleton"
              class="grid gap-1.5 rounded-xl border border-[var(--hf-border)] px-4 py-3"
            >
              <div class="flex items-center justify-between gap-3">
                <USkeleton class="h-4 w-24 !rounded" />
                <USkeleton class="h-4 w-16 !rounded" />
              </div>
              <USkeleton class="h-3 w-40 !rounded" />
            </div>
          </div>
        </div>

        <EmptyState
          v-else-if="normalizedError"
          kind="error"
          :title="normalizedError.message"
          description="Puede ser un problema temporal de conexión. No se modificó ninguna venta."
          action-label="Reintentar"
          action-test-id="history-error-retry"
          @action="refetch()"
        />

        <template v-else-if="response">
          <div
            v-if="showDebtBanner"
            data-testid="history-debt-banner"
            class="flex min-w-0 items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--hf-warning)_35%,var(--hf-warning-soft))] bg-[var(--hf-warning-soft)] px-4 py-3 text-[13px]"
          >
            <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0 text-[var(--hf-warning)]" aria-hidden="true" />
            <div class="grid min-w-0 flex-1 gap-0.5">
              <b class="hf-figure font-semibold text-[var(--hf-warning)]">Debe {{ formatCentsMXN(customerSummary?.outstandingDebtCents ?? 0) }}</b>
              <span v-if="pendingPaymentsLabel" class="text-[var(--hf-ink)]">{{ pendingPaymentsLabel }}</span>
              <span
                v-if="overdueLabel"
                data-testid="history-debt-banner-overdue"
                class="hf-figure font-semibold text-[var(--hf-warning)]"
              >{{ overdueLabel }}</span>
            </div>
            <div class="flex shrink-0 flex-col items-stretch gap-2">
              <UButton
                v-if="showCollectAction"
                data-testid="history-collect-all-banner"
                size="sm"
                class="hf-primary-control min-h-11 justify-center"
                @click="collectionOpen = true"
              >
                Cobrar todo
              </UButton>
              <UButton
                v-if="overdueLabel && status !== 'overdue'"
                size="sm"
                color="neutral"
                variant="outline"
                class="min-h-11 shrink-0 justify-center"
                aria-label="Ver las ventas vencidas"
                @click="status = 'overdue'"
              >
                Ver vencidas
              </UButton>
              <UButton
                v-else-if="!overdueLabel"
                size="sm"
                color="neutral"
                variant="outline"
                class="min-h-11 shrink-0 justify-center"
                :aria-label="'Ver las ventas con saldo'"
                @click="status = 'with-debt'"
              >
                Ver
              </UButton>
            </div>
          </div>

          <SalesHistoryMetrics v-if="customerSummary" :summary="customerSummary" :counts="customerCounts" />

          <div
            v-if="listLayout === 'table' && overdueLabel"
            data-testid="history-overdue-warning"
            class="flex min-w-0 items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--hf-warning)_35%,var(--hf-warning-soft))] bg-[var(--hf-warning-soft)] px-4 py-2 text-[13px]"
          >
            <UIcon name="i-lucide-calendar-clock" class="size-4 shrink-0 text-[var(--hf-warning)]" aria-hidden="true" />
            <span class="hf-figure min-w-0 flex-1 font-semibold text-[var(--hf-warning)]">{{ overdueLabel }}</span>
            <UButton
              v-if="status !== 'overdue'"
              size="sm"
              color="neutral"
              variant="outline"
              class="shrink-0"
              aria-label="Ver las ventas vencidas"
              @click="status = 'overdue'"
            >
              Ver vencidas
            </UButton>
          </div>

          <template v-if="showMonthlyChart">
            <SalesHistoryMonthlyChart v-if="monthlyMonths" :months="monthlyMonths" />
            <SalesHistoryMonthlyChart v-else-if="monthlyFailed" failed @retry="monthly.refetch()" />
          </template>

          <template v-if="!customerHasNoSales">
            <div class="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
              <UInput
                v-model="searchQuery"
                type="search"
                icon="i-lucide-search"
                size="lg"
                placeholder="Buscar por folio..."
                aria-label="Buscar ventas por folio"
                class="w-full md:w-auto md:min-w-48 md:flex-1"
              />
              <SalesHistoryStatusFilter v-model="status" :counts="customerCounts" />
            </div>
            <SalesHistoryPetFilter v-if="pets.length > 0" v-model="petId" :pets="pets" />
          </template>
          <UAlert
            v-if="petNotice"
            data-testid="history-pet-notice"
            color="warning"
            variant="subtle"
            icon="i-lucide-info"
            :description="petNotice"
            role="status"
          />

          <EmptyState
            v-if="response.data.length === 0 && hasSearchQuery"
            kind="no-match"
            :title="`Ningún resultado para «${searchQuery.trim()}»`"
            description="No se encontraron ventas que coincidan con la búsqueda."
            action-label="Limpiar filtros"
            @action="searchQuery = ''"
          />
          <EmptyState
            v-else-if="response.data.length === 0 && selectedPet"
            :title="`${selectedPet.name} aún no tiene ventas`"
            :description="status === 'all' ? 'No hay ventas confirmadas para esta mascota.' : 'No hay ventas de esta mascota con este filtro.'"
            action-label="Ver todas las ventas"
            @action="petId = null; status = 'all'"
          />
          <EmptyState
            v-else-if="response.data.length === 0 && status !== 'all'"
            kind="no-match"
            :title="STATUS_EMPTY_COPY[status]"
            description="Este cliente no tiene ventas con este filtro."
            action-label="Ver todas"
            @action="status = 'all'"
          />
          <EmptyState
            v-else-if="response.data.length === 0"
            title="Aún no hay ventas"
            description="Este cliente aún no tiene ventas confirmadas."
          />
          <template v-else>
            <p
              v-if="isPageTransition"
              data-testid="history-updating"
              role="status"
              aria-live="polite"
              class="flex items-center gap-2 rounded-lg bg-[var(--hf-active-soft)] px-3 py-2 text-[13px] text-[var(--hf-active)]"
            >
              <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Actualizando el historial…
            </p>
            <div
              :aria-busy="isPageTransition || undefined"
              :class="isPageTransition ? 'opacity-50' : undefined"
            >
              <SalesHistoryList
                :sales="response.data"
                :layout="listLayout"
                allow-charge
                :caption="customer ? `Ventas de ${customer.fullName}, más recientes primero` : undefined"
                @charge="onCharge"
              />
            </div>
          </template>
        </template>
      </div>

      <DebtPaymentModal
        v-if="chargeRequest"
        :key="chargeRequest.saleId"
        v-model:open="chargeOpen"
        :sale-id="chargeRequest.saleId"
        :debt-cents="chargeRequest.debtCents"
        portal-class="hf-theme hf-ui hf-form-overlay"
        @success="onChargeSuccess"
      />

      <CustomerCollectionSlideover
        v-if="collectionOpen && customer"
        :key="customer.id"
        v-model:open="collectionOpen"
        :customer-id="customer.id"
        :customer-name="customer.fullName"
      />
    </template>

    <template #footer>
      <div
        v-if="response && response.pagination.total > 0"
        class="flex min-h-14 min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:min-h-0 lg:flex-nowrap lg:gap-4 lg:p-0"
        data-testid="history-pagination"
        :data-disabled="String(isFetching)"
      >
        <div class="grid min-w-0 gap-0.5">
          <span class="text-sm text-[var(--hf-muted)]">
            <b class="hf-figure font-semibold text-[var(--hf-ink)]">{{ rangeLabel }}</b>
            <span class="hidden sm:inline"> · más recientes primero</span>
          </span>
          <span
            v-if="filterSummaryLabel"
            data-testid="history-filter-summary"
            class="hf-figure text-xs text-[var(--hf-muted)]"
          >{{ filterSummaryLabel }}</span>
        </div>
        <div v-if="response.pagination.totalPages > 1" data-testid="history-pagination-controls">
          <UPagination
            v-model:page="page"
            :items-per-page="PAGE_SIZE"
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
