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

  // O1 S1: a saved variant's stock is read-only; it moves through an adjustment.
  describe('quantity is read-only for saved variants', () => {
    it('shows the stock as a figure with the hint, not as an input', () => {
      const wrapper = mountTable()
      const stock = wrapper.get('[data-testid="variant-stock-readonly"]')
      expect(stock.text()).toContain('10')
      expect(stock.text()).toContain('Se ajusta desde Inventario')
      expect(wrapper.find('input[aria-label="Existencias de Tamaño: Grande"]').exists()).toBe(false)
      expect(wrapper.findAll('input')).toHaveLength(1)
      wrapper.unmount()
    })

    it('emits no quantity events for a saved row', async () => {
      const wrapper = mountTable()
      await wrapper.get('[data-testid="variant-stock-readonly"]').trigger('blur')
      await wrapper.get('[data-testid="variant-stock-readonly"]').trigger('keyup.enter')
      expect(wrapper.emitted('update-quantity')).toBeUndefined()
      expect(wrapper.emitted('commit-quantity')).toBeUndefined()
      wrapper.unmount()
    })

    it('stays read-only for a role that cannot update', () => {
      const wrapper = mountTable({ canUpdate: false })
      expect(wrapper.find('[data-testid="variant-stock-readonly"]').exists()).toBe(true)
      wrapper.unmount()
    })

    it('keeps the editable input while the variant is still pending (creation)', async () => {
      const wrapper = mountTable({ pending: true })
      expect(wrapper.find('[data-testid="variant-stock-readonly"]').exists()).toBe(false)
      const input = wrapper.get('input[aria-label="Existencias de Tamaño: Grande"]')
      await input.setValue('12')
      await input.trigger('blur')
      expect(wrapper.emitted('update-quantity')).toEqual([['variant-1', 12]])
      expect(wrapper.emitted('commit-quantity')).toEqual([['variant-1']])
      wrapper.unmount()
    })
  })
})
