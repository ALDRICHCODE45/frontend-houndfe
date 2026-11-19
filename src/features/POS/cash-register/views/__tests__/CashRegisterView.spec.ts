/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
//
// CashRegisterView — the composition surface for the Caja shift timeline
// (direction A). Mounted with the REAL composables and a mocked transport + auth
// store, so identity guards, money conversion and permission gates are exercised
// end to end:
//   - «Tu turno» selected by default; one task open in place at a time, opened
//     from the timeline or «Siguiente paso», never dispatching a command;
//   - the empty access state when no cash read is granted;
//   - a same-tenant user switch while a command is PENDING: the stale result is
//     discarded, no old session is selected and no banner reaches the new user.
//
// Mocked transport = UI/cache proof only. This is NOT live backend integration.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import { reactive } from 'vue'

vi.mock('../../api/cash.api', () => ({
  CASH_CLOSE_NOTES_MAX_LENGTH: 2000,
  cashApi: {
    listRegisters: vi.fn(),
    createRegister: vi.fn(),
    updateRegister: vi.fn(),
    listSessions: vi.fn(),
    getSession: vi.fn(),
    openSession: vi.fn(),
    startCount: vi.fn(),
    declare: vi.fn(),
    appendNotes: vi.fn(),
    verify: vi.fn(),
    cashIn: vi.fn(),
    cashOut: vi.fn(),
    declareHandover: vi.fn(),
    receiveHandover: vi.fn(),
    getCustody: vi.fn(),
    releaseDrawer: vi.fn(),
    closeSession: vi.fn(),
    listClosings: vi.fn(),
    getClosing: vi.fn(),
    getClosingPdf: vi.fn(),
    listHandoverRecipients: vi.fn(),
  },
}))

vi.mock('@/features/POS/users/api/user.api', () => ({
  usersApi: { listAssignable: vi.fn().mockResolvedValue([]), listAssignableDrivers: vi.fn() },
}))

