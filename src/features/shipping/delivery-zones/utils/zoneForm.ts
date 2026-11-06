/**
 * Zone form rules (handoff §2 table): which fields each type uses, the
 * whole-record PUT body and the Spanish validation shown next to each field.
 * The surcharge is typed in pesos by HfMoneyInput, which already yields cents (S4).
 */
import type {
  ApprovableZoneType,
  DeliveryZone,
  DeliveryZoneType,
  DeliveryZoneUpsertBody,
  ResolveDecision,
} from '../interfaces/delivery-zone.types'

export const LABEL_MAX = 120
export const ETA_MAX_DAYS = 60
export const SURCHARGE_MAX_CENTS = 100_000_000

export interface ZoneDraft {
  zipCode: string
  type: DeliveryZoneType
  surchargeCents: number | null
  /** As typed; parsed on submit. */
  etaDays: string
  state: string
  municipality: string
  neighborhood: string
}

export type ZoneField = 'zipCode' | 'surchargeCents' | 'etaDays' | 'state' | 'municipality' | 'neighborhood'
export type ZoneFieldErrors = Partial<Record<ZoneField, string>>

export const ZONE_TYPE_LABELS: Record<DeliveryZoneType, string> = {
  FREE: 'Envío gratis',
  SURCHARGE: 'Con cargo',
  CARRIER_ONLY: 'Solo paquetería',
  DENIED: 'Sin entrega',
}

export function zoneTypeUses(type: DeliveryZoneType): { surcharge: boolean; eta: boolean } {
  return { surcharge: type === 'SURCHARGE', eta: type === 'FREE' || type === 'SURCHARGE' }
}

export function emptyZoneDraft(): ZoneDraft {
  return { zipCode: '', type: 'FREE', surchargeCents: null, etaDays: '', state: '', municipality: '', neighborhood: '' }
}

export function draftFromZone(
  zone: Pick<DeliveryZone, 'zipCode' | 'type' | 'surchargeCents' | 'etaDays' | 'state' | 'municipality' | 'neighborhood'>,
): ZoneDraft {
  return {
    zipCode: zone.zipCode,
    type: zone.type,
    surchargeCents: zone.surchargeCents,
    etaDays: zone.etaDays === null ? '' : String(zone.etaDays),
    state: zone.state ?? '',
    municipality: zone.municipality ?? '',
    neighborhood: zone.neighborhood ?? '',
  }
}

function parseEtaDays(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d{1,2}$/.test(trimmed)) return null
  const days = Number(trimmed)
  return days <= ETA_MAX_DAYS ? days : null
}

const label = (text: string) => text.trim() || null

export function surchargeError(cents: number | null): string | undefined {
  return cents === null || !Number.isInteger(cents) || cents < 1 || cents > SURCHARGE_MAX_CENTS
    ? 'Escribe un cargo mayor a $0.00.'
    : undefined
}

export function etaDaysError(text: string): string | undefined {
  return parseEtaDays(text) === null ? `Escribe de 0 a ${ETA_MAX_DAYS} días.` : undefined
}

export function validateZoneDraft(draft: ZoneDraft): ZoneFieldErrors {
  const errors: ZoneFieldErrors = {}
  if (!/^\d{5}$/.test(draft.zipCode.trim())) errors.zipCode = 'Escribe un código postal de 5 dígitos.'
  const uses = zoneTypeUses(draft.type)
  if (uses.surcharge) errors.surchargeCents = surchargeError(draft.surchargeCents)
  if (uses.eta) errors.etaDays = etaDaysError(draft.etaDays)
  for (const field of ['state', 'municipality', 'neighborhood'] as const) {
    if (draft[field].trim().length > LABEL_MAX) errors[field] = `Máximo ${LABEL_MAX} caracteres.`
  }
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as ZoneFieldErrors
}

/** Whole-record replace: unused fields go as null and the three labels always travel. */
export function buildZoneUpsertBody(draft: ZoneDraft): DeliveryZoneUpsertBody {
  const uses = zoneTypeUses(draft.type)
  return {
    type: draft.type,
    surchargeCents: uses.surcharge ? draft.surchargeCents : null,
    etaDays: uses.eta ? parseEtaDays(draft.etaDays) : null,
    state: label(draft.state),
    municipality: label(draft.municipality),
    neighborhood: label(draft.neighborhood),
  }
}

/** The four answers of a validation: approve as one of three types, or reject. */
export type ResolveChoice = ApprovableZoneType | 'REJECT'

export interface ResolveDraft {
  choice: ResolveChoice
  surchargeCents: number | null
  etaDays: string
}

export function validateResolveDraft(draft: ResolveDraft): Partial<Record<'surchargeCents' | 'etaDays', string>> {
  if (draft.choice === 'REJECT') return {}
  const uses = zoneTypeUses(draft.choice)
  const errors: Partial<Record<'surchargeCents' | 'etaDays', string>> = {}
  if (uses.surcharge) errors.surchargeCents = surchargeError(draft.surchargeCents)
  if (uses.eta) errors.etaDays = etaDaysError(draft.etaDays)
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
}

export function buildResolveDecision(draft: ResolveDraft): ResolveDecision {
  if (draft.choice === 'REJECT') return { action: 'REJECT_DELIVERY_ZONE' }
  const uses = zoneTypeUses(draft.choice)
  return {
    action: 'APPROVE_DELIVERY_ZONE',
    zoneType: draft.choice,
    surchargeCents: uses.surcharge ? draft.surchargeCents : null,
    etaDays: uses.eta ? parseEtaDays(draft.etaDays) : null,
  }
}

export function formatEtaDays(days: number | null): string {
  if (days === null) return '—'
  if (days === 0) return 'Mismo día'
  return days === 1 ? '1 día' : `${days} días`
}
