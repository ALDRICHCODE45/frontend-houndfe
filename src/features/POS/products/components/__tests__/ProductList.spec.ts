/**
 * Product list — S10 four states plus no-match, against the real AppDataTable
 * (toolbar and pagination stubbed): empty, loading, data, error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import ProductList from '../ProductList.vue'
import type { Product } from '../../interfaces/product.types'

const isMobile = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isMobile }) }
})

const product: Product = {
  id: 'prod-1',
  name: 'Collar ajustable',
  type: 'PRODUCT',
  sku: 'COL-001',
  barcode: null,
  categoryId: 'cat-1',
  categoryName: 'Accesorios',
  brandId: 'brand-1',
  brandName: 'Pawly',
  priceCents: 129900,
  quantity: 25,
  minQuantity: 5,
  useStock: true,
  hasVariants: false,
  useLotsAndExpirations: false,
  sellInPos: true,
  includeInOnlineCatalog: true,
  requiresPrescription: false,
  chargeProductTaxes: true,
  variantStockTotal: null,
  variantCount: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2020-03-03T20:43:00.000Z',
}

const permissions = { canRead: true, canUpdate: true, canDelete: true, canCreate: true }

function mountList(props: Record<string, unknown> = {}) {
  return mount(ProductList, {
    attachTo: document.body,
    props: { items: [product], totalCount: 1, pageCount: 1, ...permissions, ...props },
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
      },
    },
  })
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 50))
const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
const labels = () => menuItems().map((item) => (item.textContent ?? '').trim())

beforeEach(() => {
  isMobile.value = false
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductList — data', () => {
  it('renders the name as the row primary with the SKU underneath, never an id', () => {
    const wrapper = mountList()
    expect(wrapper.get('.hf-row-primary').text()).toBe('Collar ajustable')
    expect(wrapper.get('.hf-row-secondary').text()).toBe('COL-001')
    expect(wrapper.text()).not.toContain('prod-1')
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    wrapper.unmount()
  })

  it('draws no secondary line when the product has no SKU', () => {
    const wrapper = mountList({ items: [{ ...product, sku: null }] })
    expect(wrapper.find('.hf-row-secondary').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps one layout: a table with at most eight columns, no view toggle, status second', () => {
    const wrapper = mountList()
    const columns = wrapper.getComponent({ name: 'AppDataTable' }).props('columns') as Array<{
      id?: string
      accessorKey?: string
    }>
    const ids = columns.map((column) => column.id ?? column.accessorKey)
    expect(ids.length).toBeLessThanOrEqual(8)
    expect(ids[0]).toBe('name')
    expect(ids[1]).toBe('status')
    expect(ids[ids.length - 1]).toBe('actions')
    expect(wrapper.find('[aria-label="Seleccionar vista de productos"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each([
    ['active', 'Activo', 'success'],
    ['inactive', 'Inactivo', 'neutral'],
    ['out_of_stock', 'Sin Stock', 'danger'],
  ] as const)('renders %s with the shared status badge', (status, label, tone) => {
    const wrapper = mountList({ items: [{ ...product, status }] })
    const badge = wrapper.get('td[data-column="status"] .hf-status-badge, .hf-status-badge')
    expect(badge.text()).toBe(label)
    expect(badge.attributes('data-tone')).toBe(tone)
    expect(badge.attributes('aria-label')).toBe(`Estado: ${label}`)
    wrapper.unmount()
  })

  it('shows the price right-aligned in 2 decimals and a plain healthy stock', () => {
    const wrapper = mountList()
    const price = wrapper.get('.hf-figure')
    expect(price.text()).toBe('$1,299.00')
    expect(wrapper.findAll('.hf-status-badge')).toHaveLength(1)
    expect(wrapper.text()).toContain('25 unidades')
    wrapper.unmount()
  })

  it.each([
    [{ quantity: 0, minQuantity: 5 }, 'danger'],
    [{ quantity: 3, minQuantity: 5 }, 'warning'],
  ])('flags low stock with a tone badge only when it needs attention: %j', (stock, tone) => {
    const wrapper = mountList({ items: [{ ...product, ...stock }] })
    const badges = wrapper.findAll('.hf-status-badge')
    expect(badges).toHaveLength(2)
    expect(badges[1]!.attributes('data-tone')).toBe(tone)
    wrapper.unmount()
  })

  it('opens the product from the whole row, but not from the ⋮ menu', async () => {
    const wrapper = mountList()
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    await wrapper.get('tbody td:nth-child(2)').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    expect(wrapper.emitted('open')![0]![0]).toEqual(product)
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
    await tick()
    expect(wrapper.emitted('open')).toHaveLength(1)
    wrapper.unmount()
  })

  it('does not make the row clickable without read permission', () => {
    const wrapper = mountList({ canRead: false })
    expect(wrapper.get('tbody tr').classes()).not.toContain('hf-clickable-row')
    expect(wrapper.find('button.hf-row-primary').exists()).toBe(false)
    expect(wrapper.get('.hf-row-primary').text()).toBe('Collar ajustable')
    wrapper.unmount()
  })

  it('lists the actions in the ⋮ menu: destructive last, behind a separator, with … on the confirmation', async () => {
    const wrapper = mountList()
    const trigger = wrapper.get('button[aria-haspopup="menu"]')
    expect(trigger.attributes('aria-label')).toBe('Acciones de Collar ajustable')
    expect(wrapper.get('td:last-child').findAll('button')).toHaveLength(1)
    await trigger.trigger('click')
    await tick()
    expect(labels()).toEqual(['Ver detalles', 'Editar', 'Eliminar…'])
    expect(document.querySelector('[role="separator"]')).not.toBeNull()
    expect(menuItems()[2]!.className).toContain('hf-row-action-danger')
    wrapper.unmount()
  })

  it.each([
    [{ canRead: true, canUpdate: false, canDelete: false }, ['Ver detalles']],
    [{ canRead: false, canUpdate: true, canDelete: false }, ['Editar']],
    [{ canRead: false, canUpdate: false, canDelete: true }, ['Eliminar…']],
  ])('lists only what the role allows: %j', async (flags, expected) => {
    const wrapper = mountList(flags)
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
    await tick()
    expect(labels()).toEqual(expected)
    wrapper.unmount()
  })

  it('emits open, edit and delete from the menu', async () => {
    const wrapper = mountList()
    for (const [label, event] of [
      ['Ver detalles', 'open'],
      ['Editar', 'edit'],
      ['Eliminar…', 'delete'],
    ] as const) {
      await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
      await tick()
      menuItems().find((item) => item.textContent?.trim() === label)!.click()
      await tick()
      expect(wrapper.emitted(event)?.slice(-1)[0]?.[0]).toEqual(product)
    }
    wrapper.unmount()
  })

  it('shows no ⋮ when the role has no action at all', () => {
    const wrapper = mountList({ canRead: false, canUpdate: false, canDelete: false })
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders each product as a card on mobile with the same data and actions', async () => {
    isMobile.value = true
    const wrapper = mountList()
    const card = wrapper.get('[data-testid="product-card"]')
    expect(card.get('.hf-row-primary').text()).toBe('Collar ajustable')
    expect(card.get('.hf-status-badge').text()).toBe('Activo')
    expect(card.text()).toContain('$1,299.00')
    expect(card.text()).toContain('25 unidades')
    expect(card.text()).toContain(formatShortDateTime(product.updatedAt))
    expect(card.get('button[aria-haspopup="menu"]').attributes('aria-label')).toBe(
      'Acciones de Collar ajustable',
    )
    await card.trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('ProductList — empty', () => {
  const emptyList = { items: [] as Product[], totalCount: 0, pageCount: 0 }

  it('says nothing yet with the create action when the role can create', async () => {
    const wrapper = mountList(emptyList)
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.get('.hf-empty-state__title').text()).toBe('Aún no hay productos')
    expect(state.get('button').text()).toContain('Crear producto')
    await state.get('button').trigger('click')
    expect(wrapper.emitted('add')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows no create action without permission', () => {
    const wrapper = mountList({ ...emptyList, canCreate: false })
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('empty')
    expect(wrapper.get('.hf-empty-state').find('button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders the same state in cards mode', () => {
    isMobile.value = true
    const wrapper = mountList(emptyList)
    const block = wrapper.get('[data-testid="mobile-empty-state"]')
    expect(block.attributes('data-kind')).toBe('empty')
    expect(block.get('.hf-empty-state__title').text()).toBe('Aún no hay productos')
    wrapper.unmount()
  })
})

describe('ProductList — no-match', () => {
  const emptyList = { items: [] as Product[], totalCount: 0, pageCount: 0, filtered: true }

  it('names the search and clears the filters', async () => {
    const wrapper = mountList({ ...emptyList, searchTerm: 'collar' })
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('no-match')
    expect(state.get('.hf-empty-state__title').text()).toBe('Ningún resultado para «collar»')
    await state.get('button').trigger('click')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
    wrapper.unmount()
  })

  it('falls back to the plain title when only a filter is active', () => {
    const wrapper = mountList(emptyList)
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Ningún resultado')
    wrapper.unmount()
  })
})

describe('ProductList — loading', () => {
  it('shows the table skeleton and no rows', () => {
    const wrapper = mountList({ items: [], totalCount: 0, pageCount: 0, loading: true })
    expect(wrapper.get('[data-testid="table-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('tbody').exists()).toBe(false)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows card skeletons on mobile', () => {
    isMobile.value = true
    const wrapper = mountList({ items: [], totalCount: 0, pageCount: 0, loading: true })
    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
    wrapper.unmount()
  })
})

describe('ProductList — error', () => {
  it('renders the error state with Reintentar that asks for a refresh', async () => {
    const wrapper = mountList({
      items: [],
      totalCount: 0,
      pageCount: 0,
      error: true,
      errorMessage: 'No se pudieron cargar los productos. Reintenta.',
    })
    const state = wrapper.get('[data-testid="table-error-state"]')
    expect(state.attributes('role')).toBe('alert')
    expect(state.text()).toContain('No se pudieron cargar los productos')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    expect(wrapper.find('.hf-empty-state[data-kind="empty"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
