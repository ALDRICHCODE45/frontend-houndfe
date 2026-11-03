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
afterEach(() => dispose.splice(0).forEach(fn => fn()))

describe('supplier screen integration', () => {
  it('keeps Estado in shared filters and matches the canonical desktop toolbar regions', async () => {
    const wrapper = setup()
    await flushPromises()
    const toolbar = wrapper.getComponent(DataTableToolbar)
    expect(toolbar.get('.hf-toolbar-filters select').element).toBe(wrapper.get('select').element)
    expect(toolbar.get('.hf-toolbar-search-region input').attributes('placeholder')).toBe('Buscar proveedor...')
    expect(toolbar.get('.hf-toolbar-actions [data-testid="create-supplier"]').text()).toBe('Crear proveedor')

    // Public presentation contract: the same desktop grid as payment-details.
    // jsdom does not apply media queries, so inspect the shipped stylesheet rules.
    const style = document.createElement('style')
    style.textContent = suppliersCss.replace(/@import[^;]+;/g, '')
    document.head.append(style)
    try {
      const desktop = Array.from(style.sheet!.cssRules).find(rule => rule.type === CSSRule.MEDIA_RULE && (rule as CSSMediaRule).media.mediaText === '(min-width: 768px)') as CSSMediaRule | undefined
      expect(desktop, 'supplier toolbar must ship the canonical desktop layout').toBeDefined()
      const rules = Array.from(desktop!.cssRules) as CSSStyleRule[]
      const region = (selector: string) => rules.find(rule => rule.selectorText === `.suppliers-page ${selector}`)?.style
      expect(region('.hf-toolbar')?.getPropertyValue('grid-template-columns')).toBe('minmax(0, 1fr) auto')
      expect(region('.hf-toolbar-search-region')?.display).toBe('contents')
      expect(region('.hf-toolbar-search')?.getPropertyValue('grid-area')).toBe('1 / 1')
      expect(region('.hf-toolbar-search')?.getPropertyValue('max-width')).toBe('26rem')
      expect(region('.hf-toolbar-actions')?.getPropertyValue('grid-area')).toBe('1 / 2')
      expect(region('.hf-toolbar-filters')?.getPropertyValue('grid-area')).toBe('2 / 1 / 3 / -1')
    } finally {
      style.remove()
    }
  })
  it.each([
    { mobile: false, trigger: 'supplier-detail', overlay: 'detalle' },
    { mobile: true, trigger: 'supplier-detail', overlay: 'detalle' },
    { mobile: false, trigger: 'supplier-status', overlay: 'confirmación' },
    { mobile: true, trigger: 'supplier-status', overlay: 'confirmación' },
    { mobile: false, trigger: 'create-supplier', overlay: 'creación' },
  ])('returns focus after Escape from $overlay (mobile=$mobile)', async ({ mobile, trigger }) => {
    isMobile.value = mobile
    const wrapper = setup(undefined, true)
    await flushPromises()
    let resolveDetail: ((value: typeof supplier) => void) | undefined
    if (trigger === 'supplier-detail') {
      vi.mocked(suppliersApi.get).mockReturnValue(new Promise(resolve => { resolveDetail = resolve }))
    }
    const button = wrapper.get(`[data-testid="${trigger}"]`)
    ;(button.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(button.element)
    // Native keyboard activation dispatches a click; jsdom does not synthesize it.
    await button.trigger('keydown', { key: 'Enter' })
    await button.trigger('click')
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
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.get('[data-testid="toolbar-mobile-actions-row"] [data-testid="create-supplier"]').text()).toBe('Crear proveedor')
    await wrapper.get('[data-testid="toolbar-filtros-button"]').trigger('click')
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"] select')).not.toBeNull())
    const select = document.querySelector<HTMLSelectElement>('[role="dialog"] select')!
    expect(select.closest('label')?.textContent).toContain('Estado')
    select.value = 'ALL'
    select.dispatchEvent(new Event('change', { bubbles: true }))
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
    await wrapper.get('[data-testid="supplier-status"]').trigger('click')
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
    expect(wrapper.find('[data-testid="supplier-status"]').exists()).toBe(false)
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
  it('shows Eliminar only with read and delete, independently of update, on desktop and mobile cards', async () => {
    for (const mobile of [false, true]) {
      isMobile.value = mobile
      let wrapper = setup(['read', 'update'])
      await flushPromises()
      expect(wrapper.find('[data-testid="supplier-delete"]').exists()).toBe(false)
      wrapper = setup(['read', 'delete'])
      await flushPromises()
      const action = wrapper.get('[data-testid="supplier-delete"]')
      expect(action.text()).toBe('Eliminar')
      expect(action.attributes('aria-label')).toBe('Eliminar Centro')
      expect(wrapper.find('[data-testid="supplier-status"]').exists()).toBe(false)
      dispose.splice(0).forEach(fn => fn())
    }
  })
  it('deletes only after explicit confirmation with the CAS version and an idempotency key, then refreshes', async () => {
    vi.mocked(suppliersApi.delete).mockResolvedValue(undefined)
    const wrapper = setup(['read', 'delete'])
    await flushPromises()
    await wrapper.get('[data-testid="supplier-delete"]').trigger('click')
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
    await wrapper.get('[data-testid="supplier-delete"]').trigger('click')
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
    await wrapper.get('[data-testid="supplier-delete"]').trigger('click')
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
    await wrapper.get('[data-testid="supplier-delete"]').trigger('click')
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
    const trigger = wrapper.get<HTMLButtonElement>('[data-testid="supplier-delete"]')
    trigger.element.focus()
    await trigger.trigger('click')
    await flushPromises()
    vi.mocked(suppliersApi.list).mockResolvedValue({ items: [], nextCursor: null })
    ;(document.querySelector('[data-testid="confirm-delete"]') as HTMLButtonElement).click()
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 50))
    await flushPromises()
    expect((document.activeElement as HTMLInputElement | null)?.placeholder).toBe('Buscar proveedor...')
  })
})
