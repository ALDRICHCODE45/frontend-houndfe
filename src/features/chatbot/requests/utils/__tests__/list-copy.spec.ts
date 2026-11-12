import { describe, expect, it } from 'vitest'
import { emptyCopy, noMatchTitle } from '../list-copy'

describe('emptyCopy — one message per tab', () => {
  it.each([
    ['open', 'No hay solicitudes abiertas'],
    ['scheduled', 'No hay solicitudes agendadas'],
    ['resolved', 'No hay solicitudes resueltas en los últimos 7 días'],
    ['cancelled', 'No hay solicitudes canceladas en los últimos 7 días'],
    ['history', 'Todavía no hay solicitudes en el historial'],
  ] as const)('%s → «%s»', (tab, title) => {
    const copy = emptyCopy(tab)
    expect(copy.title).toBe(title)
    expect(copy.description.length).toBeGreaterThan(10)
  })

  it('the open tab says where requests appear', () => {
    expect(emptyCopy('open').description).toBe(
      'Cuando el chatbot necesite a una persona, la solicitud aparece aquí.',
    )
  })
})

describe('noMatchTitle', () => {
  it('names the search when there is one, else the filters', () => {
    expect(noMatchTitle('Ana')).toBe('Sin resultados para «Ana»')
    expect(noMatchTitle('  ')).toBe('Sin resultados para «estos filtros»')
    expect(noMatchTitle('')).toBe('Sin resultados para «estos filtros»')
  })
})
