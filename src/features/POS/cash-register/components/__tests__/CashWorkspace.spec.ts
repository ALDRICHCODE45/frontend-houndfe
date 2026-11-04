/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention: specs import `.vue` and the
// plain TS server used by tooling cannot resolve SFC types; vitest resolves them
// through the Vue plugin at runtime).
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashWorkspace from '../CashWorkspace.vue'
import type { CashWorkspaceTaskOption } from '../../composables/useCashWorkspace'

const TASKS: CashWorkspaceTaskOption[] = [
  {
    id: 'apertura',
    label: 'Apertura',
    icon: 'i-lucide-door-open',
    needsSession: false,
    available: true,
  },
  {
    id: 'historial',
    label: 'Sesiones',
    icon: 'i-lucide-history',
    needsSession: false,
    available: true,
  },
]

function render(overrides: Record<string, unknown> = {}) {
  return mountWithUApp(CashWorkspace, {
    props: {
      title: 'Caja',
      tasks: TASKS,
      activeTaskId: 'apertura',
      ...overrides,
    },
    slots: {
      shift: () => h('div', { 'data-testid': 'shift-slot' }, 'turno'),
      default: () => h('div', { 'data-testid': 'operation-slot' }, 'operación'),
    },
  })
}

describe('CashWorkspace', () => {
  it('renders the header and one quiet task card per offered task', () => {
    const wrapper = render()

    expect(wrapper.get('[data-testid="cash-workspace-heading"]').text()).toBe('Caja')
    expect(wrapper.get('[data-testid="cash-workspace-nav"]').attributes('aria-label')).toBe(
      'Tareas de Caja',
    )
    for (const task of TASKS) {
      expect(wrapper.find(`[data-testid="cash-workspace-task-${task.id}"]`).exists()).toBe(true)
      // Each task is an icon and a label: no per-task description line.
      expect(wrapper.find(`[data-testid="cash-task-icon-${task.id}"]`).exists()).toBe(true)
      expect(wrapper.find('.cash-task-hint').exists()).toBe(false)
    }
  })

  it('keeps one page title that matches the breadcrumb, whatever the active task', () => {
    const opening = render()

    expect(opening.get('h1').text()).toBe('Caja')
    expect(opening.findAll('h1')).toHaveLength(1)
    expect(opening.find('.cash-workspace-eyebrow').exists()).toBe(false)
    expect(opening.find('.cash-workspace-subtitle').exists()).toBe(false)
    expect(opening.text()).not.toContain('¿Qué necesitas hacer?')
    expect(opening.text()).not.toContain('Cada tarea, cuando la necesites')

    const history = render({ activeTaskId: 'historial' })

    expect(history.get('h1').text()).toBe('Caja')
  })

  it('marks the active task as current and keeps the tasks keyboard operable', () => {
    const wrapper = render()

    const active = wrapper.get('[data-testid="cash-workspace-task-apertura"]')
    expect(active.attributes('aria-current')).toBe('true')
    expect(active.attributes('type')).toBe('button')
    expect(
      wrapper.get('[data-testid="cash-workspace-task-historial"]').attributes('aria-current'),
    ).toBeUndefined()
  })

  it('emits the selected task without touching the shift or the operation area', async () => {
    const wrapper = render()

    await wrapper.get('[data-testid="cash-workspace-task-historial"]').trigger('click')

    expect(wrapper.emitted('selectTask')).toEqual([['historial']])
    expect(wrapper.get('[data-testid="shift-slot"]').text()).toBe('turno')
    expect(wrapper.get('[data-testid="operation-slot"]').text()).toBe('operación')
  })

  it('renders the central shift region and the operation area', () => {
    const wrapper = render()

    expect(wrapper.get('[data-testid="cash-workspace-shift"]').text()).toContain('turno')
    expect(wrapper.get('[data-testid="cash-workspace-operation"]').text()).toContain('operación')
  })

  it('falls back to the plain workspace title when no task is focused', () => {
    const wrapper = render({ tasks: [], activeTaskId: null })

    expect(wrapper.get('[data-testid="cash-workspace-heading"]').text()).toBe('Caja')
    expect(wrapper.find('[data-testid="cash-workspace-nav"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-workspace-context"]').exists()).toBe(false)
  })
})
