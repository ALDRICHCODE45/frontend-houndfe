import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import ConfirmModal from '../ConfirmModal.vue'

// No Modal/Button/Teleport mocks: exercise the installed Nuxt UI + Reka tree.
const cleanups: Array<() => void> = []
afterEach(async () => {
  cleanups.reverse().forEach((cleanup) => cleanup())
  cleanups.length = 0
  await flushPromises()
})

async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

function dialog() {
  const element = document.body.querySelector<HTMLElement>('[role="dialog"]')
  expect(element).not.toBeNull()
  return element!
}

function button(label: string) {
  const element = Array.from(dialog().querySelectorAll<HTMLButtonElement>('button'))
    .find((candidate) => candidate.textContent?.trim() === label)
  expect(element, label).toBeDefined()
  return element!
}

async function escape() {
  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, cancelable: true,
  }))
  await settle()
}

async function outsidePointer() {
  // Reka registers its document pointer listener after mount. Target the real
  // overlay (a sibling of dialog content), not a synthetic component emit.
  const overlay = document.body.querySelector('[data-slot="overlay"]')!
  overlay.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, pointerType: 'mouse', button: 0,
  }))
  await settle()
}

async function fixture(extra: Record<string, unknown> = {}) {
  const open = shallowRef(false)
  const loading = shallowRef(false)
  const confirm = vi.fn()
  const cancel = vi.fn()
  const update = vi.fn((value: boolean) => { open.value = value })
  const container = document.createElement('div')
  document.body.append(container)
  const Host = defineComponent({
    setup: () => () => h('section', { 'data-testid': 'caller' }, [
      h('button', { onClick: () => { open.value = true } }, 'Abrir confirmación'),
      h(ConfirmModal, {
        description: 'Esta acción no se puede deshacer.',
        title: 'Eliminar registro',
        confirmLabel: 'Eliminar',
        confirmColor: 'error',
        ...extra,
        open: open.value,
        loading: loading.value,
        'onUpdate:open': update,
        onConfirm: confirm,
        onCancel: cancel,
      }),
    ]),
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { render: () => null } }],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mountWithUApp(Host, {
    attachTo: container,
    global: { plugins: [router] },
  })
  // The helper returns a child wrapper; unmount the owning app, not the child.
  cleanups.push(() => {
    wrapper.vm.$.appContext.app.unmount()
    container.remove()
  })
  const opener = wrapper.get('button').element as HTMLButtonElement
  opener.focus()
  opener.click()
  await settle()
  return { wrapper, opener, open, loading, confirm, cancel, update, container }
}

