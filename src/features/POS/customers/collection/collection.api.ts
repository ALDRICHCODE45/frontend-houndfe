/**
 * collection.api.ts — «Cobrar todo» routes (handoff 30 §1-§7).
 *
 * The POS v1 never sends `saleIds` (F3): the bodies are built by the caller from tenders only.
 * The receipt PDF reuses the statement's generic Blob helpers (real `%PDF-` check, sanitized
 * `Content-Disposition` name, JSON error read out of a Blob).
 */
import { http, type TenantContextBlobErrorConfig } from '@/core/shared/api/http'
import {
  isCustomerStatementPdfBlob,
  parseCustomerStatementFileName,
  readCustomerStatementBlobError,
} from '../statement/customerStatementFile'
import type {
  CollectionApplyBody,
  CollectionPreview,
  CollectionPreviewBody,
  CollectionReceiptFormat,
  CollectionReceiptPdf,
  CollectionResult,
} from './collection.types'

const segment = (id: string) => encodeURIComponent(id)

export function collectionReceiptFallbackFileName(collectionId: string): string {
  return `comprobante-cobro-${collectionId}.pdf`
}

export const customerCollectionApi = {
  async preview(customerId: string, body: CollectionPreviewBody): Promise<CollectionPreview> {
    const { data } = await http.post<CollectionPreview>(
      `/customers/${segment(customerId)}/collections/preview`,
      body,
    )
    return data
  },

  /** `201` new collection or `200` idempotent replay; both carry the same shape. */
  async apply(
    customerId: string,
    body: CollectionApplyBody,
    idempotencyKey: string,
  ): Promise<CollectionResult> {
    const { data } = await http.post<CollectionResult>(
      `/customers/${segment(customerId)}/collections`,
      body,
      { headers: { 'idempotency-key': idempotencyKey } },
    )
    return data
  },

  async read(collectionId: string): Promise<CollectionResult> {
    const { data } = await http.get<CollectionResult>(`/collections/${segment(collectionId)}`)
    return data
  },

  async getReceiptPdf(
    collectionId: string,
    format: CollectionReceiptFormat,
    options: { signal?: AbortSignal } = {},
  ): Promise<CollectionReceiptPdf> {
    try {
      const config: TenantContextBlobErrorConfig = {
        params: { format },
        responseType: 'blob',
        signal: options.signal,
        tenantContextBlobError: true,
      }
      const response = await http.get<Blob>(`/collections/${segment(collectionId)}/pdf`, config)
      if (response.status !== 200) throw new Error('COLLECTION_RECEIPT_UNEXPECTED_STATUS')
      const blob = response.data
      if (!(blob instanceof Blob) || !(await isCustomerStatementPdfBlob(blob))) {
        throw new Error('COLLECTION_RECEIPT_NON_PDF_BODY')
      }
      return {
        blob,
        fileName: parseCustomerStatementFileName(
          response.headers?.['content-disposition'] ?? null,
          collectionReceiptFallbackFileName(collectionId),
        ),
      }
    } catch (error) {
      throw await readCustomerStatementBlobError(error)
    }
  },
}
