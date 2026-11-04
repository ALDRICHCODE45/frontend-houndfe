// TenantSelectionList.spec.ts — branch picker states: empty, no match and data.
// Rows are neutral (no per-tenant rainbow), the status is a StatusBadge and
// choosing a row highlights it without submitting.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { TenantSummary } from '@/features/auth/interfaces/auth.types'
import TenantSelectionList from '../TenantSelectionList.vue'

const tenants: TenantSummary[] = [
  { id: 't-1', slug: 'centro', name: 'Sucursal Centro', status: 'open', address: 'Av. Juárez 10' },
  { id: 't-2', slug: 'norte', name: 'Sucursal Norte', status: 'closed', onShiftCount: 3 },
]

function render(list: TenantSummary[]) {
  return mountWithUApp(TenantSelectionList, { props: { tenants: list } })
}

describe('TenantSelectionList', () => {
  it('lists branches with a StatusBadge, a neutral initial and no ids', () => {
    const wrapper = render(tenants)
    const rows = wrapper.findAll('[data-testid="tenant-row"]')

    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Sucursal Centro')
    expect(rows[0]!.get('.hf-status-badge').attributes('data-tone')).toBe('success')
    expect(rows[0]!.get('.hf-status-badge').text()).toBe('Abierta')
    expect(rows[1]!.get('.hf-status-badge').attributes('data-tone')).toBe('neutral')
    expect(rows[1]!.get('.hf-status-badge').text()).toBe('Cerrada')
    expect(rows[1]!.text()).toContain('3 en turno')
    expect(wrapper.html()).not.toMatch(/bg-(amber|rose|sky|emerald|violet|orange)-/)
    expect(wrapper.text()).not.toContain('t-1')
    expect(wrapper.text()).not.toMatch(/ABIERTA|CERRADA/)
  })

  it('highlights a row and emits select without confirming', async () => {
    const wrapper = render(tenants)

    await wrapper.findAll('[data-testid="tenant-row"]')[1]!.trigger('click')

    expect(wrapper.emitted('select')).toEqual([['t-2']])
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.findAll('[data-testid="tenant-row"]')[1]!.attributes('aria-pressed')).toBe('true')
  })

  it('shows the empty state when the user has no branches', () => {
    const wrapper = render([])

    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('empty')
    expect(wrapper.text()).toContain('No tienes sucursales disponibles')
    expect(wrapper.find('[data-testid="tenant-row"]').exists()).toBe(false)
  })

  it('shows no-match with a way to clear the search', async () => {
    const wrapper = render(tenants)

    await wrapper.get('input[aria-label="Buscar sucursal"]').setValue('zzz')

    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('no-match')
    expect(state.text()).toContain('Ningún resultado para «zzz»')

    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')

    expect(wrapper.findAll('[data-testid="tenant-row"]')).toHaveLength(2)
  })

  it('selects the only branch up front, so the row shows it chosen and Continuar can be used', async () => {
    const wrapper = render([tenants[0]!])
    await wrapper.vm.$nextTick()

    const row = wrapper.get('[data-testid="tenant-row"]')
    expect(row.attributes('aria-pressed')).toBe('true')
    expect(row.attributes('data-selected')).toBe('true')
    expect(wrapper.emitted('select')).toEqual([['t-1']])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('leaves the choice to the person when there are several branches', async () => {
    const wrapper = render(tenants)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.findAll('[data-selected="true"]')).toHaveLength(0)
  })
})
