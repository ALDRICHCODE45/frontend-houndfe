/**
 * Shared, bounded fixtures for the PCA-5 promotion-capacity responsive checks.
 *
 * These four focused Playwright specs cover the promotion-capacity alert
 * workflows through the real routed pages. Only constants shared by more than
 * one spec live here — the domain payloads stay next to the flow that owns
 * them so each spec reads on its own.
 */
import { RESPONSIVE_VIEWPORTS, type ViewportCase } from '../targets/types'

const byKey = (key: ViewportCase['key']): ViewportCase => {
  const viewport = RESPONSIVE_VIEWPORTS.find((candidate) => candidate.key === key)
  if (!viewport) throw new Error(`unknown responsive viewport: ${key}`)
  return viewport
}

/** The exact required matrix: desktop first, then the two phone widths. */
export const PROMOTION_CAPACITY_VIEWPORTS: readonly ViewportCase[] = [
  byKey('shell-1024'),
  byKey('phone-375'),
  byKey('phone-320'),
]

/** The dashboard panel that owns every routed surface under test. */
export const PROMOTION_CAPACITY_OWNER = '#hound-dashboard-panel-main-panel'

/** Exact permission seeds per flow — never widened silently. */
export const PROMOTION_CREATE_PERMISSIONS: readonly string[] = [
  'read:Promotion',
  'create:Promotion',
]
export const SALE_CHARGE_PERMISSIONS: readonly string[] = ['read:Sale', 'update:Sale']
export const SALE_CANCEL_PERMISSIONS: readonly string[] = ['read:Sale', 'delete:Sale']
export const NOTIFICATION_CONFIG_PERMISSIONS: readonly string[] = [
  'read:NotificationConfig',
  'update:NotificationConfig',
]

/** Mirrors the committed `formatCentsMXN` presentation contract for exact-text assertions. */
const MXN_CURRENCY = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatCents = (cents: number): string => MXN_CURRENCY.format(cents / 100)
