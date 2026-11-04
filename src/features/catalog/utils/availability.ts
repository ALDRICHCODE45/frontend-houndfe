/**
 * Availability is a semantic status, never a commerce affordance: the tinted
 * badge only repeats the strict DTO status, and its dot always travels with the
 * written label. Tones are catalog roles (`.catalog-availability[data-tone]`),
 * never palette colors: sold out is neutral (nothing is wrong), low stock is the
 * one warm tone, and available is success.
 */
export type CatalogAvailabilityTone = 'success' | 'warning' | 'neutral'

export const catalogAvailabilityConfig = {
  available: { label: 'Disponible', tone: 'success' },
  low_stock: { label: 'Pocas piezas', tone: 'warning' },
  out_of_stock: { label: 'Agotado', tone: 'neutral' },
} as const satisfies Record<string, { label: string; tone: CatalogAvailabilityTone }>
