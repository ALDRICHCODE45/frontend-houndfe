// ProductCatalogSettingsSection.spec.ts — WU5 strict-TDD pins for the advanced
// "Catálogo online" section (REQ-14/REQ-15): hide-price and the stock override
// stay editable with update:Product only; the per-product public-context
// selector additionally requires read:TenantCatalogSettings and otherwise
// disables with the locked Spanish note; supportsAllCatalogPriceLists renders
// read-only when the server reports true (response-only, never sent).

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductCatalogSettingsSection from '../ProductCatalogSettingsSection.vue'

const contexts = [{ priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true }]

const mountSection = (props: Record<string, unknown> = {}) =>
  mountWithUApp(ProductCatalogSettingsSection, {
    props: {
      hidePriceInOnlineCatalog: false,
      supportedCatalogPriceListIds: [] as string[],
      supportsAllCatalogPriceLists: false,
      onlineStockPresentation: null,
      onlineStockPresentationCustomQty: null,
      contexts,
      canReadSettings: true,
      ...props,
    },
  })

describe('ProductCatalogSettingsSection — advanced Catálogo online (REQ-14/REQ-15)', () => {
  it('renders the section with hide-price, the stock override, and the contexts block', () => {
    const wrapper = mountSection()
    expect(wrapper.find('[data-testid="catalog-settings-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hide-price-switch"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stock-override-mode"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="supported-contexts"]').exists()).toBe(true)
  })

  it('shows the supportsAll indicator read-only only when the server reports it', () => {
    expect(mountSection().find('[data-testid="supports-all-note"]').exists()).toBe(false)
    const all = mountSection({ supportsAllCatalogPriceLists: true })
    expect(all.find('[data-testid="supports-all-note"]').text()).toContain(
      'Soporta todos los contextos públicos del tenant',
    )
  })

  it('without settings-read: selector disabled with the locked note; hide-price and stock stay editable', () => {
    const wrapper = mountSection({ canReadSettings: false })
    expect(wrapper.find('[data-testid="contexts-gated-note"]').text()).toContain(
      'Configura los contextos públicos del tenant en Sistema > Catálogo online para habilitar esta selección',
    )
    const toggle = wrapper.find('[data-testid="context-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect((toggle.element as HTMLInputElement).disabled).toBe(true)
    expect((wrapper.find('[data-testid="hide-price-switch"]').element as HTMLButtonElement).disabled).toBe(false)
    expect((wrapper.find('[data-testid="stock-override-mode"]').element as HTMLSelectElement).disabled).toBe(false)
  })

  it('REQ-15 with update:Product only and no accepted contexts: the selector is still rendered but disabled', () => {
    const wrapper = mountSection({ canReadSettings: false, contexts: [] })
    const selector = wrapper.find('[data-testid="contexts-select"]')
    expect(selector.exists()).toBe(true)
    expect((selector.element as HTMLSelectElement).disabled).toBe(true)
    expect(wrapper.find('[data-testid="context-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="contexts-gated-note"]').text()).toContain(
      'Configura los contextos públicos del tenant en Sistema > Catálogo online para habilitar esta selección',
    )
    expect((wrapper.find('[data-testid="hide-price-switch"]').element as HTMLButtonElement).disabled).toBe(false)
    expect((wrapper.find('[data-testid="stock-override-mode"]').element as HTMLSelectElement).disabled).toBe(false)
  })

  it.each([
    { name: 'pending', state: { settingsLoading: true }, note: 'settings-loading-note', copy: 'Cargando contextos públicos del tenant' },
    { name: 'failed', state: { settingsError: true }, note: 'settings-error-note', copy: 'No se pudieron cargar los contextos públicos del tenant' },
  ] as const)('$name settings query: distinct note, disabled placeholder, no rows; hide-price/stock stay usable', ({ state, note, copy }) => {
    const wrapper = mountSection({ contexts: [], ...state })
    expect(wrapper.find(`[data-testid="${note}"]`).text()).toContain(copy)
    expect(wrapper.find('[data-testid="context-toggle"]').exists()).toBe(false)
    expect((wrapper.find('[data-testid="contexts-select"]').element as HTMLSelectElement).disabled).toBe(true)
    expect((wrapper.find('[data-testid="hide-price-switch"]').element as HTMLButtonElement).disabled).toBe(false)
    expect((wrapper.find('[data-testid="stock-override-mode"]').element as HTMLSelectElement).disabled).toBe(false)
  })

  it('accepted-empty contexts state states the configured-contexts fact without synthesizing options', () => {
    const wrapper = mountSection({ contexts: [] })
    expect(wrapper.find('[data-testid="contexts-empty-note"]').text()).toContain(
      'El tenant no tiene contextos públicos configurados',
    )
    expect(wrapper.find('[data-testid="context-toggle"]').exists()).toBe(false)
    expect((wrapper.find('[data-testid="contexts-select"]').element as HTMLSelectElement).disabled).toBe(true)
  })

  it('does not leave stale contexts silently editable while the query is pending or failed', () => {
    expect(mountSection({ contexts, settingsLoading: true }).find('[data-testid="context-toggle"]').exists()).toBe(false)
    expect(mountSection({ contexts, settingsError: true }).find('[data-testid="context-toggle"]').exists()).toBe(false)
  })

  it('with settings-read: rows render from tenant contexts and toggle emits the context id', async () => {
    const wrapper = mountSection({ supportedCatalogPriceListIds: ['pl_a'] })
    const toggle = wrapper.find('[data-testid="context-toggle"]')
    expect((toggle.element as HTMLInputElement).checked).toBe(true)
    await toggle.setValue(false)
    expect(wrapper.emitted('toggle-context')).toEqual([['pl_a']])
  })

  it('emits toggle-hide-price with the next intent', async () => {
    const wrapper = mountSection({ hidePriceInOnlineCatalog: false })
    await wrapper.find('[data-testid="hide-price-switch"]').trigger('click')
    expect(wrapper.emitted('toggle-hide-price')).toEqual([[true]])
  })

  it('forwards stock changes and preserves custom 0 (Mostrar 0)', async () => {
    const wrapper = mountSection({
      onlineStockPresentation: 'CUSTOM_QUANTITY',
      onlineStockPresentationCustomQty: 0,
    })
    await wrapper.find('[data-testid="stock-override-qty"]').setValue('0')
    expect(wrapper.emitted('stock-change')?.[0]).toEqual([{ mode: 'CUSTOM_QUANTITY', customQuantity: 0 }])
  })

  it('disabled: every control disables (hide-price, stock pair, context toggle)', () => {
    const wrapper = mountSection({
      disabled: true,
      onlineStockPresentation: 'CUSTOM_QUANTITY',
      onlineStockPresentationCustomQty: 0,
      supportedCatalogPriceListIds: ['pl_a'],
    })
    expect((wrapper.find('[data-testid="hide-price-switch"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((wrapper.find('[data-testid="stock-override-mode"]').element as HTMLSelectElement).disabled).toBe(true)
    expect((wrapper.find('[data-testid="stock-override-qty"]').element as HTMLInputElement).disabled).toBe(true)
    expect((wrapper.find('[data-testid="context-toggle"]').element as HTMLInputElement).disabled).toBe(true)
  })
})
