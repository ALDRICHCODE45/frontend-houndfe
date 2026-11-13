import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { axiosError, withQuery } from './withQuery'
import { defaultsFixture, settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'
import { chatbotSettingsKeys } from '../../constants/queryKeys'
import type { ChatbotRecompute, ChatbotSettings } from '../../interfaces/chatbot-settings.types'

vi.mock('../../api/chatbotSettings.api', () => ({ chatbotSettingsApi: { put: vi.fn() } }))

const auth = vi.hoisted(() => ({ tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
  }),
}))

import { chatbotSettingsApi } from '../../api/chatbotSettings.api'
import { useChatbotSettingsEditor } from '../useChatbotSettingsEditor'

const put = vi.mocked(chatbotSettingsApi.put)

const saved = (over: Partial<ChatbotSettings> = {}, recompute: ChatbotRecompute = 'DONE') => ({
  ...settingsFixture({ version: 4, ...over }),
  recompute,
})

function setup(initial: ChatbotSettings | undefined = settingsFixture(), canUpdate = true) {
  const source = ref<ChatbotSettings | undefined>(initial)
  const refetch = vi.fn().mockResolvedValue(undefined)
  const mounted = withQuery(() =>
    useChatbotSettingsEditor({ source, canUpdate: ref(canUpdate), refetch }),
  )
  return { ...mounted, editor: mounted.result, source, refetch }
}

const setWindow = (value: number) => (d: ChatbotSettings) => {
  d.windowWarningMinutes = value
}

beforeEach(() => {
  put.mockReset()
  auth.tenantId = 'tenant-1'
})

describe('loading the draft', () => {
  it('copies the server settings into a clean draft', async () => {
    const { editor } = setup()
    await flushPromises()

    expect(editor.draft.value).toEqual(settingsFixture())
    expect(editor.isDirty.value).toBe(false)
    expect(editor.creating.value).toBe(false)
  })

  it('version 0 is «creating»: nothing dirty yet, but saving is still needed', async () => {
    const { editor } = setup(defaultsFixture())
    await flushPromises()

    expect(editor.creating.value).toBe(true)
    expect(editor.isDirty.value).toBe(false)
    expect(editor.needsSave.value).toBe(true)
  })

  it('a refreshed source replaces a clean draft but never a dirty one', async () => {
    const { editor, source } = setup()
    await flushPromises()

    source.value = settingsFixture({ version: 4, windowWarningMinutes: 30 })
    await flushPromises()
    expect(editor.draft.value!.windowWarningMinutes).toBe(30)

    editor.edit(setWindow(99))
    source.value = settingsFixture({ version: 5, windowWarningMinutes: 10 })
    await flushPromises()
    expect(editor.draft.value!.windowWarningMinutes).toBe(99)
    expect(editor.accepted.value!.version).toBe(4)
  })
})

describe('dirty state and discard', () => {
  it('an edit makes the draft dirty with the changed items, discard brings it back', async () => {
    const { editor } = setup()
    await flushPromises()

    editor.edit((d) => {
      d.slas.find((s) => s.subtype === 'COMPLAINT')!.claimMinutes = 20
    })
    expect(editor.isDirty.value).toBe(true)
    expect(editor.dirtyItems.value.map((item) => item.key)).toEqual(['s:COMPLAINT'])

    editor.discard()
    expect(editor.isDirty.value).toBe(false)
    expect(editor.draft.value).toEqual(settingsFixture())
  })

  it('an edit clears the «saved» cue', async () => {
    put.mockResolvedValue(saved())
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(60))
    await editor.save()
    expect(editor.savedAt.value).not.toBeNull()

    editor.edit(setWindow(61))
    expect(editor.savedAt.value).toBeNull()
  })
})

