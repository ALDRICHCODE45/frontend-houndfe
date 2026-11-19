import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { CASH_PANEL_IDS, CASH_PANEL_TITLES, useCashWorkspace } from '../useCashWorkspace'

// Presentation-only model for direction A: one task opens in place at a time.
// It never selects a shift, never runs a query and never dispatches a command;
// reachability is supplied by the view (timeline state + abilities).
describe('useCashWorkspace', () => {
  it('starts with the panel the view asks for, or none', () => {
    expect(useCashWorkspace().openPanelId.value).toBeNull()
    expect(useCashWorkspace({ initialPanelId: 'apertura' }).openPanelId.value).toBe('apertura')
  })

  it('opens one task in place at a time and hides it again', () => {
    const { openPanelId, openPanel, togglePanel, closePanel } = useCashWorkspace()

    openPanel('movimientos')
    expect(openPanelId.value).toBe('movimientos')
    openPanel('conteo')
    expect(openPanelId.value).toBe('conteo')
    togglePanel('conteo')
    expect(openPanelId.value).toBeNull()
    togglePanel('recepcion')
    expect(openPanelId.value).toBe('recepcion')
    closePanel()
    expect(openPanelId.value).toBeNull()
  })

  it('does not force an order: any reachable task opens, an unreachable one is ignored', () => {
    const { openPanelId, openPanel } = useCashWorkspace({
      isReachable: (id) => id !== 'verificacion',
    })

    openPanel('liberar')
    expect(openPanelId.value).toBe('liberar')
    openPanel('verificacion')
    expect(openPanelId.value).toBe('liberar')
  })

  it('closes the open task when it stops being reachable', async () => {
    const reachable = ref(true)
    const { openPanelId, openPanel } = useCashWorkspace({
      isReachable: (id) => (id === 'movimientos' ? reachable.value : true),
    })

    openPanel('movimientos')
    reachable.value = false
    await nextTick()

    expect(openPanelId.value).toBeNull()
  })

  it('names every panel for its in-place heading', () => {
    for (const id of CASH_PANEL_IDS) expect(CASH_PANEL_TITLES[id]).toBeTruthy()
    expect(CASH_PANEL_IDS).toContain('recepcion')
  })
})
