/** Envíos tabs (S2). The active tab lives in the `?tab=` query of /sistema/envios. */
export type ShippingTabKey = 'zonas' | 'cajas' | 'origen' | 'horario'

export const SHIPPING_TABS: ReadonlyArray<{ key: ShippingTabKey; label: string }> = [
  { key: 'zonas', label: 'Zonas' },
  { key: 'cajas', label: 'Cajas' },
  { key: 'origen', label: 'Origen' },
  { key: 'horario', label: 'Horario' },
]

const DEFAULT_TAB: ShippingTabKey = 'zonas'

/** Reads a route query value (string, repeated or absent); unknown values open Zonas. */
export function resolveShippingTab(value: unknown): ShippingTabKey {
  const raw = Array.isArray(value) ? value[0] : value
  return SHIPPING_TABS.find((tab) => tab.key === raw)?.key ?? DEFAULT_TAB
}
