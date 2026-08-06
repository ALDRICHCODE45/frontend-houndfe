/**
 * `quotation.api.ts` — REST client for the Quotations (Cotizaciones) module.
 *
 * Wires the 15 backend endpoints documented in
 * `houndfe-backend/docs/quotations-frontend.md §3.1–3.15` to the shared
 * Axios instance (`@/core/shared/api/http`). Returns strongly-typed
 * `QuotationResponseDto` so callers (composables, components) never touch
 * raw `AxiosResponse` objects.
 *
 * Conventions mirror `src/features/POS/sales/api/sale.api.ts`:
 *   - Single named `quotationApi` object (not individual exports).
 *   - Each method unwraps `{ data }` from the Axios response.
 *   - PDF endpoint uses `responseType: 'blob'` + `timeout: 15_000` +
 *     optional `AbortSignal` for unmount cancellation.
 *   - Known PDF error codes from the backend are surfaced as
 *     `QuotationPdfError` so the view can toast a localized message
 *     instead of leaking Axios internals.
 *
 * All mutations return the full updated quotation (the backend's
 * "replace cache head" pattern — see design.md §Data Flow).
 */

import { http } from '@/core/shared/api/http'
import type { AxiosError } from 'axios'
import type { CancelReason, PaginatedQuotations, QuotationListParams, QuotationResponseDto } from '../interfaces/quotation.types'

// ─── PDF error surface ────────────────────────────────────────────────────────

/** Format codes the quotation PDF endpoint accepts. Mirrors backend §3.4. */
export type QuotationPdfFormat = 'quotation-a4'

/** Domain error codes the backend embeds in the PDF Blob body on failure. */
export type QuotationPdfErrorCode =
  | 'INVALID_FORMAT'
  | 'QUOTATION_NOT_FOUND'
  | 'PDF_GENERATION_FAILED'

/** Domain error thrown by `quotationApi.getPdfBlob`. */
export class QuotationPdfError extends Error {
  readonly code: QuotationPdfErrorCode
  constructor(code: QuotationPdfErrorCode) {
    super(code)
    this.code = code
    this.name = 'QuotationPdfError'
  }
}

interface DomainErrorResponse {
  error?: string
}

async function parsePdfError(error: unknown): Promise<QuotationPdfError | null> {
  const data = (error as AxiosError)?.response?.data
  if (!(data instanceof Blob)) return null
  const knownCodes: QuotationPdfErrorCode[] = [
    'INVALID_FORMAT',
    'QUOTATION_NOT_FOUND',
    'PDF_GENERATION_FAILED',
  ]
  try {
    const text = await data.text()
    const parsed = JSON.parse(text) as DomainErrorResponse
    const code = parsed.error
    if (code && knownCodes.includes(code as QuotationPdfErrorCode)) {
      return new QuotationPdfError(code as QuotationPdfErrorCode)
    }
  } catch {
    return null
  }
  return null
}

// ─── Request payload types ───────────────────────────────────────────────────

/** Body of POST /quotations/drafts. `customerId` is optional. */
export interface CreateDraftPayload {
  customerId?: string
}

/** Body of POST /quotations/drafts/:id/items. */
export interface AddItemPayload {
  productId: string
  variantId?: string
  quantity: number
}

/** Body of PATCH /quotations/drafts/:id/items/:itemId/quantity. */
export interface UpdateQuantityPayload {
  quantity: number
}

/** Body of PATCH /quotations/drafts/:id/items/:itemId/price. */
export interface OverridePricePayload {
  unitPriceCents: number
}

/** Body of PUT /quotations/drafts/:id/price-list. */
export interface SetPriceListPayload {
  globalPriceListId: string | null
}

/** Body of PATCH /quotations/drafts/:id/expiry. */
export interface SetExpiryPayload {
  expiresAt: string | null
}

/** Body of PATCH /quotations/drafts/:id/notes. */
export interface UpdateNotesPayload {
  customerNotes: string | null
}

/** Body of POST /quotations/drafts/:id/cancel. */
export interface CancelQuotationPayload {
  cancelReason: CancelReason
}

// ─── API surface ─────────────────────────────────────────────────────────────

