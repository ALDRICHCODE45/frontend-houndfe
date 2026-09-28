import { http, type TenantContextBlobErrorConfig } from '@/core/shared/api/http'
import {
  isSellerReportPdfBlob,
  normalizeSellerReportPdfError,
  parseSellerReportPdfFileName,
} from '../utils/sellerReportDownload'
import {
  parseSellerSalesReportResponse,
  type SellerReportRequest,
  type SellerSalesReport,
} from '../interfaces/seller-report.types'

/**
 * sellerReport.api.ts — authenticated transport for the seller sales report.
 *
 * Locked contract:
 *   - `GET /analytics/sales/sellers/:sellerUserId/report` requires JWT plus
 *     `read:User`, `read:Sale` and `read:Analytics`; the interceptor in
 *     `core/shared/api/http` attaches the bearer token and disables HTTP caching
 *     for authenticated GETs.
 *   - Tenant identity comes from the JWT, so the request sends ONLY `from` and
 *     `to` as query params. The params object is rebuilt explicitly instead of
 *     forwarded, so a forbidden key (tenantId, currency, timestamps, page, or a
 *     future caller typo) can never cross the wire.
 *   - The seller id travels as a PATH SEGMENT and is therefore encoded: a
 *     hostile value can never escape its slot into another path or query.
 *   - `tenantId` is supplied as an EXPECTATION, never as a query param: the
 *     backend resolves the tenant from the JWT, and the response must echo the
 *     caller's tenant context.
 *   - The response crosses a network boundary and is UNTRUSTED. It is validated
 *     against the request before it reaches a composable, and a deviation
 *     rejects instead of being repaired (no fill, sort, dedupe or derivation in
 *     the browser).
 *   - The TanStack `signal` is forwarded so a superseded request is aborted at
 *     the HTTP layer, not merely ignored.
 */

export interface SellerReportRequestContext {
  /** Tenant the response must echo. Cache/validation context only — never sent. */
  tenantId: string
  /** TanStack abort signal for a superseded request. */
  signal?: AbortSignal
}

/** A validated PDF body plus the safe file name derived from the headers. */
export interface SellerReportPdf {
  blob: Blob
  fileName: string
}

export const sellerReportApi = {
  async getReport(
    params: SellerReportRequest,
    context: SellerReportRequestContext,
  ): Promise<SellerSalesReport> {
    const { data } = await http.get<unknown>(
      `/analytics/sales/sellers/${encodeURIComponent(params.sellerUserId)}/report`,
      {
        params: { from: params.from, to: params.to },
        signal: context.signal,
      },
    )

    return parseSellerSalesReportResponse(data, {
      tenantId: context.tenantId,
      sellerUserId: params.sellerUserId,
      from: params.from,
      to: params.to,
    })
  },

  /**
   * Download the backend-generated PDF for the same seller and window.
   *
   * The same authenticated tenant/UUID/`[from,to)` contract applies; the bytes
   * are an independent, fresh server snapshot. The transport refuses any status
   * other than 200 and any body that is not a real PDF (never downloading JSON
   * as PDF) and normalizes a binary domain error so the shared failure contract
   * can read it. The request opts into the interceptor's bounded Blob-error read
   * so a `Tenant context required` 401 is classified correctly for a
   * `responseType: 'blob'` call; headers, bearer token and the ordinary 401
   * refresh keep flowing through the shared interceptors.
   */
  async getReportPdf(
    params: SellerReportRequest,
    context: SellerReportRequestContext,
  ): Promise<SellerReportPdf> {
    try {
      const config: TenantContextBlobErrorConfig = {
        params: { from: params.from, to: params.to },
        responseType: 'blob',
        signal: context.signal,
        tenantContextBlobError: true,
      }
      const response = await http.get<Blob>(
        `/analytics/sales/sellers/${encodeURIComponent(params.sellerUserId)}/report/pdf`,
        config,
      )

      // This endpoint only ever answers 200. A 206 (or any other carried status)
      // could prefix a valid PDF and must never be treated as a full report.
      if (response.status !== 200) {
        throw new Error('SELLER_REPORT_PDF_UNEXPECTED_STATUS')
      }

      const blob = response.data
      if (!(blob instanceof Blob) || !(await isSellerReportPdfBlob(blob, context.signal))) {
        throw new Error('SELLER_REPORT_PDF_NON_PDF_BODY')
      }

      return {
        blob,
        fileName: parseSellerReportPdfFileName(response.headers?.['content-disposition'] ?? null),
      }
    } catch (error) {
      throw await normalizeSellerReportPdfError(error, context.signal)
    }
  },
}
