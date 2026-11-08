/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashSessionsPanel (S10): the four list states plus the selection contract,
// on the shared table (desktop) and cards (mobile).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import { ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import CashSessionsPanel from '../CashSessionsPanel.vue'

const isMobile = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isMobile }) }
})

// Row ⋮ triggers only: the header ⋯ column menus share aria-haspopup="menu".
const ROW_MENU = 'button[aria-haspopup="menu"]:not([aria-label^="Opciones de la columna"])'

const SESSIONS = [
  {
    id: 's-1',
    tenantId: 't-1',
    registerId: 'r-1',
    status: 'OPEN',
    cashierUserId: 'u-1',
    openingCents: 50000,
    frozenAt: null,
    drawerReleasedAt: null,
    blind: false,
  },
  {
    id: 's-2',
    tenantId: 't-1',
    registerId: 'r-2',
    status: 'CLOSED',
    cashierUserId: 'u-1',
    openingCents: 120050,
    frozenAt: '2026-10-07T18:30:00.000Z',
    drawerReleasedAt: '2026-10-07T19:00:00.000Z',
    blind: true,
  },
]

const NAMES = { 'r-1': 'Caja principal', 'r-2': 'Caja secundaria' }

function mountPanel(props = {}) {
  return mountWithUApp(CashSessionsPanel, {
    attachTo: document.body,
    props: { sessions: SESSIONS, registerNames: NAMES, ...props },
  })
}

enableAutoUnmount(afterEach)

beforeEach(() => {
  isMobile.value = false
})

describe('CashSessionsPanel · four states', () => {
  it('empty: shows "Aún no hay sesiones" and offers opening only with permission', async () => {
    const readOnly = mountPanel({ sessions: [] })
    const state = readOnly.get('.hf-empty-state[data-kind="empty"]')
    expect(state.text()).toContain('Aún no hay sesiones')
    expect(readOnly.find('[data-testid="empty-state-action"]').exists()).toBe(false)

    const allowed = mountPanel({ sessions: [], canOpen: true })
    await allowed.get('[data-testid="empty-state-action"]').trigger('click')
    expect(allowed.emitted('request-opening')).toEqual([[]])
  })

  it('loading: renders the table skeleton and no rows', () => {
    const wrapper = mountPanel({ sessions: [], loading: true })
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid^="cash-session-open-"]').exists()).toBe(false)
  })

  it('loading on mobile: renders card skeletons', () => {
    isMobile.value = true
    const wrapper = mountPanel({ sessions: [], loading: true })
    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
  })

  it('data: rows with a status badge and the ⋮ menu, never ids', () => {
    const wrapper = mountPanel()
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    const badge = wrapper.get('[data-testid="cash-session-status-s-1"]')
    expect(badge.classes()).toContain('hf-status-badge')
    expect(badge.attributes('data-tone')).toBe('success')
    expect(badge.text()).toBe('Abierta')
    expect(
      wrapper.get('[data-testid="cash-session-status-s-2"]').attributes('data-tone'),
    ).toBe('neutral')
    expect(wrapper.get('[data-testid="cash-session-open-s-1"]').text()).toBe('Caja principal')
    expect(wrapper.get('[data-testid="cash-session-open-s-2"]').text()).toBe('Caja secundaria')
    expect(wrapper.findAll(ROW_MENU)).toHaveLength(2)
    expect(wrapper.get(ROW_MENU).attributes('aria-label')).toBe(
      'Acciones de la sesión de Caja principal, abierta',
    )
    expect(wrapper.get('[data-testid="cash-session-blind-s-2"]').text()).toBe('Ciego')
    expect(wrapper.get('[data-testid="cash-session-drawer-s-1"]').text()).toBe('Sin liberar')
    expect(wrapper.get('[data-testid="cash-session-drawer-s-2"]').text()).toBe('Liberado')
    expect(wrapper.text()).toContain('$500.00')
    expect(wrapper.text()).not.toMatch(/\bs-1\b|\br-1\b/)
  })

  it('data on mobile: cards with the badge, the money and the menu', () => {
    isMobile.value = true
    const wrapper = mountPanel()
    expect(wrapper.findAll('[data-testid="mobile-cards-list"] article')).toHaveLength(2)
    expect(wrapper.get('[data-testid="cash-session-status-s-1"]').text()).toBe('Abierta')
    expect(wrapper.findAll(ROW_MENU)).toHaveLength(2)
    expect(wrapper.text()).toContain('$1,200.50')
  })

  it('error: shows the table error with Reintentar that asks for a refresh', async () => {
    const wrapper = mountPanel({ sessions: [], error: true })
    const state = wrapper.get('[data-testid="table-error-state"]')
    expect(state.attributes('role')).toBe('alert')
    expect(state.text()).toContain('No se pudieron cargar las sesiones')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(wrapper.emitted('refresh')).toEqual([[]])
  })
})

