import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import DataTableFilters from '../DataTableFilters.vue'
import type { FilterDefinition } from '../types'

const mdAndUp = ref(true)

vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useBreakpoints: () => ({
      greaterOrEqual: () => mdAndUp,
    }),
  }
})

const urlSyncSpy = vi.fn()
vi.mock('@/core/shared/composables/useTableFiltersUrlSync', () => ({
  useTableFiltersUrlSync: (...args: unknown[]) => urlSyncSpy(...args),
}))

const schema: FilterDefinition[] = [
  {
    kind: 'multi-enum',
    id: 'paymentStatus',
    section: 'Estado',
    label: 'Estado',
    param: 'paymentStatus',
    options: [
      { label: 'Pagada', value: 'PAID' },
      { label: 'Parcial', value: 'PARTIAL' },
    ],
    max: 50,
  },
  {
    kind: 'multi-text',
    id: 'folio',
    section: 'Identificación',
    label: 'Folio',
    param: 'folio',
    max: 200,
  },
  {
    kind: 'number-range',
    id: 'total',
    section: 'Montos',
    label: 'Total',
    minParam: 'totalMin',
    maxParam: 'totalMax',
  },
]

function mountComponent(overrideProps: Record<string, unknown> = {}) {
  return mount(DataTableFilters, {
    props: {
      schema,
      modelValue: {
        paymentStatus: ['PAID'],
        folio: ['12'],
        totalMin: 100,
        totalMax: 200,
      },
      ...overrideProps,
    },
    global: {
      stubs: {
        USlideover: {
          props: ['open', 'side'],
          emits: ['update:open'],
          template: '<div :data-side="side"><slot name="content" /></div>',
        },
        Slideover: {
          props: ['open', 'side'],
          emits: ['update:open'],
          template: '<div :data-side="side"><slot name="content" /></div>',
        },
        UButton: {
          props: ['variant', 'size'],
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
        },
        Button: {
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
        },
        MultiSelectEnumFilter: {
          props: ['modelValue', 'error'],
          emits: ['update:modelValue'],
          template: '<div data-testid="enum-filter" />',
        },
        NumericRangeFilter: {
          props: ['modelValue', 'error'],
          emits: ['update:modelValue'],
          template: '<div data-testid="number-filter" />',
        },
        DateRangeFilter: true,
        MultiSelectAsyncFilter: true,
        MultiTextInputFilter: {
          props: ['modelValue', 'error'],
          emits: ['update:modelValue'],
          template: '<div data-testid="multi-text-filter" />',
        },
        DataTableFiltersChips: {
          props: ['chips'],
          emits: ['remove', 'clear'],
          template: '<div data-testid="chips" />',
        },
        UBadge: { template: '<span data-testid="active-filters-badge"><slot /></span>' },
        USeparator: { template: '<hr data-testid="separator" />' },
      },
    },
  })
}

describe('DataTableFilters', () => {
  beforeEach(() => {
    urlSyncSpy.mockClear()
  })

  it('renders slideover side right on md+ and bottom on mobile', async () => {
    mdAndUp.value = true
    const wrapper = mountComponent()
    expect(wrapper.find('[data-side="right"]').exists()).toBe(true)

    mdAndUp.value = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-side="bottom"]').exists()).toBe(true)
  })

  it('emits update:modelValue when clearing all filters', async () => {
    const wrapper = mountComponent()

    await wrapper.find('[data-testid="clear-filters"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual({
      paymentStatus: [],
      folio: [],
      totalMin: undefined,
      totalMax: undefined,
    })
  })

  it('renders schema sections in slideover body', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('Identificación')
    expect(wrapper.text()).toContain('Estado')
    expect(wrapper.text()).toContain('Montos')
  })

  it('shows active filter count badge and clear-all in slideover header only when active filters exist', async () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="active-filters-badge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="clear-all-inside"]').exists()).toBe(true)

    await wrapper.find('[data-testid="clear-all-inside"]').trigger('click')

    expect(wrapper.find('[data-testid="active-filters-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="clear-all-inside"]').exists()).toBe(false)
  })

  it('renders sticky layout containers for header/body/footer', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="filters-slideover-layout"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="filters-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="filters-body"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="filters-footer"]').exists()).toBe(true)
  })

  it('renders multi-text primitive for multi-text fields', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="multi-text-filter"]').exists()).toBe(true)
  })

  it('blocks inverted numeric range before emit', async () => {
    const wrapper = mountComponent({
      modelValue: { totalMin: 200, totalMax: 100, paymentStatus: [] },
    })

    await wrapper.find('[data-testid="apply-filters"]').trigger('click')

    expect(wrapper.find('[data-testid="validation-error-total"]').text()).toContain('invertido')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('blocks enum arrays larger than cap', async () => {
    const wrapper = mountComponent({
      modelValue: {
        paymentStatus: Array.from({ length: 51 }, (_, index) => `VALUE_${index}`),
        totalMin: undefined,
        totalMax: undefined,
      },
    })

    await wrapper.find('[data-testid="apply-filters"]').trigger('click')
    expect(wrapper.find('[data-testid="validation-error-paymentStatus"]').text()).toContain('50')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('wires URL sync internally', () => {
    const wrapper = mountComponent()
    expect(wrapper.exists()).toBe(true)
    expect(urlSyncSpy).toHaveBeenCalledTimes(1)
  })
})
