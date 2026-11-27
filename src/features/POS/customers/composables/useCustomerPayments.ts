/**
 * «Cobros y recibos» of the customer page (customers-module T5): `GET /customers/:customerId/payments`
 * (handoff 32 §6), read:Sale, newest first, 50 per page unless the person picked another size
(owner-ideas-batch S5: the shared 5..50, remembered as 'customer-payments'). Only fetched while the tab is open.
 * Refunds are not in the feed (v1), so it is never presented as a balance.
 *
 * `useCustomerReceiptDownload` saves the PDF behind an event's `receiptPath` (one download at a
 * time), with the statement's anchor helper like the collection receipt.
 */
import { computed, readonly, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { TABLE_PAGE_SIZE_OPTIONS } from '@/core/shared/constants/table-page-size'
import { useTablePageSize } from '@/core/shared/composables/useTablePageSize'
import { saveCustomerStatementPdf } from '../statement/customerStatementFile'
import {
  CUSTOMER_PAYMENTS_PAGE_SIZE,
  customerDetailApi,
  customerDetailQueryKeys,
  type CustomerReceiptChoice,
} from '../api/customer-detail.api'
import type { CustomerPaymentEvent, CustomerPaymentsResponse } from '../interfaces/customer.types'
import { customerDetailHttpStatus } from './useCustomerSalesSummary'

export { CUSTOMER_PAYMENTS_PAGE_SIZE }

const FINAL_STATUSES = new Set([400, 401, 403, 404])

export function useCustomerPayments(options: {
  customerId: MaybeRefOrGetter<string | null | undefined>
  enabled: MaybeRefOrGetter<boolean>
}) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId ?? '')
  const customerId = computed(() => toValue(options.customerId) || '')
  const canRead = computed(
    () => typeof authStore.userCan === 'function' && authStore.userCan('read', 'Sale'),
  )
  const page = shallowRef(1)
  const { pageSize } = useTablePageSize({ persistKey: 'customer-payments', defaultPageSize: CUSTOMER_PAYMENTS_PAGE_SIZE })
  watch(customerId, () => {
    page.value = 1
  })
  // A new size starts over at page 1 (same as every table).
  watch(pageSize, () => {
    page.value = 1
  }, { flush: 'sync' })

  const query = useQuery<CustomerPaymentsResponse>({
    queryKey: computed(() =>
      customerDetailQueryKeys.payments(tenantId.value, customerId.value, page.value, pageSize.value),
    ),
    queryFn: () => customerDetailApi.getPayments(customerId.value, page.value, pageSize.value),
    enabled: computed(
      () => toValue(options.enabled) && canRead.value && !!tenantId.value && !!customerId.value,
    ),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      const status = customerDetailHttpStatus(error)
      if (status !== undefined && FINAL_STATUSES.has(status)) return false
      return failureCount < 1
    },
  })

  const status = computed(() => (query.isError.value ? customerDetailHttpStatus(query.error.value) : undefined))

  return {
    canRead,
    page,
    pageSize,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
    response: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    isForbidden: computed(() => status.value === 403),
    isNotFound: computed(() => status.value === 404),
    refetch: query.refetch,
  }
}

const RECEIPT_FAILED = 'No se pudo generar el comprobante. Intenta de nuevo.'

/** One message per documented failure; the backend `message` is never shown. */
export function customerReceiptErrorMessage(error: unknown): string {
  const status = customerDetailHttpStatus(error)
  const code = (error as { response?: { data?: { error?: unknown; message?: unknown } } } | null)
    ?.response?.data
  const codes = [code?.error, code?.message]
  if (status === 403) return 'No tienes permiso para descargar el comprobante.'
  if (codes.includes('SALE_NOT_CONFIRMED')) return 'La venta ya no está confirmada: no tiene recibo.'
  if (status === 404) return 'El comprobante ya no está disponible.'
  return RECEIPT_FAILED
}

export function useCustomerReceiptDownload() {
  /** `${eventId}:${choice}` while a PDF is being fetched. */
  const downloading = shallowRef<string | null>(null)
  const error = shallowRef<string | null>(null)

  /** `true` when the PDF was saved. */
  async function download(event: CustomerPaymentEvent, choice: CustomerReceiptChoice): Promise<boolean> {
    if (downloading.value || !event.receiptPath) return false
    downloading.value = `${event.eventId}:${choice}`
    error.value = null
    try {
      const { blob, fileName } = await customerDetailApi.getReceiptPdf(event, choice)
      saveCustomerStatementPdf(blob, fileName)
      return true
    } catch (failure) {
      error.value = customerReceiptErrorMessage(failure)
      return false
    } finally {
      downloading.value = null
    }
  }

  return { downloading: readonly(downloading), error: readonly(error), download }
}
