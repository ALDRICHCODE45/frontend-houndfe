import { reactive, defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SupplierView from '../SupplierView.vue'
import SupplierForm from '../../components/SupplierForm.vue'
import DataTableToolbar from '@/core/shared/components/DataTable/DataTableToolbar.vue'
import { readFileSync } from 'node:fs'
const suppliersCss = readFileSync('src/features/procurement/suppliers/styles/suppliers-visual.css', 'utf8')
import { suppliersApi } from '../../api/suppliers.api'
interface TestAuth { user: { id: string }; currentTenantId: string; authPhase: string; permissionsLoaded: boolean; grants: string[]; userCan: (action: string, subject: string) => boolean }
const holder = vi.hoisted(() => ({ auth: null as unknown as TestAuth }))
const isMobile = ref(false)
vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isMobile }) }
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => holder.auth }))
vi.mock('../../api/suppliers.api', () => ({ suppliersApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }))
const supplier = { id: 'supplier-1', displayName: 'Centro', termsText: null, status: 'ACTIVE' as const, version: 1, createdAt: '', updatedAt: '' }
const dispose: Array<() => void> = []
const Overlay = defineComponent({ props: ['open'], setup(props, { slots }) { return () => props.open ? h('section', [slots.body?.(), slots.footer?.()]) : null } })
function setup(grants = ['read', 'create', 'update'], realOverlays = false) {
  holder.auth = reactive({ user: { id: 'user' }, currentTenantId: 'branch', authPhase: 'authenticated', permissionsLoaded: true, grants,
    userCan(action: string, subject: string) { return subject === 'ProcurementSupplier' && this.grants.includes(action) },
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
  const root = mount(defineComponent({ setup: () => () => h(UApp, null, { default: () => h(SupplierView) }) }), { attachTo: realOverlays ? document.body : undefined, global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]], stubs: realOverlays ? {} : { USlideover: Overlay, UModal: Overlay, Slideover: Overlay, Modal: Overlay } } })
  dispose.push(() => { root.unmount(); client.clear() })
  return root.findComponent(SupplierView)
}
beforeEach(() => {
  vi.resetAllMocks()
  isMobile.value = false
  vi.mocked(suppliersApi.list).mockResolvedValue({ items: [supplier], nextCursor: null })
  vi.mocked(suppliersApi.get).mockResolvedValue(supplier)
})
afterEach(() => {
  dispose.splice(0).forEach(fn => fn())
  document.body.innerHTML = ''
})
const menuItem = (label: string) => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent?.trim() === label)
const menuTrigger = (wrapper: ReturnType<typeof setup>, name = 'Centro') => wrapper.get<HTMLButtonElement>(`button[aria-label="Acciones de ${name}"]`)
// Row actions live in the ⋮ menu: open it from the real trigger and pick the item.
async function chooseAction(wrapper: ReturnType<typeof setup>, label: string, name = 'Centro') {
  await menuTrigger(wrapper, name).trigger('click')
  await vi.waitFor(() => expect(menuItem(label)).toBeDefined())
  menuItem(label)!.click()
  await flushPromises()
}

