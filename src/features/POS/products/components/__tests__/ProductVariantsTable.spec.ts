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
  priceCents: 12990,
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
  it('shows the name with only the codes it has under it', () => {
    const wrapper = mountTable()
    const text = wrapper.text()
    expect(text).toContain('Tamaño: Grande')
    expect(wrapper.get('[data-testid="variant-codes"]').text()).toBe('SKU: VAR-1')
    expect(text).not.toContain('Código')
    wrapper.unmount()
  })

  it('shows no codes line when the variant has neither SKU nor barcode', () => {
    const wrapper = mountTable({ rows: [{ ...row, sku: '', barcode: '' }] })
    expect(wrapper.find('[data-testid="variant-codes"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('—')
    wrapper.unmount()
  })

  it('says once, in the heading, that saved stock is adjusted from Inventario', () => {
    const wrapper = mountTable({ rows: [row, { ...row, id: 'variant-2', label: 'Tamaño: Chico' }] })
    expect(wrapper.get('thead').text()).toContain('Se ajusta desde Inventario')
    expect(wrapper.get('tbody').text()).not.toContain('Se ajusta desde Inventario')
    wrapper.unmount()
  })

  it('repeats the stock hint once above the cards on phones, where the heading is hidden', () => {
    const wrapper = mountTable({ rows: [row, { ...row, id: 'variant-2', label: 'Tamaño: Chico' }] })
    const phoneHint = wrapper.get('[data-testid="variants-stock-hint-phone"]')
    expect(phoneHint.text()).toBe('Existencias · Se ajusta desde Inventario')
    // Phones only: the stacked layout (below 640px) hides the heading that says it on wider screens.
    expect(phoneHint.classes()).toContain('sm:hidden')
    // Screen readers still read the visually hidden heading, so they do not hear it twice.
    expect(phoneHint.attributes('aria-hidden')).toBe('true')
    expect(phoneHint.element.closest('table')).toBeNull()
    wrapper.unmount()
  })

  it('has no phone stock hint for pending rows, untracked stock or an empty list', () => {
    for (const props of [{ pending: true }, { showStock: false }, { rows: [] }]) {
      const wrapper = mountTable(props)
      expect(wrapper.find('[data-testid="variants-stock-hint-phone"]').exists()).toBe(false)
      wrapper.unmount()
    }
  })

  it('says the variants did not load, with a retry, instead of an empty list', async () => {
    const wrapper = mountTable({ rows: [], error: true })
    const state = wrapper.get('.hf-empty-state[data-kind="error"]')
    expect(state.text()).toContain('No se pudieron cargar las variantes')
    expect(wrapper.text()).not.toContain('Sin variantes registradas.')
    await state.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    wrapper.unmount()
  })

  it('labels each figure cell so the row can stack as a card on a phone', () => {
    const wrapper = mountTable()
    expect(wrapper.get('table').attributes('data-stack')).toBeDefined()
    const labels = wrapper.findAll('tbody td[data-label]').map((cell) => cell.attributes('data-label'))
    expect(labels).toEqual(['Existencias', 'Precio público'])
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

  it('offers «Empaque» for a saved variant of a product, readable without update rights (S3)', async () => {
    const wrapper = mountTable({ packaging: true, canUpdate: false })
    await openMenu(wrapper)
    expect(labels()).toEqual(['Elegir fotos', 'Más datos', 'Empaque', 'Editar', 'Eliminar…'])
    const item = menuItems().find((entry) => entry.textContent?.trim() === 'Empaque')!
    expect(item.getAttribute('data-disabled')).toBeNull()
    item.click()
    await tick()
    expect(wrapper.emitted('action')).toEqual([['packaging', 'variant-1']])
    wrapper.unmount()
  })

  it('has no «Empaque» while pending or when packaging does not apply (services)', async () => {
    const pending = mountTable({ packaging: true, pending: true })
    await openMenu(pending)
    expect(labels()).not.toContain('Empaque')
    pending.unmount()
    document.body.innerHTML = ''

    const service = mountTable({ packaging: false })
    await openMenu(service)
    expect(labels()).not.toContain('Empaque')
    service.unmount()
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

  it.each([
    ['150.5', 15050],
    ['70.55', 7055],
    ['70,55', 7055],
    ['1,234.50', 123450],
  ])('commits the public price %j as %i cents on blur', async (text, cents) => {
    const wrapper = mountTable()
    const price = wrapper.get('input[placeholder="0.00"]')
    await price.setValue(text)
    await price.trigger('blur')
    expect(wrapper.emitted('commit-price')).toEqual([['variant-1', cents]])
    wrapper.unmount()
  })

  it.each([
    ['12abc', 'Escribe solo el monto en números, por ejemplo 70.55.'],
    ['', 'Escribe el monto.'],
  ])('does not commit %j and shows the error', async (text, message) => {
    const wrapper = mountTable()
    const price = wrapper.get('input[placeholder="0.00"]')
    await price.setValue(text)
    await price.trigger('blur')
    expect(wrapper.emitted('commit-price')).toBeUndefined()
    expect(wrapper.text()).toContain(message)
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
    it('shows the stock as a figure, not as an input', () => {
      const wrapper = mountTable()
      const stock = wrapper.get('[data-testid="variant-stock-readonly"]')
      expect(stock.text()).toBe('10')
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