export const quotationApi = {
  // ─── 3.1 createDraft ──────────────────────────────────────────────────────
  /** POST /quotations/drafts — open a new draft quotation (optionally seeded
   * with a customer id; the backend auto-assigns that customer's price list). */
  async createDraft(customerId?: string): Promise<QuotationResponseDto> {
    const { data } = await http.post<QuotationResponseDto>(
      '/quotations/drafts',
      { customerId } satisfies CreateDraftPayload,
    )
    return data
  },

  // ─── 3.2 list ─────────────────────────────────────────────────────────────
  /** GET /quotations — paginated, filterable list of quotations. */
  async list(params: QuotationListParams): Promise<PaginatedQuotations> {
    const { data } = await http.get<PaginatedQuotations>('/quotations', { params })
    return data
  },

  // ─── 3.3 getById ──────────────────────────────────────────────────────────
  /** GET /quotations/:id — full detail. Triggers lazy SENT→EXPIRED transition. */
  async getById(id: string): Promise<QuotationResponseDto> {
    const { data } = await http.get<QuotationResponseDto>(`/quotations/${id}`)
    return data
  },

  // ─── 3.4 getPdfBlob ───────────────────────────────────────────────────────
  /** GET /quotations/:id/pdf?format=quotation-a4 — binary PDF receipt.
   * Returns a Blob the caller can hand to `URL.createObjectURL`. Errors come
   * back as a Blob too; known codes are surfaced as `QuotationPdfError`. */
  async getPdfBlob(
    id: string,
    options?: { signal?: AbortSignal },
  ): Promise<Blob> {
    try {
      const { data } = await http.get<Blob>(`/quotations/${id}/pdf`, {
        params: { format: 'quotation-a4' satisfies QuotationPdfFormat },
        responseType: 'blob',
        timeout: 15_000,
        signal: options?.signal,
      })
      return data
    } catch (error) {
      throw (await parsePdfError(error)) ?? error
    }
  },

  // ─── 3.5 assignCustomer ───────────────────────────────────────────────────
  /** PUT /quotations/drafts/:id/customer — assign (or replace) the customer.
   * Auto-seeds `globalPriceListId` from the customer's list, unless the
   * cashier has already chosen one explicitly. */
  async assignCustomer(id: string, customerId: string): Promise<QuotationResponseDto> {
    const { data } = await http.put<QuotationResponseDto>(
      `/quotations/drafts/${id}/customer`,
      { customerId },
    )
    return data
  },

  // ─── 3.6 setPriceList ─────────────────────────────────────────────────────
  /** PUT /quotations/drafts/:id/price-list — change (or clear with `null`)
   * the active global price list. The backend reprices all non-CUSTOM items. */
  async setPriceList(
    id: string,
    globalPriceListId: string | null,
  ): Promise<QuotationResponseDto> {
    const { data } = await http.put<QuotationResponseDto>(
      `/quotations/drafts/${id}/price-list`,
      { globalPriceListId } satisfies SetPriceListPayload,
    )
    return data
  },

  // ─── 3.7 addItem ──────────────────────────────────────────────────────────
  /** POST /quotations/drafts/:id/items — add a product (and optional variant)
   * to the draft. No stock validation; the price is resolved from the active
   * list and any automatic promos are re-evaluated. */
  async addItem(
    id: string,
    payload: { productId: string; variantId?: string; quantity: number },
  ): Promise<QuotationResponseDto> {
    const { data } = await http.post<QuotationResponseDto>(
      `/quotations/drafts/${id}/items`,
      payload satisfies AddItemPayload,
    )
    return data
  },

  // ─── 3.8 updateQuantity ───────────────────────────────────────────────────
  /** PATCH /quotations/drafts/:id/items/:itemId/quantity — change a line qty. */
  async updateQuantity(
    id: string,
    itemId: string,
    quantity: number,
  ): Promise<QuotationResponseDto> {
    const { data } = await http.patch<QuotationResponseDto>(
      `/quotations/drafts/${id}/items/${itemId}/quantity`,
      { quantity } satisfies UpdateQuantityPayload,
    )
    return data
  },

  // ─── 3.9 removeItem ───────────────────────────────────────────────────────
  /** DELETE /quotations/drafts/:id/items/:itemId — remove a line. */
  async removeItem(id: string, itemId: string): Promise<QuotationResponseDto> {
    const { data } = await http.delete<QuotationResponseDto>(
      `/quotations/drafts/${id}/items/${itemId}`,
    )
    return data
  },

  // ─── 3.10 overridePrice ───────────────────────────────────────────────────
  /** PATCH /quotations/drafts/:id/items/:itemId/price — mark a line as
   * `priceSource: 'CUSTOM'` and lock it from future repricing. */
  async overridePrice(
    id: string,
    itemId: string,
    unitPriceCents: number,
  ): Promise<QuotationResponseDto> {
    const { data } = await http.patch<QuotationResponseDto>(
      `/quotations/drafts/${id}/items/${itemId}/price`,
      { unitPriceCents } satisfies OverridePricePayload,
    )
    return data
  },

  // ─── 3.11 manual promotions ───────────────────────────────────────────────
  /** PUT /quotations/drafts/:id/manual-promotions/:promoId — opt in to a
   * MANUAL promotion. Idempotent. */
  async applyManualPromotion(id: string, promoId: string): Promise<QuotationResponseDto> {
    const { data } = await http.put<QuotationResponseDto>(
      `/quotations/drafts/${id}/manual-promotions/${promoId}`,
      {},
    )
    return data
  },

  /** DELETE /quotations/drafts/:id/manual-promotions/:promoId — undo a MANUAL
   * opt-in. Idempotent. */
  async removeManualPromotion(
    id: string,
    promoId: string,
  ): Promise<QuotationResponseDto> {
    const { data } = await http.delete<QuotationResponseDto>(
      `/quotations/drafts/${id}/manual-promotions/${promoId}`,
    )
    return data
  },

  // ─── 3.12 automatic promotion veto / opt-in ───────────────────────────────
  /** POST /quotations/drafts/:id/promotions/:promoId/veto — exclude an
   * AUTOMATIC promo from this draft. Sticky per draft. */
  async vetoPromotion(id: string, promoId: string): Promise<QuotationResponseDto> {
    const { data } = await http.post<QuotationResponseDto>(
      `/quotations/drafts/${id}/promotions/${promoId}/veto`,
      {},
    )
    return data
  },

  /** DELETE /quotations/drafts/:id/promotions/:promoId/veto — re-accept a
   * previously vetoed AUTOMATIC promo. */
  async unvetoPromotion(id: string, promoId: string): Promise<QuotationResponseDto> {
    const { data } = await http.delete<QuotationResponseDto>(
      `/quotations/drafts/${id}/promotions/${promoId}/veto`,
    )
    return data
  },

  // ─── 3.13 setExpiry ───────────────────────────────────────────────────────
  /** PATCH /quotations/drafts/:id/expiry — set or clear (`null` = never
   * expires) the draft's expiration timestamp. */
  async setExpiry(id: string, expiresAt: string | null): Promise<QuotationResponseDto> {
    const { data } = await http.patch<QuotationResponseDto>(
      `/quotations/drafts/${id}/expiry`,
      { expiresAt } satisfies SetExpiryPayload,
    )
    return data
  },

  // ─── 3.13b updateNotes ────────────────────────────────────────────────────
  /** PATCH /quotations/drafts/:id/notes — save customer notes (max 280 chars).
   *  Only works on DRAFT status. Returns the full updated quotation. */
  async updateNotes(id: string, customerNotes: string | null): Promise<QuotationResponseDto> {
    const { data } = await http.patch<QuotationResponseDto>(
      `/quotations/drafts/${id}/notes`,
      { customerNotes } satisfies UpdateNotesPayload,
    )
    return data
  },

  // ─── 3.13c setTaxRate ─────────────────────────────────────────────────────
  /** PATCH /quotations/drafts/:id/tax-rate — override the IVA rate for this
   *  draft (e.g. 0 = exento, 0.16 = 16%). Only works on DRAFT. Returns the
   *  full updated quotation with recalculated taxCents. */
  async setTaxRate(id: string, taxRate: number): Promise<QuotationResponseDto> {
    const { data } = await http.patch<QuotationResponseDto>(
      `/quotations/drafts/${id}/tax-rate`,
      { taxRate } satisfies { taxRate: number },
    )
    return data
  },

  // ─── 3.14 send ────────────────────────────────────────────────────────────
  /** POST /quotations/drafts/:id/send?email=… — render the PDF and (if
   * `email=true`, default) send it to the customer. Atomic: a Resend failure
   * leaves the draft in DRAFT and returns 502. */
  async send(id: string, email: boolean = true): Promise<QuotationResponseDto> {
    const { data } = await http.post<QuotationResponseDto>(
      `/quotations/drafts/${id}/send`,
      null,
      { params: { email } },
    )
    return data
  },

  // ─── 3.15 cancel ──────────────────────────────────────────────────────────
  /** POST /quotations/drafts/:id/cancel — terminal transition. Requires a
   * `CancelReason` from the backend enum. */
  async cancel(id: string, cancelReason: CancelReason): Promise<QuotationResponseDto> {
    const { data } = await http.post<QuotationResponseDto>(
      `/quotations/drafts/${id}/cancel`,
      { cancelReason } satisfies CancelQuotationPayload,
    )
    return data
  },

  // ─── 3.16 delete ───────────────────────────────────────────────────────────
  /** DELETE /quotations/:id — permanently remove a DRAFT or CANCELLED quotation.
   *  Returns 204 No Content on success. SENT/EXPIRED quotations cannot be
   *  deleted (409 QUOTATION_CANNOT_DELETE). */
  async deleteQuotation(id: string): Promise<void> {
    await http.delete(`/quotations/${id}`)
  },
}
