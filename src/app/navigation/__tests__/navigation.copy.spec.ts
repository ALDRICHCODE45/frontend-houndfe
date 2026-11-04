import { describe, expect, it } from 'vitest'
import { DASHBOARD_NAV_ITEM } from '../navigation.landing'
import { navigationGroups, quickActions } from '../navigation.registry'

// Cross-cutting copy rules for the shell: sentence case (only the first word and acronyms are
// capitalised) and neutral Spanish, so no English "Dashboard" and no Title Case labels.
const labels = [
  DASHBOARD_NAV_ITEM.label,
  ...navigationGroups.flatMap((group) => [group.label, ...group.children.map((child) => child.label)]),
  ...quickActions.map((action) => action.label),
]
const isSentenceCase = (label: string) =>
  label
    .split(/\s+/)
    .slice(1)
    .every((word) => !/^[A-ZÁÉÍÓÚÑ]/.test(word) || /^[A-ZÁÉÍÓÚÑ.]+$/.test(word))

describe('shell copy', () => {
  it('names the landing page "Resumen", never the English "Dashboard"', () => {
    expect(DASHBOARD_NAV_ITEM.label).toBe('Resumen')
    expect(labels.some((label) => /dashboard/i.test(label))).toBe(false)
  })

  it('writes every navigation and quick-action label in sentence case', () => {
    for (const label of labels) expect(isSentenceCase(label), label).toBe(true)
    expect(quickActions.map((action) => action.label)).toEqual([
      'Nuevo producto',
      'Nueva venta',
      'Nuevo cliente',
      'Nueva promoción',
      'Nuevo colaborador',
    ])
  })

  it('uses one name for the expiring documents page, the same as its title', () => {
    const labelsOfHr = navigationGroups.find((group) => group.label === 'RR.HH.')!.children.map((child) => child.label)
    expect(labelsOfHr).toContain('Documentos por vencer')
    expect(labelsOfHr).not.toContain('Vencimientos')
  })

  it('detects Title Case, so the guard itself is not vacuous', () => {
    expect(isSentenceCase('Nueva Venta')).toBe(false)
    expect(isSentenceCase('Nueva venta')).toBe(true)
    expect(isSentenceCase('Ventas de RR.HH.')).toBe(true)
  })
})