describe('ConfirmModal — installed modal integration (A9)', () => {
  it('teleports outside the caller and focuses the labelled dialog', async () => {
    const { container, opener } = await fixture()
    const content = dialog()
    expect(document.body.contains(content)).toBe(true)
    expect(container.contains(content)).toBe(false)
    expect(content.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(opener)
    expect(document.getElementById(content.getAttribute('aria-labelledby')!)?.textContent)
      .toBe('Eliminar registro')
    expect(content.textContent).toContain('Esta acción no se puede deshacer.')
  })

  it.each([
    ['ordinary', undefined],
    ['empty items', []],
    ['items', [{ id: 'one', title: 'Promoción uno' }]],
  ])('associates a nonempty accessible description for %s without visual duplication', async (_, items) => {
    const description = 'Esta acción no se puede deshacer.'
    await fixture({ items, description })
    const content = dialog()
    const ids = content.getAttribute('aria-describedby')?.trim().split(/\s+/) ?? []
    expect(ids.length).toBeGreaterThan(0)
    const descriptions = ids.map((id) => document.getElementById(id))
    for (const element of descriptions) {
      expect(element).not.toBeNull()
      expect(content.contains(element)).toBe(true)
      expect(element?.textContent?.trim()).toBe(description)
    }
    // This is a DOM utility-class contract, not a browser visibility claim.
    expect(content.querySelector('[data-slot="description"] .sr-only')?.textContent?.trim())
      .toBe(description)
    const bodyDescriptions = content.querySelectorAll('[data-testid="confirm-description"]')
    expect(bodyDescriptions).toHaveLength(items?.length ? 0 : 1)
    expect(content.querySelector('[data-slot="body"]')?.textContent?.includes(description))
      .toBe(!items?.length)
  })

  it('emits confirm once without inventing automatic close, then cancel closes', async () => {
    const { confirm, cancel, update, open } = await fixture()
    button('Eliminar').click()
    await settle()
    expect(confirm).toHaveBeenCalledExactlyOnceWith()
    expect(update).not.toHaveBeenCalled()
    expect(open.value).toBe(true)
    button('Cancelar').click()
    await settle()
    expect(cancel).toHaveBeenCalledExactlyOnceWith()
    expect(update).toHaveBeenCalledExactlyOnceWith(false)
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it.each(['Escape', 'close button', 'outside pointer'])('%s dismisses without emitting cancel', async (method) => {
    const { update, cancel, confirm, opener } = await fixture()
    if (method === 'Escape') await escape()
    else if (method === 'outside pointer') await outsidePointer()
    else {
      dialog().querySelector<HTMLButtonElement>('[data-slot="header"] button[aria-label]')!.click()
      await settle()
    }
    expect(update).toHaveBeenCalledExactlyOnceWith(false)
    expect(cancel).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('restores focus to the external opener after cancel', async () => {
    const { opener } = await fixture()
    button('Cancelar').click()
    await settle()
    expect(document.activeElement).toBe(opener)
  })

  it('protects every user dismissal/action while loading and recovers afterward', async () => {
    const { loading, update, confirm, cancel } = await fixture()
    loading.value = true
    await settle()
    expect(dialog().querySelector('[data-slot="header"] button[aria-label]')).toBeNull()
    expect(button('Cancelar').disabled).toBe(true)
    expect(button('Eliminar').disabled).toBe(true)
    button('Cancelar').click()
    button('Eliminar').click()
    await escape()
    await outsidePointer()
    expect(update).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
    expect(dialog()).toBeTruthy()
    loading.value = false
    await settle()
    expect(button('Cancelar').disabled).toBe(false)
    expect(button('Eliminar').disabled).toBe(false)
    button('Eliminar').click()
    await settle()
    expect(confirm).toHaveBeenCalledExactlyOnceWith()
    await escape()
    expect(update).toHaveBeenCalledExactlyOnceWith(false)
  })

  it.each(['light', 'dark'])('preserves caller slots/z-index and destructive semantics in global HF (%s)', async (mode) => {
    const ownedClasses = ['hf-theme', 'hf-ui', 'hf-app', mode]
      .filter((name) => !document.body.classList.contains(name))
    document.body.classList.add(...ownedClasses)
    cleanups.push(() => document.body.classList.remove(...ownedClasses))
    const ui = {
      content: 'caller-confirm z-[90] sm:max-w-xl',
      overlay: 'caller-overlay z-[89]',
      body: 'caller-body',
      footer: 'caller-footer',
    }
    const { wrapper } = await fixture({ ui })
    const content = dialog()
    expect(wrapper.findComponent({ name: 'Modal' }).props('ui')).toEqual(ui)
    expect(content.classList.contains('caller-confirm')).toBe(true)
    expect(content.classList.contains('z-[90]')).toBe(true)
    expect(content.classList.contains('sm:max-w-xl')).toBe(true)
    expect(document.body.querySelector('[data-slot="overlay"]')?.classList.contains('z-[89]'))
      .toBe(true)
    expect(content.querySelector('[data-slot="body"]')?.classList.contains('caller-body')).toBe(true)
    expect(content.querySelector('[data-slot="footer"]')?.classList.contains('caller-footer')).toBe(true)
    expect(content.closest('.hf-theme.hf-ui')).toBe(document.body)
    expect(button('Eliminar').classList.contains('bg-error')).toBe(true)
    expect(button('Eliminar').classList.contains('bg-primary')).toBe(false)
    expect(button('Cancelar').classList.contains('bg-error')).toBe(false)
  })

  it('renders real item rows instead of the description and honors caller labels', async () => {
    await fixture({
      confirmLabel: 'Eliminar seleccionadas',
      cancelLabel: 'Volver',
      items: [
        { id: 'one', title: 'Promoción uno', status: 'Activa' },
        { id: 'two', title: 'Promoción dos' },
      ],
    })
    expect(dialog().querySelector('[data-testid="confirm-description"]')).toBeNull()
    expect(Array.from(dialog().querySelectorAll('[data-testid="confirm-item-title"]'))
      .map((element) => element.textContent)).toEqual(['Promoción uno', 'Promoción dos'])
    expect(dialog().querySelectorAll('[data-testid="confirm-item-status"]')).toHaveLength(1)
    expect(button('Eliminar seleccionadas').disabled).toBe(false)
    expect(button('Volver').disabled).toBe(false)
  })

  it('retains native presentation defaults without a caller ui override', async () => {
    const { wrapper } = await fixture()
    expect(wrapper.findComponent({ name: 'Modal' }).props('ui')).toBeUndefined()
    expect(dialog().classList.contains('max-w-lg')).toBe(true)
    expect(dialog().classList.contains('caller-confirm')).toBe(false)
  })
})
