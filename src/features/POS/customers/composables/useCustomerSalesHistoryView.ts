/**
 * The customer's sales history as one controller (customers-module T4): filters, the history and
 * monthly queries, the derived labels and the «Cobrar» of one row. The «Ventas» tab of the
 * customer page calls it once and hands it to `CustomerSalesHistoryBody` and
 * `CustomerSalesHistoryPager`.
 *
 * `active` gates every request (the slideover's `open`, the page's open «Ventas» tab). A 403 shows
 * the «Sin permiso» toast once and calls `onForbidden` (the slideover closes itself).
 */
import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
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
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { usePetsList } from '../pets/usePets'
import { readPetError } from '../pets/petErrors'
import { hasUnresolvedCollection } from '../collection/useCustomerCollection'

declare const useToast: () => {
  add: (options: { title: string; description?: string; color?: 'error' | 'warning' }) => void
}

export const CUSTOMER_HISTORY_PAGE_SIZE = 10

export const STATUS_EMPTY_COPY: Record<Exclude<CustomerHistoryStatusFilter, 'all'>, string> = {
  'with-debt': 'No hay ventas con saldo',
  'not-delivered': 'No hay ventas sin entregar',
  overdue: 'No hay ventas vencidas',
}
const STATUS_LABELS: Record<Exclude<CustomerHistoryStatusFilter, 'all'>, string> = {
  'with-debt': 'Con saldo',
  'not-delivered': 'Sin entregar',
  overdue: 'Vencidas',
}

export interface UseCustomerSalesHistoryViewOptions {
  customer: MaybeRefOrGetter<Customer | null | undefined>
  active: MaybeRefOrGetter<boolean>
  onForbidden?: () => void
}

function httpStatus(value: unknown): number | undefined {
  const candidate = value as {
    response?: { status?: number }; status?: number; statusCode?: number
  } | null
  return candidate?.response?.status ?? candidate?.status ?? candidate?.statusCode
}

export function useCustomerSalesHistoryView(options: UseCustomerSalesHistoryViewOptions) {
  const customer = computed(() => toValue(options.customer) ?? null)
  const active = computed(() => toValue(options.active))
  const customerId = computed(() => customer.value?.id)

  const page = shallowRef(1)
  const searchQuery = shallowRef('')
  const debouncedSearch = shallowRef<string | undefined>(undefined)
  const petId = shallowRef<string | null>(null)
  const petNotice = shallowRef<string | null>(null)
  const status = shallowRef<CustomerHistoryStatusFilter>('all')
  // «Cobrar» (expanded row) opens the same DebtPaymentModal as the sale detail page.
  const chargeRequest = shallowRef<SaleHistoryChargeRequest | null>(null)

  watch(customerId, () => {
    page.value = 1
    searchQuery.value = ''
    debouncedSearch.value = undefined
    petId.value = null
    petNotice.value = null
    status.value = 'all'
    chargeRequest.value = null
  }, { flush: 'sync' })

  watch(petId, (selected) => {
    page.value = 1
    if (selected) petNotice.value = null
  }, { flush: 'sync' })

  watch(status, () => {
    page.value = 1
  }, { flush: 'sync' })

  // Customer pets §7: ACTIVE and ARCHIVED pets can filter the history (archived ones keep their sales).
  const petsQuery = usePetsList(() => customerId.value, 'ALL', () => active.value)
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
    customerId: () => customerId.value,
    page,
    open: () => active.value,
    q: () => debouncedSearch.value,
    petId: () => petId.value,
    status: () => status.value,
  })
  const { response, customerSummary, customerCounts, isLoading, isFetching, isPageTransition, isError, error, refetch } = history

  // Handoff 28 §4: the customer's last 12 months (read:Sale; hidden without it or on error).
  const monthly = useCustomerSalesMonthly({
    customerId: () => customerId.value,
    open: () => active.value,
    months: 12,
  })
  const monthlyMonths = monthly.months
  const monthlyFailed = monthly.isError
  const monthlyCanRead = computed(() => monthly.canRead.value)

  const toast = useToast()
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  // At phone width the table becomes cards (design 04): no sideways scroll.
  const isPhone = useBreakpoints(breakpointsTailwind).smaller('md')
  const listLayout = computed<'table' | 'cards'>(() => (isPhone.value ? 'cards' : 'table'))
  const lastForbiddenError = shallowRef<unknown>(null)
  const initialLoading = computed(() =>
    !response.value && !isError.value && (isLoading.value || isFetching.value),
  )

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
  // A «Cobrar todo» whose outcome is unknown stays reachable (to retry it) even if the debt is gone.
  const collectionUnresolved = computed(() =>
    hasUnresolvedCollection(authStore.currentTenantId, customerId.value),
  )
  const collectActionLabel = computed(() =>
    collectionUnresolved.value ? 'Cobro sin confirmar' : 'Cobrar todo',
  )
  const showDebtBanner = computed(() =>
    listLayout.value === 'cards' && (hasDebt.value || !!overdueLabel.value || collectionUnresolved.value),
  )
  const showMonthlyChart = computed(() => monthlyCanRead.value && !customerHasNoSales.value)
  // «Cobrar todo» (handoff 30 §1): collecting needs update:Sale, and only a customer with open debt.
  const canCollect = computed(
    () => typeof authStore.userCan === 'function' && authStore.userCan('update', 'Sale'),
  )
  const showCollectAction = computed(
    () => canCollect.value && (hasDebt.value || collectionUnresolved.value) && !!customerId.value,
  )
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
    options.onForbidden?.()
  }, { immediate: true })

  const normalizedError = computed(() =>
    isError.value && error.value && httpStatus(error.value) !== 403 && !isPetNotFound(error.value)
      ? normalizeApiError(error.value, 'No se pudo cargar el historial de ventas.')
      : null,
  )

  const chargeOpen = computed({
    get: () => chargeRequest.value !== null,
    set: (value: boolean) => {
      if (!value) chargeRequest.value = null
    },
  })

  function onCharge(request: SaleHistoryChargeRequest) {
    chargeRequest.value = request
  }

  // The DebtPaymentModal invalidates the sale detail and the Ventas list; the customer history key
  // is refreshed here.
  function onChargeSuccess() {
    chargeRequest.value = null
    const id = customerId.value
    if (!id) return
    void queryClient.invalidateQueries({
      queryKey: saleQueryKeys.customerHistoryPrefix(authStore.currentTenantId, id),
    })
  }

  function refetchMonthly() {
    void monthly.refetch()
  }

  return {
    customer,
    page,
    searchQuery,
    petId,
    petNotice,
    status,
    pets,
    selectedPet,
    response,
    customerSummary,
    customerCounts,
    isFetching,
    isPageTransition,
    refetch,
    monthlyMonths,
    monthlyFailed,
    refetchMonthly,
    listLayout,
    initialLoading,
    normalizedError,
    hasSearchQuery,
    customerHasNoSales,
    hasDebt,
    overdueLabel,
    collectionUnresolved,
    collectActionLabel,
    showDebtBanner,
    showMonthlyChart,
    showCollectAction,
    pendingPaymentsLabel,
    rangeLabel,
    filterSummaryLabel,
    chargeRequest,
    chargeOpen,
    onCharge,
    onChargeSuccess,
  }
}

export type CustomerSalesHistoryView = ReturnType<typeof useCustomerSalesHistoryView>
