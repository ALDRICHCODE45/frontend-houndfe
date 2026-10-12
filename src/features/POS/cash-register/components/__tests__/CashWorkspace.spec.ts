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
    heading: 'Abrir un turno',
    description: 'Elige la caja y registra el fondo inicial del turno.',
    hint: 'Cajas y fondo inicial',
    icon: 'i-lucide-door-open',
    needsSession: false,
    available: true,
  },
  {
    id: 'historial',
    label: 'Sesiones',
    heading: 'Historial de turnos',
    description: 'Consulta los turnos de caja y abre el que necesites.',
    hint: 'Lista de sesiones existente',
    icon: 'i-lucide-history',
    needsSession: false,
    available: true,
  },
]

function render(overrides: Record<string, unknown> = {}) {
  return mountWithUApp(CashWorkspace, {
    props: {
      title: 'Caja',
      subtitle: 'Opera la caja por tareas.',
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

    expect(wrapper.get('[data-testid="cash-workspace-heading"]').text()).toBe('Abrir un turno')
    expect(wrapper.get('[data-testid="cash-workspace-nav"]').attributes('aria-label')).toBe(
      'Tareas de Caja',
    )
    for (const task of TASKS) {
      expect(wrapper.find(`[data-testid="cash-workspace-task-${task.id}"]`).exists()).toBe(true)
      // Each task carries a decorative icon tile and its own contextual metadata.
      expect(wrapper.find(`[data-testid="cash-task-icon-${task.id}"]`).exists()).toBe(true)
    }
  })

  it('shows the active task heading and swaps it when another task is focused', () => {
    const opening = render()

    expect(opening.get('h1').text()).toBe('Abrir un turno')
    expect(opening.text()).toContain('Elige la caja y registra el fondo inicial del turno.')

    const history = render({ activeTaskId: 'historial' })

    expect(history.get('h1').text()).toBe('Historial de turnos')
    expect(history.text()).toContain('Consulta los turnos de caja y abre el que necesites.')
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
