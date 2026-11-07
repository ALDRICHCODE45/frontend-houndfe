/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
//
// Premium tables T9: the three Caja lists keep their column layout (order, pins, widths,
// visibility, density) per user in this browser, one key per list (never per register or
// session), and «Restablecer columnas» forgets it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import { columnLabel } from '@/core/shared/components/DataTable/columnLayout.utils'
import CashMovementsPanel from '../CashMovementsPanel.vue'
import CashRegistersPanel from '../CashRegistersPanel.vue'
import CashSessionsPanel from '../CashSessionsPanel.vue'

const isMobile = ref(false)
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isMobile }) }
})

enableAutoUnmount(afterEach)
beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const session = {
  id: 's-1',
  tenantId: 't-1',
  registerId: 'r-1',
  status: 'OPEN',
  cashierUserId: 'cashier-1',
  openingCents: 50000,
  frozenAt: null,
  drawerReleasedAt: null,
  blind: false,
}

const cases = [
  {
    name: 'CashMovementsPanel',
    key: 'pos-cash-movements',
    mount: () =>
      mountWithUApp(CashMovementsPanel, {
        props: {
          detail: {
            session,
            register: { id: 'r-1', name: 'Caja principal', isActive: true },
            movements: [],
            counts: [],
            handovers: [],
            closing: null,
            channelSnapshot: null,
          },
          currentUserId: 'cashier-1',
        },
      }),
    labels: ['Tipo', 'Fecha', 'Canal', 'Importe', 'Motivo'],
    sized: 'reason',
  },
  {
    name: 'CashSessionsPanel',
    key: 'pos-cash-sessions',
    mount: () =>
      mountWithUApp(CashSessionsPanel, {
        props: { sessions: [session], registerNames: { 'r-1': 'Caja principal' } },
      }),
    labels: ['Caja', 'Estado', 'Fondo inicial', 'Conteo', 'Cajón', 'Acciones'],
    sized: 'status',
  },
  {
    name: 'CashRegistersPanel',
    key: 'pos-cash-registers',
    mount: () =>
      mountWithUApp(CashRegistersPanel, {
        props: {
          registers: [{ id: 'r-1', name: 'Caja principal', isActive: true, createdAt: '2026-10-01T00:00:00.000Z' }],
        },
      }),
    labels: ['Caja', 'Estado', 'Acciones'],
    sized: 'status',
  },
]

describe.each(cases)('$name — column layout (premium tables T9)', ({ key, mount, labels, sized }) => {
  const storageKey = `table-preferences-${key}`

  it(`persists pins, widths, visibility and density under ${key} and resets them`, async () => {
    const wrapper = mount()
    const table = wrapper.getComponent(AppDataTable)
    expect(table.props('persistLayout')).toBe(true)

    table.vm.$emit('update:columnPinning', { left: [sized], right: [] })
    table.vm.$emit('update:columnSizing', { [sized]: 200 })
    table.vm.$emit('update:columnVisibility', { [sized]: false })
    table.vm.$emit('update:density', 'compact')
    await nextTick()
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '{}')).toMatchObject({
      pinning: { left: [sized] },
      sizing: { [sized]: 200 },
      visibility: { [sized]: false },
      density: 'compact',
    })
    expect(table.props('density')).toBe('compact')

    // A reload (a fresh mount) reads the saved layout back.
    const reloaded = mount().getComponent(AppDataTable)
    expect(reloaded.props('columnSizing')).toEqual({ [sized]: 200 })

    reloaded.vm.$emit('reset-columns')
    await nextTick()
    expect(localStorage.getItem(storageKey)).toBeNull()
    expect(reloaded.props('columnSizing')).toEqual({})
  })

  it('names every column for the column menus, never with its id', () => {
    const table = mount().getComponent(AppDataTable)
    expect(table.props('columns').map(columnLabel)).toEqual(labels)
  })
})
