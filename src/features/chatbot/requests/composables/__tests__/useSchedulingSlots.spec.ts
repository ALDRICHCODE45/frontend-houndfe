import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { axiosError, withQuery } from './withQuery'
import type { ChatbotSchedulingSlots } from '../../interfaces/chatbot-request.types'

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: { getSchedulingSlots: vi.fn() },
}))

const auth = vi.hoisted(() => ({ perms: new Set<string>(), tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) => auth.perms.has(`${action}:${subject}`),
  }),
}))

import { chatbotRequestApi } from '../../api/chatbot-request.api'
import { chatbotRequestKeys } from '../../constants/queryKeys'
import { useSchedulingSlots } from '../useSchedulingSlots'

const getSlots = vi.mocked(chatbotRequestApi.getSchedulingSlots)

const slots = (): ChatbotSchedulingSlots => ({
  timeZone: 'America/Mexico_City',
  whatsappWindowClosesAt: '2026-11-14T03:10:00.000Z',
  slots: [
    { startsAt: '2026-11-14T15:00:00.000Z', withinWindow: true, available: true },
    { startsAt: '2026-11-14T15:30:00.000Z', withinWindow: false, available: true },
  ],
})

beforeEach(() => {
  getSlots.mockReset()
  getSlots.mockResolvedValue(slots())
  auth.perms = new Set(['read:ChatbotRequest'])
  auth.tenantId = 'tenant-1'
})

describe('useSchedulingSlots', () => {
  it('reads the staff picker of the request when the reschedule sheet is open, always fresh', async () => {
    const { result, client } = withQuery(() => useSchedulingSlots('req-1', { enabled: true }))
    await flushPromises()

    expect(getSlots).toHaveBeenCalledWith('req-1', { signal: expect.anything() })
    expect(result.data.value).toEqual(slots())
    expect(client.getQueryData(chatbotRequestKeys.schedulingSlots('tenant-1', 'req-1'))).toEqual(slots())
  })

  it('does not ask until the sheet is open, nor without read:ChatbotRequest or an id', async () => {
    const open = ref(false)
    withQuery(() => useSchedulingSlots('req-1', { enabled: open }))
    await flushPromises()
    expect(getSlots).not.toHaveBeenCalled()
    open.value = true
    await flushPromises()
    expect(getSlots).toHaveBeenCalledTimes(1)

    getSlots.mockClear()
    auth.perms = new Set()
    withQuery(() => useSchedulingSlots('req-1', { enabled: true }))
    withQuery(() => useSchedulingSlots('  ', { enabled: true }))
    await flushPromises()
    expect(getSlots).not.toHaveBeenCalled()
  })

  it('exposes the failure (422 SCHEDULING_DISABLED) and does not retry it', async () => {
    getSlots.mockRejectedValue(axiosError(422, { code: 'SCHEDULING_DISABLED' }))
    const { result } = withQuery(() => useSchedulingSlots('req-1', { enabled: true }))
    await flushPromises()
    expect(result.isError.value).toBe(true)
    expect(getSlots).toHaveBeenCalledTimes(1)
    expect(result.errorMessage.value).toBe('El agendado está desactivado en esta sucursal.')
  })

  it('replaceSlots swaps the list (SLOT_UNAVAILABLE) and keeps the rest of the answer', async () => {
    const { result, client } = withQuery(() => useSchedulingSlots('req-1', { enabled: true }))
    await flushPromises()
    const fresh = [{ startsAt: '2026-11-14T16:00:00.000Z', withinWindow: true, available: true as const }]

    result.replaceSlots({ slots: fresh, timeZone: 'America/Mexico_City', whatsappWindowClosesAt: null })

    expect(result.data.value?.slots).toEqual(fresh)
    expect(result.data.value?.whatsappWindowClosesAt).toBeNull()
    expect(client.getQueryData<ChatbotSchedulingSlots>(chatbotRequestKeys.schedulingSlots('tenant-1', 'req-1'))?.slots).toEqual(fresh)
    expect(getSlots).toHaveBeenCalledTimes(1)
  })

  it('replaceSlots keeps the previous zone when the body carries none', async () => {
    const { result } = withQuery(() => useSchedulingSlots('req-1', { enabled: true }))
    await flushPromises()
    result.replaceSlots({ slots: [], timeZone: '', whatsappWindowClosesAt: '2026-11-14T03:10:00.000Z' })
    expect(result.data.value?.timeZone).toBe('America/Mexico_City')
    expect(result.data.value?.slots).toEqual([])
  })
})
