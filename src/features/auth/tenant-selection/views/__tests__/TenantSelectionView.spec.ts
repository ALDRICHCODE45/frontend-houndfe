// TenantSelectionView.spec.ts — one primary action ("Continuar"), the error
// and expired notices, and the sign-out escape hatch.

import { describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import TenantSelectionView from '../TenantSelectionView.vue'

const submit = vi.fn()
const cancel = vi.fn()
const error = ref<string | null>(null)
const route = reactive({ query: {} as Record<string, string> })
const store = reactive({
  user: { name: 'Ana Pérez', email: 'ana@houndfe.test' },
  isSuperAdmin: false,
})

vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => store }))
vi.mock('@/features/auth/tenant-selection/composables/useTenantSelection', () => ({
  useTenantSelection: () => ({
    tenants: ref([{ id: 't-1', slug: 'centro', name: 'Sucursal Centro', status: 'open' }]),
    isSubmitting: ref(false),
    error,
    submit,
    cancel,
  }),
}))

describe('TenantSelectionView', () => {
  it('gates Continuar on a highlighted branch and submits it', async () => {
    const wrapper = mountWithUApp(TenantSelectionView)
    const next = wrapper.get('[data-testid="tenant-continue"]')

    expect(next.attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="tenant-row"]').trigger('click')
    expect(next.attributes('disabled')).toBeUndefined()

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

  it('explains an expired temporary session', () => {
    route.query = { expired: 'tenant' }
    const wrapper = mountWithUApp(TenantSelectionView)

    expect(wrapper.text()).toContain('Tu sesión temporal expiró')
    route.query = {}
  })
})
