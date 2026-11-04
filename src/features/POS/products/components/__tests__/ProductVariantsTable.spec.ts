/**
 * ProductVariantsTable — rows by job (name with SKU and barcode, stock, price,
 * ⋮), pending vs saved menus, and the events the owner listens to.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductVariantsTable, { type ProductVariantRow } from '../ProductVariantsTable.vue'

const row: ProductVariantRow = {
  id: 'variant-1',
  label: 'Tamaño: Grande',
  sku: 'VAR-1',
  barcode: '',
  quantity: 10,
  price: '129.90',
  deleteName: 'Grande',
}

const baseProps = {
  rows: [row],
  pending: false,
  showStock: true,
  canUpdate: true,
  canDelete: true,
}

function mountTable(props: Record<string, unknown> = {}) {
  return mount(ProductVariantsTable, { attachTo: document.body, props: { ...baseProps, ...props } })
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 50))
const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
const labels = () => menuItems().map((item) => (item.textContent ?? '').trim())

async function openMenu(wrapper: ReturnType<typeof mountTable>) {
  await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
  await tick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductVariantsTable', () => {
  it('shows the name with SKU and barcode under it, and a dash for a missing barcode', () => {
    const wrapper = mountTable()
    const text = wrapper.text()
    expect(text).toContain('Tamaño: Grande')
    expect(text).toContain('SKU: VAR-1 · Código: —')
    wrapper.unmount()
  })

  it('has a single ⋮ in the Acciones column, named after the variant', () => {
    const wrapper = mountTable()
    const triggers = wrapper.findAll('button[aria-haspopup="menu"]')
    expect(triggers).toHaveLength(1)
    expect(triggers[0]!.attributes('aria-label')).toBe('Acciones de la variante Tamaño: Grande')
    expect(wrapper.find('[data-testid="variant-image-button"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('hides the stock column when stock is not tracked', () => {
    const wrapper = mountTable({ showStock: false })
    expect(wrapper.text()).not.toContain('Existencias')
    wrapper.unmount()
  })

  it('lists photos, details, edit and a last, confirmed delete for a saved variant', async () => {
    const wrapper = mountTable()
    await openMenu(wrapper)
    expect(labels()).toEqual(['Elegir fotos', 'Más datos', 'Editar', 'Eliminar…'])
    wrapper.unmount()
  })

  it('has no photos item while the variant is still pending', async () => {
    const wrapper = mountTable({ pending: true })
    await openMenu(wrapper)
    expect(labels()).toEqual(['Más datos', 'Editar', 'Eliminar…'])
    wrapper.unmount()
  })

  it('emits the chosen action with the row id', async () => {
    const wrapper = mountTable()
    await openMenu(wrapper)
    menuItems().find((item) => item.textContent?.trim() === 'Elegir fotos')!.click()
    await tick()
    expect(wrapper.emitted('action')).toEqual([['photos', 'variant-1']])
    wrapper.unmount()
  })

  it('locks the inputs and disables edit when the role cannot update', async () => {
    const wrapper = mountTable({ canUpdate: false, canDelete: false })
    expect(wrapper.findAll('input').every((input) => input.attributes('disabled') !== undefined)).toBe(
      true,
    )
    await openMenu(wrapper)
    const disabled = menuItems()
      .filter((item) => item.getAttribute('data-disabled') !== null)
      .map((item) => (item.textContent ?? '').trim())
    expect(disabled).toEqual(expect.arrayContaining(['Elegir fotos', 'Editar', 'Eliminar…']))
    wrapper.unmount()
  })

  it('commits the public price from the typed text on blur', async () => {
    const wrapper = mountTable()
    const price = wrapper.get('input[placeholder="0.00"]')
    ;(price.element as HTMLInputElement).value = '150.5'
    await price.trigger('blur')
    expect(wrapper.emitted('commit-price')).toEqual([['variant-1', '150.5']])
    wrapper.unmount()
  })

  it('names the empty and loading states', () => {
    const empty = mountTable({ rows: [] })
    expect(empty.text()).toContain('Sin variantes registradas.')
    empty.unmount()
    const pending = mountTable({ rows: [], pending: true })
    expect(pending.text()).toContain('Sin variantes agregadas.')
    pending.unmount()
    const loading = mountTable({ loading: true })
    expect(loading.text()).toContain('Actualizando variantes...')
    loading.unmount()
  })
})