describe('CashSessionsPanel · selection and scope', () => {
  it('selects a session from the name button, and from the whole row, once each', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="cash-session-open-s-1"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['s-1']])
    await wrapper.findAll('tbody tr')[1].get('td').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['s-1'], ['s-2']])
  })

  it('does not select again the session that is already selected', async () => {
    const wrapper = mountPanel({ selectedSessionId: 's-1' })
    expect(wrapper.get('.hf-row-secondary').text()).toBe('Seleccionada')
    await wrapper.get('[data-testid="cash-session-open-s-1"]').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('says it only lists the own sessions without the audit grant', () => {
    const own = mountPanel()
    expect(own.get('[data-testid="cash-sessions-scope-own"]').text()).toBe(
      'Solo ves tus propias sesiones.',
    )
    const audit = mountPanel({ canFilterByCashier: true })
    expect(audit.find('[data-testid="cash-sessions-scope-own"]').exists()).toBe(false)
  })

  it('reads "Caja" when the register name is unknown', () => {
    const wrapper = mountPanel({ registerNames: {} })
    expect(wrapper.get('[data-testid="cash-session-open-s-1"]').text()).toBe('Caja')
  })

  it('notes how many sessions are hidden only when the list is truncated', () => {
    expect(mountPanel().find('[data-testid="cash-sessions-total"]').exists()).toBe(false)
    const wrapper = mountPanel({ total: 40 })
    expect(wrapper.get('[data-testid="cash-sessions-total"]').text()).toBe(
      'Mostrando 2 de 40 sesiones',
    )
  })
})

describe('CashSessionsPanel · design pass (T4)', () => {
  it('sits on the data surface like every other table', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.cash-table-surface').exists()).toBe(true)
  })

  it('names what each mobile meta word refers to', () => {
    isMobile.value = true
    const wrapper = mountPanel()
    const text = wrapper.text()
    expect(text).toContain('Conteo visible')
    expect(text).toMatch(/Cajón (sin liberar|liberado)/)
  })
})

