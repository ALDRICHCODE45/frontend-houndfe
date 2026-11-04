import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EntityAvatar from '../EntityAvatar.vue'

describe('EntityAvatar', () => {
  it('renders neutral initials whatever the seed, never a per-person palette color', () => {
    const first = mount(EntityAvatar, { props: { name: 'Ana López', seed: 'a' } })
    const second = mount(EntityAvatar, { props: { name: 'Bruno Díaz', seed: 'zzzz' } })

    for (const wrapper of [first, second]) {
      const avatar = wrapper.get('[data-testid="entity-avatar"]')
      expect(avatar.classes()).toContain('hf-entity-avatar')
      expect(avatar.attributes('class')).not.toMatch(/\b(?:bg|text)-(?:[a-z]+)-\d{2,3}\b/)
    }
    expect(first.get('[data-testid="entity-avatar"]').text()).toBe('AL')
    expect(second.get('[data-testid="entity-avatar"]').text()).toBe('BD')
  })

  it('keeps the name as the accessible label and the 32px default size', () => {
    const wrapper = mount(EntityAvatar, { props: { name: 'Ana López', seed: 'a' } })
    const avatar = wrapper.get('[data-testid="entity-avatar"]')
    expect(avatar.attributes('aria-label')).toBe('Ana López')
    expect(avatar.classes()).toContain('size-8')
  })
})
