import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import ConfirmDialogHost from '../../components/ConfirmDialogHost.vue'
import { useConfirm } from '../useConfirm'

const tick = () => new Promise(resolve => setTimeout(resolve, 60))
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const button = (label: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(item => item.textContent?.trim() === label)
let wrapper: ReturnType<typeof mount> | undefined
function render() {
  wrapper = mount(defineComponent({ setup: () => () => h(UApp, null, { default: () => h(ConfirmDialogHost) }) }), { attachTo: document.body })
}
afterEach(async () => { useConfirm().cancelAll(); await tick(); wrapper?.unmount(); wrapper = undefined; document.body.innerHTML = '' })

describe('useConfirm', () => {
  it('opens one themed dialog with the copy and resolves true on confirm', async () => {
    render()
    const answer = useConfirm().confirm({ title: '¿Reemplazar tus cambios?', description: 'Se perderán tus cambios.', confirmLabel: 'Reemplazar', tone: 'danger' })
    await tick()
    expect(dialog()?.textContent).toContain('¿Reemplazar tus cambios?')
    expect(dialog()?.textContent).toContain('Se perderán tus cambios.')
    expect(dialog()?.closest('.hf-theme.hf-ui') ?? dialog()?.classList.contains('hf-theme')).toBeTruthy()
    expect(button('Cancelar')).toBeTruthy()
    button('Reemplazar')!.click()
    await expect(answer).resolves.toBe(true)
    await tick()
    expect(dialog()).toBeNull()
  })

  it('resolves false on cancel and on Escape', async () => {
    render()
    const { confirm } = useConfirm()
    const cancelled = confirm({ description: 'A', cancelLabel: 'Seguir editando' })
    await tick()
    button('Seguir editando')!.click()
    await expect(cancelled).resolves.toBe(false)
    await tick()
    const escaped = confirm({ description: 'B' })
    await tick()
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await expect(escaped).resolves.toBe(false)
  })

  it('moves focus into the dialog while it is open', async () => {
    render()
    void useConfirm().confirm({ description: 'Focus' })
    await tick()
    expect(dialog()?.contains(document.activeElement)).toBe(true)
  })

  it('a second call while one is open resolves the first as false and shows the second', async () => {
    render()
    const { confirm } = useConfirm()
    const first = confirm({ description: 'Primera' })
    const second = confirm({ description: 'Segunda', confirmLabel: 'Sí' })
    await expect(first).resolves.toBe(false)
    await tick()
    expect(dialog()?.textContent).toContain('Segunda')
    button('Sí')!.click()
    await expect(second).resolves.toBe(true)
  })
})
