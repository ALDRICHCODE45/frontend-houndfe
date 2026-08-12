// @ts-nocheck
/**
 * UserCard — direct component tests.
 *
 * W4 debt closure: UserCard shipped without dedicated specs during Fase 2
 * (only covered indirectly via AdminUsersView.test.ts). These tests pin the
 * render anatomy (article + EntityAvatar + dashed divider + 2-col body),
 * card-specific content (name, email, roles label, isActive status chip),
 * the click emit contract, and the "no kebab / no checkbox" rule.
 *
 * The shared presentational primitives (EntityAvatar, StatusDotBadge,
 * AppBadge) are stubbed with testid-exporting stubs so props are asserted
 * directly without dragging @nuxt/ui internals in.
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UserCard from '../UserCard.vue'
import type { UserTableRow } from '../../interfaces/user.types'

// ── Shared primitive stubs (mirror the view-test pattern) ────────────────────

vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: {
    name: 'EntityAvatar',
    template: '<div data-testid="entity-avatar" :data-name="name" :data-seed="seed" :data-size="size" />',
    props: ['name', 'seed', 'size', 'showDot', 'dotClass'],
  },
}))

vi.mock('@/core/shared/components/StatusDotBadge.vue', () => ({
  default: {
    name: 'StatusDotBadge',
    template: '<span data-testid="status-badge" :data-label="label" :data-tone="tone">{{ label }}</span>',
    props: ['label', 'tone', 'compact', 'ariaLabel', 'ariaPrefix'],
  },
}))

vi.mock('@/core/shared/components/AppBadge.vue', () => ({
  default: {
    name: 'AppBadge',
    template: '<span data-testid="app-badge" :data-label="label" :data-tone="tone" :data-variant="variant">{{ label }}</span>',
    props: ['label', 'value', 'tone', 'icon', 'variant'],
  },
}))

// ── Sample data ──────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<UserTableRow> = {}): UserTableRow {
  return {
    id: 'user-1',
    email: 'juan@test.com',
    name: 'Juan Pérez',
    isActive: true,
    createdAt: '2024-01-15T12:00:00.000Z',
    roles: [{ id: 'r1', name: 'Admin' }, { id: 'r2', name: 'Soporte' }],
    ...overrides,
  }
}

describe('UserCard', () => {
  it('renders the article root with the card testid and the dashed divider', () => {
    const wrapper = mount(UserCard, { props: { user: makeUser() } })
    expect(wrapper.find('article[data-testid="user-card"]').exists()).toBe(true)
    expect(wrapper.find('.border-dashed').exists()).toBe(true)
  })

  it('passes name and id to EntityAvatar as name/seed with size lg', () => {
    const wrapper = mount(UserCard, {
      props: { user: makeUser({ id: 'user-42' }) },
    })
    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('data-name')).toBe('Juan Pérez')
    expect(avatar.attributes('data-seed')).toBe('user-42')
    expect(avatar.attributes('data-size')).toBe('lg')
  })

  it('renders the user name and email', () => {
    const wrapper = mount(UserCard, { props: { user: makeUser() } })
    expect(wrapper.text()).toContain('Juan Pérez')
    expect(wrapper.text()).toContain('juan@test.com')
  })

  it('renders the roles as a comma-separated label under the Roles column', () => {
    const wrapper = mount(UserCard, { props: { user: makeUser() } })
    expect(wrapper.text()).toContain('Roles')
    expect(wrapper.text()).toContain('Admin, Soporte')
  })

  it('falls back to "Sin roles" when the user has no roles', () => {
    const wrapper = mount(UserCard, { props: { user: makeUser({ roles: [] }) } })
    expect(wrapper.text()).toContain('Sin roles')
  })

  it('shows the Activo status chip when isActive is true', () => {
    const wrapper = mount(UserCard, {
      props: { user: makeUser({ isActive: true }) },
    })
    const badge = wrapper.find('[data-testid="status-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-label')).toBe('Activo')
    expect(badge.attributes('data-tone')).toBe('active')
  })

  it('shows the Inactivo status chip when isActive is false', () => {
    const wrapper = mount(UserCard, {
      props: { user: makeUser({ isActive: false }) },
    })
    const badge = wrapper.find('[data-testid="status-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-label')).toBe('Inactivo')
    expect(badge.attributes('data-tone')).toBe('inactive')
  })

  it('renders the creation date in es-AR under the Creación column', () => {
    const wrapper = mount(UserCard, { props: { user: makeUser() } })
    expect(wrapper.text()).toContain('Creación')
    expect(wrapper.text()).toContain('15 de ene de 2024')
  })

  it('emits click with the user object when the article is clicked', async () => {
    const user = makeUser()
    const wrapper = mount(UserCard, { props: { user } })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual(user)
  })

  it('does not render a kebab menu or a checkbox', () => {
    const wrapper = mount(UserCard, { props: { user: makeUser() } })
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(false)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })
})
