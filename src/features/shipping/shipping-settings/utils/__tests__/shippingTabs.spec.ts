import { describe, expect, it } from 'vitest'
import { SHIPPING_TABS, resolveShippingTab } from '../shippingTabs'

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
})
