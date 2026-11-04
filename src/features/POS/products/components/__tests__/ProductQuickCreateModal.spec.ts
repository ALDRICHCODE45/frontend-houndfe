/**
 * ProductQuickCreateModal — one-field create modal: validates through the
 * schema, emits the name on submit and the cancel on Cancelar.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { z } from 'zod'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import ProductQuickCreateModal from '../ProductQuickCreateModal.vue'

const schema = z.object({
  name: z.string().trim().min(2, 'La categoría debe tener al menos 2 caracteres'),
})

function mountModal(extra: Record<string, unknown> = {}) {
  const open = ref(true)
  const name = ref('')
  const submitted: string[] = []
  const cancelled: boolean[] = []
  const wrapper = mount(UApp, {
    attachTo: document.body,
    slots: {
      default: () =>
        h(ProductQuickCreateModal, {
          open: open.value,
          'onUpdate:open': (value: boolean) => (open.value = value),
          name: name.value,
          'onUpdate:name': (value: string) => (name.value = value),
          title: 'Nueva categoría',
          label: 'Nombre',
          placeholder: 'Nombre de la categoría',
          formId: 'create-category-modal-form',
          schema,
          onSubmit: (value: string) => submitted.push(value),
          onCancel: () => cancelled.push(true),
          ...extra,
        }),
    },
  })
  return { wrapper, name, submitted, cancelled }
}

const form = () => document.getElementById('create-category-modal-form') as HTMLFormElement
const input = () => form().querySelector('input[name="name"]') as HTMLInputElement
const tick = () => flushPromises().then(() => new Promise((resolve) => setTimeout(resolve, 20)))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductQuickCreateModal', () => {
  it('submits the typed name through the schema', async () => {
    const { wrapper, name, submitted } = mountModal()
    await tick()
    input().value = 'Accesorios'
    input().dispatchEvent(new Event('input', { bubbles: true }))
    await tick()
    expect(name.value).toBe('Accesorios')
    form().requestSubmit()
    await tick()
    expect(submitted).toEqual(['Accesorios'])
    wrapper.unmount()
  })

  it('does not submit an invalid name', async () => {
    const { wrapper, submitted } = mountModal()
    await tick()
    input().value = 'A'
    input().dispatchEvent(new Event('input', { bubbles: true }))
    await tick()
    form().requestSubmit()
    await tick()
    expect(submitted).toEqual([])
    expect(document.body.textContent).toContain('La categoría debe tener al menos 2 caracteres')
    wrapper.unmount()
  })

  it('shows the server error and emits cancel from Cancelar', async () => {
    const { wrapper, cancelled } = mountModal({ error: 'Ya existe una categoría con ese nombre' })
    await tick()
    expect(document.body.textContent).toContain('Ya existe una categoría con ese nombre')
    const cancel = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Cancelar',
    )!
    cancel.click()
    await tick()
    expect(cancelled).toEqual([true])
    wrapper.unmount()
  })
})
