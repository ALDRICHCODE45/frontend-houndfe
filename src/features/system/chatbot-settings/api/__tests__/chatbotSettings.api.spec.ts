// chatbotSettings.api.spec.ts — transport of handoff 16 (GET/PUT /chatbot-settings, apply to all).
// The PUT body is an allow-list: `version`, `recompute` and anything unknown never reach the wire.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { chatbotSettingsApi } from '../chatbotSettings.api'
import {
  clone,
  defaultsFixture,
  settingsFixture,
} from '../../interfaces/__tests__/chatbot-settings.fixture'
import type { ChatbotSettingsPutBody } from '../../interfaces/chatbot-settings.types'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

const get = vi.mocked(http.get)
const put = vi.mocked(http.put)
const post = vi.mocked(http.post)

function putBodyOf(source = settingsFixture()): ChatbotSettingsPutBody {
  const { version, branchOpeningHours, ...rest } = source
  return { ...rest, expectedVersion: version, ...(branchOpeningHours ? { branchOpeningHours } : {}) }
}

beforeEach(() => vi.clearAllMocks())

describe('chatbotSettingsApi.get', () => {
  it('calls GET /chatbot-settings and forwards the abort signal', async () => {
    get.mockResolvedValue({ data: settingsFixture() })
    const signal = new AbortController().signal

    await chatbotSettingsApi.get({ signal })

    expect(get).toHaveBeenCalledWith('/chatbot-settings', { signal })
  })

  it('returns the parsed body and strips unknown fields', async () => {
    get.mockResolvedValue({ data: { ...settingsFixture(), futureField: 1 } })

    const settings = await chatbotSettingsApi.get()

    expect(settings).toEqual(settingsFixture())
    expect(settings).not.toHaveProperty('futureField')
  })

  it('accepts the defaults of a branch that never saved (version 0, no pickup hours)', async () => {
    get.mockResolvedValue({ data: defaultsFixture() })

    const settings = await chatbotSettingsApi.get()

    expect(settings.version).toBe(0)
    expect(settings.branchOpeningHours).toBeNull()
  })

  it('rejects a body that drifted from the contract', async () => {
    const broken = clone(settingsFixture()) as unknown as Record<string, unknown>
    delete broken.slas
    get.mockResolvedValue({ data: broken })

    await expect(chatbotSettingsApi.get()).rejects.toThrow()
  })
})

