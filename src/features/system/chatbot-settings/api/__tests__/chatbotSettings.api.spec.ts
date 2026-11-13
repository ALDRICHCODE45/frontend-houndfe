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
  const { version, branchOpeningHours, updatedBy, updatedAt, ...rest } = source
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

  it('returns the parsed body', async () => {
    get.mockResolvedValue({ data: settingsFixture() })

    expect(await chatbotSettingsApi.get()).toEqual(settingsFixture())
  })

  // The PUT is a full replacement, so an unknown key must survive the parse (it goes back unchanged on save).
  it.each([
    ['top level', (b: Record<string, unknown>) => { b.futureField = { a: 1 } }],
    ['openingHours', (b: Record<string, unknown>) => { (b.openingHours as Record<string, unknown>).futureField = 1 }],
    ['an opening day', (b: Record<string, unknown>) => { ((b.openingHours as { days: Array<Record<string, unknown>> }).days[0]!).futureField = 1 }],
    ['an opening range', (b: Record<string, unknown>) => { ((b.openingHours as { days: Array<{ ranges: Array<Record<string, unknown>> }> }).days[0]!.ranges[0]!).futureField = 1 }],
    ['an sla entry', (b: Record<string, unknown>) => { (b.slas as Array<Record<string, unknown>>)[0]!.futureField = 1 }],
    ['scheduling', (b: Record<string, unknown>) => { (b.scheduling as Record<string, unknown>).futureField = 1 }],
    ['branchOpeningHours', (b: Record<string, unknown>) => { (b.branchOpeningHours as Record<string, unknown>).futureField = 1 }],
  ])('keeps an unknown key in %s instead of stripping or rejecting it', async (_where, mutate) => {
    const body = clone(settingsFixture()) as unknown as Record<string, unknown>
    mutate(body)
    get.mockResolvedValue({ data: body })

    const settings = await chatbotSettingsApi.get()

    expect(JSON.stringify(settings)).toContain('"futureField"')
    expect(settings).toEqual(body)
  })

  it('reads updatedBy, updatedAt and closedDateReasons', async () => {
    const body = {
      ...settingsFixture(),
      closedDateReasons: { '2026-12-25': 'Navidad' },
      updatedBy: { id: '6f1c', displayName: 'Ana López' },
      updatedAt: '2026-11-12T15:04:05.123Z',
    }
    get.mockResolvedValue({ data: body })

    const settings = await chatbotSettingsApi.get()

    expect(settings.closedDateReasons).toEqual({ '2026-12-25': 'Navidad' })
    expect(settings.updatedBy).toEqual({ id: '6f1c', displayName: 'Ana López' })
    expect(settings.updatedAt).toBe('2026-11-12T15:04:05.123Z')
  })

  it('defaults the S11 fields when an older body lacks them (no reasons, nobody saved)', async () => {
    const body = clone(settingsFixture()) as unknown as Record<string, unknown>
    delete body.closedDateReasons
    delete body.updatedBy
    delete body.updatedAt
    get.mockResolvedValue({ data: body })

    const settings = await chatbotSettingsApi.get()

    expect(settings.closedDateReasons).toEqual({})
    expect(settings.updatedBy).toBeNull()
    expect(settings.updatedAt).toBeNull()
  })

  it('rejects an unknown subtype', async () => {
    const body = clone(settingsFixture()) as unknown as { slas: Array<Record<string, unknown>> }
    body.slas[0]!.subtype = 'NEW_SUBTYPE'
    get.mockResolvedValue({ data: body })

    await expect(chatbotSettingsApi.get()).rejects.toThrow()
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

  it('never sends the read-only keys (version, recompute, updatedBy, updatedAt)', async () => {
    put.mockResolvedValue({ data: { ...settingsFixture(), recompute: 'DONE' } })
    const forged = {
      ...putBodyOf(),
      version: 3,
      recompute: 'DONE',
      updatedBy: { id: 'x', displayName: 'Ana' },
      updatedAt: '2026-11-12T15:04:05.123Z',
    } as unknown as ChatbotSettingsPutBody

    await chatbotSettingsApi.put(forged)

    const sent = put.mock.calls[0]![1] as Record<string, unknown>
    for (const key of ['version', 'recompute', 'updatedBy', 'updatedAt']) expect(sent).not.toHaveProperty(key)
    expect(Object.keys(sent).sort()).toEqual(
      [
        'branchOpeningHours',
        'closedDateReasons',
        'closedDates',
        'enabledSubtypes',
        'expectedVersion',
        'openingHours',
        'receiptCloseMarginMinutes',
        'scheduling',
        'slas',
        'startTimeoutSeconds',
        'templateCostText',
        'templateLanguageCode',
        'templateName',
        'windowWarningMinutes',
      ].sort(),
    )
  })

  it('sends an unknown key back unchanged, at the top level and nested', async () => {
    put.mockResolvedValue({ data: { ...settingsFixture(), recompute: 'DONE' } })
    const body = putBodyOf() as ChatbotSettingsPutBody & Record<string, unknown>
    body.futureTop = { keep: ['me'] }
    ;(body.scheduling as unknown as Record<string, unknown>).futureNested = 7

    await chatbotSettingsApi.put(body)

    const sent = put.mock.calls[0]![1] as Record<string, unknown>
    expect(sent.futureTop).toEqual({ keep: ['me'] })
    expect((sent.scheduling as Record<string, unknown>).futureNested).toBe(7)
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

  it('keeps an unknown key of the PUT response, and reads who saved', async () => {
    put.mockResolvedValue({
      data: {
        ...settingsFixture({ version: 4, updatedBy: { id: 'u1', displayName: 'Ana López' }, updatedAt: '2026-11-12T15:04:05.123Z' }),
        recompute: 'DONE',
        futureField: 1,
      },
    })

    const saved = await chatbotSettingsApi.put(putBodyOf())

    expect((saved as unknown as Record<string, unknown>).futureField).toBe(1)
    expect(saved.updatedBy?.displayName).toBe('Ana López')
  })

  it('rejects a PUT response with an unknown subtype', async () => {
    const body = { ...clone(settingsFixture()), recompute: 'DONE' } as unknown as { slas: Array<Record<string, unknown>> }
    body.slas[0]!.subtype = 'NEW_SUBTYPE'
    put.mockResolvedValue({ data: body })

    await expect(chatbotSettingsApi.put(putBodyOf())).rejects.toThrow()
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

