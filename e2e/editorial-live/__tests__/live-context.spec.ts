/** Tests for the editorial-live context opener with stub browser/context/page (no real browser). */
import { describe, expect, it, vi } from 'vitest'
import type { Browser } from '@playwright/test'

import { resolveEditorialLiveEnv } from '../support/env'
import type { ValidatedEditorialActor } from '../support/fixture'
import { buildLiveContextOptions, EditorialLiveContextError, liveAllowedOrigins, openLiveEditorialContext } from '../support/live-context'

const env = resolveEditorialLiveEnv({
  EDITORIAL_LIVE_ENABLED: '1',
  EDITORIAL_LIVE_BACKEND_URL: 'http://127.0.0.1:8082/api/v1',
  EDITORIAL_LIVE_FIXTURE_PATH: 'artifacts/editorial-live/fixture.json',
}, '/repo/frontend')
const actor = {
  role: 'superadmin-global', userId: 'u', email: 'u@example.test', isSuperAdmin: true, tenant: null, permissionCodes: [],
  tokens: { access: 'live-token-secret' }, expiresAt: '2099-01-01T00:00:00Z', ttlSeconds: 60,
  user: { id: 'u', email: 'u@example.test', name: 'U', isActive: true, createdAt: '2026-01-01T00:00:00Z' }, memberships: [],
} as ValidatedEditorialActor

function stubs(seedFails = false) {
  const order: string[] = []
  const page = {
    on: vi.fn(), off: vi.fn(),
    addInitScript: vi.fn(() => { order.push('seed'); return seedFails ? Promise.reject(new Error('token live-token-secret')) : Promise.resolve() }),
  }
  const context = {
    route: vi.fn(() => { order.push('guard'); return Promise.resolve() }),
    unroute: vi.fn(() => Promise.resolve()),
    newPage: vi.fn(() => { order.push('page'); return Promise.resolve(page) }),
    close: vi.fn(() => { order.push('close'); return Promise.resolve() }),
  }
  const browser = { newContext: vi.fn(() => { order.push('context'); return Promise.resolve(context) }) }
  return { order, page, context, browser: browser as unknown as Browser }
}

describe('openLiveEditorialContext', () => {
  it('uses hardened options and allows exactly the frontend and backend origins', () => {
    expect(buildLiveContextOptions(env)).toEqual({ serviceWorkers: 'block', baseURL: 'http://127.0.0.1:4191', acceptDownloads: false, recordHar: undefined })
    expect(liveAllowedOrigins(env)).toEqual(['http://127.0.0.1:4191', 'http://127.0.0.1:8082'])
  })

  it('installs the guard on the context before the page exists, audits, then seeds; close tears everything down', async () => {
    const { order, page, context, browser } = stubs()
    const live = await openLiveEditorialContext(browser, env, actor)
    expect(order).toEqual(['context', 'guard', 'page', 'seed'])
    expect(page.on).toHaveBeenCalledWith('request', expect.any(Function))
    await live.close()
    expect(context.unroute).toHaveBeenCalled()
    expect(page.off).toHaveBeenCalledWith('request', expect.any(Function))
    expect(context.close).toHaveBeenCalledTimes(1)
  })

  it('a failed seed closes the context and never surfaces the raw message', async () => {
    const { context, browser } = stubs(true)
    const failure = await openLiveEditorialContext(browser, env, actor).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(EditorialLiveContextError)
    expect((failure as Error).message).not.toContain('live-token-secret')
    expect(context.close).toHaveBeenCalledTimes(1)
  })
})
