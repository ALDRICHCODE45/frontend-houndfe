// @ts-nocheck
/**
 * TenantCard — direct component tests.
 *
 * W4 debt closure: TenantCard shipped without dedicated specs during Fase 2
 * (only covered indirectly via AdminTenantsView.test.ts). These tests pin the
 * render anatomy (article + EntityAvatar + dashed divider + 2-col body),
 * card-specific content (name, slug, null-safe address, isActive status chip,
 * es-AR creation date), the click emit contract, and the "no kebab / no
 * checkbox" rule.
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TenantCard from '../TenantCard.vue'
import type { TenantTableRow } from '../../interfaces/tenant.types'

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

function makeTenant(overrides: Partial<TenantTableRow> = {}): TenantTableRow {
  return {
    id: 'tenant-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    address: 'Av. Siempre Viva 123',
    isActive: true,
    createdAt: '2024-01-15T12:00:00.000Z',
    updatedAt: '2024-01-15T12:00:00.000Z',
    ...overrides,
  }
}

describe('TenantCard', () => {
  it('renders the article root with the card testid and the dashed divider', () => {
    const wrapper = mount(TenantCard, { props: { tenant: makeTenant() } })
    expect(wrapper.find('article[data-testid="tenant-card"]').exists()).toBe(true)
    expect(wrapper.find('.border-dashed').exists()).toBe(true)
  })

  it('passes name and id to EntityAvatar as name/seed with size lg', () => {
    const wrapper = mount(TenantCard, {
      props: { tenant: makeTenant({ id: 'tenant-42' }) },
    })
    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('data-name')).toBe('Acme Corp')
    expect(avatar.attributes('data-seed')).toBe('tenant-42')
    expect(avatar.attributes('data-size')).toBe('lg')
  })

  it('renders the tenant name and slug', () => {
    const wrapper = mount(TenantCard, { props: { tenant: makeTenant() } })
    expect(wrapper.text()).toContain('Acme Corp')
    expect(wrapper.text()).toContain('acme-corp')
  })

  it('renders the address under the Dirección column', () => {
    const wrapper = mount(TenantCard, { props: { tenant: makeTenant() } })
    expect(wrapper.text()).toContain('Dirección')
    expect(wrapper.text()).toContain('Av. Siempre Viva 123')
  })

  it('falls back to an em-dash when the address is missing', () => {
    const wrapper = mount(TenantCard, { props: { tenant: makeTenant({ address: undefined }) } })
    expect(wrapper.text()).toContain('—')
  })

  it('shows the Activa status chip when isActive is true', () => {
    const wrapper = mount(TenantCard, {
      props: { tenant: makeTenant({ isActive: true }) },
    })
    const badge = wrapper.find('[data-testid="status-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-label')).toBe('Activa')
    expect(badge.attributes('data-tone')).toBe('active')
  })

  it('shows the Inactiva status chip when isActive is false', () => {
    const wrapper = mount(TenantCard, {
      props: { tenant: makeTenant({ isActive: false }) },
    })
    const badge = wrapper.find('[data-testid="status-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-label')).toBe('Inactiva')
    expect(badge.attributes('data-tone')).toBe('inactive')
  })

  it('renders the creation date in es-AR under the Creación column', () => {
    const wrapper = mount(TenantCard, { props: { tenant: makeTenant() } })
    expect(wrapper.text()).toContain('Creación')
    expect(wrapper.text()).toContain('15 de ene de 2024')
  })

  it('emits click with the tenant object when the article is clicked', async () => {
    const tenant = makeTenant()
    const wrapper = mount(TenantCard, { props: { tenant } })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual(tenant)
  })

  it('does not render a kebab menu or a checkbox', () => {
    const wrapper = mount(TenantCard, { props: { tenant: makeTenant() } })
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(false)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })
})
