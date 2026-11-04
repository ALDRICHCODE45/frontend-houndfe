// ErrorViews.spec.ts — the 403 and 404 pages use the shared EmptyState: a
// title, one line and one primary way home, with no decorative status code.

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

  it('keeps one solid primary action', () => {
    const wrapper = mountWithUApp(ForbiddenView, { global: { plugins: [router] } })

    expect(wrapper.get('[data-testid="empty-state-action"]').text()).toBe('Ir al inicio')
    expect(wrapper.findAll('button')).toHaveLength(2)
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
})
