import { describe, expect, it } from 'vitest'
import { presentationLabel } from '../presentation-label'

describe('presentationLabel', () => {
  it('keeps only the remainder when the variant name starts with the product name', () => {
    expect(presentationLabel('Croquetas adulto raza mediana', 'Croquetas adulto raza mediana 2 kg')).toBe(
      '2 kg',
    )
  })

  it('compares case-insensitively and ignores accents and surrounding spaces', () => {
    expect(presentationLabel('  croquetas adulto ', 'CROQUETAS ADULTO 8 kg')).toBe('8 kg')
    expect(presentationLabel('Champú avena', 'Champu avena 355 ml')).toBe('355 ml')
  })

  it('drops a separator between the product name and the remainder', () => {
    expect(presentationLabel('Croquetas', 'Croquetas - 20 kg')).toBe('20 kg')
    expect(presentationLabel('Croquetas', 'Croquetas · Mediana')).toBe('Mediana')
    expect(presentationLabel('Croquetas', 'Croquetas: Grande')).toBe('Grande')
  })

  it('keeps the whole name when it does not start with the product name', () => {
    expect(presentationLabel('Croquetas adulto', '2 kg')).toBe('2 kg')
    expect(presentationLabel('Croquetas adulto', 'Bolsa de Croquetas adulto')).toBe(
      'Bolsa de Croquetas adulto',
    )
  })

  it('keeps the whole name when nothing would remain', () => {
    expect(presentationLabel('Croquetas', 'Croquetas')).toBe('Croquetas')
    expect(presentationLabel('Croquetas', 'Croquetas -')).toBe('Croquetas -')
  })

  it('does not cut inside a word', () => {
    expect(presentationLabel('Croqueta', 'Croquetas 2 kg')).toBe('Croquetas 2 kg')
  })

  it('returns the variant name as is for an empty product name', () => {
    expect(presentationLabel('', ' 2 kg ')).toBe('2 kg')
  })
})
