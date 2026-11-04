// ErrorViews.spec.ts — the 403 and 404 pages use the shared EmptyState: a
// title, one line and one primary way home, with no decorative status code.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mountWithUApp } from '@/test/mountWithUApp'
import ForbiddenView from '../ForbiddenView.vue'
import NotFoundView from '../NotFoundView.vue'

const EmptyRoute = defineComponent({ name: 'EmptyRoute', render: () => null })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: EmptyRoute }],
})

describe('ForbiddenView', () => {
  it('says the role limits the view with the shared forbidden state', () => {
    const wrapper = mountWithUApp(ForbiddenView, { global: { plugins: [router] } })
    const state = wrapper.get('.hf-empty-state')

    expect(state.attributes('data-kind')).toBe('forbidden')
    expect(state.text()).toContain('Tu rol no tiene acceso a esta página')
    expect(wrapper.text()).not.toContain('403')
  })

  it('keeps one solid primary action, with Volver beside it as a quiet outline', () => {
    const wrapper = mountWithUApp(ForbiddenView, { global: { plugins: [router] } })
    const actions = wrapper.get('.hf-error-actions')

    expect(actions.findAll('button')).toHaveLength(2)
    expect(actions.get('[data-testid="error-home"]').text()).toBe('Ir al inicio')
    expect(actions.get('[data-testid="error-home"]').classes()).toContain('hf-primary-control')
    expect(actions.get('[data-testid="error-back"]').text()).toBe('Volver')
    expect(actions.get('[data-testid="error-back"]').classes()).not.toContain('hf-primary-control')
  })

  it.each([['ForbiddenView', ForbiddenView], ['NotFoundView', NotFoundView]])('%s: Volver and Ir al inicio share the same 44px control height', (_name, view) => {
    const wrapper = mountWithUApp(view, { global: { plugins: [router] } })
    for (const id of ['error-back', 'error-home']) {
      expect(wrapper.get(`[data-testid="${id}"]`).classes()).toContain('hf-error-action')
    }
    const css = readFileSync('src/features/errors/styles/errors-visual.css', 'utf8')
    expect(css).toMatch(/\.hf-error-actions \.hf-error-action \{[^}]*min-height: var\(--hf-control-height\)/)
  })

  it('wears the brand mark on a card, not floating on a blank canvas', () => {
    const wrapper = mountWithUApp(ForbiddenView, { global: { plugins: [router] } })

    expect(wrapper.get('.hf-error-card img.hf-error-logo').attributes('alt')).toBe('HounFe')
    expect(wrapper.find('.hf-error-card .hf-empty-state').exists()).toBe(true)
  })
})

describe('NotFoundView', () => {
  it('shows the shared empty state naming the missing page', () => {
    const wrapper = mountWithUApp(NotFoundView, { global: { plugins: [router] } })
    const state = wrapper.get('.hf-empty-state')

    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.text()).toContain('No encontramos esta página')
    expect(wrapper.text()).not.toContain('404')
  })

  it('has the brand mark, one primary and a quiet Volver in one even row', () => {
    const wrapper = mountWithUApp(NotFoundView, { global: { plugins: [router] } })
    const actions = wrapper.get('.hf-error-actions')

    expect(wrapper.find('.hf-error-card img.hf-error-logo').exists()).toBe(true)
    expect(actions.findAll('button')).toHaveLength(2)
    expect(actions.get('[data-testid="error-home"]').text()).toBe('Ir al inicio')
  })
})
