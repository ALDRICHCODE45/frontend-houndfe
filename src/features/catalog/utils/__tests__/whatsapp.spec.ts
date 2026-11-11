import { describe, expect, it } from 'vitest'
import {
  buildSharePreviewUrl,
  buildWhatsappUrl,
  normalizeWhatsappNumber,
  productInquiryMessage,
} from '../whatsapp'

describe('normalizeWhatsappNumber', () => {
  it.each([
    ['+5215500000000', '5215500000000'],
    ['  +52 1 55 0000 0000 ', '5215500000000'],
    ['5215500000000', '5215500000000'],
  ])('keeps only the digits of %j', (raw, digits) => {
    expect(normalizeWhatsappNumber(raw)).toBe(digits)
  })

  it.each([[null], [undefined], [''], ['   '], ['abc'], ['+12'], ['+1234567890123456']])(
    'returns null for an absent or unusable number (%j)',
    (raw) => {
      expect(normalizeWhatsappNumber(raw)).toBeNull()
    },
  )
})

describe('buildWhatsappUrl', () => {
  it('links the wa.me digits with the encoded message', () => {
    const url = buildWhatsappUrl('+5215500000000', 'Hola, quiero «Café» & más')
    expect(url).not.toBeNull()
    const parsed = new URL(url!)
    expect(parsed.origin).toBe('https://wa.me')
    expect(parsed.pathname).toBe('/5215500000000')
    expect(parsed.searchParams.get('text')).toBe('Hola, quiero «Café» & más')
  })

  it('returns null without a usable number', () => {
    expect(buildWhatsappUrl(null, 'Hola')).toBeNull()
    expect(buildWhatsappUrl('', 'Hola')).toBeNull()
  })
})

describe('productInquiryMessage', () => {
  const url = 'https://tienda.test/catalogo/centro/p/p-1'

  it('names the product, presentation, branch and page', () => {
    const text = productInquiryMessage({
      productName: 'Croqueta',
      presentationName: '8 kg',
      branchName: 'Sucursal Centro',
      url,
      outOfStock: false,
    })
    expect(text).toBe(`Hola, quiero Croqueta 8 kg · Sucursal Centro\n${url}`)
  })

  it('omits the presentation and the branch when they are unknown', () => {
    expect(
      productInquiryMessage({
        productName: 'Café',
        presentationName: null,
        branchName: null,
        url,
        outOfStock: false,
      }),
    ).toBe(`Hola, quiero Café\n${url}`)
  })

  it('asks about availability when the product is out of stock', () => {
    const text = productInquiryMessage({
      productName: 'Croqueta',
      presentationName: '20 kg',
      branchName: 'Sucursal Centro',
      url,
      outOfStock: true,
    })
    expect(text).toBe(`Hola, ¿cuándo vuelve Croqueta 20 kg? · Sucursal Centro\n${url}`)
  })
})

describe('buildSharePreviewUrl', () => {
  it('points at the API host share route, not the storefront', () => {
    expect(buildSharePreviewUrl('https://api.test/', 'centro', 'p 1', null)).toBe(
      'https://api.test/share/centro/p/p%201',
    )
  })

  it('carries the requested price list', () => {
    expect(buildSharePreviewUrl('https://api.test', 'centro', 'p-1', 'list-1')).toBe(
      'https://api.test/share/centro/p/p-1?priceListId=list-1',
    )
  })
})
