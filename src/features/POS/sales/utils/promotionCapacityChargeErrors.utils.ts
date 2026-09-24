import type { AxiosError } from 'axios'
import type { ApplicablePromotion, Sale } from '../interfaces/sale.types'

/**
 * PCA-2 — distinct capacity-charge failures returned by
 * `POST /sales/drafts/:id/charge` (backend guide §2.7).
 *
 * Three DISTINCT flat domain envelopes:
 *   - `PROMO_CAPACITY_RE_QUOTE`      → top-level applied/excluded promotion ids
 *   - `PROMOTION_CAPACITY_EXCEEDED`  → saleId/promotionId/units
 *   - `PROMOTION_CAPACITY_CLAIM_MISMATCH` → saleId/promotionId/units
 *
 * The pre-existing `PROMO_RE_QUOTE` bot error is a DIFFERENT contract
 * (`{ recomputedTotalCents, expectedTotalCents, discountCents }`) and is
 * intentionally NOT matched here.
 */
export interface PromotionCapacityReQuoteError {
  kind: 're-quote'
  appliedPromotionIds: string[]
  excludedPromotionIds: string[]
}

export type PromotionCapacityRaceErrorCode =
  | 'PROMOTION_CAPACITY_EXCEEDED'
  | 'PROMOTION_CAPACITY_CLAIM_MISMATCH'

export interface PromotionCapacityRaceError {
  kind: 'race'
  code: PromotionCapacityRaceErrorCode
  saleId: string
  promotionId: string
  units: number
}

export type PromotionCapacityChargeError =
  | PromotionCapacityReQuoteError
  | PromotionCapacityRaceError

const RE_QUOTE_CODE = 'PROMO_CAPACITY_RE_QUOTE'
const RACE_CODES: readonly PromotionCapacityRaceErrorCode[] = [
  'PROMOTION_CAPACITY_EXCEEDED',
  'PROMOTION_CAPACITY_CLAIM_MISMATCH',
]

/** Every capacity envelope is a flat 409 domain error. */
const STATUS_CONFLICT = 409

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Validates the common flat 409 domain envelope shared by all three capacity
 * codes. Anything that does not match exactly is NOT a capacity error and must
 * fall through to the generic charge flow.
 */
function hasValidDomainEnvelope(data: Record<string, unknown>, code: string): boolean {
  return (
    data.statusCode === STATUS_CONFLICT &&
    data.error === code &&
    isNonEmptyString(data.message) &&
    isNonEmptyString(data.timestamp)
  )
}

/**
 * Reads a promotion-id list. Returns `null` for anything that is not an array
 * of non-empty strings — malformed input is rejected, never degraded to `[]`.
 */
function readIdList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null

  const ids: string[] = []
  for (const entry of value) {
    if (!isNonEmptyString(entry)) return null
    ids.push(entry)
  }
  return ids
}

function isSubset(subset: string[], superset: string[]): boolean {
  const allowed = new Set(superset)
  return subset.every((id) => allowed.has(id))
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Normalizes the three capacity envelopes into a discriminated union.
 * Returns `null` for every other error so the generic charge flow stays in
 * charge (including the unrelated `PROMO_RE_QUOTE`).
 */
export function parsePromotionCapacityChargeError(
  error: unknown,
): PromotionCapacityChargeError | null {
  const data = (error as AxiosError<Record<string, unknown>> | undefined)?.response?.data
  if (!data || typeof data !== 'object') return null

  const envelope = data as Record<string, unknown>
  const code = envelope.error
  if (typeof code !== 'string') return null

  if (code === RE_QUOTE_CODE) {
    if (!hasValidDomainEnvelope(envelope, RE_QUOTE_CODE)) return null

    const appliedPromotionIds = readIdList(envelope.appliedPromotionIds)
    const excludedPromotionIds = readIdList(envelope.excludedPromotionIds)
    if (!appliedPromotionIds || !excludedPromotionIds) return null
    if (!isSubset(excludedPromotionIds, appliedPromotionIds)) return null

    return { kind: 're-quote', appliedPromotionIds, excludedPromotionIds }
  }

  if ((RACE_CODES as readonly string[]).includes(code)) {
    if (!hasValidDomainEnvelope(envelope, code)) return null

    const { saleId, promotionId, units } = envelope
    if (!isNonEmptyString(saleId) || !isNonEmptyString(promotionId) || !isPositiveInteger(units)) {
      return null
    }

    return {
      kind: 'race',
      code: code as PromotionCapacityRaceErrorCode,
      saleId,
      promotionId,
      units,
    }
  }

  return null
}

export interface DraftServerTotals {
  subtotalCents: number
  discountCents: number
  totalCents: number
}

/**
 * The only fields `readDraftServerTotals` reads. Widening to the full `Sale`
 * would be stricter than the function needs and couples it to unrelated draft
 * fields.
 */
export interface DraftServerTotalsSource {
  subtotalCents?: number
  discountCents?: number
  totalCents?: number
}

/**
 * Reads the authoritative server totals from a (re)fetched draft. Returns
 * `null` when ANY of the three is missing or not a finite number — the caller
 * must then keep the payment modal open and surface an actionable error
 * instead of presenting the draft as accepted.
 */
export function readDraftServerTotals(
  draft: DraftServerTotalsSource | null | undefined,
): DraftServerTotals | null {
  if (!draft) return null

  const { subtotalCents, discountCents, totalCents } = draft
  const values = [subtotalCents, discountCents, totalCents]
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null

  return {
    subtotalCents: subtotalCents as number,
    discountCents: discountCents as number,
    totalCents: totalCents as number,
  }
}

export interface ExcludedPromotionLabel {
  id: string
  label: string
}

/**
 * Resolves human-readable labels for the excluded promotions from the
 * PRE-refetch draft + applicable-promotion snapshot. Falls back to the raw id
 * when no title is available anywhere.
 */
export function collectExcludedPromotionLabels(
  excludedIds: string[],
  draft: Sale | null | undefined,
  applicablePromotions: ApplicablePromotion[],
): ExcludedPromotionLabel[] {
  return excludedIds.map((id) => {
    const applicable = applicablePromotions.find((promotion) => promotion.id === id)
    if (applicable) return { id, label: applicable.title }

    if (draft?.appliedOrderPromotion?.promotionId === id) {
      return { id, label: draft.appliedOrderPromotion.discountTitle }
    }

    const lineItem = draft?.items.find((item) => item.promotionId === id)
    if (lineItem?.discountTitle) {
      return { id, label: lineItem.discountTitle }
    }

    return { id, label: id }
  })
}
