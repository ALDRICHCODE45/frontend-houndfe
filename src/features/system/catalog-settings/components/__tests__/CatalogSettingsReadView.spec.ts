// CatalogSettingsReadView.spec.ts — the accepted settings in the same rows,
// read-only (REQ-5 / REQ-11 / REQ-12): publication badge and status line read
// as-is, public lists in server order with the default badge, the accepted
// stock mode only, closed-set warnings, and no control at all.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogSettingsReadView from '@/features/system/catalog-settings/components/CatalogSettingsReadView.vue'
import type { CatalogSettingsResponseDto } from '../../interfaces/catalog-settings.types'

function makeResponse(
  overrides: Partial<CatalogSettingsResponseDto> = {},
): CatalogSettingsResponseDto {
  return {
    catalogPublished: true,
    catalogRequiresPublishedEditorial: false,
    effectivePublication: true,
    priceContexts: [
      { priceListId: 'pl_b', name: 'Lista B', isCatalogDefault: false },
      { priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true },
    ],
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    warnings: [],
    updatedAt: '2026-02-14T10:00:00.000Z',
    ...overrides,
  }
}

function mountView(overrides: Partial<CatalogSettingsResponseDto> = {}) {
  return mountWithUApp(CatalogSettingsReadView, { props: { settings: makeResponse(overrides) } })
}

describe('CatalogSettingsReadView — read-only rows', () => {
  it('renders the three sections without any switch, radio, input or checkbox', () => {
    const wrapper = mountView()
    for (const testId of ['publication-card', 'contexts-card', 'stock-card']) {
      expect(wrapper.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
    expect(wrapper.findAll('[role="switch"], [role="radio"], input, button')).toHaveLength(0)
  })

  it('shows the accepted publication as a badge with the status line', () => {
    const published = mountView()
    expect(published.get('[data-testid="publication-badge"]').text()).toBe('Publicado')
    expect(published.get('[data-testid="publication-badge"]').attributes('data-tone')).toBe('success')
    expect(published.get('[data-testid="publication-status"]').text()).toContain(
      'se muestra primero Lista A.',
    )

    const unpublished = mountView({ catalogPublished: false, effectivePublication: false })
    expect(unpublished.get('[data-testid="publication-badge"]').text()).toBe('No publicado')
    expect(unpublished.get('[data-testid="publication-badge"]').attributes('data-tone')).toBe('neutral')
  })

  it('renders effectivePublication as-is even when it diverges (REQ-11)', () => {
    const wrapper = mountView({ catalogPublished: true, effectivePublication: false })
    expect(wrapper.get('[data-testid="publication-status"]').text()).toContain('No visible:')
  })

  it('lists the accepted public lists in server order with the default badge', () => {
    const wrapper = mountView()
    const rows = wrapper.findAll('[data-testid="context-row"]')
    expect(rows.map((row) => row.get('.cs-price-title > span').text())).toEqual(['Lista B', 'Lista A'])
    expect(rows[1]!.attributes('data-default')).toBe('true')
    expect(rows[1]!.get('.hf-status-badge').text()).toBe('Predeterminada')
  })

  it('says so when there are no public lists', () => {
    const wrapper = mountView({ priceContexts: [] })
    expect(wrapper.get('[data-testid="contexts-empty"]').text()).toContain(
      'Sin listas públicas: la configuración no se mostrará públicamente',
    )
  })

  it('shows only the accepted stock mode with its shared copy; fixed 0 reads «Mostrar 0»', () => {
    const detailed = mountView()
    expect(detailed.findAll('[data-testid="stock-default"]')).toHaveLength(1)
    expect(detailed.get('[data-testid="stock-default"]').text()).toContain('Estado detallado')

    const fixed = mountView({ stockPresentationDefault: { mode: 'CUSTOM_QUANTITY', customQuantity: 0 } })
    expect(fixed.get('[data-testid="stock-default"]').text()).toContain('Mostrar cantidad fija')
    expect(fixed.get('[data-testid="stock-quantity-label"]').text()).toBe('Mostrar 0')
  })

  it('maps known warnings to Spanish copy and drops unknown codes', () => {
    const wrapper = mountView({
      effectivePublication: false,
      warnings: ['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES', 'SOMETHING_NEW'],
    })
    const text = wrapper.get('[data-testid="publication-status"]').text()
    expect(text).toContain('El contexto de catálogo por defecto no tiene precios válidos')
    expect(text).not.toContain('SOMETHING_NEW')
  })
})

describe('CatalogSettingsReadView — «solo fichas publicadas» (C3.3 S1)', () => {
  it('shows the accepted value as a badge row, without a switch', () => {
    const off = mountView()
    const offRow = off.get('[data-testid="published-only-row"]')
    expect(offRow.text()).toContain('Mostrar solo productos con ficha publicada')
    expect(off.get('[data-testid="published-only-badge"]').text()).toBe('Desactivado')
    expect(off.get('[data-testid="published-only-badge"]').attributes('data-tone')).toBe('neutral')
    expect(off.find('[data-testid="published-only-switch"]').exists()).toBe(false)

    const on = mountView({ catalogRequiresPublishedEditorial: true })
    expect(on.get('[data-testid="published-only-badge"]').text()).toBe('Activado')
    expect(on.get('[data-testid="published-only-badge"]').attributes('data-tone')).toBe('success')
  })
})
