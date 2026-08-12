// @ts-nocheck
/**
 * MemberCard — direct component tests.
 *
 * W4 debt closure: MemberCard shipped without dedicated specs during Fase 2
 * (only covered indirectly via AdminTenantMembersView.test.ts). These tests
 * pin the render anatomy (article + EntityAvatar + dashed divider + 2-col
 * body), card-specific content (userName, userEmail, roleName, optional
 * userIsActive status chip, "Fecha de ingreso"), the null-safe branches
 * (userIsActive undefined → no badge; createdAt missing → '-'), the click
 * emit contract, and the "no kebab / no checkbox" rule.
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MemberCard from '../MemberCard.vue'
import type { MembershipTableRow } from '../../interfaces/membership.types'

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

function makeMember(overrides: Partial<MembershipTableRow> = {}): MembershipTableRow {
  return {
    id: 'mem-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    roleId: 'role-1',
    userName: 'María López',
    userEmail: 'maria@test.com',
    roleName: 'Admin',
    userIsActive: true,
    createdAt: '2024-01-15T12:00:00.000Z',
    ...overrides,
  }
}

describe('MemberCard', () => {
  it('renders the article root with the card testid and the dashed divider', () => {
    const wrapper = mount(MemberCard, { props: { member: makeMember() } })
    expect(wrapper.find('article[data-testid="member-card"]').exists()).toBe(true)
    expect(wrapper.find('.border-dashed').exists()).toBe(true)
  })

  it('passes userName and userId to EntityAvatar as name/seed with size lg', () => {
    const wrapper = mount(MemberCard, {
      props: { member: makeMember({ userId: 'user-42' }) },
    })
    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('data-name')).toBe('María López')
    expect(avatar.attributes('data-seed')).toBe('user-42')
    expect(avatar.attributes('data-size')).toBe('lg')
  })

  it('falls back to the membership id as avatar seed when userId is missing', () => {
    const wrapper = mount(MemberCard, {
      props: { member: makeMember({ userId: undefined, id: 'mem-7' }) },
    })
    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    expect(avatar.attributes('data-seed')).toBe('mem-7')
  })

  it('renders the member name, email, and role', () => {
    const wrapper = mount(MemberCard, { props: { member: makeMember() } })
    expect(wrapper.text()).toContain('María López')
    expect(wrapper.text()).toContain('maria@test.com')
    expect(wrapper.text()).toContain('Rol')
    expect(wrapper.text()).toContain('Admin')
  })

  it('shows the Activo status chip when userIsActive is true', () => {
    const wrapper = mount(MemberCard, {
      props: { member: makeMember({ userIsActive: true }) },
    })
    const badge = wrapper.find('[data-testid="status-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-label')).toBe('Activo')
    expect(badge.attributes('data-tone')).toBe('active')
  })

  it('shows the Inactivo status chip when userIsActive is false', () => {
    const wrapper = mount(MemberCard, {
      props: { member: makeMember({ userIsActive: false }) },
    })
    const badge = wrapper.find('[data-testid="status-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-label')).toBe('Inactivo')
    expect(badge.attributes('data-tone')).toBe('inactive')
  })

  it('renders without a status chip when userIsActive is undefined', () => {
    const wrapper = mount(MemberCard, {
      props: { member: makeMember({ userIsActive: undefined }) },
    })
    expect(wrapper.find('[data-testid="status-badge"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('María López')
  })

  it('renders the creation date under Fecha de ingreso', () => {
    const wrapper = mount(MemberCard, { props: { member: makeMember() } })
    expect(wrapper.text()).toContain('Fecha de ingreso')
    expect(wrapper.text()).toContain('15 de ene de 2024')
  })

  it('renders a dash when createdAt is missing', () => {
    const wrapper = mount(MemberCard, {
      props: { member: makeMember({ createdAt: undefined }) },
    })
    expect(wrapper.text()).toContain('-')
  })

  it('emits click with the member object when the article is clicked', async () => {
    const member = makeMember()
    const wrapper = mount(MemberCard, { props: { member } })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual(member)
  })

  it('does not render a kebab menu or a checkbox', () => {
    const wrapper = mount(MemberCard, { props: { member: makeMember() } })
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(false)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })
})
