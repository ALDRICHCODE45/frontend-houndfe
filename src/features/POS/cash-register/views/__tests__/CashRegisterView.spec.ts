/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
//
// CashRegisterView — the composition surface for the task-focused Caja
// workspace. Mounted with the REAL composables and a mocked transport + auth
// store, so identity guards, money conversion and permission gates are exercised
// end to end:
//   - one focused task at a time, chosen by navigation, never by business state;
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
import CashRegisterView from '../CashRegisterView.vue'

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

const SESSION_TASKS = ['movimientos', 'conteo', 'notas', 'verificacion', 'custodia']

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

/** Task navigation is the only way to focus a task; it never selects a shift. */
async function navigate(wrapper: ReturnType<typeof mountView>['wrapper'], taskId: string) {
  await wrapper.get(`[data-testid="cash-workspace-task-${taskId}"]`).trigger('click')
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
  await navigate(wrapper, 'historial')
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

describe('CashRegisterView · task-focused composition', () => {
  it('focuses one task at a time through the workspace navigation', async () => {
    const { wrapper } = mountView()
    await flush()

    expect(wrapper.get('[data-testid="cash-workspace"]').exists()).toBe(true)
    // Default task: opening surface.
    expect(taskShown(wrapper, 'apertura')).toBe(true)
    expect(taskShown(wrapper, 'historial')).toBe(false)
    expect(wrapper.find('[data-testid="cash-registers-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-open-session"]').exists()).toBe(true)

    await navigate(wrapper, 'historial')
    expect(taskShown(wrapper, 'historial')).toBe(true)
    expect(taskShown(wrapper, 'apertura')).toBe(false)
    expect(wrapper.find('[data-testid="cash-sessions-panel"]').exists()).toBe(true)

    await navigate(wrapper, 'recepcion')
    expect(taskShown(wrapper, 'recepcion')).toBe(true)
    expect(wrapper.find('[data-testid="cash-custody-discovery"]').exists()).toBe(true)
  })

  it('selects the register and opens the session form for it', async () => {
    const { wrapper } = mountView()
    await flush()

    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()

    expect(wrapper.get('[data-testid="cash-open-register"]').text()).toContain('Caja principal')
    expect(wrapper.find('[data-testid="cash-open-no-register"]').exists()).toBe(false)
  })

  it('presents independent tasks instead of a mandatory lifecycle', async () => {
    const { wrapper } = mountView()
    await flush()

    const nav = wrapper.get('[data-testid="cash-workspace-nav"]')
    expect(nav.find('ol').exists()).toBe(false)
    expect(nav.text().toLowerCase()).not.toContain('siguiente')
    expect(nav.text().toLowerCase()).not.toContain('paso ')
  })

  it('presents the heading of the task chosen from the quiet navigation', async () => {
    const { wrapper } = mountView()
    await flush()

    expect(wrapper.get('[data-testid="cash-workspace-heading"]').text()).toBe('Abrir un turno')

    await navigate(wrapper, 'historial')

    expect(wrapper.get('[data-testid="cash-workspace-heading"]').text()).toBe('Historial de turnos')
  })
})

describe('CashRegisterView · navigation visibility rules', () => {
  it('offers a session task only while a shift is explicitly selected', async () => {
    const { wrapper } = mountView()
    await flush()

    for (const taskId of SESSION_TASKS) {
      expect(wrapper.find(`[data-testid="cash-workspace-task-${taskId}"]`).exists()).toBe(false)
    }

    await selectFirstSession(wrapper)

    for (const taskId of ['movimientos', 'verificacion', 'custodia', 'notas']) {
      expect(wrapper.find(`[data-testid="cash-workspace-task-${taskId}"]`).exists()).toBe(true)
    }
    // SUBMITTED is not OPEN/COUNTING, so there is nothing to freeze or count yet.
    expect(wrapper.find('[data-testid="cash-workspace-task-conteo"]').exists()).toBe(false)
  })

  it('hides the reception task when custody read is not granted', async () => {
    grant(GRANTS.filter((permission) => permission !== 'read:CashHandover'))
    const { wrapper } = mountView()
    await flush()

    expect(wrapper.find('[data-testid="cash-workspace-task-recepcion"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-custody-discovery"]').exists()).toBe(false)
  })

  it('names the history task for the real list scope, without fake totals', async () => {
    grant(GRANTS.filter((permission) => permission !== 'read:CashSessionAudit'))
    const scopeOwn = mountView()
    await flush()
    expect(scopeOwn.wrapper.get('[data-testid="cash-workspace-task-historial"]').text()).toContain(
      'Mis sesiones',
    )
    expect(scopeOwn.wrapper.text()).not.toMatch(/por verificar/i)

    grant(GRANTS)
    const scopeAudit = mountView()
    await flush()
    expect(
      scopeAudit.wrapper.get('[data-testid="cash-workspace-task-historial"]').text(),
    ).toContain('Sesiones')
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
    await navigate(wrapper, 'conteo')

    expect(wrapper.find('[data-testid="cash-count-input-CASH"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-count-input-PM:1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-session-expected"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-session-freeze"]').exists()).toBe(false)
  })
})

describe('CashRegisterView · stale results after a same-tenant user switch', () => {
  it('discards a pending opening: no old session is selected and no banner reaches the new user', async () => {
    const { wrapper } = mountView()
    await flush()

    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()

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

    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()

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
    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()
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
    expect(wrapper.find('[data-testid="cash-open-no-register"]').exists()).toBe(true)
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

    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')

    await navigate(wrapper, 'historial')
    await navigate(wrapper, 'apertura')

    expect(wrapper.get('[data-testid="cash-opening-cents"]').element.value).toBe('500.00')
  })

  it('never hands an opening draft to a different actor on the same register', async () => {
    const { wrapper } = mountView()
    await flush()

    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    expect(wrapper.get('[data-testid="cash-opening-cents"]').element.value).toBe('500.00')

    // Same tenant, different principal: this is no longer the previous user's workspace.
    auth.user = { id: 'user-2' }
    await flush()
    await flush()
    await flush()

    // The new actor selects the same register; the previous draft must be gone.
    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()

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

    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')

    await wrapper.get('[data-testid="cash-register-open-r-2"]').trigger('click')
    await flush()

    expect(wrapper.get('[data-testid="cash-open-register"]').text()).toContain('Caja secundaria')
    expect(wrapper.get('[data-testid="cash-opening-cents"]').element.value).toBe('')
  })

  it('clears an opening draft when the permission set changes', async () => {
    const { wrapper } = mountView()
    await flush()

    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')

    // The opening ability survives, but the permission fingerprint does not:
    // this is a different identity scope and no draft may carry over.
    grant(GRANTS.filter((permission) => permission !== 'read:CashSessionAudit'))
    await flush()
    await flush()
    await flush()

    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()
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
    await navigate(wrapper, 'conteo')
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
    expect(wrapper.get('[data-testid="cash-verification-declared"]').text()).toBe('—')
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
    expect(wrapper.get('[data-testid="cash-verification-declared"]').text()).toBe('—')
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
    expect(wrapper.get('[data-testid="cash-verification-declared"]').text()).toBe('—')
  })

  it('drops a stale declaration failure instead of showing it on another shift', async () => {
    const countingA = { ...SUBMITTED_A, status: 'COUNTING', blind: true }
    const countingB = { ...SUBMITTED_B, status: 'COUNTING', blind: true }
    const { wrapper } = mountTwoShifts(countingA, countingB)
    await flush()

    await selectSessionById(wrapper, 's-a')
    await navigate(wrapper, 'conteo')
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

    await navigate(wrapper, 'conteo')
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
    await navigate(wrapper, 'conteo')
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
    await navigate(wrapper, 'conteo')
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

    await wrapper.get('[data-testid="cash-register-open-r-1"]').trigger('click')
    await flush()
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    api.openSession.mockRejectedValueOnce(new Error('apertura rechazada'))
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    await flush()
    await flush()
    expect(wrapper.find('[data-testid="cash-open-error"]').exists()).toBe(true)

    await wrapper.get('[data-testid="cash-register-open-r-2"]').trigger('click')
    await flush()
    expect(wrapper.find('[data-testid="cash-open-error"]').exists()).toBe(false)
  })
})
