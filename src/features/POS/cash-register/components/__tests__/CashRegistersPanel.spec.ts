/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashRegistersPanel (S10): the four list states, permission-gated row actions
// in the ⋮ menu and the create contract, on the shared table and cards.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import { ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashRegistersPanel from '../CashRegistersPanel.vue'

const isMobile = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isMobile }) }
})

const REGISTERS = [
  { id: 'r-1', name: 'Caja principal', isActive: true, createdAt: '2026-10-01T00:00:00.000Z' },
  { id: 'r-2', name: 'Caja secundaria', isActive: false, createdAt: '2026-10-02T00:00:00.000Z' },
]

const tick = () => new Promise((resolve) => setTimeout(resolve, 50))
const menuLabels = () =>
  Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) =>
    (item.textContent ?? '').trim(),
  )

function mountPanel(props = {}) {
  return mountWithUApp(CashRegistersPanel, {
    attachTo: document.body,
    props: { registers: REGISTERS, ...props },
  })
}

async function openMenu(wrapper, index = 0) {
  await wrapper.findAll('button[aria-haspopup="menu"]')[index].trigger('click')
  await tick()
}

async function chooseItem(label) {
  const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
    (node) => (node.textContent ?? '').trim() === label,
  )
  expect(item, `menu item ${label}`).toBeDefined()
  item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await tick()
}

enableAutoUnmount(afterEach)

beforeEach(() => {
  isMobile.value = false
})

describe('CashRegistersPanel · four states', () => {
  it('empty: "Aún no hay cajas", creating from the empty state only with permission', async () => {
    const readOnly = mountPanel({ registers: [] })
    expect(readOnly.get('.hf-empty-state[data-kind="empty"]').text()).toContain('Aún no hay cajas')
    expect(readOnly.find('[data-testid="empty-state-action"]').exists()).toBe(false)

    const allowed = mountPanel({ registers: [], canCreate: true })
    await allowed.get('[data-testid="empty-state-action"]').trigger('click')
    expect(document.activeElement).toBe(
      allowed.get('[data-testid="cash-register-name-input"]').element,
    )
  })

  it('loading: renders the table skeleton and no rows', () => {
    const wrapper = mountPanel({ registers: [], loading: true })
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(true)
    // No data rows: no row menu and no empty or error state while the skeleton shows.
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('loading on mobile: renders card skeletons', () => {
    isMobile.value = true
    const wrapper = mountPanel({ registers: [], loading: true })
    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
  })

  it('error: shows a human title with Reintentar that asks for a refresh', async () => {
    const wrapper = mountPanel({ registers: [], error: true })
    const state = wrapper.get('[data-testid="table-error-state"]')
    expect(state.attributes('role')).toBe('alert')
    expect(state.text()).toContain('No se pudieron cargar las cajas')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(wrapper.emitted('refresh')).toEqual([[]])
  })

  it('data: a row per register with a status badge and the ⋮ menu, never ids', () => {
    const wrapper = mountPanel({ canOpen: true, canUpdate: true })
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    const states = wrapper.findAll('.hf-status-badge')
    expect(states.map((badge) => badge.text())).toEqual(['Activa', 'Inactiva'])
    expect(states.map((badge) => badge.attributes('data-tone'))).toEqual(['success', 'neutral'])
    expect(wrapper.findAll('button[aria-haspopup="menu"]')).toHaveLength(2)
    expect(wrapper.get('button[aria-haspopup="menu"]').attributes('aria-label')).toBe(
      'Acciones de Caja principal',
    )
    expect(wrapper.text()).toContain('Caja secundaria')
    expect(wrapper.text()).not.toMatch(/\br-1\b/)
  })

  it('data on mobile: cards with the badge and the ⋮ menu', () => {
    isMobile.value = true
    const wrapper = mountPanel({ canOpen: true, canUpdate: true })
    expect(wrapper.findAll('[data-testid="mobile-cards-list"] article')).toHaveLength(2)
    expect(wrapper.findAll('.hf-status-badge').map((badge) => badge.text())).toEqual([
      'Activa',
      'Inactiva',
    ])
    expect(wrapper.findAll('button[aria-haspopup="menu"]')).toHaveLength(2)
  })
})

describe('CashRegistersPanel · row actions', () => {
  it('opens a register from its name and from the whole row, only when active and permitted', async () => {
    const forbidden = mountPanel()
    expect(forbidden.find('[data-testid="cash-register-open-r-1"]').exists()).toBe(false)
    expect(forbidden.find('button[aria-haspopup="menu"]').exists()).toBe(false)

    const allowed = mountPanel({ canOpen: true })
    expect(allowed.find('[data-testid="cash-register-open-r-2"]').exists()).toBe(false)
    await allowed.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    expect(allowed.emitted('select')).toEqual([['r-1']])
    await allowed.findAll('tbody tr')[0].findAll('td')[1].trigger('click')
    expect(allowed.emitted('select')).toEqual([['r-1'], ['r-1']])
    await allowed.findAll('tbody tr')[1].findAll('td')[1].trigger('click')
    expect(allowed.emitted('select')).toHaveLength(2)
  })

  it('offers "Abrir caja" in the menu only for an active, unselected register', async () => {
    const wrapper = mountPanel({ canOpen: true })
    await openMenu(wrapper, 0)
    expect(menuLabels()).toEqual(['Abrir caja'])
    await chooseItem('Abrir caja')
    expect(wrapper.emitted('select')).toEqual([['r-1']])

    const selected = mountPanel({ canOpen: true, selectedRegisterId: 'r-1' })
    expect(selected.get('.hf-row-secondary').text()).toBe('Seleccionada')
    expect(selected.findAll('button[aria-haspopup="menu"]')).toHaveLength(0)
  })

  it('emits the inverted isActive from the menu, only with the update permission', async () => {
    const readOnly = mountPanel()
    expect(readOnly.find('button[aria-haspopup="menu"]').exists()).toBe(false)

    const wrapper = mountPanel({ canUpdate: true })
    await openMenu(wrapper, 0)
    expect(menuLabels()).toEqual(['Desactivar'])
    await chooseItem('Desactivar')
    await openMenu(wrapper, 1)
    expect(menuLabels()).toEqual(['Activar'])
    await chooseItem('Activar')

    expect(wrapper.emitted('update')).toEqual([
      ['r-1', { isActive: false }],
      ['r-2', { isActive: true }],
    ])
  })
})

describe('CashRegistersPanel · create', () => {
  it('requires a non-empty name before creating', async () => {
    const wrapper = mountPanel({ registers: [], canCreate: true })
    await wrapper.get('[data-testid="cash-register-create-form"]').trigger('submit')
    expect(wrapper.emitted('create')).toBeUndefined()
    expect(wrapper.find('[data-testid="cash-register-form-error"]').exists()).toBe(true)

    await wrapper.get('[data-testid="cash-register-name-input"]').setValue('  Caja nueva  ')
    await wrapper.get('[data-testid="cash-register-create-form"]').trigger('submit')
    expect(wrapper.emitted('create')).toEqual([['Caja nueva']])
  })

  it('puts the create form above the table, not hanging under it', () => {
    const wrapper = mountPanel({ registers: [REGISTERS[0]], canCreate: true })
    const form = wrapper.get('[data-testid="cash-register-create-form"]').element
    const table = wrapper.get('table').element
    expect(form.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows no create form, and no explanation, without the create permission', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="cash-register-create-form"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No tienes permiso')
  })
})
