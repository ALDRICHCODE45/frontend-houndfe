import { effectScope, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inventoryApi } from '../../api/inventory.api'
import type { AdjustmentInput, AdjustmentResult } from '../../interfaces/inventory.types'
import type { InventoryContext } from '../useInventoryAccess'
import { useStockAdjustment } from '../useStockAdjustment'

vi.mock('../../api/inventory.api', () => ({ inventoryApi: { adjust: vi.fn() } }))

const input = (patch: Partial<AdjustmentInput> = {}): AdjustmentInput => ({
  target: { productId: 'p1', lotId: 'l1' }, expectedVersion: 1, delta: -8, reason: 'EXPIRED',
  note: 'Lote vencido retirado', ...patch,
})
const result = { movement: { id: 'm1' }, stock: { product: { id: 'p1', quantity: 34 } } } as unknown as AdjustmentResult
function setup(patch: Partial<InventoryContext> = {}) {
  const context = shallowRef<InventoryContext>({
    userId: 'user-1', tenantId: 'branch-1', ready: true, canRead: true, canAdjust: true, ...patch,
  })
  const scope = effectScope()
  const owner = scope.run(() => useStockAdjustment(context))!
  return { context, scope, owner }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const httpError = (status: number, error: string) =>
  Object.assign(new Error(error), { response: { status, data: { statusCode: status, error } } })
beforeEach(() => vi.resetAllMocks())

describe('adjustment transport', () => {
  it('sends one frozen body with the abort signal and a uuid Idempotency-Key, then returns movement and stock', async () => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockResolvedValue(result)
    const draft = input()
    expect(await owner.adjust(draft)).toEqual({ status: 'applied', result })
    const [body, key, signal] = vi.mocked(inventoryApi.adjust).mock.calls[0]!
    expect(body).toEqual(input())
    expect(Object.isFrozen(body) && Object.isFrozen(body.target)).toBe(true)
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(signal).toEqual(expect.any(AbortSignal))
    draft.delta = 99
    expect(body.delta).toBe(-8)
    expect(owner.acknowledged.value).toEqual(result)
    expect(owner.isPending.value).toBe(false)
    scope.stop()
  })

  it('trims the note and drops a blank note on a reason that does not need one', async () => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockResolvedValue(result)
    await owner.adjust(input({ reason: 'OTHER', note: '  Se cayó el estante  ' }))
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0].note).toBe('Se cayó el estante')
    await owner.adjust(input({ reason: 'DAMAGE', note: '   ' }))
    expect(vi.mocked(inventoryApi.adjust).mock.calls[1]![0]).not.toHaveProperty('note')
    scope.stop()
  })

  it('uses a fresh key for every new submission, after success and after a rejection', async () => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockResolvedValueOnce(result)
      .mockRejectedValueOnce(httpError(409, 'INSUFFICIENT_STOCK')).mockResolvedValueOnce(result)
    await owner.adjust(input())
    await owner.adjust(input())
    await owner.adjust(input())
    const keys = vi.mocked(inventoryApi.adjust).mock.calls.map(call => call[1])
    expect(new Set(keys).size).toBe(3)
    scope.stop()
  })

  it('refuses a second submission while the first is in flight (one request, one movement)', async () => {
    const { owner, scope } = setup()
    const pending = deferred<AdjustmentResult>()
    vi.mocked(inventoryApi.adjust).mockReturnValue(pending.promise)
    const first = owner.adjust(input())
    expect(owner.isPending.value).toBe(true)
    expect(await owner.adjust(input())).toEqual({ status: 'blocked' })
    pending.resolve(result)
    expect(await first).toEqual({ status: 'applied', result })
    expect(inventoryApi.adjust).toHaveBeenCalledTimes(1)
    scope.stop()
  })
})

