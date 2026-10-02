import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isReadonly, watch } from 'vue'
import { authStorage } from '../auth-storage'
import { createSessionContext } from '../session-context'

function input(id = 'a') {
  const claims = { sub: 'user', tenantId: id, tenantSlug: id, isSuperAdmin: false }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return {
    tokens: { accessToken: `e30.${payload}.sig`, refreshToken: `refresh-${id}` },
    context: { tenant: { id, name: id, slug: id }, isSuperAdmin: false },
  }
}

function prepare(owner: ReturnType<typeof createSessionContext>, id = 'a') {
  const next = input(id)
  return owner.prepareReplacement(next.tokens, next.context)!
}

describe('isolated reactive session context', () => {
  beforeEach(() => authStorage.clear())

  it('prepares without publishing, then publishes one immutable coherent snapshot', () => {
    const owner = createSessionContext()
    const next = input()
    const expected = input()
    const generation = authStorage.getSessionGeneration()
    const pending = owner.prepareReplacement(next.tokens, next.context)!
    expect(pending.generation).toBe(generation + 1)
    expect(pending.isCurrent()).toBe(true)
    expect(owner.state.value).toBeNull()
    expect(authStorage.getAccessToken()).toBeNull()
    next.tokens.refreshToken = 'mutated'
    next.context.tenant.name = 'mutated'
    next.context.isSuperAdmin = true
    const observations: unknown[] = []
    const stop = watch(
      owner.state,
      (state) => {
        observations.push(state)
        expect(authStorage.getAccessToken()).toBe(state?.tokens?.accessToken)
        expect(authStorage.getRefreshToken()).toBe(state?.tokens?.refreshToken)
        expect(authStorage.getCurrentTenant()).toEqual(state?.tenant)
        expect(authStorage.getIsSuperAdmin()).toBe(state?.isSuperAdmin)
      },
      { flush: 'sync' },
    )
    try {
      expect(pending.commit()).toBe(true)
      expect(observations).toHaveLength(1)
      expect(owner.state.value).toEqual({
        ...expected.context,
        tokens: expected.tokens,
        generation: pending.generation,
      })
      expect(authStorage.getSessionGeneration()).toBe(pending.generation)
      expect(pending.isCurrent()).toBe(true)
      expect(pending.commit()).toBe(false)
      expect(isReadonly(owner.state)).toBe(true)
      expect(Reflect.set(owner.state.value!, 'isSuperAdmin', true)).toBe(false)
      expect(Reflect.set(owner.state.value!.tokens!, 'refreshToken', 'foreign')).toBe(false)
      expect(Reflect.set(owner.state.value!.tenant!, 'name', 'foreign')).toBe(false)
    } finally {
      stop()
    }
  })

  it('rejects invalid input without taking ownership or touching storage', () => {
    const owner = createSessionContext()
    const first = prepare(owner)
    expect(first.commit()).toBe(true)
    const original = owner.state.value
    const next = input('b')
    next.context.tenant.id = 'inconsistent'
    expect(owner.prepareReplacement(next.tokens, next.context)).toBeNull()
    expect(owner.state.value).toBe(original)
    expect(first.isCurrent()).toBe(true)
    expect(authStorage.getSessionGeneration()).toBe(first.generation)
    expect(authStorage.getRefreshToken()).toBe('refresh-a')
  })

  it('rejects an obsolete preparation and invalidates identical-login and ABA leases', () => {
    const owner = createSessionContext()
    const stale = prepare(owner)
    const first = prepare(owner)
    expect(stale.isCurrent()).toBe(false)
    expect(stale.commit()).toBe(false)
    expect(first.commit()).toBe(true)
    const original = owner.state.value
    const identical = prepare(owner)
    expect(identical.commit()).toBe(true)
    expect(owner.state.value).not.toBe(original)
    expect(first.isCurrent()).toBe(false)
    expect(prepare(owner, 'b').commit()).toBe(true)
    expect(prepare(owner).commit()).toBe(true)
    expect(identical.isCurrent()).toBe(false)
    expect(authStorage.getRefreshToken()).toBe('refresh-a')
  })

  it.each(['replace', 'clear', 'storage'] as const)(
    'reports abandonment after synchronous %s',
    (action) => {
      const owner = createSessionContext()
      expect(prepare(owner).commit()).toBe(true)
      const pending = prepare(owner, 'b')
      let nestedCommitted: boolean | undefined
      const stop = watch(
        owner.state,
        (state) => {
          if (state?.tokens?.refreshToken !== 'refresh-b') return
          if (action === 'replace') nestedCommitted = prepare(owner, 'c').commit()
          if (action === 'clear') nestedCommitted = owner.prepareClear().commit()
          if (action === 'storage') authStorage.setTokens(input('c').tokens)
        },
        { flush: 'sync' },
      )
      try {
        expect(pending.commit()).toBe(false)
        expect(nestedCommitted).toBe(action === 'storage' ? undefined : true)
        expect(pending.isCurrent()).toBe(false)
        expect(authStorage.getSessionGeneration()).toBeGreaterThan(pending.generation)
        expect(authStorage.getRefreshToken()).toBe(action === 'clear' ? null : 'refresh-c')
        expect(owner.state.value?.tokens?.refreshToken ?? null).toBe(
          action === 'replace' ? 'refresh-c' : action === 'clear' ? null : 'refresh-b',
        )
      } finally {
        stop()
      }
    },
  )

  it('clears coherently but cannot erase a replacement published by a clear watcher', () => {
    const owner = createSessionContext()
    expect(prepare(owner).commit()).toBe(true)
    const clearing = owner.prepareClear()
    const generation = clearing.generation
    const stop = watch(
      owner.state,
      (state) => {
        if (state?.tokens !== null) return
        expect(authStorage.getAccessToken()).toBeNull()
        expect(authStorage.getCurrentTenant()).toBeNull()
        expect(state).toEqual({ generation, tokens: null, tenant: null, isSuperAdmin: false })
        expect(prepare(owner, 'b').commit()).toBe(true)
      },
      { flush: 'sync' },
    )
    try {
      expect(clearing.commit()).toBe(false)
      expect(clearing.isCurrent()).toBe(false)
      expect(clearing.commit()).toBe(false)
      expect(owner.state.value?.tokens?.refreshToken).toBe('refresh-b')
      expect(authStorage.getRefreshToken()).toBe('refresh-b')
    } finally {
      stop()
    }
    const finalClear = owner.prepareClear()
    expect(finalClear.commit()).toBe(true)
    expect(finalClear.isCurrent()).toBe(true)
    expect(authStorage.getSessionGeneration()).toBe(finalClear.generation)
    expect(owner.state.value?.tokens).toBeNull()
  })

  it.each(['replace', 'clear'] as const)(
    'rejects delayed %s before any stale mutation',
    (action) => {
      const owner = createSessionContext()
      expect(prepare(owner).commit()).toBe(true)
      const pending = action === 'clear' ? owner.prepareClear() : prepare(owner, 'b')
      expect(prepare(owner, 'c').commit()).toBe(true)
      const latest = owner.state.value
      const write = vi.spyOn(localStorage, 'setItem')
      const remove = vi.spyOn(localStorage, 'removeItem')
      try {
        expect(pending.isCurrent()).toBe(false)
        expect(pending.commit()).toBe(false)
        expect(write).not.toHaveBeenCalled()
        expect(remove).not.toHaveBeenCalled()
        expect(owner.state.value).toBe(latest)
        expect(authStorage.getRefreshToken()).toBe('refresh-c')
      } finally {
        write.mockRestore()
        remove.mockRestore()
      }
    },
  )

  it('does not publish on persistence failure or retain a valid old lease', () => {
    const owner = createSessionContext()
    const first = prepare(owner)
    expect(first.commit()).toBe(true)
    const original = owner.state.value
    const pending = prepare(owner, 'b')
    const error = new Error('refresh denied')
    const originalSet = localStorage.setItem.bind(localStorage)
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'hound.auth.refreshToken') throw error
      originalSet(key, value)
    })
    let thrown: unknown
    try {
      pending.commit()
    } catch (caught) {
      thrown = caught
    } finally {
      write.mockRestore()
    }
    expect(thrown).toBe(error)
    expect(owner.state.value).toBe(original)
    expect(first.isCurrent()).toBe(false)
    expect(pending.isCurrent()).toBe(false)
    expect(pending.commit()).toBe(false)
    expect(authStorage.getSessionGeneration()).toBe(pending.generation + 1)
    expect(authStorage.getAccessToken()).toBe(input('b').tokens.accessToken)
    expect(authStorage.getRefreshToken()).toBe('refresh-a')
  })
})