const auth = reactive({
  currentTenantId: 'tenant-1',
  user: { id: 'user-1' } as { id: string } | null,
  permissionCodes: [] as string[],
  permissionsLoaded: true,
  userCan: vi.fn(),
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

import { cashApi } from '../../api/cash.api'
import { usersApi } from '@/features/POS/users/api/user.api'
import CashRegisterView from '../CashRegisterView.vue'
import { CLOSING, ME, makeReadyDetail, makeSession } from '../../closing/__tests__/closingFixtures'

const api = cashApi as unknown as Record<string, ReturnType<typeof vi.fn>>

const REGISTER = {
  id: 'r-1',
  name: 'Caja principal',
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
}

const SESSION = {
  id: 's-1',
  tenantId: 'tenant-1',
  registerId: 'r-1',
  status: 'SUBMITTED',
  cashierUserId: 'user-2',
  openingCents: 50000,
  frozenAt: '2026-10-07T18:30:00.000Z',
  drawerReleasedAt: null,
  blind: false,
}

const DETAIL = {
  session: SESSION,
  register: null,
  movements: [],
  counts: [],
  handovers: [],
  closing: null,
  channelSnapshot: [
    { channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH', expectedCents: 157500 },
  ],
}

const PENDING_HANDOVER = {
  id: 'h-1',
  sessionId: 's-1',
  kind: 'FLOAT',
  declaredCents: 30000,
  receivedCents: null,
  senderUserId: 'sender-1',
  receiverUserId: 'user-1',
  declaredAt: '2026-10-07T20:05:00.000Z',
  receivedAt: null,
}

const GRANTS = [
  'read:CashRegister',
  'create:CashRegister',
  'update:CashRegister',
  'create:CashSession',
  'read:CashSession',
  'read:CashHandover',
  'update:CashHandover',
  'create:CashCount',
  'create:CashIn',
  'create:CashOut',
  'create:CashVerification',
  'read:CashSessionAudit',
]

function grant(permissions: string[]) {
  const set = new Set(permissions)
  auth.userCan.mockImplementation((action: string, subject: string) =>
    set.has(`${action}:${subject}`),
  )
  auth.permissionCodes = permissions
}

const SESSION_STEPS = ['movimientos', 'conteo', 'declaracion', 'entrega', 'verificacion', 'liberar']

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function mountView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mountWithUApp(CashRegisterView, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient }
}

function mountWithPendingCustody() {
  api.getCustody.mockResolvedValue({
    pendingHandovers: { items: [PENDING_HANDOVER], page: 1, limit: 25, total: 1 },
    eligibleFloat: { items: [], page: 1, limit: 25, total: 0 },
  })
  return mountView()
}

const SUBMITTED_A = {
  ...SESSION,
  id: 's-a',
  status: 'SUBMITTED',
  blind: false,
  cashierUserId: 'cashier-1',
}
const SUBMITTED_B = {
  ...SESSION,
  id: 's-b',
  status: 'SUBMITTED',
  blind: false,
  cashierUserId: 'cashier-2',
}

function detailFor(session: Record<string, unknown>) {
  return {
    ...DETAIL,
    session,
    ...(session.blind
      ? { requiredChannels: [{ channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH' }] }
      : {}),
  }
}

function mountTwoShifts(first: Record<string, unknown>, second: Record<string, unknown>) {
  api.listSessions.mockResolvedValue({ items: [first, second], page: 1, limit: 25, total: 2 })
  api.getSession.mockImplementation((sessionId: string) =>
    Promise.resolve(detailFor(sessionId === second.id ? second : first)),
  )
  return mountView()
}

/** Old task names that map onto a timeline step. */
const TASK_ALIASES: Record<string, string> = { notas: 'declaracion', custodia: 'entrega' }

/**
 * Open a task in place: a timeline step's toggle, or «Por recibir» from the
 * summary column. It never selects a shift. The session list is always on the
 * side, so «historial» needs no navigation.
 */
async function navigate(wrapper: ReturnType<typeof mountView>['wrapper'], taskId: string) {
  if (taskId === 'historial') return
  const id = TASK_ALIASES[taskId] ?? taskId
  if (taskShown(wrapper, id)) return
  const toggle =
    id === 'recepcion' ? '[data-testid="cash-receive-entry"]' : `[data-testid="cash-step-toggle-${id}"]`
  await wrapper.get(toggle).trigger('click')
  await flush()
}

/** Choose a register in the opening radio cards (the one place to pick it). */
async function chooseRegister(wrapper: ReturnType<typeof mountView>['wrapper'], registerId: string) {
  await wrapper
    .get(`[data-testid="cash-opening-registers"] [role="radio"][data-value="${registerId}"]`)
    .trigger('click')
  await flush()
}

/**
 * `v-show` toggles the inline `display`, but jsdom caches `getComputedStyle`, so
 * VTU's `isVisible()` can go stale after a toggle. Check the inline cascade.
 */
function isShown(element: Element): boolean {
  let node: Element | null = element
  while (node) {
    if (node instanceof HTMLElement && node.style.display === 'none') return false
    node = node.parentElement
  }
  return true
}

function taskShown(wrapper: ReturnType<typeof mountView>['wrapper'], taskId: string): boolean {
  const element = wrapper.find(`[data-testid="cash-task-${taskId}"]`)
  return element.exists() && isShown(element.element)
}

async function selectSessionById(
  wrapper: ReturnType<typeof mountView>['wrapper'],
  sessionId: string,
) {
  await wrapper.get(`[data-testid="cash-session-open-${sessionId}"]`).trigger('click')
  await flush()
}

async function selectFirstSession(wrapper: ReturnType<typeof mountView>['wrapper']) {
  await selectSessionById(wrapper, 's-1')
}

enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.clearAllMocks()
  auth.currentTenantId = 'tenant-1'
  auth.user = { id: 'user-1' }
  auth.permissionsLoaded = true
  grant(GRANTS)
  api.listRegisters.mockResolvedValue([REGISTER])
  api.listSessions.mockResolvedValue({ items: [SESSION], page: 1, limit: 25, total: 1 })
  api.getCustody.mockResolvedValue({
    pendingHandovers: { items: [], page: 1, limit: 25, total: 0 },
    eligibleFloat: { items: [], page: 1, limit: 25, total: 0 },
  })
  api.getSession.mockResolvedValue(DETAIL)
  api.listHandoverRecipients.mockResolvedValue([])
  api.listClosings.mockResolvedValue({ items: [], page: 1, limit: 10, total: 0 })
})

describe('CashRegisterView · access state', () => {
  it('renders the empty access state and no workspace without any cash read', async () => {
    grant([])
    const { wrapper } = mountView()
    await flush()

    expect(wrapper.find('[data-testid="cash-access-denied"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-workspace"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-registers-panel"]').exists()).toBe(false)
    expect(api.listRegisters).not.toHaveBeenCalled()
  })
})

describe('CashRegisterView · timeline composition', () => {
  it('opens the opening in place without a shift, and one task at a time', async () => {
    const { wrapper } = mountView()
    await flush()

    expect(wrapper.get('[data-testid="cash-workspace"]').exists()).toBe(true)
    // No own shift: the opening is open in place, register management sits inside it.
    expect(taskShown(wrapper, 'apertura')).toBe(true)
    expect(wrapper.find('[data-testid="cash-registers-panel"]').exists()).toBe(true)
    // The opening form appears once a register is chosen, not as a hint before.
    expect(wrapper.find('[data-testid="cash-open-session"]').exists()).toBe(false)
    // The session list is always on the side.
    expect(wrapper.find('[data-testid="cash-sessions-panel"]').exists()).toBe(true)

    await navigate(wrapper, 'recepcion')
    expect(taskShown(wrapper, 'recepcion')).toBe(true)
    expect(taskShown(wrapper, 'apertura')).toBe(false)
    expect(wrapper.find('[data-testid="cash-custody-discovery"]').exists()).toBe(true)
  })

  it('selects the register and opens the session form for it', async () => {
    const { wrapper } = mountView()
    await flush()

    await chooseRegister(wrapper, 'r-1')

    expect(wrapper.get('[data-testid="cash-open-register"]').text()).toContain('Caja principal')
    expect(wrapper.find('[data-testid="cash-open-no-register"]').exists()).toBe(false)
  })

  it('offers every reachable step on its own, without forcing an order', async () => {
    const own = { ...SESSION, status: 'OPEN', cashierUserId: 'user-1', blind: true }
    api.listSessions.mockResolvedValue({ items: [own], page: 1, limit: 25, total: 1 })
    api.getSession.mockResolvedValue(detailFor(own))
    const { wrapper } = mountView()
    await flush()
    await flush()

    for (const id of ['apertura', 'movimientos', 'conteo']) {
      expect(wrapper.find(`[data-testid="cash-step-toggle-${id}"]`).exists()).toBe(true)
    }
    // Later steps say who does them and wait, without an action yet.
    expect(wrapper.find('[data-testid="cash-step-toggle-verificacion"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="cash-step-state-verificacion"]').text()).toBe('Estado: Después')
    // Opening a later-suggested step first is allowed.
    await navigate(wrapper, 'movimientos')
    expect(taskShown(wrapper, 'movimientos')).toBe(true)
  })

  it('keeps the page title equal to the breadcrumb when another task is opened', async () => {
    const { wrapper } = mountView()
    await flush()

    expect(wrapper.get('[data-testid="cash-workspace-heading"]').text()).toBe('Caja')

    await navigate(wrapper, 'recepcion')

    expect(wrapper.get('[data-testid="cash-workspace-heading"]').text()).toBe('Caja')
  })
})

describe('CashRegisterView · navigation visibility rules', () => {
  it('offers a session step only while a shift is explicitly selected', async () => {
    const { wrapper } = mountView()
    await flush()

    for (const id of SESSION_STEPS) {
      expect(wrapper.find(`[data-testid="cash-step-toggle-${id}"]`).exists()).toBe(false)
    }

    await selectFirstSession(wrapper)

    for (const id of SESSION_STEPS) {
      expect(wrapper.find(`[data-testid="cash-step-toggle-${id}"]`).exists()).toBe(true)
    }
    // The close and the corte wait for the verification and the release.
    expect(wrapper.find('[data-testid="cash-step-toggle-cierre"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-step-toggle-corte"]').exists()).toBe(false)
  })

  it('hides the reception task when custody read is not granted', async () => {
    grant(GRANTS.filter((permission) => permission !== 'read:CashHandover'))
    const { wrapper } = mountView()
    await flush()

    expect(wrapper.find('[data-testid="cash-receive-entry"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-custody-discovery"]').exists()).toBe(false)
  })

  it('names the session list for its real scope, with filters only for the branch list', async () => {
    grant(GRANTS.filter((permission) => permission !== 'read:CashSessionAudit'))
    const scopeOwn = mountView()
    await flush()
    expect(scopeOwn.wrapper.get('[data-testid="cash-sessions-title"]').text()).toBe('Mis sesiones')
    expect(scopeOwn.wrapper.find('[data-testid="cash-sessions-filters"]').exists()).toBe(false)
    expect(scopeOwn.wrapper.text()).not.toMatch(/por verificar/i)

    grant(GRANTS)
    const scopeAudit = mountView()
    await flush()
    expect(scopeAudit.wrapper.get('[data-testid="cash-sessions-title"]').text()).toBe(
      'Sesiones de la sucursal',
    )
    expect(scopeAudit.wrapper.find('[data-testid="cash-sessions-filters"]').exists()).toBe(true)
  })

  it('never selects a shift or dispatches a command from navigation alone', async () => {
    const { wrapper } = mountView()
    await flush()

    expect(api.getSession).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)

    await navigate(wrapper, 'historial')
    expect(api.getSession).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)

    // Only the explicit session action selects a shift.
    await wrapper.get('[data-testid="cash-session-open-s-1"]').trigger('click')
    await flush()
    expect(api.getSession).toHaveBeenCalledWith('s-1')
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(true)

    await navigate(wrapper, 'movimientos')
    await navigate(wrapper, 'verificacion')
    expect(api.cashIn).not.toHaveBeenCalled()
    expect(api.cashOut).not.toHaveBeenCalled()
    expect(api.startCount).not.toHaveBeenCalled()
    expect(api.verify).not.toHaveBeenCalled()
  })

  it('keeps a movement draft when navigating between tasks and back', async () => {
    const openSession = { ...SESSION, status: 'OPEN', cashierUserId: 'user-1', blind: false }
    api.listSessions.mockResolvedValue({ items: [openSession], page: 1, limit: 25, total: 1 })
    api.getSession.mockResolvedValue({ ...DETAIL, session: openSession })

    const { wrapper } = mountView()
    await flush()
    await selectFirstSession(wrapper)

    await navigate(wrapper, 'movimientos')
    await wrapper.get('[data-testid="cash-movement-amount"]').setValue('25.00')
    await wrapper.get('[data-testid="cash-movement-reason"]').setValue('Compra de bolsas')

    await navigate(wrapper, 'conteo')
    await navigate(wrapper, 'movimientos')

    expect(wrapper.get('[data-testid="cash-movement-amount"]').element.value).toBe('25.00')
    expect(wrapper.get('[data-testid="cash-movement-reason"]').element.value).toBe(
      'Compra de bolsas',
    )
  })
})

describe('CashRegisterView · blind count task', () => {
  it('shows every frozen channel and no expected values in a blind window', async () => {
    const blindSession = {
      ...SESSION,
      status: 'COUNTING',
      blind: true,
      cashierUserId: 'user-1',
      frozenAt: '2026-10-07T19:00:00.000Z',
    }
    api.listSessions.mockResolvedValue({ items: [blindSession], page: 1, limit: 25, total: 1 })
    api.getSession.mockResolvedValue({
      ...DETAIL,
      session: blindSession,
      channelSnapshot: [
        { channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH', expectedCents: 157500 },
        {
          channelKey: 'PM:1',
          channelLabel: 'Tarjeta de crédito',
          method: 'CARD_CREDIT',
          expectedCents: 40000,
        },
      ],
      requiredChannels: [
        { channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH' },
        { channelKey: 'PM:1', channelLabel: 'Tarjeta de crédito', method: 'CARD_CREDIT' },
      ],
    })

    const { wrapper } = mountView()
    await flush()
    await selectFirstSession(wrapper)
    await navigate(wrapper, 'declaracion')

    expect(wrapper.find('[data-testid="cash-count-input-CASH"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-count-input-PM:1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-session-expected"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-freeze"]').exists()).toBe(false)
  })
})

describe('CashRegisterView · stale results after a same-tenant user switch', () => {
  it('discards a pending opening: no old session is selected and no banner reaches the new user', async () => {
    // No own shift for either principal, so nothing is selected by default.
    api.listSessions.mockResolvedValue({ items: [], page: 1, limit: 25, total: 0 })
    const { wrapper } = mountView()
    await flush()

    await chooseRegister(wrapper, 'r-1')

    // Fill and submit the opening while the command is still in flight.
    const pending = deferred<unknown>()
    api.openSession.mockReturnValueOnce(pending.promise)

    // 500.00 pesos → the 50000 integer cents carried by the session fixture.
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    await flush()

    // The principal changes within the same tenant, then the old response lands.
    auth.user = { id: 'user-2' }
    pending.resolve({ session: { id: 's-1' }, register: REGISTER })
    await flush()
    await flush()

    // No old session is selected for the new user, and no stale error is shown.
    expect(api.getSession).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-open-error"]').exists()).toBe(false)
  })

  it('does select the new session when the principal is unchanged (control)', async () => {
    const { wrapper } = mountView()
    await flush()

    await chooseRegister(wrapper, 'r-1')

    api.openSession.mockResolvedValueOnce({ session: { id: 's-1' }, register: REGISTER })

    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    await flush()
    await flush()

    // The pesos entry converts exactly once; the API receives integer cents.
    expect(api.openSession).toHaveBeenCalledWith(
      'r-1',
      { openingCents: 50000, openingConfirmed: true },
      expect.any(String),
    )
    expect(api.getSession).toHaveBeenCalledWith('s-1')
  })
})

// Live run 2 (2026-11-18): after a 201 OPEN the opening form stayed mounted for
// the same register with the fund still confirmed and the submit enabled.
describe('CashRegisterView · leaving the opening state after an open', () => {
  const OPENED = {
    ...SESSION,
    id: 's-new',
    status: 'OPEN',
    cashierUserId: 'user-1',
    openingCents: 50000,
    frozenAt: null,
    blind: false,
  }

  async function fillOpening(wrapper: ReturnType<typeof mountView>['wrapper']) {
    await chooseRegister(wrapper, 'r-1')
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
  }

  it('removes the opening form and focuses the new session after a resolved open', async () => {
    api.getSession.mockImplementation((sessionId: string) =>
      Promise.resolve(sessionId === 's-new' ? detailFor(OPENED) : DETAIL),
    )
    const { wrapper } = mountView()
    await flush()
    await fillOpening(wrapper)

    api.openSession.mockResolvedValueOnce({ session: OPENED, register: REGISTER })
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    await flush()
    await flush()

    // No opening form (and no submit) is left for the register just opened.
    expect(wrapper.find('[data-testid="cash-open-session"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-open-submit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-opening-confirmation"]').exists()).toBe(false)
    // The new session is the focused shift: «Abierta» with its fund.
    expect(api.getSession).toHaveBeenLastCalledWith('s-new')
    const card = wrapper.get('[data-testid="cash-workspace-shift-card"]')
    expect(card.get('[data-testid="cash-shift-status"]').text()).toContain('Abierta')
    expect(card.get('[data-testid="cash-session-opening"]').text()).toContain('500.00')
    expect(api.openSession).toHaveBeenCalledTimes(1)
  })

  it('keeps the form, its values and the error after a rejected open', async () => {
    const { wrapper } = mountView()
    await flush()
    await fillOpening(wrapper)

    api.openSession.mockRejectedValueOnce(new Error('apertura rechazada'))
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    await flush()
    await flush()

    expect(wrapper.find('[data-testid="cash-open-error"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cash-open-register"]').text()).toContain('Caja principal')
    expect(
      (wrapper.get('[data-testid="cash-opening-cents"]').element as HTMLInputElement).value,
    ).toBe('500.00')
    expect(wrapper.get('[data-testid="cash-opening-confirmation"]').text()).toContain(
      'Fondo de $500.00 confirmado',
    )
    expect(wrapper.find('[data-testid="cash-open-submit"]').exists()).toBe(true)
    expect(
      wrapper
        .find('[data-testid="cash-workspace-shift-card"] [data-testid="cash-shift-status"]')
        .exists(),
    ).toBe(false)
  })

  it('sends the open exactly once when the submit is clicked twice quickly', async () => {
    const { wrapper } = mountView()
    await flush()
    await fillOpening(wrapper)

    const pending = deferred<unknown>()
    api.openSession.mockReturnValueOnce(pending.promise)
    const submit = wrapper.get('[data-testid="cash-open-submit"]')
    // Two clicks in the same tick: the second lands before the pending render.
    void submit.trigger('click')
    await submit.trigger('click')
    await flush()

    expect(api.openSession).toHaveBeenCalledTimes(1)
    // The repeat is absorbed quietly, not reported as a failure.
    expect(wrapper.find('[data-testid="cash-open-error"]').exists()).toBe(false)

    pending.resolve({ session: OPENED, register: REGISTER })
    await flush()
    await flush()
    expect(api.openSession).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="cash-open-submit"]').exists()).toBe(false)
  })
})

describe('CashRegisterView · receipt pending wiring and overlapping entry', () => {
  it('tracks the receipt target while pending, blocks a repeat and other command controls', async () => {
    const receipt = deferred<unknown>()
    api.receiveHandover.mockReturnValueOnce(receipt.promise)
    const { wrapper } = mountWithPendingCustody()
    await flush()

    // Select a session so the other command controls (drawer release) exist.
    await selectFirstSession(wrapper)
    await navigate(wrapper, 'recepcion')

    // 300.00 pesos → the declared 30000 integer cents, converted exactly once.
    await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue('300.00')
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    await flush()

    expect(api.receiveHandover).toHaveBeenCalledWith(
      'h-1',
      { receivedCents: 30000 },
      expect.any(String),
    )

    // The pending target is tracked: the receipt control is disabled and a repeat
    // click cannot start a second command.
    expect(
      wrapper.get('[data-testid="cash-custody-receive-h-1"]').attributes('disabled'),
    ).toBeDefined()
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    expect(api.receiveHandover).toHaveBeenCalledTimes(1)

    // Other command controls are disabled while a command is in flight.
    expect(wrapper.get('[data-testid="cash-drawer-release"]').attributes('disabled')).toBeDefined()

    receipt.resolve({ id: 'h-1' })
    await flush()
    await flush()

    expect(api.receiveHandover).toHaveBeenCalledTimes(1)
    expect(
      wrapper.get('[data-testid="cash-custody-receive-h-1"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('rejects a blank or over-precise receipt amount without dispatching a command', async () => {
    const { wrapper } = mountWithPendingCustody()
    await flush()
    await navigate(wrapper, 'recepcion')

    // Blank is MISSING, not a zero amount.
    await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue('')
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    await flush()

    // A third decimal is rejected, never silently rounded.
    await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue('300.001')
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    await flush()

    expect(api.receiveHandover).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cash-custody-local-error"]').exists()).toBe(true)
  })
})

describe('CashRegisterView · sensitive local state is cleared on an identity change', () => {
  it('drops the previous selection and a completed comparison when the session ends', async () => {
    const { wrapper } = mountView()
    await flush()

    // Register + session selection through the focused tasks.
    await chooseRegister(wrapper, 'r-1')
    await selectFirstSession(wrapper)
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(true)

    // Publish a completed verification comparison through the public recount form.
    api.verify.mockResolvedValueOnce({
      sessionId: 's-1',
      verification: {},
      comparison: {
        expectedCents: 157500,
        declaredCents: 158000,
        verifiedCents: 158300,
        declarationDifferenceCents: 500,
        verificationDifferenceCents: 300,
        verifiedVsExpectedDifferenceCents: 800,
        requiresDeclarationNotes: true,
        requiresVerificationNotes: true,
        hasDiscrepancy: true,
      },
    })
    await navigate(wrapper, 'verificacion')
    await wrapper.get('[data-testid="cash-count-input-CASH"]').setValue('1583.00')
    await wrapper.get('[data-testid="cash-count-notes"]').setValue('Recuento independiente')
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    await flush()
    await flush()
    expect(wrapper.find('[data-testid="cash-verification-verification-difference"]').exists()).toBe(
      true,
    )

    // The session lifecycle ends (logout): nothing sensitive may survive.
    auth.currentTenantId = ''
    auth.user = null
    auth.permissionCodes = []
    await flush()
    await flush()

    expect(wrapper.find('[data-testid="cash-verification-verification-difference"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('[data-testid="cash-session-summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-open-session"]').exists()).toBe(false)
  })
})

describe('CashRegisterView · verification access is derived, never granted', () => {
  it('does not offer verification without the audit scope even with create:CashVerification', async () => {
    // create:CashVerification WITHOUT read:CashSessionAudit: the derived gate is closed.
    grant(['read:CashRegister', 'read:CashSession', 'create:CashVerification'])
    const { wrapper } = mountView()
    await flush()

    await selectFirstSession(wrapper)
    await navigate(wrapper, 'verificacion')

    expect(wrapper.get('[data-testid="cash-verification-forbidden"]').exists()).toBe(true)
  })
})

describe('CashRegisterView · peso entry maps to integer cents and blanks never dispatch', () => {
  it('refuses a blank channel and sends the exact cents of a valid pesos count', async () => {
    const { wrapper } = mountView()
    await flush()

    await selectFirstSession(wrapper)
    await navigate(wrapper, 'verificacion')

    // A blank channel is MISSING, not a counted zero: nothing is dispatched.
    await wrapper.get('[data-testid="cash-count-input-CASH"]').setValue('')
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    await flush()
    expect(api.verify).not.toHaveBeenCalled()

    // 1583.00 pesos → the unchanged 158300 integer cents the API expects.
    api.verify.mockResolvedValueOnce({ sessionId: 's-1', verification: {}, comparison: {} })
    await wrapper.get('[data-testid="cash-count-input-CASH"]').setValue('1583.00')
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    await flush()
    await flush()

    expect(api.verify).toHaveBeenCalledWith(
      's-1',
      { lines: [{ channelKey: 'CASH', amountCents: 158300 }] },
      expect.any(String),
    )
  })
})

describe('CashRegisterView · identity-scoped workspace drafts', () => {
  it('keeps a same-actor opening draft while moving between tasks', async () => {
    const { wrapper } = mountView()
    await flush()

    await chooseRegister(wrapper, 'r-1')
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')

    await navigate(wrapper, 'recepcion')
    await navigate(wrapper, 'apertura')

    expect(wrapper.get('[data-testid="cash-opening-cents"]').element.value).toBe('500.00')
  })

  it('never hands an opening draft to a different actor on the same register', async () => {
    api.listSessions.mockResolvedValue({ items: [], page: 1, limit: 25, total: 0 })
    const { wrapper } = mountView()
    await flush()

    await chooseRegister(wrapper, 'r-1')
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    expect(wrapper.get('[data-testid="cash-opening-cents"]').element.value).toBe('500.00')

    // Same tenant, different principal: this is no longer the previous user's workspace.
    auth.user = { id: 'user-2' }
    await flush()
    await flush()
    await flush()

    // The new actor selects the same register; the previous draft must be gone.
    await chooseRegister(wrapper, 'r-1')

    expect(wrapper.get('[data-testid="cash-opening-cents"]').element.value).toBe('')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    await flush()
    expect(api.openSession).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cash-open-local-error"]').exists()).toBe(true)
  })

  it('clears an opening draft when another register is selected', async () => {
    api.listRegisters.mockResolvedValue([
      REGISTER,
      { ...REGISTER, id: 'r-2', name: 'Caja secundaria' },
    ])
    const { wrapper } = mountView()
    await flush()

    await chooseRegister(wrapper, 'r-1')
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')

    await chooseRegister(wrapper, 'r-2')

    expect(wrapper.get('[data-testid="cash-open-register"]').text()).toContain('Caja secundaria')
    expect(wrapper.get('[data-testid="cash-opening-cents"]').element.value).toBe('')
  })

  it('clears an opening draft when the permission set changes', async () => {
    const { wrapper } = mountView()
    await flush()

    await chooseRegister(wrapper, 'r-1')
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')

    // The opening ability survives, but the permission fingerprint does not:
    // this is a different identity scope and no draft may carry over.
    grant(GRANTS.filter((permission) => permission !== 'read:CashSessionAudit'))
    await flush()
    await flush()
    await flush()

    await chooseRegister(wrapper, 'r-1')
    expect(wrapper.get('[data-testid="cash-opening-cents"]').element.value).toBe('')
  })

  it('clears a reception draft when the identity changes', async () => {
    const { wrapper } = mountWithPendingCustody()
    await flush()
    await navigate(wrapper, 'recepcion')
    await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue('300.00')

    // A new permission set is a new identity scope for the same recipient.
    grant([...GRANTS, 'read:User'])
    await flush()
    await flush()
    await flush()

    expect(wrapper.get('[data-testid="cash-custody-received-input-h-1"]').element.value).toBe('')
  })

  it('clears session-task drafts when another shift is selected', async () => {
    const first = { ...SESSION, id: 's-1', status: 'OPEN', cashierUserId: 'user-1' }
    const second = { ...SESSION, id: 's-2', status: 'OPEN', cashierUserId: 'user-1' }
    api.listSessions.mockResolvedValue({ items: [first, second], page: 1, limit: 25, total: 2 })
    api.getSession.mockImplementation((sessionId: string) =>
      Promise.resolve({ ...DETAIL, session: sessionId === 's-2' ? second : first }),
    )

    const { wrapper } = mountView()
    await flush()
    await selectSessionById(wrapper, 's-1')
    await navigate(wrapper, 'movimientos')
    await wrapper.get('[data-testid="cash-movement-amount"]').setValue('25.00')

    await selectSessionById(wrapper, 's-2')
    await navigate(wrapper, 'movimientos')

    expect(wrapper.get('[data-testid="cash-movement-amount"]').element.value).toBe('')
  })
})

describe('CashRegisterView · late comparisons after a shift switch', () => {
  const COMPARISON = {
    expectedCents: 157500,
    declaredCents: 158000,
    declarationDifferenceCents: 500,
    verificationDifferenceCents: 300,
  }

  it('never renders a declaration comparison from a shift that is no longer selected', async () => {
    const countingA = { ...SUBMITTED_A, status: 'COUNTING', blind: true }
    const { wrapper } = mountTwoShifts(countingA, SUBMITTED_B)
    await flush()

    await selectSessionById(wrapper, 's-a')
    await navigate(wrapper, 'declaracion')
    await wrapper.get('[data-testid="cash-count-input-CASH"]').setValue('1583.00')

    const pending = deferred<unknown>()
    api.declare.mockReturnValueOnce(pending.promise)
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    await flush()
    expect(api.declare).toHaveBeenCalledWith(
      's-a',
      { lines: [{ channelKey: 'CASH', amountCents: 158300 }] },
      expect.any(String),
    )

    // The operator moves to another shift while A's declaration is in flight.
    await selectSessionById(wrapper, 's-b')
    pending.resolve({ sessionId: 's-a', declaration: {}, comparison: COMPARISON })
    await flush()
    await flush()
    await flush()

    await navigate(wrapper, 'verificacion')
    await flush()
    expect(wrapper.find('[data-testid="cash-verification-declared"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-verification-no-comparison"]').exists()).toBe(true)
  })

  it('never renders a verification comparison from a shift that is no longer selected', async () => {
    const { wrapper } = mountTwoShifts(SUBMITTED_A, SUBMITTED_B)
    await flush()

    await selectSessionById(wrapper, 's-a')
    await navigate(wrapper, 'verificacion')
    await wrapper.get('[data-testid="cash-count-input-CASH"]').setValue('1583.00')

    const pending = deferred<unknown>()
    api.verify.mockReturnValueOnce(pending.promise)
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    await flush()
    expect(api.verify).toHaveBeenCalledTimes(1)

    await selectSessionById(wrapper, 's-b')
    pending.resolve({ sessionId: 's-a', verification: {}, comparison: COMPARISON })
    await flush()
    await flush()
    await flush()

    await navigate(wrapper, 'verificacion')
    await flush()
    expect(wrapper.find('[data-testid="cash-verification-declared"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-verification-no-comparison"]').exists()).toBe(true)
  })

  it('does not reuse a comparison when the same shift is reselected while pending', async () => {
    const { wrapper } = mountTwoShifts(SUBMITTED_A, SUBMITTED_B)
    await flush()

    await selectSessionById(wrapper, 's-a')
    await navigate(wrapper, 'verificacion')
    await wrapper.get('[data-testid="cash-count-input-CASH"]').setValue('1583.00')

    const pending = deferred<unknown>()
    api.verify.mockReturnValueOnce(pending.promise)
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    await flush()

    await selectSessionById(wrapper, 's-b')
    await selectSessionById(wrapper, 's-a')
    pending.resolve({ sessionId: 's-a', verification: {}, comparison: COMPARISON })
    await flush()
    await flush()
    await flush()

    await navigate(wrapper, 'verificacion')
    await flush()
    expect(wrapper.find('[data-testid="cash-verification-declared"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-verification-no-comparison"]').exists()).toBe(true)
  })

  it('drops a stale declaration failure instead of showing it on another shift', async () => {
    const countingA = { ...SUBMITTED_A, status: 'COUNTING', blind: true }
    const countingB = { ...SUBMITTED_B, status: 'COUNTING', blind: true }
    const { wrapper } = mountTwoShifts(countingA, countingB)
    await flush()

    await selectSessionById(wrapper, 's-a')
    await navigate(wrapper, 'declaracion')
    await wrapper.get('[data-testid="cash-count-input-CASH"]').setValue('1583.00')

    const pending = deferred<unknown>()
    api.declare.mockReturnValueOnce(pending.promise)
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    await flush()

    // Shift A's request fails only after the operator already moved to shift B:
    // B receives neither A's comparison nor A's error banner.
    await selectSessionById(wrapper, 's-b')
    pending.resolve(Promise.reject(new Error('declaración rechazada')))
    await flush()
    await flush()
    await flush()

    await navigate(wrapper, 'declaracion')
    await flush()
    expect(wrapper.find('[data-testid="cash-count-error"]').exists()).toBe(false)
  })
})

describe('CashRegisterView · contextual feedback after a selection change', () => {
  const countingA = { ...SUBMITTED_A, status: 'COUNTING', blind: true }
  const countingB = { ...SUBMITTED_B, status: 'COUNTING', blind: true }

  it('clears a settled declaration banner when another shift is selected', async () => {
    const { wrapper } = mountTwoShifts(countingA, countingB)
    await flush()

    await selectSessionById(wrapper, 's-a')
    await navigate(wrapper, 'declaracion')
    await wrapper.get('[data-testid="cash-count-input-CASH"]').setValue('1583.00')
    api.declare.mockRejectedValueOnce(new Error('declaración rechazada'))
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    await flush()
    await flush()
    expect(api.declare).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="cash-count-error"]').exists()).toBe(true)

    // Selecting another shift is navigation, never a command: the banner that
    // belonged to the previous shift is not part of the new shift's surface.
    await selectSessionById(wrapper, 's-b')
    await navigate(wrapper, 'declaracion')
    expect(wrapper.find('[data-testid="cash-count-error"]').exists()).toBe(false)
    expect(api.declare).toHaveBeenCalledTimes(1)
  })

  it('clears a settled verification banner when another shift is selected', async () => {
    const { wrapper } = mountTwoShifts(SUBMITTED_A, SUBMITTED_B)
    await flush()

    await selectSessionById(wrapper, 's-a')
    await navigate(wrapper, 'verificacion')
    await wrapper.get('[data-testid="cash-count-input-CASH"]').setValue('1583.00')
    api.verify.mockRejectedValueOnce(new Error('verificación rechazada'))
    await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
    await flush()
    await flush()
    expect(wrapper.find('[data-testid="cash-verification-error"]').exists()).toBe(true)

    await selectSessionById(wrapper, 's-b')
    await navigate(wrapper, 'verificacion')
    expect(wrapper.find('[data-testid="cash-verification-error"]').exists()).toBe(false)
    expect(api.verify).toHaveBeenCalledTimes(1)
  })

  it('clears a settled opening banner when another register is selected', async () => {
    api.listRegisters.mockResolvedValue([
      REGISTER,
      { ...REGISTER, id: 'r-2', name: 'Caja secundaria' },
    ])
    const { wrapper } = mountView()
    await flush()

    await chooseRegister(wrapper, 'r-1')
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    api.openSession.mockRejectedValueOnce(new Error('apertura rechazada'))
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    await flush()
    await flush()
    expect(wrapper.find('[data-testid="cash-open-error"]').exists()).toBe(true)

    await chooseRegister(wrapper, 'r-2')
    expect(wrapper.find('[data-testid="cash-open-error"]').exists()).toBe(false)
  })
})

describe('CashRegisterView · four states (S10)', () => {
  it('empty: registers, sessions and the unselected shift each say "nada todavía"', async () => {
    api.listRegisters.mockResolvedValue([])
    api.listSessions.mockResolvedValue({ items: [], page: 1, limit: 25, total: 0 })
    const { wrapper } = mountView()
    await flush()

    const registers = wrapper.get('[data-testid="cash-registers-panel"]')
    expect(registers.get('.hf-empty-state[data-kind="empty"]').text()).toContain('Aún no hay cajas')
    // With no registers the management disclosure opens itself (the create form is the way on).
    expect(wrapper.get('[data-testid="cash-opening-manage"]').attributes('open')).toBeDefined()
    const sessionsPanel = wrapper.get('[data-testid="cash-sessions-panel"]')
    expect(sessionsPanel.get('.hf-empty-state[data-kind="empty"]').text()).toContain(
      'Aún no hay sesiones',
    )
    expect(wrapper.get('[data-testid="cash-workspace-no-shift"]').text()).toContain(
      'Aún no hay un turno en foco',
    )
    expect(wrapper.get('[data-testid="cash-workspace-no-shift"]').text()).toContain(
      'Aún no hay cajas para abrir un turno.',
    )
  })

  it('the Tu turno card follows the page states: skeleton, then choose a register, then the float', async () => {
    api.listRegisters.mockReturnValue(new Promise(() => {}))
    const loading = mountView()
    await flush()
    expect(loading.wrapper.get('[data-testid="cash-shift-context-loading"]').attributes('aria-busy')).toBe('true')
    expect(loading.wrapper.find('[data-testid="cash-workspace-no-shift"]').exists()).toBe(false)

    api.listRegisters.mockResolvedValue([REGISTER])
    const ready = mountView()
    await flush()
    expect(ready.wrapper.get('[data-testid="cash-workspace-no-shift"]').text()).toContain(
      'Elige una caja para abrir tu turno.',
    )
    // The Apertura task is already open, so the card has no button that leads nowhere.
    expect(ready.wrapper.find('[data-testid="cash-workspace-shift-open"]').exists()).toBe(false)

    await chooseRegister(ready.wrapper, 'r-1')
    expect(ready.wrapper.get('[data-testid="cash-workspace-no-shift"]').text()).toContain(
      'Ingresa el fondo inicial para abrir tu turno.',
    )
  })

  it('a failed registers read leaves the card quiet (the panel owns the error) and points at Sesiones', async () => {
    api.listRegisters.mockRejectedValueOnce(new Error('boom'))
    const { wrapper } = mountView()
    await flush()

    const card = wrapper.get('[data-testid="cash-workspace-shift-card"]')
    expect(card.find('[role="alert"]').exists()).toBe(false)
    expect(card.text()).toContain('Elige una sesión para operar, contar o verificar.')
  })

  it('loading: the opening and the session list render skeletons, never a blank panel', async () => {
    api.listRegisters.mockReturnValue(new Promise(() => {}))
    api.listSessions.mockReturnValue(new Promise(() => {}))
    const { wrapper } = mountView()
    await flush()

    expect(wrapper.get('[data-testid="cash-opening-loading"]').attributes('aria-busy')).toBe('true')
    expect(
      wrapper.findAll('[data-testid="cash-sessions-panel"] [data-testid="mobile-card-skeleton"]').length,
    ).toBeGreaterThan(0)
  })

  it('data: registers are radio cards (managed in a table), sessions are side cards with a badge and ⋮', async () => {
    const { wrapper } = mountView()
    await flush()

    const radio = wrapper.get('[data-testid="cash-opening-registers"] [role="radio"][data-value="r-1"]')
    expect(radio.text()).toContain('Caja principal')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    const registers = wrapper.get('[data-testid="cash-registers-panel"]')
    expect(registers.get('tbody .hf-status-badge').text()).toBe('Activa')
    expect(registers.find('button[aria-haspopup="menu"]').exists()).toBe(true)
    const sessionsPanel = wrapper.get('[data-testid="cash-sessions-panel"]')
    expect(sessionsPanel.get('[data-testid="cash-session-status-s-1"]').text()).toBe('Declarada')
    expect(sessionsPanel.get('[data-testid="cash-session-open-s-1"]').text()).toBe('Caja principal')
    expect(sessionsPanel.find('button[aria-haspopup="menu"]').exists()).toBe(true)
  })

  it('error: a failed read shows one alert per read with Reintentar that reads again', async () => {
    api.listRegisters.mockRejectedValueOnce(new Error('boom'))
    api.listSessions.mockRejectedValueOnce(new Error('boom'))
    const { wrapper } = mountView()
    await flush()

    const opening = wrapper.get('[data-testid="cash-opening-error"]')
    expect(opening.attributes('role')).toBe('alert')
    // The management table is not a second place telling the same failure.
    expect(wrapper.find('[data-testid="cash-registers-panel"]').exists()).toBe(false)
    const sessionsPanel = wrapper.get('[data-testid="cash-sessions-panel"]')
    expect(sessionsPanel.get('[data-testid="cards-error-state"]').attributes('role')).toBe('alert')

    api.listRegisters.mockClear()
    await opening.get('[data-testid="empty-state-action"]').trigger('click')
    await flush()
    expect(api.listRegisters).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="cash-opening-error"]').exists()).toBe(false)
  })

  it('selected shift: loading shows a skeleton and a failed read offers Reintentar', async () => {
    api.getSession.mockReturnValueOnce(new Promise(() => {}))
    const loading = mountView()
    await flush()
    await selectFirstSession(loading.wrapper)
    expect(loading.wrapper.get('[data-testid="cash-shift-loading"]').attributes('aria-busy')).toBe('true')

    api.getSession.mockRejectedValueOnce(new Error('boom'))
    const failed = mountView()
    await flush()
    await selectFirstSession(failed.wrapper)
    expect(failed.wrapper.get('[data-testid="cash-shift-error"]').attributes('role')).toBe('alert')

    api.getSession.mockClear()
    api.getSession.mockResolvedValue(DETAIL)
    await failed.wrapper.get('[data-testid="cash-shift-error"] [data-testid="empty-state-action"]').trigger('click')
    await flush()
    expect(api.getSession).toHaveBeenCalledTimes(1)
    expect(failed.wrapper.find('[data-testid="cash-shift-error"]').exists()).toBe(false)
  })

  it('selected shift: one failed read shows one error with one Reintentar', async () => {
    api.getSession.mockRejectedValueOnce(new Error('boom'))
    const { wrapper } = mountView()
    await flush()
    await selectFirstSession(wrapper)

    const shownAlerts = wrapper.findAll('[role="alert"]').filter((node) => isShown(node.element))
    expect(shownAlerts).toHaveLength(1)
    const retries = wrapper
      .findAll('button')
      .filter((button) => button.text().trim() === 'Reintentar' && isShown(button.element))
    expect(retries).toHaveLength(1)
    expect(wrapper.get('[data-testid="cash-shift-error"]').text()).toContain('Reintentar')
    // The failed shift shows no timeline built from nothing.
    expect(wrapper.find('[data-testid="cash-timeline"]').exists()).toBe(false)
  })

  it('selected shift: a failed refetch keeps the loaded movements and still shows one Reintentar', async () => {
    const movement = {
      id: 'm-1',
      kind: 'CASH_IN',
      deltaCents: 20000,
      method: 'CASH',
      channelKey: 'CASH',
      channelLabel: 'Efectivo',
      sourceType: 'MANUAL',
      sourceId: 'src-1',
      actorUserId: 'user-2',
      reason: 'Cambio adicional',
      occurredAt: '2026-10-07T17:15:00.000Z',
    }
    api.getSession.mockResolvedValue({ ...DETAIL, movements: [movement] })
    const { wrapper, queryClient } = mountView()
    await flush()
    await selectFirstSession(wrapper)
    await navigate(wrapper, 'movimientos')
    expect(wrapper.find('[data-testid="cash-movement-m-1"]').exists()).toBe(true)

    api.getSession.mockRejectedValue(new Error('boom'))
    await queryClient.refetchQueries()
    await flush()

    expect(wrapper.find('[data-testid="cash-shift-error"]').exists()).toBe(true)
    const movements = wrapper.get('[data-testid="cash-task-movimientos"]')
    expect(movements.find('[data-testid="cash-movement-m-1"]').exists()).toBe(true)
    const retries = wrapper
      .findAll('button')
      .filter((button) => button.text().trim() === 'Reintentar' && isShown(button.element))
    expect(retries).toHaveLength(1)
  })

  it('no shift in focus: the header invites to open, then names the selected register', async () => {
    const { wrapper } = mountView()
    await flush()
    expect(wrapper.find('[data-testid="cash-workspace-no-shift"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cash-head-title"]').text()).toBe('Abre tu turno')

    await selectFirstSession(wrapper)
    expect(wrapper.get('[data-testid="cash-head-title"]').text()).toBe('Caja principal')
    expect(wrapper.get('[data-testid="cash-head-status"]').text()).toContain('Declarada')
  })
})

describe('CashRegisterView · «Tu turno» timeline (direction A)', () => {
  const OWN_OPEN = {
    ...SESSION,
    id: 's-own',
    status: 'OPEN',
    cashierUserId: 'user-1',
    blind: true,
    frozenAt: null,
    drawerReleasedAt: null,
  }

  function mountOwn(session: Record<string, unknown>, detail: Record<string, unknown> = {}) {
    api.listSessions.mockResolvedValue({ items: [session], page: 1, limit: 25, total: 1 })
    api.getSession.mockResolvedValue({ ...detailFor(session), ...detail })
    return mountView()
  }

  it('selects the latest own session with the drawer not released, from the existing list read', async () => {
    const { wrapper } = mountOwn(OWN_OPEN)
    await flush()
    await flush()

    expect(api.getSession).toHaveBeenCalledWith('s-own')
    expect(api.listSessions).toHaveBeenCalledWith({ page: 1, limit: 25 })
    // S7: «Tu turno» comes from the status/drawerOpen filters, narrowed to me with audit.
    expect(api.listSessions).toHaveBeenCalledWith({
      status: ['OPEN', 'COUNTING', 'SUBMITTED'],
      drawerOpen: true,
      limit: 1,
      cashierUserId: 'user-1',
    })
    expect(wrapper.get('[data-testid="cash-step-movimientos"]').attributes('data-state')).toBe(
      'current',
    )
    expect(wrapper.get('[data-testid="cash-step-who-verificacion"]').text()).toBe('Otra persona')
    expect(wrapper.get('[data-testid="cash-next-title"]').text()).toBe('Iniciar conteo')
    expect(wrapper.get('[data-testid="cash-own-shift-select"]').attributes('aria-current')).toBe(
      'true',
    )
  })

  it('selects «Tu turno» again when the page remounts over a cached list', async () => {
    api.listSessions.mockResolvedValue({ items: [OWN_OPEN], page: 1, limit: 25, total: 1 })
    api.getSession.mockResolvedValue(detailFor(OWN_OPEN))
    const { queryClient } = mountView()
    await flush()
    await flush()

    // A second mount over the same cache: the list is already loaded on setup.
    const again = mountWithUApp(CashRegisterView, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })
    await flush()
    expect(again.get('[data-testid="cash-own-shift-select"]').attributes('aria-current')).toBe('true')
    expect(again.get('[data-testid="cash-head-title"]').text()).toBe('Caja principal')
  })

  it('does not select another person’s session or a released own one by default', async () => {
    const released = { ...OWN_OPEN, status: 'SUBMITTED', drawerReleasedAt: '2026-11-18T20:00:00.000Z' }
    const { wrapper } = mountOwn(released)
    await flush()
    await flush()

    expect(api.getSession).not.toHaveBeenCalled()
    // The opening is the next action and it is already open in place, so the
    // «Siguiente paso» bar does not repeat it.
    expect(wrapper.get('[data-testid="cash-step-apertura"]').attributes('data-state')).toBe('current')
    expect(taskShown(wrapper, 'apertura')).toBe(true)
    expect(wrapper.find('[data-testid="cash-next-action"]').exists()).toBe(false)
  })

  it('opens the next task in place from «Siguiente paso» without dispatching a command', async () => {
    const { wrapper } = mountOwn(OWN_OPEN)
    await flush()
    await flush()

    // Without forcing order: the alternative opens first…
    await wrapper.get('[data-testid="cash-next-alt"]').trigger('click')
    await flush()
    expect(taskShown(wrapper, 'movimientos')).toBe(true)

    // …and the suggested step is still one click away.
    await wrapper.get('[data-testid="cash-next-primary"]').trigger('click')
    await flush()
    expect(taskShown(wrapper, 'conteo')).toBe(true)
    expect(taskShown(wrapper, 'movimientos')).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-freeze"]').exists()).toBe(true)
    expect(api.startCount).not.toHaveBeenCalled()
    // The bar does not repeat the task that is already open.
    expect(wrapper.find('[data-testid="cash-next-action"]').exists()).toBe(false)
  })

  it('S8: offers the handover right after the declaration, before any verification', async () => {
    grant([...GRANTS, 'create:CashHandover'])
    const submitted = { ...OWN_OPEN, status: 'SUBMITTED', blind: false }
    const { wrapper } = mountOwn(submitted, {
      counts: [
        {
          id: 'c-1',
          kind: 'DECLARATION',
          revision: 1,
          actorUserId: 'user-1',
          lines: [{ channelKey: 'CASH', amountCents: 150000 }],
          denominations: null,
          notes: null,
          createdAt: '2026-11-18T20:00:00.000Z',
        },
      ],
    })
    await flush()
    await flush()

    expect(wrapper.get('[data-testid="cash-next-title"]').text()).toBe('Entregar efectivo')
    expect(wrapper.get('[data-testid="cash-step-entrega"]').attributes('data-state')).toBe('current')
    expect(wrapper.get('[data-testid="cash-step-verificacion"]').attributes('data-state')).toBe(
      'current',
    )
    await wrapper.get('[data-testid="cash-next-primary"]').trigger('click')
    await flush()
    expect(taskShown(wrapper, 'entrega')).toBe(true)
    expect(
      wrapper.get('[data-testid="cash-task-entrega"]').find('[data-testid="cash-handover-form"]').exists(),
    ).toBe(true)
  })

  it('S9: after a blind cash out, shows only the confirmation of that entry', async () => {
    const { wrapper } = mountOwn(OWN_OPEN)
    await flush()
    await flush()
    await navigate(wrapper, 'movimientos')

    api.cashOut.mockResolvedValueOnce({
      id: 'm-9',
      sessionId: 's-own',
      kind: 'CASH_OUT',
      deltaCents: -35000,
      occurredAt: '2026-11-18T21:12:00.000Z',
    })
    await wrapper.get('[data-testid="cash-movement-amount"]').setValue('350.00')
    await wrapper.get('[data-testid="cash-movement-reason"]').setValue('Compra de bolsas')
    await wrapper.get('[data-testid="cash-out-submit"]').trigger('click')
    await flush()
    await flush()

    expect(api.cashOut).toHaveBeenCalledWith(
      's-own',
      { amountCents: 35000, reason: 'Compra de bolsas' },
      expect.any(String),
    )
    const last = wrapper.get('[data-testid="cash-movement-last"]')
    expect(last.attributes('role')).toBe('status')
    expect(last.text()).toMatch(/Salida de \$350\.00 registrada/)
    expect(wrapper.find('[data-testid="cash-movements-table"]').exists()).toBe(false)
  })

  it('supervisor: verifies another person’s declared session picked from the branch list', async () => {
    const { wrapper } = mountView()
    await flush()
    expect(wrapper.get('[data-testid="cash-sessions-title"]').text()).toBe('Sesiones de la sucursal')

    await wrapper.get('[data-testid="cash-session-open-s-1"]').trigger('click')
    await flush()
    expect(wrapper.get('[data-testid="cash-next-title"]').text()).toBe('Verificar conteo')
    await wrapper.get('[data-testid="cash-sessions-status-SUBMITTED"]').setValue()
    await flush()
    expect(api.listSessions).toHaveBeenCalledWith({ page: 1, limit: 25, status: ['SUBMITTED'] })
  })
})

// S7: supervisor list — exact status filter and real paging.
describe('CashRegisterView · supervisor session list (S7)', () => {
  it('maps each status choice to the exact status filter and back to «Todas»', async () => {
    const { wrapper } = mountView()
    await flush()
    for (const status of ['OPEN', 'COUNTING', 'SUBMITTED', 'CLOSED']) {
      await wrapper.get(`[data-testid="cash-sessions-status-${status}"]`).setValue()
      await flush()
      expect(api.listSessions).toHaveBeenCalledWith({ page: 1, limit: 25, status: [status] })
    }
    api.listSessions.mockClear()
    await wrapper.get('[data-testid="cash-sessions-status-ALL"]').setValue()
    await flush()
    const calls = api.listSessions.mock.calls.map(([params]) => params)
    expect(calls.every((params) => !('pendingOnly' in params))).toBe(true)
  })

  it('pages with the real total and returns to page 1 when a filter changes', async () => {
    api.listSessions.mockResolvedValue({ items: [SESSION], page: 1, limit: 25, total: 60 })
    const { wrapper } = mountView()
    await flush()
    expect(wrapper.get('[data-testid="cash-sessions-page"]').text()).toBe('Página 1 de 3 · 60 sesiones')

    await wrapper.get('[data-testid="cash-sessions-next"]').trigger('click')
    await flush()
    expect(api.listSessions).toHaveBeenCalledWith({ page: 2, limit: 25 })

    await wrapper.get('[data-testid="cash-sessions-status-CLOSED"]').setValue()
    await flush()
    expect(api.listSessions).toHaveBeenLastCalledWith({ page: 1, limit: 25, status: ['CLOSED'] })
  })
})

// S6: the handover recipient by name and role, never a raw UUID.
describe('CashRegisterView · handover recipients (S6)', () => {
  it('reads the recipients of the kind and offers them by name and role', async () => {
    grant([...GRANTS, 'create:CashHandover'])
    api.listHandoverRecipients.mockImplementation((kind: string) =>
      Promise.resolve(
        kind === 'FLOAT'
          ? [{ userId: 'sup-1', displayName: 'Luis Supervisor', roleName: 'Supervisor' }]
          : [],
      ),
    )
    const own = { ...SESSION, id: 's-own', cashierUserId: 'user-1', status: 'SUBMITTED' }
    api.listSessions.mockResolvedValue({ items: [own], page: 1, limit: 25, total: 1 })
    api.getSession.mockResolvedValue(detailFor(own))
    const { wrapper } = mountView()
    await flush()
    await flush()
    expect(api.listHandoverRecipients).not.toHaveBeenCalled()

    await navigate(wrapper, 'entrega')
    await flush()
    expect(api.listHandoverRecipients).toHaveBeenCalledWith('FLOAT')
    const task = wrapper.get('[data-testid="cash-task-entrega"]')
    expect(task.get('[data-testid="cash-handover-recipient-card-sup-1"]').text()).toContain('Supervisor')
    expect(task.find('[data-testid="cash-handover-recipient-uuid"]').exists()).toBe(false)
    expect(usersApi.listAssignable).not.toHaveBeenCalled()
  })
})

// S5: «Cerrar caja», the corte and «Cortes» mount in the shell.
describe('CashRegisterView · close, corte and Cortes (S5)', () => {
  const CLOSE_GRANTS = [...GRANTS, 'create:CashClosing', 'read:CashClosing']

  function mountReady(detail = makeReadyDetail()) {
    auth.user = { id: ME }
    grant(CLOSE_GRANTS)
    api.listSessions.mockResolvedValue({ items: [detail.session], page: 1, limit: 25, total: 1 })
    api.getSession.mockResolvedValue(detail)
    api.getClosing.mockResolvedValue(CLOSING)
    return mountView()
  }

  it('the supervisor closes from the «Cerrar caja» step and lands on the corte', async () => {
    const ready = makeReadyDetail()
    const { wrapper } = mountReady(ready)
    await flush()
    await selectSessionById(wrapper, ready.session.id)
    await flush()

    await navigate(wrapper, 'cierre')
    const task = wrapper.get('[data-testid="cash-task-cierre"]')
    expect(task.find('[data-testid="cash-close-step"]').exists()).toBe(true)

    api.closeSession.mockResolvedValue(CLOSING)
    api.getSession.mockResolvedValue({
      ...ready,
      session: makeSession({ status: 'CLOSED' }),
      closing: { id: CLOSING.id, sessionId: CLOSING.sessionId, folio: CLOSING.folio, createdAt: CLOSING.createdAt },
    })
    await task.get('[data-testid="cash-close-submit"]').trigger('click')
    await flush()
    // ConfirmModal teleports to the body.
    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Cerrar caja',
    )
    expect(confirm).toBeTruthy()
    confirm!.click()
    await flush()
    await flush()
    await flush()

    expect(api.closeSession).toHaveBeenCalledWith(ready.session.id, {}, expect.any(String))
    expect(taskShown(wrapper, 'corte')).toBe(true)
    const corte = wrapper.get('[data-testid="cash-task-corte"]')
    expect(corte.find('[data-testid="cash-closing-detail"]').exists()).toBe(true)
    expect(corte.get('[data-testid="cash-closing-header"]').text()).toContain(CLOSING.folio)
  })

  it('the cashier never gets the close action in their own shift', async () => {
    const ready = makeReadyDetail()
    const { wrapper } = mountReady(ready)
    auth.user = { id: ready.session.cashierUserId }
    await flush()
    await flush()
    await selectSessionById(wrapper, ready.session.id)
    await flush()
    expect(wrapper.find('[data-testid="cash-close-submit"]').exists()).toBe(false)
  })

  it('a closed session shows its corte by the closing id', async () => {
    const closed = makeReadyDetail({
      session: makeSession({ status: 'CLOSED' }),
      closing: { id: CLOSING.id, sessionId: CLOSING.sessionId, folio: CLOSING.folio, createdAt: CLOSING.createdAt },
    })
    const { wrapper } = mountReady(closed)
    await flush()
    await selectSessionById(wrapper, closed.session.id)
    await flush()
    await navigate(wrapper, 'corte')
    await flush()
    expect(api.getClosing).toHaveBeenCalledWith(CLOSING.id)
    expect(
      wrapper.get('[data-testid="cash-task-corte"]').find('[data-testid="cash-closing-detail"]').exists(),
    ).toBe(true)
  })

  it('«Cortes» opens the list with read:CashClosing; a row opens the corte and back returns', async () => {
    api.listClosings.mockResolvedValue({
      items: [{ id: CLOSING.id, sessionId: CLOSING.sessionId, folio: CLOSING.folio, createdAt: CLOSING.createdAt }],
      page: 1,
      limit: 10,
      total: 1,
    })
    const { wrapper } = mountReady()
    await flush()
    expect(api.listClosings).not.toHaveBeenCalled()

    const entry = wrapper.get('[data-testid="cash-closings-entry"]')
    expect(entry.attributes('aria-expanded')).toBe('false')
    await entry.trigger('click')
    await flush()
    expect(entry.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[data-testid="cash-closings-list"]').exists()).toBe(true)
    expect(api.listClosings).toHaveBeenCalled()

    await wrapper.get('[data-testid="cash-closing-row-open"]').trigger('click')
    await flush()
    expect(wrapper.find('[data-testid="cash-closing-detail"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-closings-list"]').exists()).toBe(false)

    await wrapper.get('[data-testid="cash-closings-back"]').trigger('click')
    await flush()
    expect(wrapper.find('[data-testid="cash-closings-list"]').exists()).toBe(true)

    // Opening a timeline task leaves «Cortes».
    await wrapper.get('[data-testid="cash-closings-hide"]').trigger('click')
    await flush()
    expect(wrapper.find('[data-testid="cash-closings-list"]').exists()).toBe(false)
  })

  it('hides «Cortes» without read:CashClosing', async () => {
    const { wrapper } = mountView()
    await flush()
    expect(wrapper.find('[data-testid="cash-closings-entry"]').exists()).toBe(false)
    expect(api.listClosings).not.toHaveBeenCalled()
  })
})
