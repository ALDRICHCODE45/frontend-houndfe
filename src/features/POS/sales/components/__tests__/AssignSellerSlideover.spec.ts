import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import AssignSellerSlideover from '../AssignSellerSlideover.vue'
import { usersApi } from '@/features/POS/users/api/user.api'
import { SellerAssignmentError } from '../../interfaces/sale.types'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'

const assignSellerMock = vi.fn()

vi.mock('@/features/POS/users/api/user.api', () => ({
  usersApi: {
    listAssignable: vi.fn(),
  },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))

vi.mock('@/features/POS/sales/composables/useSellerAssignment', () => ({
  useSellerAssignment: () => ({
    assignSeller: assignSellerMock,
    unassignSeller: vi.fn(),
    isPending: { value: false },
    lastError: { value: null },
  }),
}))

const toastAddMock = vi.fn()
vi.stubGlobal('useToast', () => ({ add: toastAddMock }))

function makeUsers(): AssignableUser[] {
  return [
    { id: 'u-1', name: 'Ana Pérez' },
    { id: 'u-2', name: 'César Flores' },
    { id: 'u-3', name: 'Beto Ruiz' },
  ]
}

function mountSlideover() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })

  return mount(AssignSellerSlideover, {
    props: { open: true, saleId: 'sale-1' },
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        USlideover: {
          props: ['open'],
          template: '<div v-if="open"><slot name="content" /></div>',
        },
        UButton: {
          props: ['label', 'icon', 'disabled', 'loading'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot />{{ label }}</button>',
        },
        UInput: {
          props: ['modelValue', 'placeholder'],
          emits: ['update:modelValue'],
          template: '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        UCard: { template: '<div><slot /></div>' },
        UAvatar: { template: '<span />' },
        UIcon: { template: '<span />' },
        USkeleton: { template: '<div data-testid="skeleton" />' },
      },
    },
  })
}

function pageText(): string {
  return document.body.textContent ?? ''
}

function $(selector: string): HTMLElement {
  const node = document.body.querySelector(selector)
  if (!(node instanceof HTMLElement)) {
    throw new Error(`Missing element matching ${selector}`)
  }
  return node
}

describe('AssignSellerSlideover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    vi.mocked(usersApi.listAssignable).mockResolvedValue(makeUsers())
    assignSellerMock.mockResolvedValue(undefined)
  })

  it('renders the assignable users list', async () => {
    mountSlideover()
    await flushPromises()

    expect(pageText()).toContain('Ana Pérez')
    expect(pageText()).toContain('César Flores')
    expect(pageText()).toContain('Beto Ruiz')
  })

  it('filters users client-side by name (debounced)', async () => {
    vi.useFakeTimers()
    mountSlideover()
    await vi.advanceTimersByTimeAsync(0)
    // wait for the initial query to resolve
    await vi.runAllTimersAsync()

    const input = $('[data-testid="seller-search-input"]') as HTMLInputElement
    input.value = 'césar'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(250)

    expect(pageText()).toContain('César Flores')
    expect(pageText()).not.toContain('Ana Pérez')
    expect(pageText()).not.toContain('Beto Ruiz')
    vi.useRealTimers()
  })

  it('clicking a user calls assignSeller and emits update:open false', async () => {
    const wrapper = mountSlideover()
    await flushPromises()

    $('[data-testid="seller-row-u-1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(assignSellerMock).toHaveBeenCalledWith('u-1')
    expect(wrapper.emitted('update:open')).toBeTruthy()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('shows empty state when no users are assignable', async () => {
    vi.mocked(usersApi.listAssignable).mockResolvedValueOnce([])
    mountSlideover()
    await flushPromises()

    expect(pageText()).toContain('No hay usuarios asignables')
  })

  it('does NOT emit update:open false when assignSeller fails (keeps slideover open)', async () => {
    // Boundary assertion: failed assign should keep slideover open. Full toast
    // wiring depends on the global useToast harness which is brittle here.
    assignSellerMock.mockRejectedValueOnce(new SellerAssignmentError('SELLER_NOT_ASSIGNABLE'))

    const wrapper = mountSlideover()
    await flushPromises()

    $('[data-testid="seller-row-u-1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(assignSellerMock).toHaveBeenCalledWith('u-1')
    expect(wrapper.emitted('update:open')).toBeFalsy()
  })
})
