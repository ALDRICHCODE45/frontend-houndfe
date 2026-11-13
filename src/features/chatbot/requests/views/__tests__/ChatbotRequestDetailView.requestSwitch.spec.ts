import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { DETAIL_STUBS, makeDetail } from '../../utils/detail-fixture'
import type { ChatbotRequestDetail } from '../../interfaces/chatbot-request.types'

// A reactive route: the detail view is reused across /chatbot/solicitudes/:id (T16 note).
const route = await vi.hoisted(async () => {
  const { reactive } = await import('vue')
  return reactive({ params: { id: 'req-1' } as Record<string, string> })
})
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push: vi.fn() }) }))

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: { getDetail: vi.fn(), listAudit: vi.fn() },
}))
vi.mock('../../api/chatbot-conversation.api', () => ({
  chatbotConversationApi: { getPage: vi.fn(), getMedia: vi.fn() },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    user: { id: 'u-1' },
    userCan: (action: string, subject: string) =>
      ['read:ChatbotRequest', 'read:CustomerPhone', 'read:ChatbotConversation'].includes(`${action}:${subject}`),
  }),
}))

import { chatbotRequestApi } from '../../api/chatbot-request.api'
import { chatbotConversationApi } from '../../api/chatbot-conversation.api'
import ChatbotRequestDetailView from '../ChatbotRequestDetailView.vue'

const getDetail = vi.mocked(chatbotRequestApi.getDetail)
const getPage = vi.mocked(chatbotConversationApi.getPage)

const live = (id: string): ChatbotRequestDetail =>
  makeDetail({
    id,
    subtype: 'COMPLAINT',
    status: 'IN_PROGRESS',
    assignee: { id: 'u-1', displayName: 'Laura Méndez' },
    allowedActions: ['SEND_MESSAGE', 'FINISH'],
    liveSession: {
      state: 'ACTIVE',
      handoffEpoch: 3,
      lastStaffActivityAt: new Date().toISOString(),
      lastCustomerMessageAt: new Date().toISOString(),
    },
  })

beforeEach(() => {
  route.params = { id: 'req-1' }
  getDetail.mockReset().mockImplementation(async (id: string) => live(id))
  getPage.mockReset().mockResolvedValue({ items: [], hasMoreBefore: false })
})

describe('ChatbotRequestDetailView — switching request', () => {
  it('closes the mobile chat when the route moves to another request', async () => {
    const wrapper = mount(ChatbotRequestDetailView, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }]],
        stubs: DETAIL_STUBS,
      },
    })
    await flushPromises()
    const block = () => wrapper.get('[data-testid="detail-conversation"]')

    await wrapper.get('[data-testid="bar-primary"]').trigger('click')
    expect(block().classes()).toContain('rc--open')

    route.params.id = 'req-2'
    await flushPromises()
    expect(getDetail).toHaveBeenCalledWith('req-2', { signal: expect.anything() })
    expect(block().classes()).not.toContain('rc--open')
  })

  it('keeps the chat open while the same request refetches', async () => {
    const wrapper = mount(ChatbotRequestDetailView, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }]],
        stubs: DETAIL_STUBS,
      },
    })
    await flushPromises()
    await wrapper.get('[data-testid="bar-primary"]').trigger('click')
    route.params.id = 'req-1'
    await flushPromises()
    expect(wrapper.get('[data-testid="detail-conversation"]').classes()).toContain('rc--open')
  })
})