describe('adjustment validation before sending', () => {
  it.each([
    ['a zero delta', { delta: 0 }, 'DELTA_ZERO'],
    ['a fractional delta', { delta: 0.5 }, 'DELTA_INVALID'],
    ['OTHER without a note', { reason: 'OTHER', note: undefined }, 'NOTE_REQUIRED'],
    ['OTHER with a blank note', { reason: 'OTHER', note: '  ' }, 'NOTE_REQUIRED'],
    ['a note over 500 characters', { note: 'x'.repeat(501) }, 'NOTE_TOO_LONG'],
    ['lot and variant together', { target: { productId: 'p1', lotId: 'l1', variantId: 'v1' } }, 'TARGET_AMBIGUOUS'],
  ] as const)('does not send %s', async (_name, patch, issue) => {
    const { owner, scope } = setup()
    expect(await owner.adjust(input(patch as Partial<AdjustmentInput>))).toEqual({ status: 'invalid', issue })
    expect(inventoryApi.adjust).not.toHaveBeenCalled()
    expect(owner.isPending.value).toBe(false)
    // an invalid draft leaves no attempt behind: the corrected one goes through
    vi.mocked(inventoryApi.adjust).mockResolvedValue(result)
    expect((await owner.adjust(input())).status).toBe('applied')
    scope.stop()
  })
})

describe('adjustment permissions', () => {
  it.each([
    ['without the adjust grant', { canAdjust: false }],
    ['without the read grant', { canRead: false, canAdjust: false }],
    ['before the session is ready', { ready: false }],
    ['without a user', { userId: '' }],
    ['without a branch', { tenantId: '' }],
  ])('sends nothing %s', async (_name, patch) => {
    const { owner, scope } = setup(patch)
    expect(await owner.adjust(input())).toEqual({ status: 'blocked' })
    expect(inventoryApi.adjust).not.toHaveBeenCalled()
    scope.stop()
  })
})

describe('definitive rejections', () => {
  it.each([
    [409, 'STOCK_VERSION_CONFLICT'],
    [409, 'INSUFFICIENT_STOCK'],
    [409, 'STOCK_NOT_TRACKED'],
    [409, 'IDEMPOTENCY_KEY_CONFLICT'],
    [400, 'MALFORMED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
  ])('classifies %s %s as rejected with its code and drops the attempt', async (status, code) => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(httpError(status, code))
    expect(await owner.adjust(input())).toEqual({ status: 'rejected', code })
    expect(owner.errorCode.value).toBe(code)
    expect(owner.hasUncertainResult.value).toBe(false)
    expect(owner.acknowledged.value).toBeNull()
    expect(await owner.retry()).toEqual({ status: 'blocked' })
    expect(inventoryApi.adjust).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('starts the next submission with a new key after a version conflict', async () => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(httpError(409, 'STOCK_VERSION_CONFLICT')).mockResolvedValueOnce(result)
    await owner.adjust(input())
    const staleKey = vi.mocked(inventoryApi.adjust).mock.calls[0]![1]
    await owner.adjust(input({ expectedVersion: 2 }))
    const [body, key] = vi.mocked(inventoryApi.adjust).mock.calls[1]!
    expect(key).not.toBe(staleKey)
    expect(body.expectedVersion).toBe(2)
    expect(owner.errorCode.value).toBeNull()
    scope.stop()
  })
})

describe('uncertain results and replay', () => {
  it.each([
    ['a network failure', new Error('timeout')],
    ['a 500', httpError(500, 'INTERNAL_ERROR')],
    ['an in-flight key', httpError(409, 'IDEMPOTENCY_KEY_IN_FLIGHT')],
  ])('keeps the attempt after %s and replays it only on explicit retry with the same key and body', async (_name, failure) => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(failure).mockResolvedValueOnce(result)
    const draft = input()
    expect(await owner.adjust(draft)).toEqual({ status: 'uncertain' })
    expect(owner.hasUncertainResult.value).toBe(true)
    // nothing replays on its own and a different body cannot slip past the open attempt
    expect(await owner.adjust(input({ delta: -1 }))).toEqual({ status: 'blocked' })
    expect(inventoryApi.adjust).toHaveBeenCalledTimes(1)
    expect(await owner.retry()).toEqual({ status: 'applied', result })
    const [first, second] = vi.mocked(inventoryApi.adjust).mock.calls
    expect(second![1]).toBe(first![1])
    expect(second![0]).toBe(first![0])
    expect(second![0]).toEqual(input())
    expect(owner.hasUncertainResult.value).toBe(false)
    expect(owner.errorCode.value).toBeNull()
    scope.stop()
  })

  it('turns a replay that the server answers definitively into a rejection and closes the attempt', async () => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(httpError(409, 'IDEMPOTENCY_KEY_CONFLICT'))
    await owner.adjust(input())
    expect(await owner.retry()).toEqual({ status: 'rejected', code: 'IDEMPOTENCY_KEY_CONFLICT' })
    expect(owner.hasUncertainResult.value).toBe(false)
    expect(await owner.retry()).toEqual({ status: 'blocked' })
    scope.stop()
  })

  it('lets the user abandon an uncertain attempt so a new adjustment can start with a new key', async () => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(result)
    await owner.adjust(input())
    const abandonedKey = vi.mocked(inventoryApi.adjust).mock.calls[0]![1]
    owner.abandon()
    expect(owner.hasUncertainResult.value).toBe(false)
    expect(owner.errorCode.value).toBeNull()
    expect(await owner.retry()).toEqual({ status: 'blocked' })
    await owner.adjust(input({ expectedVersion: 4 }))
    expect(vi.mocked(inventoryApi.adjust).mock.calls[1]![1]).not.toBe(abandonedKey)
    scope.stop()
  })

  it('does not replay while a replay is already running', async () => {
    const { owner, scope } = setup()
    const pending = deferred<AdjustmentResult>()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(new Error('timeout')).mockReturnValueOnce(pending.promise)
    await owner.adjust(input())
    const replay = owner.retry()
    expect(await owner.retry()).toEqual({ status: 'blocked' })
    pending.resolve(result)
    await replay
    expect(inventoryApi.adjust).toHaveBeenCalledTimes(2)
    scope.stop()
  })
})

