import { describe, expect, it, vi } from 'vitest'
import type { EditorialContractContext } from '../../interfaces/editorial-contract-request.types'
import type { EditorialStateResponse, EditorialVocabularyResponse } from '../../interfaces/editorial-contract-response.types'
import { loadEditorialContractSnapshot, type EditorialContractSnapshot } from '../editorial-contract-snapshot'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function harness(productId = 'product-a', digit = 'a') {
  const revision = `ev2-sha256-${digit.repeat(64)}`
  const vocabulary: EditorialVocabularyResponse = {
    contractVersion: 2, vocabularyRevision: revision,
    vocabulary: { semanticsVersion: 'editorial-production-1', families: [], definitions: [] },
  }
  const state: EditorialStateResponse = {
    contractVersion: 2, vocabularyRevision: revision,
    state: { cycle: null, draft: null, published: null, warnings: [] },
  }
  const context: EditorialContractContext = { variants: [{ id: 'variant', name: 'Original name' }] }
  const v = deferred<EditorialVocabularyResponse>()
  const s = deferred<EditorialStateResponse>()
  const c = deferred<EditorialContractContext>()
  const stateStarted = deferred<void>()
  const contextStarted = deferred<void>()
  const port = {
    getVocabulary: vi.fn((_signal: AbortSignal) => v.promise),
    getState: vi.fn((_id: string, _revision: string, _signal: AbortSignal) => {
      stateStarted.resolve()
      return s.promise
    }),
    getContext: vi.fn((_id: string, _signal: AbortSignal) => {
      contextStarted.resolve()
      return c.promise
    }),
  }
  const controller = new AbortController()
  let outcome: 'pending' | 'fulfilled' | 'rejected' = 'pending'
  let result: EditorialContractSnapshot | undefined
  let error: unknown
  const run = () => {
    const promise = loadEditorialContractSnapshot(port, productId, controller.signal)
    // Observe rejection immediately, including in intentional failure cases.
    const observed = promise.then(value => { outcome = 'fulfilled'; result = value }, reason => {
      outcome = 'rejected'; error = reason
    })
    return { promise, observed }
  }
  const startBranches = async () => {
    v.resolve(vocabulary)
    await Promise.all([stateStarted.promise, contextStarted.promise])
  }
  const expectOnce = () => {
    expect(port.getVocabulary).toHaveBeenCalledTimes(1)
    expect(port.getState).toHaveBeenCalledTimes(1)
    expect(port.getContext).toHaveBeenCalledTimes(1)
  }
  return {
    productId, revision, vocabulary, state, context, v, s, c, port, controller,
    run, startBranches, expectOnce,
    get outcome() { return outcome }, get result() { return result }, get error() { return error },
  }
}

// Bounded microtask checkpoint, not a scheduler delay or a timer.
async function checkpoint() {
  for (let turn = 0; turn < 8; turn++) await Promise.resolve()
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep)
    Object.freeze(value)
  }
  return value
}

function expectSafeError(error: unknown, message: string) {
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).toBe(message)
}

const cancelled = 'Editorial snapshot load cancelled'
const incoherent = 'Editorial snapshot revisions do not match'