describe('CashSessionsPanel · display fields (T12)', () => {
  const OPENED = '2026-11-05T15:02:11.000Z'
  const CLOSED = '2026-11-05T22:45:30.000Z'
  const LATER = '2026-11-05T23:10:00.000Z'
  // Two closed sessions on the same register with the same fund: only the
  // cashier and the period tell them apart.
  const TWINS = [
    {
      ...SESSIONS[1],
      id: 'a',
      registerId: 'r-2',
      openedAt: OPENED,
      closedAt: CLOSED,
      cashierDisplayName: 'Ana Cajera',
    },
    {
      ...SESSIONS[1],
      id: 'b',
      registerId: 'r-2',
      openedAt: CLOSED,
      closedAt: LATER,
      cashierDisplayName: 'Luis Cajero',
    },
  ]
  const period = (from: string, to: string) =>
    `${formatShortDateTime(from)} – ${formatShortDateTime(to).split(', ')[1]}`

  it('gives each row its cashier and its period under the register name on desktop', () => {
    const wrapper = mountPanel({ sessions: TWINS })
    expect(wrapper.get('[data-testid="cash-session-cashier-a"]').text()).toBe('Ana Cajera')
    expect(wrapper.get('[data-testid="cash-session-period-a"]').text()).toBe(period(OPENED, CLOSED))
    expect(wrapper.get('[data-testid="cash-session-cashier-b"]').text()).toBe('Luis Cajero')
    expect(wrapper.get('[data-testid="cash-session-period-b"]').text()).toBe(period(CLOSED, LATER))
    // One line under the name in the primary column, which has the room for it
    // (a column of its own truncated the period at 1440).
    const firstCell = wrapper.findAll('tbody tr')[0].get('td')
    expect(firstCell.text()).toContain('Caja secundaria')
    expect(firstCell.get('[data-testid="cash-session-shift-a"]').text()).toBe(
      `Ana Cajera · ${period(OPENED, CLOSED)}`,
    )
    expect(wrapper.findAll('thead th').map((th) => th.text())).not.toContain('Turno')
  })

  it('gives each mobile card its cashier and its period', () => {
    isMobile.value = true
    const wrapper = mountPanel({ sessions: TWINS })
    expect(wrapper.get('[data-testid="cash-session-cashier-a"]').text()).toBe('Ana Cajera')
    expect(wrapper.get('[data-testid="cash-session-period-b"]').text()).toBe(period(CLOSED, LATER))
  })

  it('says since when an open session runs, never a closing time', () => {
    const wrapper = mountPanel({
      sessions: [{ ...SESSIONS[0], openedAt: OPENED, closedAt: null, cashierDisplayName: 'Ana' }],
    })
    expect(wrapper.get('[data-testid="cash-session-period-s-1"]').text()).toBe(
      `Desde ${formatShortDateTime(OPENED)}`,
    )
  })

  it('names the cashier in the ⋮ label so the twin menus differ', () => {
    const wrapper = mountPanel({ sessions: TWINS })
    const labels = wrapper
      .findAll('[aria-label]')
      .map((node) => node.attributes('aria-label'))
      .filter((label) => label.includes('Caja secundaria'))
    expect(labels.some((label) => label.includes('Ana Cajera'))).toBe(true)
    expect(labels.some((label) => label.includes('Luis Cajero'))).toBe(true)
  })

  it.each([
    ['desktop', false],
    ['mobile', true],
  ])('shows nothing for missing names or times on %s: no placeholder, no id', (_, mobile) => {
    isMobile.value = mobile
    const wrapper = mountPanel({
      sessions: [{ ...SESSIONS[0], cashierDisplayName: null, closedAt: null }],
    })
    expect(wrapper.find('[data-testid="cash-session-cashier-s-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-period-s-1"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('u-1')
    expect(wrapper.text()).not.toContain('Sin nombre')
  })
})

// Premium tables T7 (S5): the totals row counts the sessions only. Opening funds are not added
// up: each session reuses the same drawer money, so a sum would double count it (owner decision).
describe('CashSessionsPanel · totals row', () => {
  it('counts the sessions and does not sum the opening funds', () => {
    const foot = mountPanel().get('tfoot')
    expect(foot.get('th.hf-colid-register').text()).toContain('2 sesiones')
    expect(foot.get('[data-testid="table-totals-scope"]').text()).toBe('Esta página')
    for (const id of ['status', 'opening', 'count', 'drawer', 'actions']) expect(foot.get(`th.hf-colid-${id}`).text()).toBe('')
  })

  it('has no totals row on mobile cards or when empty', () => {
    expect(mountPanel({ sessions: [] }).find('tfoot').exists()).toBe(false)
    isMobile.value = true
    expect(mountPanel().find('tfoot').exists()).toBe(false)
  })
})
