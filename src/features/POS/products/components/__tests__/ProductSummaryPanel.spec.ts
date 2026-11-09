/**
 * ProductSummaryPanel — identity, the four figures and the readiness checklist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ProductSummaryPanel from '../ProductSummaryPanel.vue'

const isNarrow = ref(false)
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useMediaQuery: () => isNarrow }
})
beforeEach(() => {
  isNarrow.value = false
})

const modalStub = {
  props: ['open', 'ui', 'title'],
  emits: ['update:open'],
  template:
    '<div v-if="open" data-testid="image-lightbox" :data-title="title" :data-content-class="ui?.content"><slot name="content" /></div>',
}
// Nuxt UI registers the modal as `Modal`; stub both names.
const lightboxStubs = {
  UModal: modalStub,
  Modal: modalStub,
  UButton: { template: '<button type="button" v-bind="$attrs"><slot /></button>' },
}

const props = {
  name: 'Collar ajustable',
  imageUrl: null,
  isProduct: true,
  sellInPos: true,
  includeInOnlineCatalog: false,
  priceCents: 129900,
  costCents: 80000,
  marginPercent: 38,
  stockTotal: 25,
  checklist: [
    { label: 'Nombre del producto', done: true, disabled: false },
    { label: 'Imágenes disponibles después de crear', done: false, disabled: true },
  ],
  completedItems: 1,
  applicableItems: 1,
  completionPercent: 100,
}

describe('ProductSummaryPanel', () => {
  it('is a labelled aside with the four figures', () => {
    const wrapper = mount(ProductSummaryPanel, { props })
    expect(wrapper.get('aside').attributes('aria-label')).toBe('Resumen operativo del producto')
    expect(wrapper.get('[data-summary="price"]').text()).toBe('$1,299.00')
    expect(wrapper.get('[data-summary="cost"]').text()).toBe('$800.00')
    expect(wrapper.get('[data-summary="stock"]').text()).toBe('25')
    expect(wrapper.text()).toContain('38%')
    expect(wrapper.text()).toContain('Producto')
    expect(wrapper.text()).toContain('POS')
    expect(wrapper.text()).not.toContain('Online')
    wrapper.unmount()
  })

  it('reads a dash for unknown margin and stock, and a negative margin in danger text', () => {
    const unknown = mount(ProductSummaryPanel, {
      props: { ...props, marginPercent: null, stockTotal: null },
    })
    expect(unknown.get('[data-summary="stock"]').text()).toBe('—')
    expect(unknown.text()).toContain('—')
    unknown.unmount()
    const negative = mount(ProductSummaryPanel, { props: { ...props, marginPercent: -5 } })
    expect(negative.find('.text-error').exists()).toBe(true)
    negative.unmount()
  })

  it('speaks each checklist item state and keeps no permanent help paragraph', () => {
    const wrapper = mount(ProductSummaryPanel, { props })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain(': Completo')
    expect(wrapper.text()).toContain('1/1')
    expect(wrapper.text()).not.toContain('No indica elegibilidad')
    expect(wrapper.find('progress').attributes('value')).toBe('100')
    wrapper.unmount()
  })

  it('shows the product image or the "Sin imagen" fallback', () => {
    const withImage = mount(ProductSummaryPanel, { props: { ...props, imageUrl: '/img/collar.png' } })
    expect(withImage.get('img').attributes('src')).toBe('/img/collar.png')
    withImage.unmount()
    const without = mount(ProductSummaryPanel, { props })
    expect(without.text()).toContain('Sin imagen')
    without.unmount()
  })

  it('opens the whole product image in a centered lightbox from the thumbnail', async () => {
    const wrapper = mount(ProductSummaryPanel, {
      props: { ...props, imageUrl: '/img/collar.png' },
      global: { stubs: lightboxStubs },
    })
    const trigger = wrapper.get('button[aria-label="Ver imagen completa"]')
    expect(trigger.attributes('type')).toBe('button')
    expect(wrapper.find('[data-testid="image-lightbox"]').exists()).toBe(false)
    await trigger.trigger('click')
    const modal = wrapper.get('[data-testid="image-lightbox"]')
    expect(modal.attributes('data-content-class')).toContain('hf-theme hf-ui')
    expect(modal.attributes('data-title')).toBe('Collar ajustable')
    const full = modal.get('img')
    expect(full.attributes('src')).toBe('/img/collar.png')
    expect(full.attributes('alt')).toBe('Collar ajustable')
    expect(full.classes()).toContain('object-contain')
    await modal.get('button[aria-label="Cerrar vista previa"]').trigger('click')
    expect(wrapper.find('[data-testid="image-lightbox"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('offers no lightbox button without a thumbnail', () => {
    const wrapper = mount(ProductSummaryPanel, { props, global: { stubs: lightboxStubs } })
    expect(wrapper.find('button[aria-label="Ver imagen completa"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('counts what it lists: the item that waits for creation is a note, not a list row', () => {
    const wrapper = mount(ProductSummaryPanel, {
      props: {
        ...props,
        checklist: [
          { label: 'Nombre del producto', done: false, disabled: false },
          { label: 'Precio de venta definido', done: false, disabled: false },
          { label: 'Categoría asignada', done: false, disabled: false },
          { label: 'Imágenes disponibles después de crear', done: false, disabled: true },
        ],
        completedItems: 0,
        applicableItems: 3,
        completionPercent: 0,
      },
    })
    expect(wrapper.text()).toContain('0/3')
    expect(wrapper.findAll('li')).toHaveLength(3)
    expect(wrapper.get('[data-testid="summary-deferred"]').text()).toBe(
      'Imágenes disponibles después de crear',
    )
    wrapper.unmount()
  })

  it('on mobile collapses the figures and checklist behind a toggle', async () => {
    isNarrow.value = true
    const wrapper = mount(ProductSummaryPanel, { props })
    const hidden = () => (wrapper.get('.product-summary-body').attributes('style') ?? '').includes('display: none')
    expect(hidden()).toBe(true)
    const toggle = wrapper.get('[data-testid="summary-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(hidden()).toBe(false)
    expect(toggle.attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })

  it('on desktop always shows the body and no toggle', () => {
    const wrapper = mount(ProductSummaryPanel, { props })
    expect(wrapper.get('.product-summary-body').attributes('style') ?? '').not.toContain('display: none')
    expect(wrapper.find('[data-testid="summary-toggle"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