describe('loadEditorialContractSnapshot (S5/S19)', () => {
  it.each(['state', 'context'] as const)('orders calls and waits when %s resolves first', async first => {
    const h = harness()
    const before = structuredClone({ vocabulary: h.vocabulary, state: h.state, context: h.context })
    freezeDeep(h.vocabulary); freezeDeep(h.state); freezeDeep(h.context)
    const run = h.run()
    expect(h.port.getVocabulary.mock.calls).toEqual([[h.controller.signal]])
    expect(h.port.getState).not.toHaveBeenCalled()
    expect(h.port.getContext).not.toHaveBeenCalled()
    await h.startBranches()
    h.expectOnce()
    expect(h.port.getState.mock.calls).toEqual([[h.productId, h.revision, h.controller.signal]])
    expect(h.port.getContext.mock.calls).toEqual([[h.productId, h.controller.signal]])
    expect(h.outcome).toBe('pending')
    if (first === 'state') h.s.resolve(h.state)
    else h.c.resolve(h.context)
    await checkpoint()
    expect(h.outcome).toBe('pending')
    if (first === 'state') h.c.resolve(h.context)
    else h.s.resolve(h.state)
    await run.observed
    expect(h.outcome).toBe('fulfilled')
    expect(h.result).toEqual(before)
    expect(h.result?.vocabulary).toBe(h.vocabulary)
    expect(h.result?.state).toBe(h.state)
    expect(h.result?.context).toBe(h.context)
    expect({ vocabulary: h.vocabulary, state: h.state, context: h.context }).toEqual(before)
    h.expectOnce()
  })

  it('preserves vocabulary failure identity without starting fanout or retrying', async () => {
    const h = harness()
    const failure = new Error('upstream vocabulary failure')
    const run = h.run()
    h.v.reject(failure)
    await run.observed
    expect(h.error).toBe(failure)
    expect(h.result).toBeUndefined()
    expect(h.port.getVocabulary).toHaveBeenCalledTimes(1)
    expect(h.port.getState).not.toHaveBeenCalled()
    expect(h.port.getContext).not.toHaveBeenCalled()
  })

  for (const branch of ['state', 'context'] as const) {
    it.each([
      new Error('upstream failure'),
      { status: 409, code: 'CONFLICT' },
      { status: 409, code: 'VOCABULARY_CHANGED' },
    ])(`preserves ${branch} rejection identity and does not retry (%j)`, async failure => {
      const h = harness()
      const run = h.run()
      await h.startBranches()
      h[branch === 'state' ? 's' : 'c'].reject(failure)
      await run.observed
      expect(h.outcome).toBe('rejected')
      expect(h.error).toBe(failure)
      expect(h.result).toBeUndefined()
      // A subsequent sibling rejection is handled by the fanout, not unhandled.
      h[branch === 'state' ? 'c' : 's'].reject(new Error('later sibling failure'))
      await checkpoint()
      expect(h.error).toBe(failure)
      h.expectOnce()
    })
  }

  it('rejects an unequal R without exposing either revision or returning partial data', async () => {
    const h = harness()
    const run = h.run()
    await h.startBranches()
    h.s.resolve({ ...h.state, vocabularyRevision: `ev2-sha256-${'b'.repeat(64)}` })
    h.c.resolve(h.context)
    await run.observed
    expectSafeError(h.error, incoherent)
    expect(h.result).toBeUndefined()
    h.expectOnce()
  })

  it('checks cancellation before calling the port and hides arbitrary abort reasons', async () => {
    const h = harness()
    h.controller.abort(new Error('private reason'))
    h.v.resolve(h.vocabulary)
    h.s.resolve(h.state)
    h.c.resolve(h.context)
    await h.run().observed
    expectSafeError(h.error, cancelled)
    expect(h.port.getVocabulary).not.toHaveBeenCalled()
    expect(h.port.getState).not.toHaveBeenCalled()
    expect(h.port.getContext).not.toHaveBeenCalled()
  })

  it('checks cancellation after vocabulary even when the port ignores abort', async () => {
    const h = harness()
    const run = h.run()
    h.controller.abort('private reason')
    h.v.resolve(h.vocabulary)
    h.s.resolve(h.state)
    h.c.resolve(h.context)
    await run.observed
    expectSafeError(h.error, cancelled)
    expect(h.port.getVocabulary).toHaveBeenCalledTimes(1)
    expect(h.port.getState).not.toHaveBeenCalled()
    expect(h.port.getContext).not.toHaveBeenCalled()
  })

  it.each(['neither', 'state', 'context', 'both'] as const)(
    'rejects ignored-signal results when abort happens after vocabulary with %s settled', async settled => {
      const h = harness()
      const run = h.run()
      await h.startBranches()
      if (settled === 'state' || settled === 'both') h.s.resolve(h.state)
      if (settled === 'context' || settled === 'both') h.c.resolve(h.context)
      if (settled !== 'both') await checkpoint()
      // For both, abort synchronously after resolve, before async continuation returns.
      h.controller.abort({ private: 'reason' })
      h.s.resolve(h.state)
      h.c.resolve(h.context)
      await run.observed
      expectSafeError(h.error, cancelled)
      expect(h.result).toBeUndefined()
      h.expectOnce()
    },
  )

  it('preserves upstream rejection identity even if cancellation also occurred', async () => {
    const h = harness()
    const run = h.run()
    await h.startBranches()
    h.controller.abort()
    const failure = { status: 409, code: 'VOCABULARY_CHANGED' }
    h.s.reject(failure)
    h.c.resolve(h.context)
    await run.observed
    expect(h.error).toBe(failure)
    h.expectOnce()
  })

  it('isolates overlapping products, revisions, results and cancellation', async () => {
    const a = harness('product-a', 'a')
    const b = harness('product-b', 'b')
    // One read port, two overlapping invocations; no lifecycle/cache state.
    const port = {
      getVocabulary: vi.fn((signal: AbortSignal) => signal === a.controller.signal ? a.v.promise : b.v.promise),
      getState: vi.fn((id: string, revision: string, signal: AbortSignal) =>
        (id === a.productId ? a : b).port.getState(id, revision, signal)),
      getContext: vi.fn((id: string, signal: AbortSignal) =>
        (id === a.productId ? a : b).port.getContext(id, signal)),
    }
    const pa = loadEditorialContractSnapshot(port, a.productId, a.controller.signal)
    const observedA = pa.then(() => { throw new Error('cancelled load succeeded') }, error => error)
    const pb = loadEditorialContractSnapshot(port, b.productId, b.controller.signal)
    await b.startBranches()
    await a.startBranches()
    expect(port.getState.mock.calls).toEqual([
      [b.productId, b.revision, b.controller.signal], [a.productId, a.revision, a.controller.signal],
    ])
    expect(port.getContext.mock.calls).toEqual([
      [b.productId, b.controller.signal], [a.productId, a.controller.signal],
    ])
    a.controller.abort()
    b.c.resolve(b.context)
    a.s.resolve(a.state)
    b.s.resolve(b.state)
    const result = await pb
    expect(result).toEqual({ vocabulary: b.vocabulary, state: b.state, context: b.context })
    expect(result.vocabulary).toBe(b.vocabulary)
    a.c.resolve(a.context)
    expectSafeError(await observedA, cancelled)
    expect(port.getVocabulary.mock.calls).toEqual([[a.controller.signal], [b.controller.signal]])
    expect(port.getState).toHaveBeenCalledTimes(2)
    expect(port.getContext).toHaveBeenCalledTimes(2)
  })
})