describe('save', () => {
  it('PUTs the full object with expectedVersion and without version or recompute', async () => {
    put.mockResolvedValue(saved())
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(60))

    const outcome = await editor.save()

    expect(outcome).toEqual({ status: 'saved', changed: true, notice: null })
    const body = put.mock.calls[0]![0]
    expect(body.expectedVersion).toBe(3)
    expect(body).not.toHaveProperty('version')
    expect(body).not.toHaveProperty('recompute')
    expect(body.windowWarningMinutes).toBe(60)
    expect(body.enabledSubtypes).toEqual(['RESTOCK', 'COMPLAINT'])
    expect(body.branchOpeningHours).toEqual(settingsFixture().branchOpeningHours)
  })

  it('accepts the response: new base version, clean draft, query cache and the «saved» cue', async () => {
    put.mockResolvedValue(saved({ windowWarningMinutes: 60 }))
    const { editor, client } = setup()
    await flushPromises()
    editor.edit(setWindow(60))

    await editor.save()

    expect(editor.accepted.value!.version).toBe(4)
    expect(editor.isDirty.value).toBe(false)
    expect(editor.savedAt.value).not.toBeNull()
    const cached = client.getQueryData(chatbotSettingsKeys.detail('tenant-1')) as Record<string, unknown>
    expect(cached.version).toBe(4)
    expect(cached).not.toHaveProperty('recompute')
  })

  it('the first save of a version 0 branch sends expectedVersion 0 and no extra field', async () => {
    put.mockResolvedValue({ ...defaultsFixture(), version: 1, recompute: 'DONE' as const })
    const { editor } = setup(defaultsFixture())
    await flushPromises()

    await editor.save()

    expect(put.mock.calls[0]![0].expectedVersion).toBe(0)
    expect(put.mock.calls[0]![0]).not.toHaveProperty('branchOpeningHours')
    expect(editor.accepted.value!.version).toBe(1)
    expect(editor.creating.value).toBe(false)
  })

  it('identical content answers the same version: «changed» is false', async () => {
    put.mockResolvedValue(saved({ version: 3 }, 'NOT_NEEDED'))
    const { editor } = setup()
    await flushPromises()

    const outcome = await editor.save()

    expect(outcome).toEqual({ status: 'saved', changed: false, notice: null })
  })

  it('recompute FAILED keeps the new version and raises the notice, PARTIAL a softer one', async () => {
    put.mockResolvedValueOnce(saved({}, 'FAILED'))
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(60))
    expect(await editor.save()).toEqual({ status: 'saved', changed: true, notice: 'failed' })
    expect(editor.notice.value).toBe('failed')
    expect(editor.accepted.value!.version).toBe(4)

    put.mockResolvedValueOnce(saved({ version: 5 }, 'PARTIAL'))
    editor.edit(setWindow(61))
    await editor.save()
    expect(put.mock.calls[1]![0].expectedVersion).toBe(4)
    expect(editor.notice.value).toBe('partial')
  })

  it('refreshes the inbox queries when deadlines were recomputed, not when nothing changed', async () => {
    put.mockResolvedValueOnce(saved({}, 'DONE'))
    const { editor, client } = setup()
    await flushPromises()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    editor.edit(setWindow(60))
    await editor.save()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['chatbot-requests', 'tenant-1'] })

    invalidate.mockClear()
    put.mockResolvedValueOnce(saved({ version: 4 }, 'NOT_NEEDED'))
    await editor.save()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('does not send an invalid draft: it shows the errors instead', async () => {
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(1441))

    const outcome = await editor.save()

    expect(outcome.status).toBe('invalid')
    expect(put).not.toHaveBeenCalled()
    expect(editor.showErrors.value).toBe(true)
    expect(editor.errors.value['x:window']).toBeDefined()
  })

  it('does not send an out-of-range timeout or a malformed language', async () => {
    const { editor } = setup()
    await flushPromises()
    editor.edit((d) => { d.startTimeoutSeconds = 29 })
    expect((await editor.save()).status).toBe('invalid')
    expect(editor.errors.value['x:startTimeout']).toBe('Entre 30 y 600 segundos.')
    editor.edit((d) => { d.startTimeoutSeconds = 120; d.templateLanguageCode = 'es-MX' })
    expect((await editor.save()).status).toBe('invalid')
    expect(editor.errors.value['x:templateLanguage']).toBeDefined()
    expect(put).not.toHaveBeenCalled()
  })

  it('ignores a second save while one is in flight', async () => {
    let resolve!: (value: ReturnType<typeof saved>) => void
    put.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(60))

    const first = editor.save()
    const second = await editor.save()
    expect(second.status).toBe('skipped')
    resolve(saved())
    await first
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('without update permission nothing is sent', async () => {
    const { editor } = setup(settingsFixture(), false)
    await flushPromises()

    expect((await editor.save()).status).toBe('skipped')
    expect(put).not.toHaveBeenCalled()
  })
})

