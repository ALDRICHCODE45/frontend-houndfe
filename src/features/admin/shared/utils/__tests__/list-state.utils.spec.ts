import { describe, expect, it } from 'vitest'
import { noMatchTitleFor, resolveListErrorMessage } from '../list-state.utils'

describe('resolveListErrorMessage', () => {
  const fallback = 'No se pudieron cargar los roles. Reintenta.'

  it('prefers the backend string message', () => {
    expect(resolveListErrorMessage({ response: { data: { message: 'Sin acceso' } }, message: 'x' }, fallback)).toBe('Sin acceso')
  })

  it('takes the first string of a backend message list', () => {
    expect(resolveListErrorMessage({ response: { data: { message: ['uno', 'dos'] } } }, fallback)).toBe('uno')
  })

  it('falls back to the error message, then to the Spanish fallback', () => {
    expect(resolveListErrorMessage({ message: 'Network Error' }, fallback)).toBe('Network Error')
    expect(resolveListErrorMessage({ response: { data: { message: '  ' } }, message: ' ' }, fallback)).toBe(fallback)
    expect(resolveListErrorMessage(null, fallback)).toBe(fallback)
  })
})

describe('noMatchTitleFor', () => {
  it('names the search term', () => {
    expect(noMatchTitleFor(' caja ')).toBe('Ningún resultado para «caja»')
  })

  it('stays generic without a term', () => {
    expect(noMatchTitleFor('  ')).toBe('Ningún resultado')
  })
})