describe('ownership of late results', () => {
  it.each([
    ['the branch changes', { tenantId: 'branch-2' }],
    ['the user changes', { userId: 'user-2' }],
    ['the adjust grant is revoked', { canAdjust: false }],
  ])('discards the result and aborts the request when %s mid-flight', async (_name, patch) => {
    const { owner, scope, context } = setup()
    const pending = deferred<AdjustmentResult>()
    vi.mocked(inventoryApi.adjust).mockReturnValue(pending.promise)
    const running = owner.adjust(input())
    const signal = vi.mocked(inventoryApi.adjust).mock.calls[0]![2]!
    context.value = { ...context.value, ...patch }
    expect(signal.aborted).toBe(true)
    expect(owner.isPending.value).toBe(false)
    pending.resolve(result)
    expect(await running).toEqual({ status: 'discarded' })
    expect(owner.acknowledged.value).toBeNull()
    expect(owner.errorCode.value).toBeNull()
    scope.stop()
  })

  it('discards a late failure and an uncertain attempt when the scope is disposed', async () => {
    const { owner, scope } = setup()
    const pending = deferred<AdjustmentResult>()
    vi.mocked(inventoryApi.adjust).mockReturnValue(pending.promise)
    const running = owner.adjust(input())
    scope.stop()
    pending.reject(httpError(409, 'INSUFFICIENT_STOCK'))
    expect(await running).toEqual({ status: 'discarded' })
    expect(owner.errorCode.value).toBeNull()
    expect(await owner.adjust(input())).toEqual({ status: 'blocked' })
  })

  it('forgets an uncertain attempt when the identity changes', async () => {
    const { owner, scope, context } = setup()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(new Error('timeout'))
    await owner.adjust(input())
    context.value = { ...context.value, tenantId: 'branch-2' }
    expect(owner.hasUncertainResult.value).toBe(false)
    expect(await owner.retry()).toEqual({ status: 'blocked' })
    scope.stop()
  })
})

describe('error message', () => {
  it('shows the fixed sentence of a definitive rejection, never the server text', async () => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(Object.assign(new Error('boom'), {
      response: { status: 409, data: { statusCode: 409, error: 'INSUFFICIENT_STOCK', message: 'Server says no' } },
    }))
    await owner.adjust(input())
    expect(owner.errorMessage.value).toBe('No hay suficiente stock para restar esa cantidad.')
    scope.stop()
  })

  it('says the result is unknown after a network failure and clears once applied', async () => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(result)
    await owner.adjust(input())
    expect(owner.errorMessage.value).toBe('No pudimos confirmar si el ajuste se aplicó.')
    await owner.retry()
    expect(owner.errorMessage.value).toBeNull()
    scope.stop()
  })

  it('says an in-flight key is still processing', async () => {
    const { owner, scope } = setup()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(httpError(409, 'IDEMPOTENCY_KEY_IN_FLIGHT'))
    await owner.adjust(input())
    expect(owner.errorMessage.value).toBe('El ajuste sigue en proceso. Aún no sabemos si se aplicó.')
    scope.stop()
  })
})
