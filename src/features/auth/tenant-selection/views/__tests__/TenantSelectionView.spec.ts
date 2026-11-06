// TenantSelectionView.spec.ts — one primary action ("Continuar"), the error
// and expired notices, and the sign-out escape hatch.

import { describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import TenantSelectionView from '../TenantSelectionView.vue'

const submit = vi.fn()
const cancel = vi.fn()
const error = ref<string | null>(null)
const tenants = ref([{ id: 't-1', slug: 'centro', name: 'Sucursal Centro', status: 'open' }])
const route = reactive({ query: {} as Record<string, string> })
const store = reactive({
  user: { name: 'Ana Pérez', email: 'ana@houndfe.test' } as { name: string; email: string } | null,
  isSuperAdmin: false,
  isAuthenticated: true,
  tempToken: null as string | null,
})

vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => store }))
vi.mock('@/features/auth/tenant-selection/composables/useTenantSelection', () => ({
  useTenantSelection: () => ({
    tenants,
    isSubmitting: ref(false),
    error,
    submit,
    cancel,
  }),
}))

describe('TenantSelectionView', () => {
  it('gates Continuar on a highlighted branch and submits it', async () => {
    tenants.value = [
      { id: 't-1', slug: 'centro', name: 'Sucursal Centro', status: 'open' },
      { id: 't-2', slug: 'norte', name: 'Sucursal Norte', status: 'open' },
    ]
    const wrapper = mountWithUApp(TenantSelectionView)
    const next = wrapper.get('[data-testid="tenant-continue"]')

    expect(next.attributes('disabled')).toBeDefined()

    await wrapper.findAll('[data-testid="tenant-row"]')[1]!.trigger('click')
    expect(next.attributes('disabled')).toBeUndefined()

    await next.trigger('click')
    expect(submit).toHaveBeenCalledWith('t-2')
    tenants.value = [{ id: 't-1', slug: 'centro', name: 'Sucursal Centro', status: 'open' }]
  })

  it('with a single branch it is already chosen and Continuar is ready as the primary', async () => {
    submit.mockClear()
    const wrapper = mountWithUApp(TenantSelectionView)
    await wrapper.vm.$nextTick()
    const next = wrapper.get('[data-testid="tenant-continue"]')

    expect(wrapper.get('[data-testid="tenant-row"]').attributes('data-selected')).toBe('true')
    expect(next.attributes('disabled')).toBeUndefined()
    expect(next.classes()).toContain('hf-primary-control')
    await next.trigger('click')
    expect(submit).toHaveBeenCalledWith('t-1')
  })

  it('keeps a single solid primary and a ghost sign-out', async () => {
    const wrapper = mountWithUApp(TenantSelectionView)

    expect(wrapper.get('h1').text()).toBe('Selecciona tu sucursal')
    expect(wrapper.text()).not.toContain('Puedes cambiarla más tarde')
    expect(wrapper.html()).not.toContain('uppercase')
    await wrapper.findAll('button').find((b) => b.text().includes('Cerrar sesión'))!.trigger('click')
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('shows the submit error in an alert', () => {
    error.value = 'Error al seleccionar sucursal'
    const wrapper = mountWithUApp(TenantSelectionView)

    expect(wrapper.text()).toContain('Error al seleccionar sucursal')
    error.value = null
  })

  it('after a failed selection that ended the session it only explains it and offers to sign in again', async () => {
    cancel.mockClear()
    tenants.value = [
      { id: 't-1', slug: 'centro', name: 'Sucursal Centro', status: 'open' },
      { id: 't-2', slug: 'norte', name: 'Sucursal Norte', status: 'open' },
    ]
    const wrapper = mountWithUApp(TenantSelectionView)
    await wrapper.findAll('[data-testid="tenant-row"]')[0]!.trigger('click')

    // The store clears the session on a 5xx or network failure.
    store.isAuthenticated = false
    store.user = null
    tenants.value = []
    error.value = 'No pudimos abrir la sucursal.'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('No pudimos abrir la sucursal.')
    expect(wrapper.text()).toContain('Tu sesión se cerró. Inicia sesión de nuevo para continuar.')
    expect(wrapper.text()).toContain('Hola, Ana Pérez')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-continue"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Cerrar sesión')
    await wrapper.findAll('button').find((b) => b.text().includes('Iniciar sesión de nuevo'))!.trigger('click')
    expect(cancel).toHaveBeenCalledTimes(1)

    store.isAuthenticated = true
    store.user = { name: 'Ana Pérez', email: 'ana@houndfe.test' }
    tenants.value = [{ id: 't-1', slug: 'centro', name: 'Sucursal Centro', status: 'open' }]
    error.value = null
  })

  it('explains an expired temporary session', () => {
    route.query = { expired: 'tenant' }
    const wrapper = mountWithUApp(TenantSelectionView)

    expect(wrapper.text()).toContain('Tu sesión temporal expiró')
    route.query = {}
  })
})
