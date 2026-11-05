import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HfSaveBar from '../HfSaveBar.vue'

const NOW = new Date('2026-11-04T13:40:00')

function mountBar(props: Record<string, unknown> = {}) {
  return mount(HfSaveBar, { props: { dirtyCount: 0, ...props } })
}

const status = (wrapper: ReturnType<typeof mountBar>) => wrapper.get('.hf-save-bar__status')
const button = (wrapper: ReturnType<typeof mountBar>, label: string) =>
  wrapper.findAll('button').find(item => item.text() === label)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('HfSaveBar state', () => {
  it('says when it was saved, with a check, while there are no changes', () => {
    const wrapper = mountBar({ savedAt: new Date(NOW.getTime() - 2 * 60_000) })
    expect(status(wrapper).text()).toBe('Guardado hace 2 min')
    expect(status(wrapper).attributes('data-state')).toBe('saved')
    expect(status(wrapper).find('.hf-save-bar__check').exists()).toBe(true)
    expect(status(wrapper).attributes('aria-live')).toBe('polite')
  })

  it('says "justo ahora" under a minute and keeps the label fresh', async () => {
    const wrapper = mountBar({ savedAt: NOW })
    expect(status(wrapper).text()).toBe('Guardado justo ahora')
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(status(wrapper).text()).toBe('Guardado hace 5 min')
  })

  it('counts unsaved changes with an amber dot', () => {
    const one = mountBar({ dirtyCount: 1 })
    expect(status(one).text()).toBe('1 cambio sin guardar')
    const many = mountBar({ dirtyCount: 3, savedAt: NOW })
    expect(status(many).text()).toBe('3 cambios sin guardar')
    expect(status(many).attributes('data-state')).toBe('dirty')
    expect(status(many).find('.hf-save-bar__dot').exists()).toBe(true)
  })

  it('says it is saving', () => {
    const wrapper = mountBar({ dirtyCount: 2, saving: true })
    expect(status(wrapper).text()).toBe('Guardando…')
    expect(status(wrapper).attributes('data-state')).toBe('saving')
  })

  it('shows an error in the danger text and keeps Guardar available to retry', () => {
    const wrapper = mountBar({ dirtyCount: 2, error: 'No se pudo guardar. Intenta de nuevo.' })
    expect(status(wrapper).text()).toBe('No se pudo guardar. Intenta de nuevo.')
    expect(status(wrapper).attributes('data-state')).toBe('error')
    expect(button(wrapper, 'Guardar')!.attributes('disabled')).toBeUndefined()
  })
})

describe('HfSaveBar actions', () => {
  it('disables Guardar with the shared disabled primary and hides Descartar when clean', () => {
    const wrapper = mountBar({ savedAt: NOW })
    const save = button(wrapper, 'Guardar')!
    expect(save.attributes('disabled')).toBeDefined()
    expect(save.classes()).toContain('hf-primary-control')
    expect(button(wrapper, 'Descartar')).toBeUndefined()
  })

  it('enables Guardar and shows Descartar when dirty', async () => {
    const wrapper = mountBar({ dirtyCount: 3 })
    const save = button(wrapper, 'Guardar')!
    expect(save.attributes('disabled')).toBeUndefined()
    await save.trigger('click')
    await button(wrapper, 'Descartar')!.trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('discard')).toHaveLength(1)
  })

  it('blocks both actions while saving', () => {
    const wrapper = mountBar({ dirtyCount: 3, saving: true })
    expect(button(wrapper, 'Guardar')!.attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'Descartar')!.attributes('disabled')).toBeDefined()
  })
})