describe('save errors', () => {
  it('409 keeps the draft and opens the conflict with the server «current»; nothing is overwritten', async () => {
    const current = settingsFixture({ version: 4, closedDates: ['2027-01-06'] })
    put.mockRejectedValue(axiosError(409, { code: 'VERSION_CONFLICT', current }))
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(60))

    const outcome = await editor.save()

    expect(outcome.status).toBe('conflict')
    expect(editor.conflict.value).toEqual(current)
    expect(editor.draft.value!.windowWarningMinutes).toBe(60)
    expect(editor.accepted.value!.version).toBe(3)
    expect(editor.notice.value).toBeNull()
  })

  it('keepMine rebases onto the other version: my edits stay, the next PUT uses current.version', async () => {
    const current = settingsFixture({ version: 4, enabledSubtypes: ['RESTOCK'], windowWarningMinutes: 5 })
    put.mockRejectedValueOnce(axiosError(409, { code: 'VERSION_CONFLICT', current }))
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(60))
    await editor.save()

    editor.keepMine()
    expect(editor.conflict.value).toBeNull()
    expect(editor.accepted.value!.version).toBe(4)
    expect(editor.draft.value!.windowWarningMinutes).toBe(60)
    expect(editor.draft.value!.enabledSubtypes).toEqual(['RESTOCK'])
    expect(editor.isDirty.value).toBe(true)

    put.mockResolvedValueOnce(saved({ version: 5 }))
    await editor.save()
    expect(put.mock.calls[1]![0].expectedVersion).toBe(4)
    expect(put.mock.calls[1]![0].windowWarningMinutes).toBe(60)
  })

  it('useTheirs replaces the draft with the other version and drops my edits', async () => {
    const current = settingsFixture({ version: 4, windowWarningMinutes: 5 })
    put.mockRejectedValue(axiosError(409, { code: 'VERSION_CONFLICT', current }))
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(60))
    await editor.save()

    editor.useTheirs()

    expect(editor.conflict.value).toBeNull()
    expect(editor.draft.value).toEqual(current)
    expect(editor.isDirty.value).toBe(false)
  })

  it('a 409 without a usable current re-reads the settings to show the comparison', async () => {
    put.mockRejectedValue(axiosError(409, { code: 'VERSION_CONFLICT' }))
    const fresh = settingsFixture({ version: 4 })
    const { editor, refetch } = setup()
    refetch.mockResolvedValue(fresh)
    await flushPromises()
    editor.edit(setWindow(60))

    await editor.save()

    expect(refetch).toHaveBeenCalled()
    expect(editor.conflict.value).toEqual(fresh)
  })

  it.each([
    [400, { code: 'VALIDATION_ERROR', reason: 'INVALID_CHATBOT_SETTINGS' }, 'validation'],
    [403, { code: 'INSUFFICIENT_PERMISSIONS' }, 'forbidden'],
    [500, {}, 'error'],
  ])('%s keeps the draft and raises the %s notice', async (status, data, notice) => {
    put.mockRejectedValue(axiosError(status, data))
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(60))

    const outcome = await editor.save()

    expect(outcome.status).toBe('error')
    expect(editor.notice.value).toBe(notice)
    expect(editor.draft.value!.windowWarningMinutes).toBe(60)
    expect(editor.isDirty.value).toBe(true)
    expect(editor.saving.value).toBe(false)
  })

  describe('400 with fieldErrors', () => {
    const fieldErrors = [
      { path: 'scheduling.slotMinutes', code: 'OUT_OF_RANGE' },
      { path: 'openingHours.days[1].ranges[1]', code: 'OVERLAP' },
    ]

    it('locates each error on its field, shows the checklist and keeps the draft', async () => {
      put.mockRejectedValue(axiosError(400, { code: 'VALIDATION_ERROR', fieldErrors }))
      const { editor } = setup()
      await flushPromises()
      editor.edit(setWindow(60))

      const outcome = await editor.save()

      expect(outcome).toEqual({ status: 'error', located: true, first: 'c:slot' })
      expect(Object.keys(editor.serverErrors.value)).toEqual(['c:slot', 'h:TUESDAY'])
      expect(Object.keys(editor.allErrors.value)).toEqual(['c:slot', 'h:TUESDAY'])
      expect(editor.showErrors.value).toBe(true)
      // every error was located: the field messages are the notice, no generic banner on top
      expect(editor.notice.value).toBeNull()
      expect(editor.draft.value!.windowWarningMinutes).toBe(60)
    })

    it('an error that cannot be located also raises the generic notice', async () => {
      put.mockRejectedValue(
        axiosError(400, { code: 'VALIDATION_ERROR', fieldErrors: [...fieldErrors, { path: 'tenantId', code: 'UNKNOWN_FIELD' }] }),
      )
      const { editor } = setup()
      await flushPromises()
      editor.edit(setWindow(60))

      const outcome = await editor.save()

      expect(outcome).toMatchObject({ status: 'error', located: true })
      expect(editor.notice.value).toBe('validation')
    })

    it('an empty or missing fieldErrors falls back to the generic notice only', async () => {
      put.mockRejectedValue(axiosError(400, { code: 'VALIDATION_ERROR', fieldErrors: [] }))
      const { editor } = setup()
      await flushPromises()
      editor.edit(setWindow(60))

      const outcome = await editor.save()

      expect(outcome).toEqual({ status: 'error', located: false, first: null })
      expect(editor.notice.value).toBe('validation')
      expect(editor.serverErrors.value).toEqual({})
    })

    it('maps indexes against the body that was sent (ranges and dates are sorted on send)', async () => {
      put.mockRejectedValue(
        axiosError(400, { code: 'VALIDATION_ERROR', fieldErrors: [{ path: 'slas[3].resolveMinutes', code: 'MUST_BE_NULL' }] }),
      )
      const { editor } = setup()
      await flushPromises()
      editor.edit(setWindow(60))
      await editor.save()
      expect(Object.keys(editor.serverErrors.value)).toEqual(['s:TRANSFER_RECEIPT:resolve'])
    })

    it('editing a field clears its server error and keeps the others', async () => {
      put.mockRejectedValue(axiosError(400, { code: 'VALIDATION_ERROR', fieldErrors }))
      const { editor } = setup()
      await flushPromises()
      editor.edit(setWindow(60))
      await editor.save()

      editor.edit((d) => {
        d.scheduling.slotMinutes = 45
      })

      expect(Object.keys(editor.serverErrors.value)).toEqual(['h:TUESDAY'])
      expect(editor.showErrors.value).toBe(true)

      editor.edit((d) => {
        d.openingHours.days[1]!.ranges = [{ open: '09:00', close: '10:00' }]
      })

      expect(editor.serverErrors.value).toEqual({})
      expect(editor.showErrors.value).toBe(false)
    })

    it('editing the timeout or the language clears only its own server error', async () => {
      put.mockRejectedValue(
        axiosError(400, {
          code: 'VALIDATION_ERROR',
          fieldErrors: [
            { path: 'startTimeoutSeconds', code: 'OUT_OF_RANGE' },
            { path: 'templateLanguageCode', code: 'INVALID_LANGUAGE_CODE' },
          ],
        }),
      )
      const { editor } = setup()
      await flushPromises()
      editor.edit(setWindow(60))
      await editor.save()
      expect(Object.keys(editor.serverErrors.value)).toEqual(['x:startTimeout', 'x:templateLanguage'])

      editor.edit((d) => { d.startTimeoutSeconds = 200 })
      expect(Object.keys(editor.serverErrors.value)).toEqual(['x:templateLanguage'])
      editor.edit((d) => { d.templateLanguageCode = 'es' })
      expect(editor.serverErrors.value).toEqual({})
    })

    it('the next save starts clean, and discard clears the server errors', async () => {
      put.mockRejectedValueOnce(axiosError(400, { code: 'VALIDATION_ERROR', fieldErrors }))
      const { editor } = setup()
      await flushPromises()
      editor.edit(setWindow(60))
      await editor.save()
      put.mockResolvedValueOnce(saved({ windowWarningMinutes: 60 }))

      await editor.save()
      expect(editor.serverErrors.value).toEqual({})

      put.mockRejectedValueOnce(axiosError(400, { code: 'VALIDATION_ERROR', fieldErrors }))
      editor.edit(setWindow(61))
      await editor.save()
      expect(Object.keys(editor.serverErrors.value)).toHaveLength(2)
      editor.discard()
      expect(editor.serverErrors.value).toEqual({})
    })

    it('a server error does not block sending again (the server decides)', async () => {
      put.mockRejectedValueOnce(axiosError(400, { code: 'VALIDATION_ERROR', fieldErrors }))
      const { editor } = setup()
      await flushPromises()
      editor.edit(setWindow(60))
      await editor.save()
      put.mockResolvedValueOnce(saved({ windowWarningMinutes: 60 }))

      expect((await editor.save()).status).toBe('saved')
    })
  })

  describe('round trip', () => {
    it('sends an unknown key of the GET back unchanged and never the read-only keys', async () => {
      put.mockResolvedValue(saved())
      const source = {
        ...settingsFixture({ updatedBy: { id: 'u1', displayName: 'Ana' }, updatedAt: '2026-11-12T15:04:05.123Z' }),
        futureTop: { keep: true },
      } as ChatbotSettings
      ;(source.scheduling as unknown as Record<string, unknown>).futureNested = 9
      const { editor } = setup(source)
      await flushPromises()
      editor.edit(setWindow(60))

      await editor.save()

      const sent = put.mock.calls[0]![0] as Record<string, unknown>
      expect(sent.futureTop).toEqual({ keep: true })
      expect((sent.scheduling as Record<string, unknown>).futureNested).toBe(9)
      for (const key of ['version', 'recompute', 'updatedBy', 'updatedAt']) expect(sent).not.toHaveProperty(key)
    })

    it('a reason edit makes the draft dirty and travels in the PUT for present dates only', async () => {
      put.mockResolvedValue(saved())
      const { editor } = setup()
      await flushPromises()

      editor.edit((d) => {
        d.closedDateReasons = { '2026-12-25': ' Navidad ' }
      })
      expect(editor.isDirty.value).toBe(true)
      await editor.save()

      expect(put.mock.calls[0]![0].closedDateReasons).toEqual({ '2026-12-25': 'Navidad' })
    })

    it('a reason over 80 characters blocks the save client-side, under its date', async () => {
      const { editor } = setup()
      await flushPromises()
      editor.edit((d) => {
        d.closedDateReasons = { '2026-12-25': 'a'.repeat(81) }
      })

      const outcome = await editor.save()

      expect(outcome.status).toBe('invalid')
      expect(Object.keys(editor.allErrors.value)).toEqual(['r:2026-12-25'])
      expect(put).not.toHaveBeenCalled()
    })
  })

  it('a network failure raises the generic «error» notice', async () => {
    put.mockRejectedValue(new Error('Network Error'))
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(60))
    await editor.save()
    expect(editor.notice.value).toBe('error')
  })

  it('closeNotice clears the notice', async () => {
    put.mockRejectedValue(axiosError(500))
    const { editor } = setup()
    await flushPromises()
    editor.edit(setWindow(60))
    await editor.save()
    editor.closeNotice()
    expect(editor.notice.value).toBeNull()
  })
})
