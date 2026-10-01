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
export const UNIT_FALLBACK = 'Sin unidad'
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

export function unitPresentationLabel(unit: string): string {
  return nonEmpty(unit) ?? UNIT_FALLBACK
}

export function expirationVariantPresentationLabel(snapshot: ExpirationDecisionSnapshot): string {
  if (nonEmpty(snapshot.variantId) === null) return VARIANT_ABSENT_LABEL
  const name = nonEmpty(snapshot.variantName) ?? VARIANT_PRESENT_LABEL
  const descriptor = [nonEmpty(snapshot.variantOption), nonEmpty(snapshot.variantValue)]
    .filter((value): value is string => value !== null)
    .join(': ')
  return descriptor ? `${name} (${descriptor})` : name
}

/** Type-aware product metadata: EXPIRATION shows `unit`, RESTOCK keeps SKU/variant. */
export function productMetaPresentationLabel(decision: HumanDecision): string {
  if (decision.type === 'EXPIRATION') {
    const { snapshot } = decision
    return `${unitPresentationLabel(snapshot.unit)} · ${expirationVariantPresentationLabel(snapshot)}`
  }
  const { snapshot } = decision
  return `${skuPresentationLabel(snapshot.sku)} · ${variantPresentationLabel(snapshot.variantId)}`
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
