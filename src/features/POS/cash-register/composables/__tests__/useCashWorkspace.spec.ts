import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { CASH_WORKSPACE_TASKS, useCashWorkspace } from '../useCashWorkspace'

// Presentation-only navigation model. It never selects a shift, never runs a
// query and never invents a task outside the fixed catalog.
describe('useCashWorkspace', () => {
  it('opens the default task and offers only the available tasks', () => {
    const { activeTaskId, visibleTasks } = useCashWorkspace({
      isAvailable: (id) => id !== 'recepcion',
      defaultTaskId: 'apertura',
    })

    expect(activeTaskId.value).toBe('apertura')
    expect(visibleTasks.value.map((task) => task.id)).not.toContain('recepcion')
    expect(visibleTasks.value).toHaveLength(CASH_WORKSPACE_TASKS.length - 1)
  })

  it('falls back to the first offered task when the active one stops being available', async () => {
    const available = ref(true)
    const { activeTaskId, selectTask, visibleTasks } = useCashWorkspace({
      isAvailable: (id) => (id === 'recepcion' ? available.value : true),
      defaultTaskId: 'apertura',
    })

    selectTask('recepcion')
    expect(activeTaskId.value).toBe('recepcion')

    available.value = false
    await nextTick()

    expect(visibleTasks.value.map((task) => task.id)).not.toContain('recepcion')
    expect(activeTaskId.value).toBe('apertura')
  })

  it('ignores a selection for a task that is not offered', () => {
    const { activeTaskId, selectTask } = useCashWorkspace({
      isAvailable: (id) => id !== 'verificacion',
      defaultTaskId: 'apertura',
    })

    selectTask('verificacion')

    expect(activeTaskId.value).toBe('apertura')
  })

  it('resolves scope-honest labels through labelFor', () => {
    const { visibleTasks } = useCashWorkspace({
      labelFor: (task) => (task.id === 'historial' ? 'Mis sesiones' : task.label),
    })

    const history = visibleTasks.value.find((task) => task.id === 'historial')
    expect(history?.label).toBe('Mis sesiones')
  })

  it('exposes a neutral Spanish heading for every catalog task', () => {
    for (const task of CASH_WORKSPACE_TASKS) {
      expect(task.heading).toBeTruthy()
      expect(task.description).toBeTruthy()
    }
    expect(CASH_WORKSPACE_TASKS.find((task) => task.id === 'apertura')?.heading).toBe(
      'Abrir un turno',
    )
    expect(CASH_WORKSPACE_TASKS.find((task) => task.id === 'conteo')?.heading).toBe(
      'Cuenta el dinero de tu cajón',
    )
  })

  it('keeps the task heading independent from the scope-honest label override', () => {
    const { visibleTasks } = useCashWorkspace({
      labelFor: (task) => (task.id === 'historial' ? 'Mis sesiones' : task.label),
    })

    const history = visibleTasks.value.find((task) => task.id === 'historial')
    expect(history?.label).toBe('Mis sesiones')
    expect(history?.heading).toBe('Historial de turnos')
  })
})
