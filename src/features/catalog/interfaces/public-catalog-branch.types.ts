/** Public response contract for GET /public/catalog/:tenantSlug/branch (handoff 15 §4). */

export interface PublicCatalogBranchHourRange {
  /** `HH:mm`, 24 hours. */
  open: string
  close: string
}

export interface PublicCatalogBranchHoursDay {
  /** `MONDAY` … `SUNDAY`. */
  day: string
  /** Ready-to-show es-MX weekday name. */
  label: string
  closed: boolean
  ranges: PublicCatalogBranchHourRange[]
}

export interface PublicCatalogBranchHours {
  /** IANA time zone the ranges are expressed in. */
  timeZone: string
  /** The 7 weekdays, Monday first. */
  days: PublicCatalogBranchHoursDay[]
  /** Ready-to-show es-MX text, for example the open weekdays in one line. */
  summary: string
}

export interface PublicCatalogBranchAddress {
  /** One ready-to-show line; the structured parts may be null. */
  formatted: string
}

export interface PublicCatalogBranchDetailDto {
  name: string
  phone: string | null
  address: PublicCatalogBranchAddress | null
  hours: PublicCatalogBranchHours | null
  pickupAvailable: boolean
  deliveryAvailable: boolean
  whatsappNumber: string | null
}
