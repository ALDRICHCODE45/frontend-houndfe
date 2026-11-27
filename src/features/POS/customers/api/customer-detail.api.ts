/**
 * customer-detail.api.ts — the customer page's own routes (customers-module T5, handoff 32 §5-§6).
 *
 * - `GET /customers/:customerId/sales-summary` (read:Sale): the KPI strip's metrics.
 * - `GET /customers/:customerId/payments?page=&limit=` (read:Sale): «Cobros y recibos», newest first.
 * - The receipt PDF of a feed event: its relative `receiptPath` plus `?format=`, downloaded as an
 *   authenticated Blob with the statement's helpers (real `%PDF-` check, sanitized
 *   `Content-Disposition` name, JSON error read out of a Blob), like the collection receipt.
 *
 * Both query keys sit under `saleQueryKeys.customerHistoryPrefix`: every flow that already refreshes
 * the customer's history after a collection or a debt payment refreshes the summary and the feed too.
 */
import { http, type TenantContextBlobErrorConfig } from '@/core/shared/api/http'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import {
  isCustomerStatementPdfBlob,
  parseCustomerStatementFileName,
  readCustomerStatementBlobError,
} from '../statement/customerStatementFile'
import type {
  CustomerPaymentEvent,
  CustomerPaymentsResponse,
  CustomerSalesSummaryResponse,
} from '../interfaces/customer.types'

export const CUSTOMER_PAYMENTS_PAGE_SIZE = 50

/** What the person picks; the wire value depends on the event kind. */
export type CustomerReceiptChoice = 'ticket' | 'a4'
export type CustomerReceiptFormat = 'ticket' | 'a4' | 'receipt-ticket' | 'receipt-a4'

export interface CustomerReceiptPdf {
  blob: Blob
  fileName: string
}

const segment = (id: string) => encodeURIComponent(id)

/** Handoff 32 §6: a collection prints `ticket|a4`; a sale prints `receipt-ticket|receipt-a4`. */
export function customerReceiptFormat(
  kind: CustomerPaymentEvent['kind'],
  choice: CustomerReceiptChoice,
): CustomerReceiptFormat {
  if (kind === 'collection') return choice
  return choice === 'ticket' ? 'receipt-ticket' : 'receipt-a4'
}

const RECEIPT_PATH = /^\/(?:collections|sales)\/[A-Za-z0-9-]+\/pdf$/

/** Only the two documented relative paths are ever requested (no host, query or dot segments). */
export function isCustomerReceiptPath(path: string | null | undefined): path is string {
  return typeof path === 'string' && RECEIPT_PATH.test(path)
}

function receiptFallbackFileName(event: CustomerPaymentEvent): string {
  return event.kind === 'collection'
    ? `comprobante-cobro-${event.eventId}.pdf`
    : `recibo-${event.sale.folio || event.sale.id}.pdf`
}

export const customerDetailQueryKeys = {
  salesSummary: (tenantId: string, customerId: string) =>
    [...saleQueryKeys.customerHistoryPrefix(tenantId, customerId), 'sales-summary'] as const,
  paymentsPrefix: (tenantId: string, customerId: string) =>
    [...saleQueryKeys.customerHistoryPrefix(tenantId, customerId), 'payments'] as const,
  payments: (tenantId: string, customerId: string, page: number, limit = CUSTOMER_PAYMENTS_PAGE_SIZE) =>
    [...saleQueryKeys.customerHistoryPrefix(tenantId, customerId), 'payments', page, limit] as const,
}

export const customerDetailApi = {
  async getSalesSummary(customerId: string): Promise<CustomerSalesSummaryResponse> {
    const { data } = await http.get<CustomerSalesSummaryResponse>(
      `/customers/${segment(customerId)}/sales-summary`,
    )
    return data
  },

  async getPayments(
    customerId: string,
    page: number,
    limit: number = CUSTOMER_PAYMENTS_PAGE_SIZE,
  ): Promise<CustomerPaymentsResponse> {
    const { data } = await http.get<CustomerPaymentsResponse>(
      `/customers/${segment(customerId)}/payments`,
      { params: { page, limit } },
    )
    return data
  },

  async getReceiptPdf(
    event: CustomerPaymentEvent,
    choice: CustomerReceiptChoice,
    options: { signal?: AbortSignal } = {},
  ): Promise<CustomerReceiptPdf> {
    const path = event.receiptPath
    if (!isCustomerReceiptPath(path)) throw new Error('CUSTOMER_RECEIPT_UNAVAILABLE')
    try {
      const config: TenantContextBlobErrorConfig = {
        params: { format: customerReceiptFormat(event.kind, choice) },
        responseType: 'blob',
        signal: options.signal,
        tenantContextBlobError: true,
      }
      const response = await http.get<Blob>(path, config)
      if (response.status !== 200) throw new Error('CUSTOMER_RECEIPT_UNEXPECTED_STATUS')
      const blob = response.data
      if (!(blob instanceof Blob) || !(await isCustomerStatementPdfBlob(blob))) {
        throw new Error('CUSTOMER_RECEIPT_NON_PDF_BODY')
      }
      return {
        blob,
        fileName: parseCustomerStatementFileName(
          response.headers?.['content-disposition'] ?? null,
          receiptFallbackFileName(event),
        ),
      }
    } catch (error) {
      throw await readCustomerStatementBlobError(error)
    }
  },
}