describe('supplier screen integration', () => {
  it('keeps Estado in the shared filters, inline beside the search on one row like Products', async () => {
    const wrapper = setup()
    await flushPromises()
    const toolbar = wrapper.getComponent(DataTableToolbar)
    const filter = toolbar.get('.hf-toolbar-filters [data-testid="supplier-status-filter"]')
    expect(filter.attributes('role')).toBe('combobox')
    expect(filter.attributes('aria-label')).toBe('Estado')
    expect(filter.text()).toContain('Activos')
    expect(wrapper.find('select').exists()).toBe(false)
    expect(toolbar.get('.hf-toolbar-search-region input').attributes('placeholder')).toBe('Buscar proveedor...')
    expect(toolbar.get('.hf-toolbar-actions [data-testid="create-supplier"]').text()).toBe('Crear proveedor')
    // The filter shares the search row: no feature rule may push it onto a second grid row.
    expect(suppliersCss).not.toMatch(/hf-toolbar-filters/)
    expect(suppliersCss).not.toMatch(/grid-area/)
  })
  it('keeps the page header to the title alone', async () => {
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Proveedores')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Contactos comerciales')
  })
  it('opens the supplier from Editar in the ⋮ menu and from the whole row, restoring focus to the row control', async () => {
    const wrapper = setup(undefined, true)
    await flushPromises()
    await chooseAction(wrapper, 'Editar')
    expect(suppliersApi.get).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(document.querySelector('form.supplier-form')).not.toBeNull())
    document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(document.activeElement).toBe(menuTrigger(wrapper).element)
    await wrapper.get('td:nth-child(3)').trigger('click')
    await flushPromises()
    expect(suppliersApi.get).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => expect(document.querySelector('form.supplier-form')).not.toBeNull())
  })
  it('shows the supplier name and status in the slideover header without a permanent help paragraph', async () => {
    vi.mocked(suppliersApi.get).mockResolvedValue({ ...supplier, termsText: 'Crédito a 30 días' })
    const wrapper = setup(undefined, true)
    await flushPromises()
    await wrapper.get('[data-testid="supplier-detail"]').trigger('click')
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.querySelector('[data-slot="title"]')?.textContent?.trim()).toBe('Centro')
    expect(dialog.querySelector('.hf-status-badge')?.textContent?.trim()).toBe('Activo')
    expect(dialog.textContent).not.toContain('No se modifican existencias')
    expect(dialog.textContent).not.toContain('Nombre comercial. Hasta')
    expect(dialog.textContent).not.toContain('No generan pagos ni deuda')
    expect(dialog.textContent).not.toContain('Estado:')
    expect(dialog.querySelector('[data-testid="cancel"]')).toBeNull()
    expect(Array.from(dialog.querySelectorAll('button')).filter(button => button.type === 'submit')).toHaveLength(1)
  })
  it('titles the creation slideover and shows no status for a supplier that does not exist yet', async () => {
    const wrapper = setup(undefined, true)
    await flushPromises()
    await wrapper.get('[data-testid="create-supplier"]').trigger('click')
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.querySelector('[data-slot="title"]')?.textContent?.trim()).toBe('Crear proveedor')
    expect(dialog.querySelector('.hf-status-badge')).toBeNull()
  })
  it('chooses a status by its readable label and clears back to the default', async () => {
    const wrapper = setup(undefined, true)
    await flushPromises()
    expect(wrapper.find('[data-testid="toolbar-filtros-badge"]').exists()).toBe(false)
    document.querySelector<HTMLElement>('[data-testid="supplier-status-filter"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await vi.waitFor(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull())
    const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
    expect(options.map(option => option.textContent?.trim())).toEqual(['Activos', 'Archivados', 'Todos'])
    options[1]!.focus()
    options[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await vi.waitFor(() => expect(suppliersApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ARCHIVED' }), expect.any(AbortSignal)))
    expect(wrapper.getComponent(DataTableToolbar).props('activeFilterCount')).toBe(1)
    wrapper.getComponent(DataTableToolbar).vm.$emit('clear-filters')
    await vi.waitFor(() => expect(suppliersApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ACTIVE' }), expect.any(AbortSignal)))
    expect(wrapper.getComponent(DataTableToolbar).props('activeFilterCount')).toBe(0)
  })
  it.each([
    { mobile: false, trigger: 'supplier-detail', overlay: 'detalle' },
    { mobile: true, trigger: 'supplier-detail', overlay: 'detalle' },
    { mobile: false, trigger: 'row-menu', overlay: 'confirmación' },
    { mobile: true, trigger: 'row-menu', overlay: 'confirmación' },
    { mobile: false, trigger: 'create-supplier', overlay: 'creación' },
  ])('returns focus after Escape from $overlay (mobile=$mobile)', async ({ mobile, trigger }) => {
    isMobile.value = mobile
    const wrapper = setup(undefined, true)
    await flushPromises()
    let resolveDetail: ((value: typeof supplier) => void) | undefined
    if (trigger === 'supplier-detail') {
      vi.mocked(suppliersApi.get).mockReturnValue(new Promise(resolve => { resolveDetail = resolve }))
    }
    const button = trigger === 'row-menu' ? menuTrigger(wrapper) : wrapper.get(`[data-testid="${trigger}"]`)
    ;(button.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(button.element)
    // Native keyboard activation dispatches a click; jsdom does not synthesize it.
    if (trigger !== 'row-menu') await button.trigger('keydown', { key: 'Enter' })
    await button.trigger('click')
    if (trigger === 'row-menu') {
      await vi.waitFor(() => expect(menuItem('Archivar')).toBeDefined())
      menuItem('Archivar')!.click()
    }
    if (resolveDetail) {
      expect(button.attributes('disabled')).toBeDefined()
      // Browsers blur a focused native button when loading disables it.
      // jsdom does not implement that behavior; reproduce it at the DOM boundary.
      document.body.tabIndex = -1
      document.body.focus()
      document.body.removeAttribute('tabindex')
      expect(document.activeElement).toBe(document.body)
      resolveDetail(supplier)
    }
    await flushPromises()
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()
      expect(document.querySelector('[role="dialog"]')?.contains(document.activeElement)).toBe(true)
    })
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    // Let the focus-scope unmount timer settle before checking restoration.
    await new Promise(resolve => setTimeout(resolve, 50))
    await vi.waitFor(() => expect(document.activeElement, 'closing the overlay must focus its connected trigger').toBe(button.element))
  })
  it('keeps the original row invoker across an explicit conflict reload', async () => {
    const wrapper = setup(undefined, true)
    await flushPromises()
    const button = wrapper.get('[data-testid="supplier-detail"]')
    ;(button.element as HTMLButtonElement).focus()
    await button.trigger('click')
    await flushPromises()
    vi.mocked(suppliersApi.update).mockRejectedValue({ response: { status: 409, data: { error: 'SUPPLIER_VERSION_CONFLICT' } } })
    const form = document.querySelector('form.supplier-form')!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()
    const reload = document.querySelector<HTMLButtonElement>('[data-testid="reload-supplier"]')!
    reload.focus()
    reload.click()
    await flushPromises()
    document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(document.activeElement).toBe(button.element)
  })
  it('does not restore an old tenant invoker after the context closes an overlay', async () => {
    const wrapper = setup(undefined, true)
    await flushPromises()
    const button = wrapper.get('[data-testid="supplier-detail"]')
    ;(button.element as HTMLButtonElement).focus()
    await button.trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.contains(document.activeElement)).toBe(true))
    const focus = vi.spyOn(button.element as HTMLButtonElement, 'focus')
    holder.auth.currentTenantId = 'other'
    await flushPromises()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(focus).not.toHaveBeenCalled()
  })
  it('leaves the mobile status filter in the shared filter sheet', async () => {
    isMobile.value = true
    const wrapper = setup(undefined, true)
    await flushPromises()
    expect(wrapper.find('[data-testid="supplier-status-filter"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="toolbar-mobile-actions-row"] [data-testid="create-supplier"]').text()).toBe('Crear proveedor')
    await wrapper.get('[data-testid="toolbar-filtros-button"]').trigger('click')
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"] [data-testid="supplier-status-filter"]')).not.toBeNull())
    const select = document.querySelector<HTMLElement>('[role="dialog"] [data-testid="supplier-status-filter"]')!
    expect(select.closest('[role="dialog"]')?.querySelector('select')).toBeNull()
    expect(select.parentElement?.querySelector('p')?.textContent).toBe('Estado')
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await vi.waitFor(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull())
    const all = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(option => option.textContent?.trim() === 'Todos')!
    all.focus()
    all.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(suppliersApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ALL' }), expect.any(AbortSignal))
    document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  })
  it('creates explicitly and reports acknowledgement even when the refresh fails', async () => {
    const wrapper = setup()
    await flushPromises()
    await wrapper.get('[data-testid="create-supplier"]').trigger('click')
    vi.mocked(suppliersApi.create).mockResolvedValue(supplier)
    vi.mocked(suppliersApi.list).mockRejectedValue(new Error('refresh failed'))
    wrapper.getComponent(SupplierForm).vm.$emit('save', { displayName: 'Centro', termsText: null, status: 'ACTIVE' })
    await flushPromises()
    expect(suppliersApi.create).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('guardado')
    expect(wrapper.text()).toContain('actualizar')
  })
  it('preserves edit buffer on conflict and requires explicit reload', async () => {
    const wrapper = setup()
    await flushPromises()
    await wrapper.get('[data-testid="supplier-detail"]').trigger('click')
    await flushPromises()
    await wrapper.get('[name="displayName"]').setValue('Local edit')
    vi.mocked(suppliersApi.update).mockRejectedValue({ response: { status: 409, data: { error: 'SUPPLIER_VERSION_CONFLICT' } } })
    await wrapper.get('form.supplier-form').trigger('submit')
    await flushPromises()
    expect((wrapper.get('[name="displayName"]').element as HTMLInputElement).value).toBe('Local edit')
    expect(wrapper.text()).toContain('otra sesión')
    expect(suppliersApi.update).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="reload-supplier"]').exists()).toBe(true)
    await wrapper.get('[data-testid="reload-supplier"]').trigger('click')
    await flushPromises()
    expect((wrapper.get('[name="displayName"]').element as HTMLInputElement).value).toBe('Centro')
    expect(wrapper.text()).not.toContain('otra sesión')
  })
  it('requires confirmation for archive and sends expected version, not delete', async () => {
    const wrapper = setup()
    await flushPromises()
    await chooseAction(wrapper, 'Archivar')
    expect(suppliersApi.update).not.toHaveBeenCalled()
    vi.mocked(suppliersApi.update).mockResolvedValue({ ...supplier, status: 'ARCHIVED', version: 2 })
    await wrapper.get('[data-testid="confirm-status"]').trigger('click')
    await flushPromises()
    expect(suppliersApi.update).toHaveBeenCalledWith(supplier.id, { expectedVersion: 1, changes: { status: 'ARCHIVED' } }, expect.any(String), expect.any(AbortSignal))
  })
  it('exposes no mutation controls to readers and closes private form on tenant change', async () => {
    const wrapper = setup(['read'])
    await flushPromises()
    expect(wrapper.find('[data-testid="create-supplier"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
    await wrapper.get('[data-testid="supplier-detail"]').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(SupplierForm).exists()).toBe(false)
    holder.auth.currentTenantId = 'other'
    await flushPromises()
    expect(wrapper.find('[data-testid="supplier-readonly"]').exists()).toBe(false)
  })
})

describe('supplier deletion', () => {
  const rejection = (status: number, error: string) => Object.assign(new Error(error), { response: { status, data: { error } } })
  it('offers Eliminar in the ⋮ menu only with read and delete, independently of update, on desktop and mobile cards', async () => {
    for (const mobile of [false, true]) {
      isMobile.value = mobile
      let wrapper = setup(['read', 'update'])
      await flushPromises()
      await menuTrigger(wrapper).trigger('click')
      await vi.waitFor(() => expect(menuItem('Archivar')).toBeDefined())
      expect(menuItem('Eliminar')).toBeUndefined()
      dispose.splice(0).forEach(fn => fn())
      document.body.innerHTML = ''
      wrapper = setup(['read', 'delete'])
      await flushPromises()
      expect(wrapper.find('[data-testid="supplier-delete"]').exists()).toBe(false)
      await menuTrigger(wrapper).trigger('click')
      await vi.waitFor(() => expect(menuItem('Eliminar')).toBeDefined())
      expect(menuItem('Archivar')).toBeUndefined()
      expect(menuItem('Editar')).toBeUndefined()
      dispose.splice(0).forEach(fn => fn())
      document.body.innerHTML = ''
    }
  })
  it('deletes only after explicit confirmation with the CAS version and an idempotency key, then refreshes', async () => {
    vi.mocked(suppliersApi.delete).mockResolvedValue(undefined)
    const wrapper = setup(['read', 'delete'])
    await flushPromises()
    await chooseAction(wrapper, 'Eliminar')
    expect(suppliersApi.delete).not.toHaveBeenCalled()
    // The overlay stub renders slots only; title/description fall through as attributes.
    const dialog = wrapper.get('section[title="Eliminar proveedor"]')
    expect(dialog.attributes('description')).toBe('Se eliminará permanentemente. Su historial de auditoría se conserva.')
    expect(dialog.text()).toContain('Centro')
    const confirm = wrapper.get('[data-testid="confirm-delete"]')
    expect(confirm.text()).toBe('Sí, eliminar')
    vi.mocked(suppliersApi.list).mockClear()
    await confirm.trigger('click')
    await flushPromises()
    expect(suppliersApi.delete).toHaveBeenCalledExactlyOnceWith('supplier-1', { expectedVersion: 1 }, expect.any(String), expect.any(AbortSignal))
    expect(suppliersApi.list).toHaveBeenCalled()
    expect(wrapper.get('[role="status"]').text()).toBe('Proveedor eliminado correctamente.')
    expect(wrapper.find('[data-testid="confirm-delete"]').exists()).toBe(false)
  })
  it('sends nothing when the deletion is cancelled', async () => {
    const wrapper = setup(['read', 'delete'])
    await flushPromises()
    await chooseAction(wrapper, 'Eliminar')
    await wrapper.get('[data-testid="cancel-delete"]').trigger('click')
    await flushPromises()
    expect(suppliersApi.delete).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="confirm-delete"]').exists()).toBe(false)
  })
  it.each([
    [409, 'SUPPLIER_HAS_PURCHASE_ORDERS', 'Este proveedor tiene órdenes de compra y no se puede eliminar. Puedes archivarlo.'],
    [404, 'NOT_FOUND', 'El proveedor ya no está disponible en esta sucursal.'],
    [409, 'SUPPLIER_VERSION_CONFLICT', 'El proveedor cambió en otra sesión. Cierra esta confirmación y vuelve a intentarlo con la versión actual.'],
  ])('keeps the confirmation open and reports %s %s without claiming success', async (status, code, message) => {
    vi.mocked(suppliersApi.delete).mockRejectedValue(rejection(status, code))
    const wrapper = setup(['read', 'delete'])
    await flushPromises()
    await chooseAction(wrapper, 'Eliminar')
    await wrapper.get('[data-testid="confirm-delete"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(message)
    expect(wrapper.text()).not.toContain('Proveedor eliminado correctamente.')
    expect(wrapper.get('[data-testid="confirm-delete"]').attributes('disabled')).toBeDefined()
  })
  it('recovers an uncertain deletion only explicitly, with the same key, then refreshes', async () => {
    vi.mocked(suppliersApi.delete).mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce(undefined)
    const wrapper = setup(['read', 'delete'])
    await flushPromises()
    await chooseAction(wrapper, 'Eliminar')
    await wrapper.get('[data-testid="confirm-delete"]').trigger('click')
    await flushPromises()
    expect(suppliersApi.delete).toHaveBeenCalledTimes(1)
    const recover = wrapper.findAll('button').find(button => button.text() === 'Recuperar resultado')!
    await recover.trigger('click')
    await flushPromises()
    const [first, second] = vi.mocked(suppliersApi.delete).mock.calls
    expect(second!.slice(0, 3)).toEqual(first!.slice(0, 3))
    expect(wrapper.get('[role="status"]').text()).toBe('Proveedor eliminado correctamente.')
  })
  it('moves focus to the supplier search after a successful deletion', async () => {
    vi.mocked(suppliersApi.delete).mockResolvedValue(undefined)
    const wrapper = setup(['read', 'delete'], true)
    await flushPromises()
    const trigger = menuTrigger(wrapper)
    trigger.element.focus()
    await chooseAction(wrapper, 'Eliminar')
    vi.mocked(suppliersApi.list).mockResolvedValue({ items: [], nextCursor: null })
    ;(document.querySelector('[data-testid="confirm-delete"]') as HTMLButtonElement).click()
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 50))
    await flushPromises()
    expect((document.activeElement as HTMLInputElement | null)?.placeholder).toBe('Buscar proveedor...')
  })
})
describe('supplier view empty, no-match and pager', () => {
  it('is nada todavía with an empty directory, and its create action opens the form', async () => {
    vi.mocked(suppliersApi.list).mockResolvedValue({ items: [], nextCursor: null })
    const wrapper = setup(['read', 'create'], true)
    await vi.waitFor(() => expect(wrapper.find('.hf-empty-state').exists()).toBe(true))
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.get('.hf-empty-state__title').text()).toBe('Aún no hay proveedores')
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[role="dialog"] [data-slot="title"]')?.textContent?.trim()).toBe('Crear proveedor')
  })

  it('offers no create action to a read-only role', async () => {
    vi.mocked(suppliersApi.list).mockResolvedValue({ items: [], nextCursor: null })
    const wrapper = setup(['read'], true)
    await vi.waitFor(() => expect(wrapper.find('.hf-empty-state').exists()).toBe(true))
    expect(wrapper.find('[data-testid="empty-state-action"]').exists()).toBe(false)
  })

  it('hides the pager when there is nothing to page', async () => {
    vi.mocked(suppliersApi.list).mockResolvedValue({ items: [], nextCursor: null })
    const wrapper = setup(['read'], true)
    await flushPromises()
    expect(wrapper.find('.supplier-pagination').exists()).toBe(false)
  })

  it('keeps the pager when another page exists', async () => {
    vi.mocked(suppliersApi.list).mockResolvedValue({ items: [supplier], nextCursor: 'next' })
    const wrapper = setup(['read'], true)
    await flushPromises()
    expect(wrapper.find('.supplier-pagination').exists()).toBe(true)
  })
})
