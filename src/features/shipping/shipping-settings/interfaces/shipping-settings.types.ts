/**
 * Shapes of the Envíos settings routes (shipping handoff §5–§7). Wire units:
 * sizes in cm (one decimal), weights in grams. The screens type kg (S4).
 */

export interface ShippingBox {
  id: string
  name: string
  innerLengthCm: number
  innerWidthCm: number
  innerHeightCm: number
  /** The empty box's own weight. */
  weightG: number
  /** The most content it carries, box weight not included. */
  maxContentWeightG: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ShippingBoxBody {
  name: string
  innerLengthCm: number
  innerWidthCm: number
  innerHeightCm: number
  weightG: number
  maxContentWeightG: number
  isActive?: boolean
}

/** PATCH takes any subset; never `null` for a field. */
export type ShippingBoxPatch = Partial<ShippingBoxBody>

export interface ShippingOriginBody {
  addressLine1: string
  addressLine2: string | null
  neighborhood: string
  municipality: string
  state: string
  postalCode: string
  contactPhone: string
}

export interface ShippingOrigin extends ShippingOriginBody {
  updatedAt: string
}

export interface ShippingOriginResponse {
  configured: boolean
  origin: ShippingOrigin | null
}

export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const

export type Weekday = (typeof WEEKDAYS)[number]

export interface OpeningRange {
  open: string
  close: string
}

export interface OpeningDay {
  day: Weekday
  ranges: OpeningRange[]
}

export interface OpeningHoursBody {
  timeZone: string
  days: OpeningDay[]
}

export interface OpeningHours extends OpeningHoursBody {
  updatedAt: string
}

export interface OpeningHoursResponse {
  configured: boolean
  openingHours: OpeningHours | null
}
