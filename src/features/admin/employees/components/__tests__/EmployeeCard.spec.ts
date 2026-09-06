import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EmployeeCard from '../EmployeeCard.vue'
import type { Employee } from '../../interfaces/employee.types'

// Typed helper: the kebab exposes its action list as the UDropdownMenu PUBLIC
// `items` prop. Stubs are routed through @nuxt/ui/components/* (the auto-import
// path used by the template) so we never inspect Reka UI internals or closed-
// dropdown text.
interface KebabItem {
  label: string
  color?: string
  onSelect?: () => void
}

vi.mock('@nuxt/ui/components/DropdownMenu.vue', () => ({
  default: { name: 'UDropdownMenu', template: '<div data-testid="kebab-menu-stub"><slot /></div>', props: ['items', 'content'], emits: ['select'] },
}))
vi.mock('@nuxt/ui/components/Button.vue', () => ({
  default: { name: 'UButton', template: '<button v-bind="$attrs"><slot /></button>', props: ['icon', 'color', 'variant'], emits: ['click'] },
}))
vi.mock('@nuxt/ui/components/Icon.vue', () => ({
  default: { name: 'UIcon', template: '<span aria-hidden="true" />', props: ['name'] },
}))

vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: {
    name: 'EntityAvatar',
    template: '<div :data-seed="seed" :data-name="name" data-testid="entity-avatar" />',
    props: ['name', 'seed', 'showDot', 'dotClass', 'size'],
  },
}))

vi.mock('@/core/shared/components/DotBadge.vue', () => ({
  default: {
    name: 'DotBadge',
    template: '<span data-testid="dot-badge">{{ label }}</span>',
    props: ['label', 'dotClass', 'badgeClass', 'truncate', 'compact'],
  },
}))

