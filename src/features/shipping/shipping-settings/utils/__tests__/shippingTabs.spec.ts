import { describe, expect, it } from 'vitest'
import { SHIPPING_TABS, resolveShippingTab, visibleShippingTabs } from '../shippingTabs'

describe('shippingTabs', () => {
  it('lists Zonas, Cajas, Origen and Horario in that order', () => {
    expect(SHIPPING_TABS.map((tab) => [tab.key, tab.label])).toEqual([
      ['zonas', 'Zonas'],
      ['cajas', 'Cajas'],
      ['origen', 'Origen'],
      ['horario', 'Horario'],
    ])
  })

  it('reads the tab from the query and falls back to zonas', () => {
    expect(resolveShippingTab('horario')).toBe('horario')
    expect(resolveShippingTab(['cajas', 'origen'])).toBe('cajas')
    expect(resolveShippingTab('unknown')).toBe('zonas')
    expect(resolveShippingTab(undefined)).toBe('zonas')
    expect(resolveShippingTab(null)).toBe('zonas')
  })

  it('without read:DeliveryZone, Zonas is not offered and the first visible tab opens', () => {
    expect(visibleShippingTabs({ canReadZones: false }).map((tab) => tab.key)).toEqual(['cajas', 'origen', 'horario'])
    expect(visibleShippingTabs({ canReadZones: true })).toHaveLength(4)
    const visible = visibleShippingTabs({ canReadZones: false })
    expect(resolveShippingTab('zonas', visible)).toBe('cajas')
    expect(resolveShippingTab(undefined, visible)).toBe('cajas')
    expect(resolveShippingTab('horario', visible)).toBe('horario')
  })
})
