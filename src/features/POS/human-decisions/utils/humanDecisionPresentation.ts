import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { SERVICE_UNIT_OPTIONS, UNIT_OPTIONS } from '@/features/POS/products/composables/useProductForm'
import type { HumanDecision, HumanDecisionResolution } from '../interfaces/human-decision.types'
import type {
  ExpirationDecisionResolution,
  ExpirationDecisionSnapshot,
} from '../interfaces/expiration-decision.types'

const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City'
export const BRANCH_FALLBACK = 'Sucursal no especificada'
export const SKU_FALLBACK = 'Sin SKU'
export const VARIANT_PRESENT_LABEL = 'Con variante'
export const VARIANT_ABSENT_LABEL = 'Sin variante'
export const QUANTITY_FALLBACK = 'Cantidad no especificada'
const UNIT_FALLBACK = 'Sin unidad'
const UNIT_LABELS = new Map<string, string>(
  [...UNIT_OPTIONS, ...SERVICE_UNIT_OPTIONS].map((option) => [option.value, option.label]),
)
export const CREATED_AT_FALLBACK = '—'
export const EXPIRATION_UNAVAILABLE_LABEL = 'Por ahora no hay información de vencimiento.'

const createdAtFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: MEXICO_CITY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export interface PendingHumanDecisionPresentation {
  productLabel: string
  productMetaLabel: string
  branchLabel: string
  /** `null` for EXPIRATION rows: quantity is not part of their contract. */
  requestedQuantityLabel: string | null
  createdAtLabel: string
}

function nonEmpty(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function branchPresentationLabel(branchName: string | null): string {
  return nonEmpty(branchName) ?? BRANCH_FALLBACK
}

export function skuPresentationLabel(sku: string | null): string {
  return nonEmpty(sku) ?? SKU_FALLBACK
}

export function variantPresentationLabel(variantId: string | null): string {
  return nonEmpty(variantId) ? VARIANT_PRESENT_LABEL : VARIANT_ABSENT_LABEL
}

/** The catalog's readable unit name (`UNIDAD` → `Unidad`); an unknown unit stays as sent. */
function unitPresentationLabel(unit: string): string {
  const code = nonEmpty(unit)
  if (code === null) return UNIT_FALLBACK
  return UNIT_LABELS.get(code) ?? code
}

/** `null` when the request has no variant: an absent variant is not worth a word. */
function expirationVariantPresentationLabel(snapshot: ExpirationDecisionSnapshot): string | null {
  if (nonEmpty(snapshot.variantId) === null) return null
  const name = nonEmpty(snapshot.variantName) ?? VARIANT_PRESENT_LABEL
  const descriptor = [nonEmpty(snapshot.variantOption), nonEmpty(snapshot.variantValue)]
    .filter((value): value is string => value !== null)
    .join(': ')
  return descriptor ? `${name} (${descriptor})` : name
}

/**
 * Type-aware product metadata: EXPIRATION shows the unit, RESTOCK the SKU, each
 * followed by the variant only when the request has one.
 */
export function productMetaPresentationLabel(decision: HumanDecision): string {
  const parts =
    decision.type === 'EXPIRATION'
      ? [
          unitPresentationLabel(decision.snapshot.unit),
          expirationVariantPresentationLabel(decision.snapshot),
        ]
      : [
          skuPresentationLabel(decision.snapshot.sku),
          nonEmpty(decision.snapshot.variantId) === null
            ? null
            : variantPresentationLabel(decision.snapshot.variantId),
        ]
  return parts.filter((part): part is string => part !== null).join(' · ')
}

export function requestedQuantityPresentationLabel(requestedQuantity: number | null): string {
  if (requestedQuantity === null || !Number.isFinite(requestedQuantity)) return QUANTITY_FALLBACK
  return `${requestedQuantity} ${requestedQuantity === 1 ? 'unidad' : 'unidades'}`
}

export function createdAtPresentationLabel(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return CREATED_AT_FALLBACK
  return createdAtFormatter.format(date)
}

/** Short date for lists and cards (`3 nov, 20:43`) in the operating time zone; the detail keeps the full date. */
export function listDatePresentationLabel(value: string): string {
  return formatShortDateTime(value, { timeZone: MEXICO_CITY_TIME_ZONE })
}

/** Match the approved detail wording without coupling list presentation to a column factory. */
export function resolvedResponseLabel(
  resolution: HumanDecisionResolution | ExpirationDecisionResolution,
): string {
  if (resolution.action === 'PROVIDE_RESTOCK_ESTIMATE') {
    return `Reposición estimada en ${resolution.restockDays} días naturales.`
  }
  if (resolution.action === 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE') {
    return 'Por ahora no tenemos una fecha estimada de reposición.'
  }
  if (resolution.action === 'PROVIDE_EXPIRATION_TEXT') return resolution.expirationText
  return EXPIRATION_UNAVAILABLE_LABEL
}

export function presentPendingHumanDecision(
  decision: Extract<HumanDecision, { status: 'PENDING' }>,
): PendingHumanDecisionPresentation {
  const { snapshot } = decision
  return {
    productLabel: snapshot.productName,
    productMetaLabel: productMetaPresentationLabel(decision),
    branchLabel: branchPresentationLabel(snapshot.branchName),
    requestedQuantityLabel:
      decision.type === 'EXPIRATION'
        ? null
        : requestedQuantityPresentationLabel(decision.snapshot.requestedQuantity),
    createdAtLabel: createdAtPresentationLabel(decision.createdAt),
  }
}
