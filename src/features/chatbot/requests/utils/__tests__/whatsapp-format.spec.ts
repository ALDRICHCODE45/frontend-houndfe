import { describe, expect, it } from 'vitest'
import { parseWhatsAppText } from '../whatsapp-format'

const plain = (text: string) => ({ text, bold: false, italic: false, strike: false })

describe('parseWhatsAppText', () => {
  it('returns one plain segment for text without markers', () => {
    expect(parseWhatsAppText('Hola, ¿cómo estás?')).toEqual([plain('Hola, ¿cómo estás?')])
  })

  it('turns *x* into bold, _x_ into italic and ~x~ into strikethrough', () => {
    expect(parseWhatsAppText('Total *$1,250.00* _con envío_ ~$1,300~')).toEqual([
      plain('Total '),
      { text: '$1,250.00', bold: true, italic: false, strike: false },
      plain(' '),
      { text: 'con envío', bold: false, italic: true, strike: false },
      plain(' '),
      { text: '$1,300', bold: false, italic: false, strike: true },
    ])
  })

  it('nests markers like WhatsApp (*_x_* is bold and italic)', () => {
    expect(parseWhatsAppText('*_Pedido listo_*')).toEqual([
      { text: 'Pedido listo', bold: true, italic: true, strike: false },
    ])
  })

  it('keeps line breaks, leading spaces, bullets and emojis untouched', () => {
    const text = '🧾 *Tu pedido*\n   • Croquetas x2\n   • Collar\n✅ Listo'
    const joined = parseWhatsAppText(text)
      .map((segment) => segment.text)
      .join('')
    expect(joined).toBe('🧾 Tu pedido\n   • Croquetas x2\n   • Collar\n✅ Listo')
  })

  it('leaves markers that WhatsApp would not format as literal text', () => {
    expect(parseWhatsAppText('2 * 3 = 6')).toEqual([plain('2 * 3 = 6')])
    expect(parseWhatsAppText('archivo_final_v2.pdf')).toEqual([plain('archivo_final_v2.pdf')])
    expect(parseWhatsAppText('** vacío')).toEqual([plain('** vacío')])
    expect(parseWhatsAppText('*sin cerrar')).toEqual([plain('*sin cerrar')])
    expect(parseWhatsAppText('* espacio*')).toEqual([plain('* espacio*')])
    expect(parseWhatsAppText('*no\ncruza*')).toEqual([plain('*no\ncruza*')])
  })

  it('returns no segments for an empty string', () => {
    expect(parseWhatsAppText('')).toEqual([])
  })
})
