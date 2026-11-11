import { describe, expect, it } from 'vitest'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import {
  defaultPresentationId,
  displayAvailability,
  displayPrice,
  displayQuantity,
  exactQuantityLabel,
  groupAttributesBySection,
  presentationAttributes,
} from '../detail-presentation'
import type { PublicProductAttribute } from '../../interfaces/public-catalog-product-detail.types'

const attribute = (
  code: string,
  display: string,
  section: { code: string; label: string } | null,
): PublicProductAttribute => ({
  code,
  label: code,
  facet: false,
  section,
  value: { type: 'text', text: display },
  display,
})
const who = { code: 'who', label: 'Para quién' }
const pack = { code: 'pack', label: 'Contenido y empaque' }

describe('detail presentation helpers', () => {
  it('formats a visible price and withholds a hidden or absent one', () => {
    expect(displayPrice({ priceCents: 74900, hidden: false })).toBe(formatCentsMXN(74900))
    expect(displayPrice({ priceCents: null, hidden: true })).toBeNull()
    expect(displayPrice({ priceCents: null, hidden: false })).toBeNull()
  })

  it('writes a custom quantity, including zero, and nothing for other modes', () => {
    expect(displayQuantity({ mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 0 })).toBe(
      '0 unidades',
    )
    expect(
      displayQuantity({ mode: 'SYSTEM_STATUS', status: 'available', customQuantity: null }),
    ).toBeNull()
  })

  it('maps availability to its label and tone, and hides it when stock is hidden', () => {
    const system = { mode: 'SYSTEM_STATUS' as const, status: null, customQuantity: null }
    expect(displayAvailability(system, 'out_of_stock')).toEqual({
      label: 'Agotado',
      tone: 'neutral',
      isOut: true,
    })
    expect(displayAvailability(system, 'low_stock')?.label).toBe('Pocas piezas')
    expect(displayAvailability({ ...system, mode: 'HIDDEN' }, 'available')).toBeNull()
    expect(displayAvailability(system, null)).toBeNull()
  })

  it('groups attributes by section in first-appearance order', () => {
    const groups = groupAttributesBySection([
      attribute('species', 'Perro', who),
      attribute('weight', '8 kg', pack),
      attribute('stage', 'Cachorro', who),
      attribute('note', 'Libre', null),
    ])
    expect(
      groups.map((group) => [group.label, group.attributes.map((entry) => entry.code)]),
    ).toEqual([
      ['Para quién', ['species', 'stage']],
      ['Contenido y empaque', ['weight']],
      [null, ['note']],
    ])
  })

  it('lets the presentation value win over the product value and appends presentation-only data', () => {
    const merged = presentationAttributes(
      [attribute('species', 'Perro', who), attribute('weight', 'Varios', pack)],
      [attribute('weight', '2 kg', pack), attribute('package', 'Bolsa', pack)],
    )
    expect(merged.map((entry) => `${entry.code}=${entry.display}`)).toEqual([
      'species=Perro',
      'weight=2 kg',
      'package=Bolsa',
    ])
  })

  it('selects the first presentation in stock, or the first one when every presentation is out', () => {
    expect(
      defaultPresentationId([
        { id: 'a', isOut: true },
        { id: 'b', isOut: false },
      ]),
    ).toBe('b')
    expect(defaultPresentationId([{ id: 'a', isOut: true }])).toBe('a')
    expect(defaultPresentationId([])).toBeNull()
  })

  describe('exact low stock («Quedan N»)', () => {
    const exact = (status: 'low_stock' | 'available' | 'out_of_stock', exactQuantity?: number | null) => ({
      mode: 'SYSTEM_STATUS_EXACT_LOW_STOCK' as const,
      status,
      customQuantity: null,
      ...(exactQuantity === undefined ? {} : { exactQuantity }),
    })

    it('writes the real quantity only when the backend sends it', () => {
      expect(exactQuantityLabel(exact('low_stock', 3))).toBe('Quedan 3')
      expect(displayQuantity(exact('low_stock', 1))).toBe('Quedan 1')
    })

    it.each([
      ['null', exact('low_stock', null)],
      ['absent', exact('low_stock')],
      ['not low stock', exact('available', null)],
      ['a plain system status', { mode: 'SYSTEM_STATUS' as const, status: 'low_stock' as const, customQuantity: null }],
    ])('renders nothing when the quantity is %s (as today)', (_, presentation) => {
      expect(exactQuantityLabel(presentation)).toBeNull()
      expect(displayQuantity(presentation)).toBeNull()
    })

    it('keeps «N unidades» for a custom quantity', () => {
      expect(displayQuantity({ mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 4 })).toBe('4 unidades')
    })
  })
})
