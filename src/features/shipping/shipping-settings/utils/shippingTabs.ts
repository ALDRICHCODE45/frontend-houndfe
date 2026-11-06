/** Envíos tabs (S2). The active tab lives in the `?tab=` query of /sistema/envios. */
export type ShippingTabKey = 'zonas' | 'cajas' | 'origen' | 'horario'

export interface ShippingTab {
  key: ShippingTabKey
  label: string
}

export const SHIPPING_TABS: ReadonlyArray<ShippingTab> = [
  { key: 'zonas', label: 'Zonas' },
  { key: 'cajas', label: 'Cajas' },
  { key: 'origen', label: 'Origen' },
  { key: 'horario', label: 'Horario' },
]

/** Zonas needs read:DeliveryZone; the other tabs come with the route's read:ShippingSettings. */
export function visibleShippingTabs(access: { canReadZones: boolean }): ReadonlyArray<ShippingTab> {
  return access.canReadZones ? SHIPPING_TABS : SHIPPING_TABS.filter((tab) => tab.key !== 'zonas')
}

/** Reads a route query value (string, repeated or absent); unknown or hidden values open the first visible tab. */
export function resolveShippingTab(
  value: unknown,
  visible: ReadonlyArray<ShippingTab> = SHIPPING_TABS,
): ShippingTabKey {
  const raw = Array.isArray(value) ? value[0] : value
  return visible.find((tab) => tab.key === raw)?.key ?? visible[0]?.key ?? 'cajas'
}