vi.mock('@/core/shared/components/StatusDotBadge.vue', () => ({
  default: {
    name: 'StatusDotBadge',
    template: '<span data-testid="status-dot-badge">{{ label }}</span>',
    props: ['label', 'tone', 'compact', 'ariaLabel', 'ariaPrefix'],
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

function mountCard(props: {
  employee: Employee
  managerDisplay?: string
  canUpdate?: boolean
}) {
  return mount(EmployeeCard, {
    props: { managerDisplay: '—', ...props },
  })
}

function getKebabItems(wrapper: ReturnType<typeof mount>): KebabItem[] {
  const dropdown = wrapper.findComponent({ name: 'UDropdownMenu' })
  return ((dropdown.props('items') as KebabItem[] | undefined) ?? []).flat()
}

// ── S4: card shrink containment ─────────────────────────────────────────────
describe('EmployeeCard shrink containment (S4)', () => {
  it('keeps the card root shrinkable within its grid track', () => {
    const wrapper = mountCard({ employee: makeEmployee() })
    const card = wrapper.get('article')

    expect(card.classes()).toEqual(expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full']))
    // Card mode must never become its own horizontal scroll container.
    expect(card.classes()).not.toContain('overflow-x-auto')
  })

  it('constrains the department/status chip row within the shrinkable card', () => {
    const wrapper = mountCard({
      employee: makeEmployee({ currentDepartment: 'Recursos Humanos' }),
    })

    // The chip row stays within the shrinkable card; the department badge
    // truncates rather than widening the row.
    const chipRow = wrapper.get('[data-testid="card-chip-row"]')
    expect(chipRow.classes()).toEqual(expect.arrayContaining(['min-w-0', 'max-w-full']))

    const departmentBadge = wrapper.get('[data-testid="dot-badge"]')
    expect(departmentBadge.text()).toContain('Recursos Humanos')
  })

  it('truncates modality and seniority values within their cells', () => {
    const wrapper = mountCard({ employee: makeEmployee() })
    const paragraphs = wrapper.get('article').findAll('p')

    // Field-specific truncation contracts (design §5): modality and
    // seniority truncate inside their two-column metadata cells.
    const modalityParagraph = paragraphs.find((p) => p.text() === 'Híbrido')
    const seniorityParagraph = paragraphs.find((p) => p.classes().includes('font-semibold'))
    expect(modalityParagraph).toBeDefined()
    expect(modalityParagraph!.classes()).toContain('truncate')
    expect(seniorityParagraph).toBeDefined()
    expect(seniorityParagraph!.classes()).toContain('truncate')
  })

  it('keeps name/position/manager/date truncation contracts beside a pinned propagation-guarded kebab', () => {
    const wrapper = mountCard({ employee: makeEmployee(), canUpdate: true })
    const card = wrapper.get('article')
    const paragraphs = card.findAll('p')

    // Field-specific truncation contracts (design §5): name truncates,
    // position is single-line clamped, manager and date truncate in their cells.
    expect(paragraphs.some((p) => p.classes().includes('truncate') && p.classes().includes('font-semibold'))).toBe(true)
    expect(paragraphs.some((p) => p.classes().includes('line-clamp-1'))).toBe(true)
    expect(paragraphs.filter((p) => p.classes().includes('truncate')).length).toBeGreaterThanOrEqual(4)

    const kebab = wrapper.get('[data-testid="kebab-wrapper"]')
    expect(Array.from(kebab.classes())).toEqual(
      expect.arrayContaining(['absolute', 'right-3', 'top-3', 'z-10']),
    )
  })
})

// ── S4: long-content triangulation ─────────────────────────────────────────
describe('EmployeeCard long-content rendering (S4 triangulate)', () => {
  it('renders long name/position/department/manager/modality values inside the shrinkable card without scroll classes', () => {
    const wrapper = mountCard({
      employee: makeEmployee({
        fullName: 'José Eduardo de Jesús Ramírez-Salazar de la Torre y Fuentes',
        currentPosition: 'Coordinadora Senior de Operaciones Logísticas Internacionales',
        currentDepartment: 'Administración y Finanzas Corporativas Regionales',
        managerId: 'mgr-1',
        workModality: 'HYBRID',
      }),
      managerDisplay: 'Ing. Alejandro Vega-Montenegro de los Ríos',
      canUpdate: true,
    })
    const card = wrapper.get('article')

    // Long values remain readable inside field-specific truncation —
    // never asserted as jsdom geometry.
    expect(card.text()).toContain('José Eduardo de Jesús')
    expect(card.text()).toContain('Coordinadora Senior de Operaciones')
    expect(card.text()).toContain('Administración y Finanzas Corporativas')
    expect(card.text()).toContain('Alejandro Vega-Montenegro')
    expect(card.text()).toContain('Híbrido')
    expect(card.classes()).not.toContain('overflow-x-auto')

    // The kebab stays absolutely pinned and actionable beside long content.
    const kebab = wrapper.get('[data-testid="kebab-wrapper"]')
    expect(kebab.classes()).toContain('absolute')
  })
})

describe('EmployeeCard', () => {
  it('renders fullName, position, department, and modality', () => {
    const wrapper = mountCard({ employee: makeEmployee() })
    expect(wrapper.text()).toContain('Ana García López')
    expect(wrapper.text()).toContain('Desarrolladora Frontend')
    expect(wrapper.text()).toContain('Ingeniería')
    expect(wrapper.text()).toContain('Híbrido')
  })

  it('passes the employee id to EntityAvatar as seed', () => {
    const wrapper = mountCard({ employee: makeEmployee({ id: 'emp-42' }) })
    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('data-seed')).toBe('emp-42')
    expect(avatar.attributes('data-name')).toBe('Ana García López')
  })

  it('renders the semantic status label through StatusDotBadge', () => {
    const wrapper = mountCard({ employee: makeEmployee({ status: 'ON_LEAVE' }) })
    const badge = wrapper.get('[data-testid="status-dot-badge"]')
    expect(badge.text()).toContain('Licencia')
  })

  it('emits click with the employee when the article is clicked', async () => {
    const employee = makeEmployee()
    const wrapper = mountCard({ employee })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual(employee)
  })

  it('hides the kebab when canUpdate is false', () => {
    const wrapper = mountCard({ employee: makeEmployee(), canUpdate: false })
    expect(wrapper.findComponent({ name: 'UDropdownMenu' }).exists()).toBe(false)
  })

  it('shows the kebab when canUpdate is true', () => {
    const wrapper = mountCard({ employee: makeEmployee(), canUpdate: true })
    expect(wrapper.findComponent({ name: 'UDropdownMenu' }).exists()).toBe(true)
  })

  it('offers Editar + Dar de baja for an active employee when canUpdate is true', () => {
    const wrapper = mountCard({ employee: makeEmployee({ status: 'ACTIVE' }), canUpdate: true })
    expect(getKebabItems(wrapper).map((i) => i.label)).toEqual(['Editar', 'Dar de baja'])
  })

  it('offers Editar + Reactivar for a terminated employee when canUpdate is true', () => {
    const wrapper = mountCard({
      employee: makeEmployee({ status: 'TERMINATED' }),
      canUpdate: true,
    })
    const items = getKebabItems(wrapper)
    expect(items.map((i) => i.label)).toEqual(['Editar', 'Reactivar'])
    expect(items.some((i) => i.color === 'error')).toBe(false)
  })

  it('invoking the edit onSelect emits edit exactly with [[employee]]', async () => {
    const employee = makeEmployee()
    const wrapper = mountCard({ employee, canUpdate: true })
    const edit = getKebabItems(wrapper).find((i) => i.label === 'Editar')
    expect(edit?.onSelect).toBeDefined()
    edit!.onSelect!()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('edit')).toEqual([[employee]])
  })

  it('clicking the kebab wrapper stops propagation and does not emit card click', async () => {
    const wrapper = mountCard({ employee: makeEmployee(), canUpdate: true })
    await wrapper.find('[data-testid="kebab-wrapper"]').trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  // ── S4 triangulate: badge constraints, seniority, fallbacks ────────────────

  it('constrains the department label through DotBadge truncate/compact props', () => {
    const wrapper = mountCard({
      employee: makeEmployee({ currentDepartment: 'Tecnología' }),
    })
    const badge = wrapper.findComponent({ name: 'DotBadge' })
    expect(badge.exists()).toBe(true)
    // The label truncates inside the badge shell rather than widening it.
    expect(badge.props('truncate')).toBe(true)
    expect(badge.props('compact')).toBe(true)
  })

  it('renders a long department label inside the contained chip row without scroll classes', () => {
    const wrapper = mountCard({
      employee: makeEmployee({
        currentDepartment: 'Administración y Finanzas Corporativas Regionales',
      }),
    })
    const chipRow = wrapper.get('[data-testid="card-chip-row"]')
    expect(chipRow.text()).toContain('Administración y Finanzas Corporativas')
    expect(chipRow.classes()).not.toContain('overflow-x-auto')
  })

  it('renders seniority for a hire date and the em-dash manager fallback without breaking containment', () => {
    const wrapper = mountCard({
      employee: makeEmployee({ hireDate: '2020-03-01' }),
      managerDisplay: '—',
    })
    const card = wrapper.get('article')
    expect(card.text()).toContain('Antigüedad')
    expect(card.text()).toContain('Jefe directo')
    expect(card.text()).toContain('—')
    expect(card.text()).toContain('Fecha de ingreso')
    expect(card.classes()).not.toContain('overflow-x-auto')
  })
})
