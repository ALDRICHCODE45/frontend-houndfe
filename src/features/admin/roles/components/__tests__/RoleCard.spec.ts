// @ts-nocheck
/**
 * RoleCard — direct component tests.
 *
 * W4 debt closure: RoleCard shipped without dedicated specs during Fase 2
 * (only covered indirectly via AdminRolesView.test.ts). These tests pin the
 * render anatomy (article + EntityAvatar + dashed divider + 2-col body),
 * card-specific content (name, description, "N permisos", "N usuarios",
 * "Sistema" system chip), the click emit contract, and the "no kebab / no
 * checkbox" rule.
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RoleCard from '../RoleCard.vue'
import type { RoleTableRow } from '../../interfaces/role.types'

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

function makeRole(overrides: Partial<RoleTableRow> = {}): RoleTableRow {
  return {
    id: 'role-1',
    name: 'Admin',
    description: 'Administrador del sistema',
    isSystem: false,
    permissionCount: 5,
    userCount: 3,
    createdAt: '2024-01-15T12:00:00.000Z',
    updatedAt: '2024-01-15T12:00:00.000Z',
    ...overrides,
  }
}

describe('RoleCard', () => {
  it('renders the article root with the card testid and the dashed divider', () => {
    const wrapper = mount(RoleCard, { props: { role: makeRole() } })
    expect(wrapper.find('article[data-testid="role-card"]').exists()).toBe(true)
    expect(wrapper.find('.border-dashed').exists()).toBe(true)
  })

  it('passes name and id to EntityAvatar as name/seed with size lg', () => {
    const wrapper = mount(RoleCard, {
      props: { role: makeRole({ id: 'role-42' }) },
    })
    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('data-name')).toBe('Admin')
    expect(avatar.attributes('data-seed')).toBe('role-42')
    expect(avatar.attributes('data-size')).toBe('lg')
  })

  it('renders the role name and description', () => {
    const wrapper = mount(RoleCard, { props: { role: makeRole() } })
    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.text()).toContain('Administrador del sistema')
  })

  it('renders the permission and user count badges', () => {
    const wrapper = mount(RoleCard, {
      props: { role: makeRole({ permissionCount: 7, userCount: 2 }) },
    })
    const badges = wrapper.findAll('[data-testid="app-badge"]')
    expect(badges.length).toBe(2)
    expect(badges[0].attributes('data-label')).toBe('7 permisos')
    expect(badges[0].attributes('data-tone')).toBe('info')
    expect(badges[1].attributes('data-label')).toBe('2 usuarios')
    expect(badges[1].attributes('data-tone')).toBe('type')
    expect(badges[1].attributes('data-variant')).toBe('outline')
  })

  it('renders the Sistema chip when isSystem is true', () => {
    const wrapper = mount(RoleCard, { props: { role: makeRole({ isSystem: true }) } })
    const badge = wrapper.find('[data-testid="status-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-label')).toBe('Sistema')
    expect(badge.attributes('data-tone')).toBe('info')
  })

  it('hides the Sistema chip when isSystem is false', () => {
    const wrapper = mount(RoleCard, { props: { role: makeRole({ isSystem: false }) } })
    expect(wrapper.find('[data-testid="status-badge"]').exists()).toBe(false)
  })

  it('falls back to an em-dash when the description is null', () => {
    const wrapper = mount(RoleCard, { props: { role: makeRole({ description: null }) } })
    expect(wrapper.text()).toContain('—')
  })

  it('renders the creation date in es-AR under the Creación column', () => {
    const wrapper = mount(RoleCard, { props: { role: makeRole() } })
    expect(wrapper.text()).toContain('Creación')
    expect(wrapper.text()).toContain('15 de ene de 2024')
  })

  it('emits click with the role object when the article is clicked', async () => {
    const role = makeRole()
    const wrapper = mount(RoleCard, { props: { role } })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual(role)
  })

  it('does not render a kebab menu or a checkbox', () => {
    const wrapper = mount(RoleCard, { props: { role: makeRole() } })
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(false)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })
})
