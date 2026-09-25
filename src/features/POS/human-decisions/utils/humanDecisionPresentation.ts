import type { PendingHumanDecision } from '../interfaces/human-decision.types'

const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City'
export const BRANCH_FALLBACK = 'Sucursal no especificada'
export const SKU_FALLBACK = 'Sin SKU'
export const VARIANT_PRESENT_LABEL = 'Con variante'
export const VARIANT_ABSENT_LABEL = 'Sin variante'
export const QUANTITY_FALLBACK = 'Cantidad no especificada'
export const CREATED_AT_FALLBACK = '—'

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
  branchLabel: string
  skuLabel: string
  variantLabel: string
  requestedQuantityLabel: string
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

export function requestedQuantityPresentationLabel(requestedQuantity: number | null): string {
  if (requestedQuantity === null || !Number.isFinite(requestedQuantity)) return QUANTITY_FALLBACK
  return `${requestedQuantity} ${requestedQuantity === 1 ? 'unidad' : 'unidades'}`
}

export function createdAtPresentationLabel(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return CREATED_AT_FALLBACK
  return createdAtFormatter.format(date)
}

export function presentPendingHumanDecision(
  decision: PendingHumanDecision,
): PendingHumanDecisionPresentation {
  const { snapshot } = decision
  return {
    productLabel: snapshot.productName,
    branchLabel: branchPresentationLabel(snapshot.branchName),
    skuLabel: skuPresentationLabel(snapshot.sku),
    variantLabel: variantPresentationLabel(snapshot.variantId),
    requestedQuantityLabel: requestedQuantityPresentationLabel(snapshot.requestedQuantity),
    createdAtLabel: createdAtPresentationLabel(decision.createdAt),
  }
}
