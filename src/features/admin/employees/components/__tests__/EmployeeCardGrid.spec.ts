import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import EmployeeCardGrid from '../EmployeeCardGrid.vue'
import EmployeeCard from '../EmployeeCard.vue'
import type { Employee } from '../../interfaces/employee.types'

vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: {
    name: 'EntityAvatar',
    template: '<div data-testid="entity-avatar" />',
    props: ['name', 'seed', 'showDot', 'dotClass', 'size'],
  },
}))

const UIconStub = defineComponent({
  name: 'UIcon',
  props: ['name'],
  template: '<span aria-hidden="true" />',
})

vi.mock('@nuxt/ui/components/Icon.vue', () => ({
  default: {
    name: 'UIcon',
    template: '<span aria-hidden="true" />',
    props: ['name'],
  },
}))

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    employeeNumber: 'EMP-001',
    fullName: 'Ana García López',
    email: 'ana@hound.com',
    status: 'ACTIVE',
    terminationDate: null,
    contractType: 'PERMANENT',
    workModality: 'HYBRID',
    currentPosition: 'Desarrolladora Frontend',
    currentDepartment: 'Ingeniería',
    managerId: null,
    hireDate: '2024-01-15',
    photoFileId: null,
    cvFileId: null,
    ...overrides,
  } as Employee
}

