// NotificationConfigView.payload.spec.ts — the redesign keeps the API
// contract: the real query + form + mutation composables run against a mocked
// HTTP boundary and the PUT body is asserted exactly (3 whitelisted keys).

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import NotificationConfigView from '../NotificationConfigView.vue'
import { notificationConfigApi } from '../../api/notificationConfig.api'
import { usersApi } from '@/features/POS/users/api/user.api'

vi.mock('../../api/notificationConfig.api', () => ({
  notificationConfigApi: { get: vi.fn(), update: vi.fn() },
}))

vi.mock('@/features/POS/users/api/user.api', () => ({
  usersApi: { listAssignable: vi.fn() },
}))

const authMock = { currentTenantId: 'tenant-1', userCan: vi.fn().mockReturnValue(true) }
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

const get = vi.mocked(notificationConfigApi.get)
const update = vi.mocked(notificationConfigApi.update)
const listAssignable = vi.mocked(usersApi.listAssignable)

async function mountView() {
  const wrapper = mountWithUApp(NotificationConfigView, {
    global: {
      plugins: [
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
    },
  })
  await flushPromises()
  return wrapper
}

const save = (wrapper: Awaited<ReturnType<typeof mountView>>) =>
  wrapper.findAll('.hf-save-bar button').find((b) => b.text() === 'Guardar cambios')!

beforeEach(() => {
  vi.clearAllMocks()
  authMock.userCan.mockReturnValue(true)
  get.mockResolvedValue({ enabled: true, recipients: ['u1'], enabledActions: ['LOW_STOCK'] })
  listAssignable.mockResolvedValue([
    { id: 'u1', name: 'Ana Ruiz' },
    { id: 'u2', name: 'Bruno Gil' },
  ])
  update.mockImplementation(async (body) => ({
    enabled: body.enabled,
    recipients: body.recipientUserIds,
    enabledActions: body.enabledActions,
  }))
})

describe('NotificationConfigView — saved payload', () => {
  it('PUTs exactly { enabled, recipientUserIds, enabledActions } built from the edited form', async () => {
    const wrapper = await mountView()
    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    await wrapper.get('[data-testid="module-all-promotions"]').trigger('click')
    await wrapper.get('[data-testid="action-row-low-stock"] [role="switch"]').trigger('click')
    await save(wrapper).trigger('click')
    await flushPromises()

    expect(update).toHaveBeenCalledTimes(1)
    const body = update.mock.calls[0]![0]
    expect(Object.keys(body).sort()).toEqual(['enabled', 'enabledActions', 'recipientUserIds'])
    expect(body).toEqual({
      enabled: true,
      recipientUserIds: ['u1', 'u2'],
      enabledActions: ['PROMOTION_EXPIRING', 'PROMOTION_NEAR_CAPACITY'],
    })
  })

  it('PUTs the master off with the kept selection', async () => {
    const wrapper = await mountView()
    await wrapper.get('[data-testid="master-toggle"] [role="switch"]').trigger('click')
    await save(wrapper).trigger('click')
    await flushPromises()
    expect(update).toHaveBeenCalledWith({
      enabled: false,
      recipientUserIds: ['u1'],
      enabledActions: ['LOW_STOCK'],
    })
  })

  it('never PUTs without update permission', async () => {
    authMock.userCan.mockReturnValue(false)
    const wrapper = await mountView()
    expect(wrapper.find('.hf-save-bar').exists()).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })
})
