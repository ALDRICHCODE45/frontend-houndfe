// CatalogSettingsReadView.spec.ts — STRICT-TDD tests for the WU3A read-only
// accepted-settings surface (REQ-5, REQ-8, REQ-11, REQ-12).
//
// The component receives the ACCEPTED response DTO and renders it read-only:
// publication badges, contexts/default, stock default, warnings, timestamp,
// empty state. No mutation UI, no PATCH wiring (WU3B owns that).

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogSettingsReadView from '@/features/system/catalog-settings/components/CatalogSettingsReadView.vue'
import type { CatalogSettingsResponseDto } from '../../interfaces/catalog-settings.types'

function makeResponse(
  overrides: Partial<CatalogSettingsResponseDto> = {},
): CatalogSettingsResponseDto {
  return {
    catalogPublished: true,
    effectivePublication: true,
    priceContexts: [
      { priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true },
      { priceListId: 'pl_b', name: 'Lista B', isCatalogDefault: false },
    ],
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    warnings: [],
    updatedAt: '2026-02-14T10:00:00.000Z',
    ...overrides,
  }
}

describe('CatalogSettingsReadView — accepted publication rendering (REQ-5, REQ-11)', () => {
  it('keeps the three semantic sections card-free for the routed outer card', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse() },
    })

    expect(wrapper.findAllComponents({ name: 'Card' })).toHaveLength(0)
    for (const testId of ['publication-card', 'contexts-card', 'stock-card']) {
      expect(wrapper.find(`[data-testid="${testId}"]`).element.tagName).toBe('SECTION')
    }
    expect(wrapper.find('[data-testid="catalog-settings-read"]').classes()).toContain('sm:gap-8')
    expect(wrapper.find('[data-testid="contexts-card"]').classes()).toContain('border-t')
    expect(wrapper.find('[data-testid="stock-card"]').classes()).toContain('sm:pt-8')
  })

  it('shows the accepted catalogPublished state with a visible badge', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse({ catalogPublished: true }) },
    })
    expect(wrapper.find('[data-testid="publication-badge"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Publicado')
  })

  it('shows the unpublished accepted state', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse({ catalogPublished: false }) },
    })
    expect(wrapper.find('[data-testid="publication-badge"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No publicado')
  })

  it('renders effectivePublication faithfully even when divergent (REQ-11)', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: {
        settings: makeResponse({ catalogPublished: true, effectivePublication: false }),
      },
    })
    expect(wrapper.find('[data-testid="effective-badge"]').exists()).toBe(true)
    expect(wrapper.text()).toContain(
      'La publicación efectiva también depende del estado del tenant.',
    )
    expect(wrapper.text()).toContain('Inactiva')
  })

  it('hides the effective-publication helper when effectivePublication is true', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: {
        settings: makeResponse({ catalogPublished: true, effectivePublication: true }),
      },
    })
    expect(wrapper.text()).not.toContain(
      'La publicación efectiva también depende del estado del tenant.',
    )
  })
})

describe('CatalogSettingsReadView — contexts + default ul > li semantics (REQ-5, REQ-6)', () => {
  it('wraps rows in a <ul> with a data-testid', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse() },
    })
    expect(wrapper.find('ul[data-testid="contexts-list"]').exists()).toBe(true)
  })

  it('uses <li> as direct children — validates with DOM .children', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse() },
    })
    const list = wrapper.find('ul[data-testid="contexts-list"]').element
    // Exact child count
    expect(list.children).toHaveLength(2)
    // Every direct child is an <li>
    for (const child of list.children) {
      expect(child.tagName).toBe('LI')
    }
  })

  it('renders the accepted price contexts in server order with the default marked', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse() },
    })
    const items = wrapper.findAll('li[data-testid="context-row"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Lista A')
    expect(items[0]!.text()).toContain('Predeterminada')
    expect(items[1]!.text()).toContain('Lista B')
  })

  it('row class contains sm:flex-row for horizontal layout at breakpoint', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse() },
    })
    const row = wrapper.find('li[data-testid="context-row"]')
    expect(row.classes()).toContain('sm:flex-row')
  })

  it('name wrapper has min-w-0 and break-words for safe wrapping', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse() },
    })
    const nameSpan = wrapper.find('li[data-testid="context-row"] span')
    expect(nameSpan.classes()).toContain('min-w-0')
    expect(nameSpan.classes()).toContain('break-words')
  })

  it('renders the empty-state copy when priceContexts is empty', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse({ priceContexts: [] }) },
    })
    expect(wrapper.text()).toContain(
      'Sin listas públicas: la configuración no se mostrará públicamente',
    )
  })
})

describe('CatalogSettingsReadView — stock default (REQ-8)', () => {
  it('renders the serialized non-custom mode without a quantity', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: {
        settings: makeResponse({
          stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
        }),
      },
    })
    const stock = wrapper.find('[data-testid="stock-default"]')
    expect(stock.exists()).toBe(true)
    expect(stock.text()).toContain('Según estado del sistema')
    expect(stock.text()).not.toContain('Mostrar 0')
  })

  it('labels CUSTOM_QUANTITY 0 as "Mostrar 0"', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: {
        settings: makeResponse({
          stockPresentationDefault: { mode: 'CUSTOM_QUANTITY', customQuantity: 0 },
        }),
      },
    })
    expect(wrapper.find('[data-testid="stock-default"]').text()).toContain('Mostrar 0')
  })

  it('labels CUSTOM_QUANTITY with a positive quantity as "Mostrar n"', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: {
        settings: makeResponse({
          stockPresentationDefault: { mode: 'CUSTOM_QUANTITY', customQuantity: 2 },
        }),
      },
    })
    expect(wrapper.find('[data-testid="stock-default"]').text()).toContain('Mostrar 2')
  })

  it.each([
    ['ABSTRACT_STATUS', 'Según estado abstracto'],
    ['HIDDEN', 'Oculto'],
  ] as const)('renders mode %s with its Spanish label', (mode, label) => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: {
        settings: makeResponse({
          stockPresentationDefault: { mode, customQuantity: null },
        }),
      },
    })
    expect(wrapper.find('[data-testid="stock-default"]').text()).toContain(label)
  })
})

describe('CatalogSettingsReadView — warnings + timestamp (REQ-11)', () => {
  it('shows the known warning with its Spanish copy, read-only', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: {
        settings: makeResponse({ warnings: ['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES'] }),
      },
    })
    expect(wrapper.text()).toContain('El contexto de catálogo por defecto no tiene precios válidos')
  })

  it('drops unknown warning codes silently', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: {
        settings: makeResponse({ warnings: ['SOME_FUTURE_CODE'] }),
      },
    })
    expect(wrapper.text()).not.toContain('SOME_FUTURE_CODE')
  })

  it('renders the accepted updatedAt timestamp', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse({ updatedAt: '2026-02-14T10:00:00.000Z' }) },
    })
    expect(wrapper.find('[data-testid="updated-at"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="updated-at"]').text()).toContain('2026')
  })
})

describe('CatalogSettingsReadView — update-permission notice moved to page footer (REQ-12, WU3B)', () => {
  it('does not render a canUpdate prop — the notice lives in the page sticky footer', () => {
    const wrapper = mountWithUApp(CatalogSettingsReadView, {
      props: { settings: makeResponse() },
    })
    expect(wrapper.find('[data-testid="readonly-notice"]').exists()).toBe(false)
  })
})