describe('chatbotSettingsApi.put', () => {
  it('calls PUT /chatbot-settings with the full object and expectedVersion', async () => {
    put.mockResolvedValue({ data: { ...settingsFixture({ version: 4 }), recompute: 'DONE' } })
    const body = putBodyOf()

    const saved = await chatbotSettingsApi.put(body)

    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0]![0]).toBe('/chatbot-settings')
    expect(put.mock.calls[0]![1]).toEqual(body)
    expect((put.mock.calls[0]![1] as ChatbotSettingsPutBody).expectedVersion).toBe(3)
    expect(saved.version).toBe(4)
    expect(saved.recompute).toBe('DONE')
  })

  it('round-trips enabledSubtypes, stored-only fields and branchOpeningHours untouched', async () => {
    put.mockResolvedValue({ data: { ...settingsFixture(), recompute: 'NOT_NEEDED' } })
    const source = settingsFixture({
      enabledSubtypes: ['RESTOCK', 'COMPLAINT'],
      windowWarningMinutes: 90,
      templateName: 'aviso_seguimiento',
    })

    await chatbotSettingsApi.put(putBodyOf(source))

    const sent = put.mock.calls[0]![1] as ChatbotSettingsPutBody
    expect(sent.enabledSubtypes).toEqual(['RESTOCK', 'COMPLAINT'])
    expect(sent.windowWarningMinutes).toBe(90)
    expect(sent.templateName).toBe('aviso_seguimiento')
    expect(sent.scheduling).toEqual(source.scheduling)
    expect(sent.branchOpeningHours).toEqual(source.branchOpeningHours)
  })

  it('drops the read-only fields the contract excludes (version, recompute) and unknown keys', async () => {
    put.mockResolvedValue({ data: { ...settingsFixture(), recompute: 'DONE' } })
    const forged = {
      ...putBodyOf(),
      version: 3,
      recompute: 'DONE',
      updatedBy: 'x',
    } as unknown as ChatbotSettingsPutBody

    await chatbotSettingsApi.put(forged)

    const sent = put.mock.calls[0]![1] as Record<string, unknown>
    expect(sent).not.toHaveProperty('version')
    expect(sent).not.toHaveProperty('recompute')
    expect(sent).not.toHaveProperty('updatedBy')
    expect(Object.keys(sent).sort()).toEqual(
      [
        'branchOpeningHours',
        'closedDates',
        'enabledSubtypes',
        'expectedVersion',
        'openingHours',
        'receiptCloseMarginMinutes',
        'scheduling',
        'slas',
        'templateCostText',
        'templateName',
        'windowWarningMinutes',
      ].sort(),
    )
  })

  it('omits branchOpeningHours when the GET had none', async () => {
    put.mockResolvedValue({ data: { ...defaultsFixture(), version: 1, recompute: 'DONE' } })
    const body = putBodyOf(defaultsFixture())
    delete body.branchOpeningHours

    await chatbotSettingsApi.put(body)

    expect(put.mock.calls[0]![1]).not.toHaveProperty('branchOpeningHours')
  })

  it('sends expectedVersion 0 for the first save of a branch', async () => {
    put.mockResolvedValue({ data: { ...defaultsFixture(), version: 1, recompute: 'DONE' } })

    await chatbotSettingsApi.put(putBodyOf(defaultsFixture()))

    expect((put.mock.calls[0]![1] as ChatbotSettingsPutBody).expectedVersion).toBe(0)
  })

  it('does not mutate the caller body', async () => {
    put.mockResolvedValue({ data: { ...settingsFixture(), recompute: 'DONE' } })
    const body = putBodyOf()
    const snapshot = clone(body)

    await chatbotSettingsApi.put(body)

    expect(body).toEqual(snapshot)
  })

  it('rejects a response without recompute', async () => {
    put.mockResolvedValue({ data: settingsFixture() })

    await expect(chatbotSettingsApi.put(putBodyOf())).rejects.toThrow()
  })
})

describe('chatbotSettingsApi.applyToAllBranches', () => {
  const dry = {
    dryRun: true,
    source: { tenantId: 't1', version: 4 },
    tenantsApplied: [{ tenantId: 't2', name: 'Norte' }],
    tenantsUnchanged: [{ tenantId: 't1', name: 'Centro' }],
    tenantsSkipped: [{ tenantId: 't3', name: 'Sur', reason: 'NO_PERMISSION' }],
    tenantsFailed: [],
  }

  it('POSTs the dry run with expectedVersion to /chatbot-settings/apply-to-all-tenants', async () => {
    post.mockResolvedValue({ data: dry })

    const result = await chatbotSettingsApi.applyToAllBranches({ dryRun: true, expectedVersion: 4 })

    expect(post).toHaveBeenCalledWith('/chatbot-settings/apply-to-all-tenants', {
      dryRun: true,
      expectedVersion: 4,
    })
    expect(result.tenantsApplied).toEqual([{ tenantId: 't2', name: 'Norte' }])
    expect(result.tenantsSkipped[0]!.reason).toBe('NO_PERMISSION')
  })

  it('the real run sends only expectedVersion', async () => {
    post.mockResolvedValue({
      data: {
        ...dry,
        dryRun: false,
        tenantsApplied: [{ tenantId: 't2', name: 'Norte', recompute: 'FAILED' }],
      },
    })

    const result = await chatbotSettingsApi.applyToAllBranches({ expectedVersion: 4 })

    expect(post.mock.calls[0]![1]).toEqual({ expectedVersion: 4 })
    expect(result.tenantsApplied[0]!.recompute).toBe('FAILED')
  })

  it('allow-lists the body: forged keys do not travel', async () => {
    post.mockResolvedValue({ data: dry })

    await chatbotSettingsApi.applyToAllBranches({
      dryRun: true,
      expectedVersion: 4,
      tenantIds: ['x'],
    } as never)

    expect(post.mock.calls[0]![1]).toEqual({ dryRun: true, expectedVersion: 4 })
  })

  it('sends an empty body when nothing is given', async () => {
    post.mockResolvedValue({ data: dry })

    await chatbotSettingsApi.applyToAllBranches({})

    expect(post.mock.calls[0]![1]).toEqual({})
  })
})

