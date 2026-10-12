import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, enableAutoUnmount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { reactive } from 'vue'
import CashReceptionView from '../CashReceptionView.vue'
import CashCustodyDiscovery from '../../components/CashCustodyDiscovery.vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import { cashApi } from '../../api/cash.api'

vi.mock('../../api/cash.api', () => ({
  cashApi: {
    getCustody: vi.fn(),
    receiveHandover: vi.fn(),
    listRegisters: vi.fn(),
    listSessions: vi.fn(),
    getSession: vi.fn(),
    openSession: vi.fn(),
    declareHandover: vi.fn(),
    releaseDrawer: vi.fn(),
  },
}))
const auth = reactive({
  currentTenantId: 'tenant',
  user: { id: 'receiver' } as { id: string } | null,
  permissionCodes: ['read:CashHandover', 'update:CashHandover'],
  permissionsLoaded: true,
  userCan: (action: string, subject: string) =>
    auth.permissionCodes.includes(`${action}:${subject}`),
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
const item = {
  id: 'handover',
  tenantId: 'tenant',
  sessionId: 'session',
  kind: 'WITHDRAWAL' as const,
  recipientUserId: 'receiver',
  receiverUserId: 'receiver',
  cashierUserId: 'cashier',
  declaredCents: 100,
  receivedCents: null,
  receivedAt: null,
}
const custody = {
  pendingHandovers: { items: [item], page: 1, limit: 25, total: 1 },
  eligibleFloat: { items: [], page: 1, limit: 25, total: 0 },
}
function render() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return mount(CashReceptionView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: { CashCustodyDiscovery: true, UAlert: true },
    },
  })
}

