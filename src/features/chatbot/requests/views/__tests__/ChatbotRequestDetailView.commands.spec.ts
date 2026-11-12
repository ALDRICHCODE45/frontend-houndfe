import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { axiosError } from '../../composables/__tests__/withQuery'
import { DETAIL_STUBS, makeDetail } from '../../utils/detail-fixture'
import type { ChatbotRequestCommandResponse, ChatbotRequestDetail } from '../../interfaces/chatbot-request.types'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'req-1' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: {
    getDetail: vi.fn(),
    listAudit: vi.fn(),
    claim: vi.fn(),
    release: vi.fn(),
    cancel: vi.fn(),
    listAssignableUsers: vi.fn(),
    listMergeCandidates: vi.fn(),
  },
}))

const auth = vi.hoisted(() => ({ perms: new Set<string>() }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    user: { id: 'u-1' },
    userCan: (action: string, subject: string) => auth.perms.has(`${action}:${subject}`),
  }),
}))

const toastAdd = vi.hoisted(() => vi.fn())
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({ useToast: () => ({ add: toastAdd }) }))

import { chatbotRequestApi } from '../../api/chatbot-request.api'
import ChatbotRequestDetailView from '../ChatbotRequestDetailView.vue'

const api = vi.mocked(chatbotRequestApi)

const claimed = (version: number): ChatbotRequestCommandResponse => ({
  request: {
    id: 'req-1',
    folio: 'S-000123',
    kind: 'DECISION',
    subtype: 'RESTOCK',
    status: 'IN_PROGRESS',
    displayStatus: 'IN_PROGRESS',
    version,
    assignee: { id: 'u-1', displayName: 'Laura' },
    claimedAt: null,
    overdueAt: null,
    closedAt: null,
  },
})

async function mountView(detail: ChatbotRequestDetail) {
  api.getDetail.mockResolvedValue(detail)
  const wrapper = mount(ChatbotRequestDetailView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }]],
      stubs: {
        ...DETAIL_STUBS,
        AppResponsiveDrawer: {
          props: ['open', 'title'],
          template: '<section v-if="open" data-testid="drawer"><h2>{{ title }}</h2><slot name="body" /></section>',
        },
      },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.listAudit.mockResolvedValue({ items: [], nextCursor: null })
  toastAdd.mockReset()
  auth.perms = new Set(['read:ChatbotRequest', 'update:ChatbotRequest'])
})

describe('ChatbotRequestDetailView — commands', () => {
  it('«Atender» sends the claim with the version on screen, toasts and refetches the detail', async () => {
    api.claim.mockResolvedValue(claimed(4))
    const wrapper = await mountView(makeDetail({ version: 3, allowedActions: ['CLAIM', 'RESOLVE'] }))
    expect(api.getDetail).toHaveBeenCalledTimes(1)

    await wrapper.get('[data-testid="action-CLAIM"]').trigger('click')
    await flushPromises()

    expect(api.claim).toHaveBeenCalledWith('req-1', { expectedVersion: 3 }, expect.stringMatching(/^[0-9a-f-]{36}$/))
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Solicitud tomada', color: 'success' }))
    expect(api.getDetail.mock.calls.length).toBeGreaterThan(1)
  })

  it('a 409 shows the conflict notice above «Qué hacer», and «Actualizar» refetches', async () => {
    api.claim.mockRejectedValue(
      axiosError(409, {
        code: 'REQUEST_CLAIMED_BY_OTHER',
        current: { version: 5, status: 'IN_PROGRESS', claimedBy: { id: 'u-2', displayName: 'Ana López' } },
      }),
    )
    const wrapper = await mountView(makeDetail({ allowedActions: ['CLAIM'] }))
    await wrapper.get('[data-testid="action-CLAIM"]').trigger('click')
    await flushPromises()

    const rail = wrapper.get('aside')
    expect(rail.get('[data-testid="command-notice-title"]').text()).toBe('Ana López ya tomó esta solicitud')
    const before = api.getDetail.mock.calls.length
    await rail.get('[data-testid="notice-refresh"]').trigger('click')
    await flushPromises()
    expect(api.getDetail.mock.calls.length).toBeGreaterThan(before)
    expect(wrapper.find('[data-testid="command-notice"]').exists()).toBe(false)
  })

  it('«Cancelar solicitud…» opens the cancel form from the action panel', async () => {
    const wrapper = await mountView(
      makeDetail({ kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', decision: null, allowedActions: ['CANCEL'] }),
    )
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(false)

    await wrapper.get('[data-testid="action-CANCEL"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="drawer"]').text()).toContain('Cancelar solicitud')
    expect(wrapper.find('[data-testid="cancel-form"]').exists()).toBe(true)
  })

  it('does not call the permission-gated reads just by showing the page', async () => {
    await mountView(makeDetail({ allowedActions: ['REASSIGN', 'MERGE'] }))
    expect(api.listAssignableUsers).not.toHaveBeenCalled()
    expect(api.listMergeCandidates).not.toHaveBeenCalled()
  })
})
