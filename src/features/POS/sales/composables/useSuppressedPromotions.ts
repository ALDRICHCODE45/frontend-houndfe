/**
 * Suppressed promotions of a sale draft opened from a quotation (odd T3b / S5, backend handoff 23 §2).
 *
 * `POST /quotations/:id/convert-to-sale` opens the draft at the EXACT quoted total: every automatic
 * promotion that would apply today is vetoed on that draft and returned once as
 * `suppressedPromotions`. `GET /sales/drafts` does not expose vetoes, so this module keeps that list
 * and «Promociones disponibles» offers each entry with «Aplicar»
 * (`POST /sales/drafts/:id/manual-promotions/:promotionId` clears the veto).
 *
 * Storage: `localStorage`, one key per tenant + sale (`pos:suppressed-promotions:<tenant>:<saleId>`).
 * localStorage, not sessionStorage, because the draft outlives the browser tab (the cashier may
 * close the tab and continue later). An entry is dropped when applied (`forgetSuppressedPromotion`,
 * called by `saleApi.applyManualPromotion`), the whole list when the draft is charged or discarded
 * (`clearSuppressedPromotions`, called by `saleApi.chargeDraft` / `closeDraft` /
 * `quotationApi.createFromSale`), and anything older than the TTL is ignored and pruned on write
 * (a draft discarded on another device never reaches this browser's cleanup).
 *
 * Storage failures (quota, private mode) are swallowed: losing the hint never blocks a sale.
 */
import { computed, ref, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { ApplicablePromotion } from '../interfaces/sale.types'

/** One automatic promotion vetoed by the conversion. `title` is `null` when the backend cannot read it. */
export interface SuppressedPromotion {
  promotionId: string
  title: string | null
}

export const SUPPRESSED_PROMOTIONS_STORAGE_PREFIX = 'pos:suppressed-promotions:'
/** 7 days: drafts can stay open for a while, but the list only describes promotions active «today». */
export const SUPPRESSED_PROMOTIONS_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const SUPPRESSED_PROMOTION_FALLBACK_TITLE = 'Promoción'
export const SUPPRESSED_PROMOTION_NOTE = 'No aplicada por venir de una cotización'

interface StoredEntry {
  savedAt: number
  promotions: SuppressedPromotion[]
}

/** Bumped on every write so `useSuppressedPromotions` recomputes (localStorage is not reactive). */
const version = ref(0)

function tenantId(): string {
  return useSafeTenantId().value ?? ''
}

function storageKey(saleId: string): string {
  return `${SUPPRESSED_PROMOTIONS_STORAGE_PREFIX}${tenantId()}:${saleId}`
}

function isSuppressedPromotion(value: unknown): value is SuppressedPromotion {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.promotionId === 'string' &&
    (entry.title === null || typeof entry.title === 'string')
  )
}

function parseEntry(raw: string | null): StoredEntry | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { savedAt, promotions } = parsed as Record<string, unknown>
    if (typeof savedAt !== 'number' || !Array.isArray(promotions)) return null
    return { savedAt, promotions: promotions.filter(isSuppressedPromotion) }
  } catch {
    return null
  }
}

function isExpired(entry: StoredEntry, now: number): boolean {
  return now - entry.savedAt > SUPPRESSED_PROMOTIONS_TTL_MS
}

function safely(action: () => void): void {
  try {
    action()
  } catch {
    // Storage unavailable: the list is a hint, never a blocker.
  }
}

function pruneExpired(now: number): void {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (!key?.startsWith(SUPPRESSED_PROMOTIONS_STORAGE_PREFIX)) continue
    const entry = parseEntry(localStorage.getItem(key))
    if (!entry || isExpired(entry, now)) localStorage.removeItem(key)
  }
}

function write(saleId: string, entry: StoredEntry | null, now: number): void {
  safely(() => {
    pruneExpired(now)
    const key = storageKey(saleId)
    if (entry && entry.promotions.length > 0) localStorage.setItem(key, JSON.stringify(entry))
    else localStorage.removeItem(key)
  })
  version.value += 1
}

/** Keeps the conversion's list for `saleId` (an empty list removes any previous one). */
export function rememberSuppressedPromotions(
  saleId: string,
  promotions: SuppressedPromotion[],
  now: number = Date.now(),
): void {
  const unique = promotions.filter(
    (promo, index) => promotions.findIndex((other) => other.promotionId === promo.promotionId) === index,
  )
  write(saleId, { savedAt: now, promotions: unique }, now)
}

/** The stored list for `saleId` in the current tenant; `[]` when missing, corrupt or expired. */
export function readSuppressedPromotions(saleId: string, now: number = Date.now()): SuppressedPromotion[] {
  let entry: StoredEntry | null = null
  safely(() => {
    entry = parseEntry(localStorage.getItem(storageKey(saleId)))
  })
  const found = entry as StoredEntry | null
  if (!found || isExpired(found, now)) return []
  return found.promotions
}

/** Drops one entry once the cashier applied it (the veto is cleared server-side). */
export function forgetSuppressedPromotion(saleId: string, promotionId: string): void {
  let entry: StoredEntry | null = null
  safely(() => {
    entry = parseEntry(localStorage.getItem(storageKey(saleId)))
  })
  const found = entry as StoredEntry | null
  if (!found) return
  const now = Date.now()
  write(
    saleId,
    { ...found, promotions: found.promotions.filter((promo) => promo.promotionId !== promotionId) },
    now,
  )
}

/** Drops the whole list of a draft that was charged or discarded. */
export function clearSuppressedPromotions(saleId: string): void {
  write(saleId, null, Date.now())
}

// ─── «Promociones disponibles» entries ───────────────────────────────────────

/** A suppressed promotion shown in «Promociones disponibles». Its real `type` is unknown (the
 *  conversion response carries only id + title) and is not read for these rows. */
export type SuppressedApplicablePromotion = ApplicablePromotion & { suppressedFromQuotation: true }

export function isSuppressedFromQuotation(
  promotion: ApplicablePromotion,
): promotion is SuppressedApplicablePromotion {
  return (promotion as Partial<SuppressedApplicablePromotion>).suppressedFromQuotation === true
}

/** Suppressed promotions first (marked, «Promoción» for a null title), then the backend's list; an
 *  id the backend already lists is not repeated. */
export function mergeSuppressedPromotions(
  promotions: ApplicablePromotion[],
  suppressed: SuppressedPromotion[],
): ApplicablePromotion[] {
  if (suppressed.length === 0) return promotions
  const listed = new Set(promotions.map((promo) => promo.id))
  const extra: SuppressedApplicablePromotion[] = suppressed
    .filter((promo) => !listed.has(promo.promotionId))
    .map((promo) => ({
      id: promo.promotionId,
      title: promo.title ?? SUPPRESSED_PROMOTION_FALLBACK_TITLE,
      type: 'PRODUCT_DISCOUNT',
      suppressedFromQuotation: true,
    }))
  return extra.length === 0 ? promotions : [...extra, ...promotions]
}

/** Reactive stored list for a draft id (recomputes on every write of this module). */
export function useSuppressedPromotions(
  saleId: MaybeRefOrGetter<string | undefined>,
): ComputedRef<SuppressedPromotion[]> {
  return computed(() => {
    void version.value
    const id = toValue(saleId)
    return id ? readSuppressedPromotions(id) : []
  })
}
