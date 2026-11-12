import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { axiosError, withQuery } from './withQuery'
import { settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'
import type { ChatbotApplyResult } from '../../interfaces/chatbot-settings.types'

vi.mock('../../api/chatbotSettings.api', () => ({ chatbotSettingsApi: { applyToAllBranches: vi.fn() } }))

import { chatbotSettingsApi } from '../../api/chatbotSettings.api'
import { useApplyToAllBranches } from '../useApplyToAllBranches'

const apply = vi.mocked(chatbotSettingsApi.applyToAllBranches)

const dry: ChatbotApplyResult = {
  dryRun: true,
  source: { tenantId: 't1', version: 3 },
  tenantsApplied: [{ tenantId: 't2', name: 'Norte' }],
  tenantsUnchanged: [{ tenantId: 't1', name: 'Centro' }],
  tenantsSkipped: [{ tenantId: 't3', name: 'Sur', reason: 'NO_PERMISSION' }],
  tenantsFailed: [],
}
const real: ChatbotApplyResult = {
  ...dry,
  dryRun: false,
  tenantsApplied: [{ tenantId: 't2', name: 'Norte', recompute: 'DONE' }],
}

function setup(over: { canApply?: boolean; needsSave?: boolean; version?: number } = {}) {
  const state = { needsSave: over.needsSave ?? false, version: over.version ?? 3 }
  const save = vi.fn().mockResolvedValue({ status: 'saved', changed: true, notice: null })
  const refetch = vi.fn().mockResolvedValue(settingsFixture({ version: 4 }))
  const mounted = withQuery(() =>
    useApplyToAllBranches({
      canApply: ref(over.canApply ?? true),
      needsSave: () => state.needsSave,
      version: () => state.version,
      save,
      refetch,
    }),
  )
  return { ...mounted, flow: mounted.result, save, refetch, state }
}

beforeEach(() => {
  apply.mockReset()
  apply.mockResolvedValue(dry)
})

describe('open', () => {
  it('with nothing to save it dry-runs straight away with the version on screen', async () => {
    const { flow } = setup()
    await flow.open()

    expect(apply).toHaveBeenCalledWith({ dryRun: true, expectedVersion: 3 })
    expect(flow.step.value).toBe('review')
    expect(flow.result.value).toEqual(dry)
  })

  it('does nothing without update:ChatbotSettingsAllBranches', async () => {
    const { flow } = setup({ canApply: false })
    await flow.open()

    expect(flow.step.value).toBe('closed')
    expect(apply).not.toHaveBeenCalled()
  })

  it('with unsaved changes or a version 0 it asks to save first and sends nothing yet', async () => {
    const { flow } = setup({ needsSave: true })
    await flow.open()

    expect(flow.step.value).toBe('save-first')
    expect(apply).not.toHaveBeenCalled()
  })
})

describe('save first', () => {
  it('saves, then reviews with the NEW version', async () => {
    const { flow, save, state } = setup({ needsSave: true })
    save.mockImplementation(async () => {
      state.needsSave = false
      state.version = 4
      return { status: 'saved', changed: true, notice: null }
    })
    await flow.open()
    await flow.saveFirst()

    expect(save).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith({ dryRun: true, expectedVersion: 4 })
    expect(flow.step.value).toBe('review')
  })

  it.each([
    [{ status: 'invalid' }],
    [{ status: 'conflict' }],
    [{ status: 'error' }],
    [{ status: 'saved', changed: true, notice: 'failed' }],
  ])('stops and closes when the save does not end clean (%o)', async (outcome) => {
    const { flow, save } = setup({ needsSave: true })
    save.mockResolvedValue(outcome)
    await flow.open()
    await flow.saveFirst()

    expect(apply).not.toHaveBeenCalled()
    expect(flow.step.value).toBe('closed')
  })
})

describe('confirm', () => {
  it('applies with only expectedVersion (no dryRun) and keeps the per-branch result', async () => {
    const { flow } = setup()
    await flow.open()
    apply.mockResolvedValue(real)
    await flow.confirm()

    expect(apply).toHaveBeenLastCalledWith({ expectedVersion: 3 })
    expect(flow.step.value).toBe('result')
    expect(flow.result.value).toEqual(real)
  })

  it('a partial result keeps the failed branches and the FAILED recompute for the dialog', async () => {
    const { flow } = setup()
    await flow.open()
    const partial: ChatbotApplyResult = {
      ...real,
      tenantsApplied: [{ tenantId: 't2', name: 'Norte', recompute: 'FAILED' }],
      tenantsFailed: [{ tenantId: 't4', name: 'Poniente' }],
    }
    apply.mockResolvedValue(partial)
    await flow.confirm()

    expect(flow.step.value).toBe('result')
    expect(flow.result.value!.tenantsFailed).toHaveLength(1)
    expect(flow.result.value!.tenantsApplied[0]!.recompute).toBe('FAILED')
  })

  it('retrying the failed ones repeats the same call (the server operation is idempotent)', async () => {
    const { flow } = setup()
    await flow.open()
    apply.mockResolvedValue(real)
    await flow.confirm()
    await flow.confirm()

    expect(apply.mock.calls.filter(([body]) => !body.dryRun)).toHaveLength(2)
  })
})

describe('errors', () => {
  it('409 on the dry run moves to «conflict» whether or not the body had current', async () => {
    apply.mockRejectedValue(axiosError(409, { code: 'VERSION_CONFLICT' }))
    const { flow } = setup()
    await flow.open()
    expect(flow.step.value).toBe('conflict')

    apply.mockRejectedValue(axiosError(409, { code: 'VERSION_CONFLICT', current: settingsFixture({ version: 4 }) }))
    await flow.retry()
    expect(flow.step.value).toBe('conflict')
  })

  it('retry after a conflict re-reads the settings and reviews again', async () => {
    apply.mockRejectedValueOnce(axiosError(409, { code: 'VERSION_CONFLICT' }))
    const { flow, refetch, state } = setup()
    await flow.open()
    refetch.mockImplementation(async () => {
      state.version = 4
      return settingsFixture({ version: 4 })
    })
    apply.mockResolvedValueOnce(dry)
    await flow.retry()

    expect(refetch).toHaveBeenCalled()
    expect(apply).toHaveBeenLastCalledWith({ dryRun: true, expectedVersion: 4 })
    expect(flow.step.value).toBe('review')
  })

  it('a 409 on the real run also lands in «conflict»', async () => {
    const { flow } = setup()
    await flow.open()
    apply.mockRejectedValue(axiosError(409, { code: 'VERSION_CONFLICT' }))
    await flow.confirm()
    expect(flow.step.value).toBe('conflict')
  })

  it.each([
    [403, 'forbidden'],
    [400, 'validation'],
    [500, 'server'],
  ])('%s shows an error step with its kind and retry repeats the failed call', async (status, kind) => {
    apply.mockRejectedValue(axiosError(status))
    const { flow } = setup()
    await flow.open()
    expect(flow.step.value).toBe('error')
    expect(flow.errorKind.value).toBe(kind)

    apply.mockResolvedValue(dry)
    await flow.retry()
    expect(flow.step.value).toBe('review')
  })

  it('a network failure is an error step too', async () => {
    apply.mockRejectedValue(new Error('Network Error'))
    const { flow } = setup()
    await flow.open()
    expect(flow.errorKind.value).toBe('network')
  })
})

describe('close', () => {
  it('resets the flow', async () => {
    const { flow } = setup()
    await flow.open()
    flow.close()
    await flushPromises()

    expect(flow.step.value).toBe('closed')
    expect(flow.result.value).toBeNull()
  })

  it('a response that arrives after closing is ignored', async () => {
    let resolve!: (value: ChatbotApplyResult) => void
    apply.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const { flow } = setup()
    const opening = flow.open()
    flow.close()
    resolve(dry)
    await opening

    expect(flow.step.value).toBe('closed')
  })
})