// ── S4: available-width grid containment ───────────────────────────────────
describe('EmployeeCardGrid available-width containment (S4)', () => {
  // S4 pilot convention (design §4): the nested list width — not the
  // viewport — decides the column count. The exact sm/lg/xl/2xl ladder is
  // intentionally retired for this grid.
  const availableWidthClasses = [
    'grid',
    'gap-3',
    'w-full',
    'min-w-0',
    'max-w-full',
    'grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]',
  ]

  function mountGrid(overrides: Record<string, unknown> = {}) {
    return mount(EmployeeCardGrid, {
      props: {
        employees: [] as Employee[],
        managerMap: new Map(),
        ...overrides,
      },
      global: { stubs: { UIcon: UIconStub } },
    })
  }

  it('uses the available-width auto-fit grid contract on both skeleton and card states', () => {
    const cardsGrid = mountGrid({ employees: [makeEmployee({ id: 'a' })] }).get(
      '[data-testid="card-grid"]',
    )
    expect(cardsGrid.classes()).toEqual(expect.arrayContaining(availableWidthClasses))
    expect(cardsGrid.classes()).not.toContain('sm:grid-cols-2')
    expect(cardsGrid.classes()).not.toContain('2xl:grid-cols-7')

    // Skeleton mirrors the cards contract so layout doesn't jump when the
    // cards arrive.
    const skeletonGrid = mountGrid({ employees: [], loading: true }).get(
      '[data-testid="card-grid-skeleton"]',
    )
    expect(skeletonGrid.classes()).toEqual(expect.arrayContaining(availableWidthClasses))
    expect(skeletonGrid.classes()).not.toContain('xl:grid-cols-5')
  })

  it('contains the empty state to the available width without a horizontal scroll class', () => {
    const emptyRoot = mountGrid({ employees: [], empty: 'Sin colaboradores' }).get(
      '[data-testid="card-grid-empty"]',
    )

    expect(emptyRoot.classes()).toEqual(expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full']))
    expect(emptyRoot.classes()).not.toContain('overflow-x-auto')
    expect(emptyRoot.text()).toContain('Sin colaboradores')
  })

  it('keeps long employee names inside the available-width grid without scroll classes', () => {
    const longEmployee = makeEmployee({
      id: 'long',
      fullName: 'María Fernanda de los Ángeles Guadalupe Contreras-Montenegro Salazar',
    })
    const grid = mountGrid({ employees: [longEmployee] }).get('[data-testid="card-grid"]')

    expect(grid.text()).toContain('María Fernanda de los Ángeles')
    expect(grid.classes()).not.toContain('overflow-x-auto')
  })
})

describe('EmployeeCardGrid', () => {
  it('renders one card per employee', () => {
    const wrapper = mount(EmployeeCardGrid, {
      props: {
        managerMap: new Map(),
        employees: [makeEmployee({ id: 'a' }), makeEmployee({ id: 'b' })],
      },
      global: { stubs: { UIcon: UIconStub } },
    })
    expect(wrapper.findAll('article').length).toBe(2)
  })

  it('shows 8 skeleton placeholders when loading', () => {
    const wrapper = mount(EmployeeCardGrid, {
      props: {
        managerMap: new Map(),
        employees: [],
        loading: true,
      },
      global: { stubs: { UIcon: UIconStub } },
    })
    const skeleton = wrapper.find('[data-testid="card-grid-skeleton"]')
    expect(skeleton.exists()).toBe(true)
    expect(skeleton.findAll('[data-testid="card-skeleton"]').length).toBe(8)
  })

  it('shows the empty state with an icon and message when there are no employees', () => {
    const wrapper = mount(EmployeeCardGrid, {
      props: {
        managerMap: new Map(),
        employees: [],
        empty: 'No se encontraron colaboradores',
      },
      global: { stubs: { UIcon: UIconStub } },
    })
    expect(wrapper.text()).toContain('No se encontraron colaboradores')
    expect(wrapper.find('[data-testid="card-grid-empty"]').exists()).toBe(true)
  })

  it('falls back to the default empty message when none is provided', () => {
    const wrapper = mount(EmployeeCardGrid, {
      props: {
        managerMap: new Map(), employees: [] },
      global: { stubs: { UIcon: UIconStub } },
    })
    expect(wrapper.text()).toContain('No se encontraron colaboradores')
  })

  it('forwards card-click to the parent', async () => {
    const employee = makeEmployee({ id: 'a' })
    const wrapper = mount(EmployeeCardGrid, {
      props: { employees: [employee], managerMap: new Map() },
      global: { stubs: { UIcon: UIconStub } },
    })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('card-click')?.[0]?.[0]).toEqual(employee)
  })

  it('forwards edit/terminate/reactivate from a card exactly once each', () => {
    const employee = makeEmployee({ id: 'a' })
    const wrapper = mount(EmployeeCardGrid, {
      props: { employees: [employee], managerMap: new Map(), canUpdate: true },
      global: { stubs: { UIcon: UIconStub } },
    })
    const card = wrapper.getComponent(EmployeeCard)
    card.vm.$emit('edit', employee)
    card.vm.$emit('terminate', employee)
    card.vm.$emit('reactivate', employee)
    expect(wrapper.emitted('edit')?.length).toBe(1)
    expect(wrapper.emitted('terminate')?.length).toBe(1)
    expect(wrapper.emitted('reactivate')?.length).toBe(1)
    expect(wrapper.emitted('edit')?.[0]?.[0]).toEqual(employee)
    expect(wrapper.emitted('terminate')?.[0]?.[0]).toEqual(employee)
    expect(wrapper.emitted('reactivate')?.[0]?.[0]).toEqual(employee)
  })

  it('forwards canUpdate to the inner EmployeeCard', () => {
    const employee = makeEmployee({ id: 'a' })
    const wrapper = mount(EmployeeCardGrid, {
      props: { employees: [employee], managerMap: new Map(), canUpdate: true },
      global: { stubs: { UIcon: UIconStub } },
    })
    const card = wrapper.getComponent(EmployeeCard)
    expect(card.props('canUpdate')).toBe(true)
  })

  // ── S4 triangulate: state precedence and manager resolution ────────────

  it('shows the skeleton when loading even with employees present', () => {
    const wrapper = mount(EmployeeCardGrid, {
      props: {
        managerMap: new Map(), employees: [makeEmployee({ id: 'a' })], loading: true },
      global: { stubs: { UIcon: UIconStub } },
    })
    expect(wrapper.find('[data-testid="card-grid-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="card-grid"]').exists()).toBe(false)
  })

  it('resolves manager display through the manager map (— fallback when absent)', () => {
    const employee = makeEmployee({ id: 'a', managerId: 'mgr-1' })
    const wrapper = mount(EmployeeCardGrid, {
      props: { employees: [employee], managerMap: new Map() },
      global: { stubs: { UIcon: UIconStub } },
    })
    const card = wrapper.getComponent(EmployeeCard)
    expect(card.props('managerDisplay')).toBe('—')
  })
})