/** Same view, but with the REAL custody UI so the pesos entry seam is exercised. */
function renderIntegrated() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return mountWithUApp(CashReceptionView, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
}
enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  auth.currentTenantId = 'tenant'
  auth.user = { id: 'receiver' }
  auth.permissionsLoaded = true
  auth.permissionCodes = ['read:CashHandover', 'update:CashHandover']
  vi.mocked(cashApi.getCustody).mockResolvedValue(custody as never)
  vi.mocked(cashApi.receiveHandover).mockResolvedValue({ ...item, receivedAt: 'now' } as never)
})
async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}
describe('recipient-only cash reception', () => {
  it('scopes the screen to recipient reception with neutral Mexican copy', async () => {
    const wrapper = render()
    await settle()

    expect(wrapper.find('[data-testid="cash-reception-context"]').exists()).toBe(true)
    const text = wrapper.text()
    expect(text).toContain('destinadas a ti')
    // Neutral Mexican Spanish: no Argentine voseo imperatives.
    expect(text).not.toMatch(/\bvos\b|tenés|consultá|recibí|elegí/i)
    // Reception stays a single surface: no task navigation is fabricated here.
    expect(wrapper.find('[data-testid="cash-workspace-nav"]').exists()).toBe(false)
  })

  it('presents a genuine task heading and a receipt-context summary of the real custody', async () => {
    const wrapper = render()
    await settle()

    const heading = wrapper.get('[data-testid="cash-reception-heading"]')
    expect(heading.get('[data-testid="cash-reception-task-label"]').text()).toContain('Recepción')
    expect(heading.get('h1').text().length).toBeGreaterThan(0)
    expect(heading.get('p').text()).toContain('destinadas a ti')

    // The context column summarizes the REAL recipient custody as label/value rows.
    const context = wrapper.get('[data-testid="cash-reception-context"]')
    expect(context.get('[data-testid="cash-reception-context-pending"]').text()).toBe('1')
    expect(context.get('[data-testid="cash-reception-context-declared"]').text()).toMatch(/1[.,]00/)
    expect(context.get('[data-testid="cash-reception-context-float"]').text()).toBe('0')
    expect(context.text()).toMatch(/destinataria/i)
  })

  it('loads only recipient custody and exposes receipt under the two minimal grants', async () => {
    const wrapper = render()
    await settle()
    const panel = wrapper.getComponent(CashCustodyDiscovery)
    expect(panel.props('allowed')).toBe(true)
    expect(panel.props('canReceive')).toBe(true)
    expect(panel.props('pendingHandovers')).toEqual([item])
    expect(cashApi.getCustody).toHaveBeenCalledWith({ page: 1, limit: 25 })
    panel.vm.$emit('receive', { id: 'handover', receivedCents: 100 })
    await settle()
    expect(cashApi.receiveHandover).toHaveBeenCalledExactlyOnceWith(
      'handover',
      { receivedCents: 100 },
      expect.any(String),
    )
    for (const api of [
      cashApi.listRegisters,
      cashApi.listSessions,
      cashApi.getSession,
      cashApi.openSession,
      cashApi.declareHandover,
      cashApi.releaseDrawer,
    ]) {
      expect(api).not.toHaveBeenCalled()
    }
    expect(wrapper.find('[data-testid="cash-registers-panel"]').exists()).toBe(false)
    expect(auth.permissionCodes).toEqual(['read:CashHandover', 'update:CashHandover'])
  })

  it('does not dispatch receipt for a read-only recipient or an unknown handover', async () => {
    const wrapper = render()
    await settle()
    auth.permissionCodes = ['read:CashHandover']
    await settle()
    // Permission changes remount the recipient panel to clear local amounts/notes.
    const readOnlyPanel = wrapper.getComponent(CashCustodyDiscovery)
    expect(readOnlyPanel.props('canReceive')).toBe(false)
    readOnlyPanel.vm.$emit('receive', { id: 'handover', receivedCents: 100 })
    await settle()
    auth.permissionCodes = ['read:CashHandover', 'update:CashHandover']
    await settle()
    wrapper.getComponent(CashCustodyDiscovery).vm.$emit('receive', {
      id: 'not-in-my-custody',
      receivedCents: 100,
    })
    await settle()
    expect(cashApi.receiveHandover).not.toHaveBeenCalled()
  })

  it('does not read or refresh custody without read permission', async () => {
    auth.permissionCodes = ['update:CashHandover']
    const wrapper = render()
    await settle()
    const panel = wrapper.getComponent(CashCustodyDiscovery)
    expect(panel.props('allowed')).toBe(false)
    panel.vm.$emit('refresh')
    panel.vm.$emit('receive', { id: 'handover', receivedCents: 100 })
    await settle()
    expect(cashApi.getCustody).not.toHaveBeenCalled()
    expect(cashApi.receiveHandover).not.toHaveBeenCalled()
  })

  it('rejects overlap and drops an old receipt error after an actor switch', async () => {
    let reject!: (reason: unknown) => void
    vi.mocked(cashApi.receiveHandover).mockReturnValue(
      new Promise((_, fail) => {
        reject = fail
      }),
    )
    const wrapper = render()
    await settle()
    const panel = wrapper.getComponent(CashCustodyDiscovery)
    panel.vm.$emit('receive', { id: 'handover', receivedCents: 100 })
    panel.vm.$emit('receive', { id: 'handover', receivedCents: 100 })
    await settle()
    expect(cashApi.receiveHandover).toHaveBeenCalledTimes(1)
    expect(panel.props('receivingId')).toBe('handover')
    auth.user = { id: 'other' }
    vi.mocked(cashApi.getCustody).mockResolvedValue({
      ...custody,
      pendingHandovers: { ...custody.pendingHandovers, items: [], total: 0 },
    } as never)
    reject(new Error('old actor error'))
    await settle()
    expect(wrapper.text()).not.toContain('old actor error')
    expect(wrapper.find('[data-testid="cash-reception-error"]').exists()).toBe(false)
    expect(wrapper.getComponent(CashCustodyDiscovery).props('receivingId')).toBeNull()
  })

  it('transports a typed pesos receipt as unchanged integer cents through the real custody UI', async () => {
    const wrapper = renderIntegrated()
    await settle()

    // The declared amount is 100 wire cents; 300.00 pesos differs, so the note is
    // required and both the exact cents and the note must reach the transport.
    await wrapper.get('[data-testid="cash-custody-received-input-handover"]').setValue('300.00')
    await wrapper
      .get('[data-testid="cash-custody-received-notes-handover"]')
      .setValue('Monto acordado')
    await wrapper.get('[data-testid="cash-custody-receive-handover"]').trigger('click')
    await settle()

    expect(cashApi.receiveHandover).toHaveBeenCalledExactlyOnceWith(
      'handover',
      { receivedCents: 30000, notes: 'Monto acordado' },
      expect.any(String),
    )
  })

  it('does not dispatch through the real UI when the received amount is blank', async () => {
    const wrapper = renderIntegrated()
    await settle()

    // Blank is MISSING, never a zero amount.
    await wrapper.get('[data-testid="cash-custody-received-input-handover"]').setValue('')
    await wrapper.get('[data-testid="cash-custody-receive-handover"]').trigger('click')
    await settle()

    expect(cashApi.receiveHandover).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cash-custody-local-error"]').exists()).toBe(true)
  })
})
