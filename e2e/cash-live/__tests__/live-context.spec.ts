/**
 * Focused unit tests for the cash-live per-actor browser context helper
 * (`../support/live-context.ts`).
 *
 * The helper is the ONLY place that opens a `BrowserContext` for the live
 * journey. It must, in this exact order:
 *
 * 1. open the context with the hardened options
 *    (`serviceWorkers: 'block'`, owned frontend `baseURL`,
 *    `acceptDownloads: false`, `recordHar: undefined`);
 * 2. install the outbound guard ON THE CONTEXT (so popups are covered too)
 *    with exactly the declared frontend + backend origins;
 * 3. create the page;
 * 4. seed the backend-issued actor before any navigation.
 *
 * It must never navigate, never mock/fulfil a response, and it must clean the
 * guard and the context even when setup throws — without echoing any raw
 * (token-rich) setup error into a public message.
 *
 * Everything here runs against synthetic in-memory stubs: no browser, no
 * network, no services, no fixture file. The env and actor are still built
 * through the REAL validators so the helper is exercised with the real
 * contracts.
 */
import { describe, expect, it } from 'vitest'
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
  Request,
  Route,
} from '@playwright/test'

import { resolveCashLiveEnv } from '../support/env'
import { buildActorAuthSeedPlan } from '../support/auth-seed'
import {
  validateCashLiveFixture,
  type CashLiveFixtureBinding,
  type ValidatedFixtureActor,
} from '../support/fixture'
import {
  CashLiveContextError,
  buildLiveContextOptions,
  liveAllowedOrigins,
  openLiveActorContext,
} from '../support/live-context'

const BACKEND = 'http://127.0.0.1:36383'

/** Real validated env: loopback backend with an empty base path. */
const env = resolveCashLiveEnv({
  CASH_LIVE_ENABLED: '1',
  CASH_LIVE_BACKEND_URL: BACKEND,
  CASH_LIVE_FIXTURE_PATH: 'artifacts/cash-live/scratch/fixture.json',
})

const FRONTEND = env.frontendOrigin
const BACKEND_ORIGIN = env.backendOrigin
const RESOURCE_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const TENANT_A = { id: 'tenant-a-id', name: 'Tenant A', slug: 'tenant-a' }
const TENANT_B = { id: 'tenant-b-id', name: 'Tenant B', slug: 'tenant-b' }
const ACCESS_TOKEN = 'synthetic-access-token-0001'

const actorUser = (id: string, email: string, name: string) => ({
  id,
  email,
  name,
  isActive: true,
  createdAt: '2025-06-01T00:00:00.000Z',
})

const actor = (
  role: 'cashier' | 'verifier' | 'foreign',
  tenant: { id: string; name: string; slug: string },
  permissionCodes: string[],
  accessToken: string,
) => ({
  userId: `user-${role}-id`,
  tenantId: tenant.id,
  email: `${role}@cash-live.test`,
  permissionCodes,
  accessToken,
  functionalRole: role,
  user: actorUser(`user-${role}-id`, `${role}@cash-live.test`, `Actor ${role}`),
  tenant,
  memberships: [
    { tenantId: tenant.id, tenantName: tenant.name, tenantSlug: tenant.slug, roleName: 'owner' },
  ],
  expiresAt: '2025-06-01T02:00:00.000Z',
  ttlSeconds: 7200,
})

const binding: CashLiveFixtureBinding = {
  backendUrl: env.backendBaseUrl,
  frontendOrigin: FRONTEND,
}

const fixture = validateCashLiveFixture(
  {
    schemaVersion: 1,
    backend: { url: env.backendBaseUrl, basePath: '', resourceId: RESOURCE_ID },
    frontendOrigin: FRONTEND,
    tenants: [TENANT_A, TENANT_B],
    actors: {
      cashier: actor(
        'cashier',
        TENANT_A,
        ['read:CashRegister', 'create:CashSession'],
        ACCESS_TOKEN,
      ),
      verifier: actor('verifier', TENANT_A, ['read:CashRegister'], 'synthetic-access-token-0002'),
      foreign: actor('foreign', TENANT_B, ['read:Sale'], 'synthetic-access-token-0003'),
    },
    metadata: {
      owner: 'cash-live-harness',
      backendHEAD: 'a29a61404eff4d98e333613b1691d1c01528d600',
      resourceId: RESOURCE_ID,
      generatedAt: '2025-06-01T00:00:00.000Z',
      readiness: {
        seeded: true,
        tenants: 2,
        users: 3,
        permissionsSeeded: 4,
        accessTokensIssued: 3,
      },
      cleanup: { owner: 'backend', drops: ['pg', 'server'] },
      accessOnly: true,
      refreshTokenIssued: false,
      otpIssued: false,
    },
  },
  binding,
)
const cashier: ValidatedFixtureActor = fixture.actors[0]!

interface RecordedRoute {
  readonly pattern: string
  readonly handler: (route: Route, request: Request) => unknown
}

interface HarnessOptions {
  readonly failRoute?: Error
  readonly failNewPage?: Error
  readonly failAddInitScript?: Error
  readonly failUnroute?: Error
  readonly failClose?: Error
}

/** Minimal `Browser`/`BrowserContext`/`Page` stubs that record interaction order. */
function createHarness(options: HarnessOptions = {}) {
  const calls: string[] = []
  const routes: RecordedRoute[] = []
  const unrouted: RecordedRoute[] = []
  const initScripts: { readonly script: unknown; readonly arg: unknown }[] = []
  let contextOptions: BrowserContextOptions | undefined
  let closed = false

  const page = {
    async addInitScript(script: unknown, arg?: unknown) {
      calls.push('addInitScript')
      if (options.failAddInitScript) throw options.failAddInitScript
      initScripts.push({ script, arg })
    },
    async goto() {
      calls.push('goto')
    },
  }

  const context = {
    async route(pattern: string, handler: RecordedRoute['handler']) {
      calls.push('route')
      if (options.failRoute) throw options.failRoute
      routes.push({ pattern, handler })
    },
    async unroute(pattern: string, handler?: RecordedRoute['handler']) {
      calls.push('unroute')
      if (options.failUnroute) throw options.failUnroute
      unrouted.push({ pattern, handler: handler as RecordedRoute['handler'] })
    },
    async newPage() {
      calls.push('newPage')
      if (options.failNewPage) throw options.failNewPage
      return page as unknown as Page
    },
    async close() {
      calls.push('close')
      if (options.failClose) throw options.failClose
      closed = true
    },
  }

  const browser = {
    async newContext(nextOptions?: BrowserContextOptions) {
      calls.push('newContext')
      contextOptions = nextOptions
      return context as unknown as BrowserContext
    },
  }

  return {
    browser: browser as unknown as Browser,
    calls,
    routes,
    unrouted,
    initScripts,
    contextOptions: () => contextOptions,
    isClosed: () => closed,
    navigation: () => calls.filter((call) => call === 'goto'),
  }
}

/** Awaits a promise expected to reject and returns the thrown error. */
async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
  } catch (error) {
    return error as Error
  }
  throw new Error('expected the setup promise to reject')
}

function createRouteStub(url: string, method = 'GET') {
  const calls = { abort: 0, fallback: 0, continue: 0, fulfill: 0 }
  const request = { method: () => method, url: () => url } as unknown as Request
  const route = {
    request: () => request,
    abort: async () => {
      calls.abort += 1
    },
    fallback: async () => {
      calls.fallback += 1
    },
    continue: async () => {
      calls.continue += 1
    },
    fulfill: async () => {
      calls.fulfill += 1
    },
  } as unknown as Route
  return { route, calls }
}

describe('buildLiveContextOptions — exact hardened options', () => {
  it('blocks service workers and pins the owned frontend baseURL', () => {
    expect(buildLiveContextOptions(env)).toStrictEqual({
      serviceWorkers: 'block',
      baseURL: FRONTEND,
      acceptDownloads: false,
      recordHar: undefined,
    })
  })

  it('never enables a credential-persisting capture channel', () => {
    const options = buildLiveContextOptions(env)
    expect(options.recordHar).toBeUndefined()
    expect(options.acceptDownloads).toBe(false)
    expect(options.serviceWorkers).toBe('block')
  })
})

describe('liveAllowedOrigins — exactly the declared frontend and backend origins', () => {
  it('returns the owned frontend origin and declared backend origin', () => {
    expect(liveAllowedOrigins(env)).toEqual([FRONTEND, BACKEND_ORIGIN])
  })
})

describe('openLiveActorContext — setup order and hardening', () => {
  it('opens the context, installs the guard on the context, then creates and seeds the page without navigating', async () => {
    const harness = createHarness()

    await openLiveActorContext(harness.browser, env, cashier)

    expect(harness.calls).toEqual(['newContext', 'route', 'newPage', 'addInitScript'])
    expect(harness.navigation()).toEqual([])
  })

  it('passes the hardened context options to newContext', async () => {
    const harness = createHarness()

    await openLiveActorContext(harness.browser, env, cashier)

    expect(harness.contextOptions()).toStrictEqual({
      serviceWorkers: 'block',
      baseURL: FRONTEND,
      acceptDownloads: false,
      recordHar: undefined,
    })
  })

  it('installs exactly one catch-all guard on the context (not the page)', async () => {
    const harness = createHarness()

    await openLiveActorContext(harness.browser, env, cashier)

    expect(harness.routes).toHaveLength(1)
    expect(harness.routes[0]?.pattern).toBe('**/*')
  })

  it('allows only the exact declared origins and aborts everything else without fulfilling', async () => {
    const harness = createHarness()
    const live = await openLiveActorContext(harness.browser, env, cashier)
    const handler = harness.routes[0]!.handler

    const allowedFrontend = createRouteStub(`${FRONTEND}/pos/caja`)
    await handler(allowedFrontend.route, allowedFrontend.route.request())

    const allowedBackend = createRouteStub(`${BACKEND_ORIGIN}/api/v1/cash-registers`)
    await handler(allowedBackend.route, allowedBackend.route.request())

    const denied = createRouteStub('https://api.example.com/v1/ping?token=leak#frag')
    await handler(denied.route, denied.route.request())

    expect(allowedFrontend.calls).toEqual({ abort: 0, fallback: 1, continue: 0, fulfill: 0 })
    expect(allowedBackend.calls).toEqual({ abort: 0, fallback: 1, continue: 0, fulfill: 0 })
    expect(denied.calls).toEqual({ abort: 1, fallback: 0, continue: 0, fulfill: 0 })
    expect(denied.calls.fulfill).toBe(0)
    expect(live.guard.violations()).toEqual(['GET https://api.example.com'])
  })

  it('seeds the real backend-issued actor plan via addInitScript before any navigation', async () => {
    const harness = createHarness()

    await openLiveActorContext(harness.browser, env, cashier)

    expect(harness.initScripts).toHaveLength(1)
    expect(harness.initScripts[0]?.arg).toEqual(buildActorAuthSeedPlan(cashier))
    expect(harness.initScripts[0]?.arg).toMatchObject({
      remove: ['hound.auth.refreshToken', 'hound.auth.tempToken'],
    })
    expect(harness.navigation()).toEqual([])
  })

  it('returns the context, page and guard for the journey', async () => {
    const harness = createHarness()

    const live = await openLiveActorContext(harness.browser, env, cashier)

    expect(live.context).toBeDefined()
    expect(live.page).toBeDefined()
    expect(typeof live.guard.dispose).toBe('function')
    expect(typeof live.close).toBe('function')
  })
})

describe('openLiveActorContext — close lifecycle', () => {
  it('disposes the guard before closing the context', async () => {
    const harness = createHarness()
    const live = await openLiveActorContext(harness.browser, env, cashier)
    harness.calls.length = 0

    await live.close()

    expect(harness.calls).toEqual(['unroute', 'close'])
    expect(harness.unrouted[0]?.handler).toBe(harness.routes[0]?.handler)
    expect(harness.isClosed()).toBe(true)
  })

  it('still closes the context when the guard dispose fails', async () => {
    const harness = createHarness({ failUnroute: new Error('unroute failed') })
    const live = await openLiveActorContext(harness.browser, env, cashier)
    harness.calls.length = 0

    await expect(live.close()).rejects.toThrow('unroute failed')

    expect(harness.calls).toEqual(['unroute', 'close'])
    expect(harness.isClosed()).toBe(true)
  })
})

describe('openLiveActorContext — setup failure cleanup', () => {
  it('closes the context when the guard cannot be installed', async () => {
    const harness = createHarness({ failRoute: new Error('route failed') })

    await expect(openLiveActorContext(harness.browser, env, cashier)).rejects.toThrow(
      'route failed',
    )

    expect(harness.calls).toEqual(['newContext', 'route', 'close'])
    expect(harness.isClosed()).toBe(true)
  })

  it('disposes the guard and closes the context when the page cannot be created', async () => {
    const harness = createHarness({ failNewPage: new Error('newPage failed') })

    await expect(openLiveActorContext(harness.browser, env, cashier)).rejects.toThrow(
      'newPage failed',
    )

    expect(harness.calls).toEqual(['newContext', 'route', 'newPage', 'unroute', 'close'])
    expect(harness.isClosed()).toBe(true)
  })

  it('cleans up on a seed failure without echoing the token-bearing error', async () => {
    const leaky = new Error(`addInitScript failed while serializing ${ACCESS_TOKEN}`)
    const harness = createHarness({ failAddInitScript: leaky })

    const rejection = await rejectionOf(openLiveActorContext(harness.browser, env, cashier))

    expect(rejection).toBeInstanceOf(CashLiveContextError)
    expect(rejection.message).not.toContain(ACCESS_TOKEN)
    expect(rejection.message).not.toContain('addInitScript failed')
    expect(rejection.message).toMatch(/suppressed/)
    expect(harness.calls).toEqual([
      'newContext',
      'route',
      'newPage',
      'addInitScript',
      'unroute',
      'close',
    ])
    expect(harness.isClosed()).toBe(true)
  })

  it('does not let a cleanup failure mask the setup failure', async () => {
    const harness = createHarness({
      failAddInitScript: new Error('seed failed'),
      failUnroute: new Error('unroute failed'),
      failClose: new Error('close failed'),
    })

    const rejection = await rejectionOf(openLiveActorContext(harness.browser, env, cashier))

    expect(rejection).toBeInstanceOf(CashLiveContextError)
    expect(rejection.message).not.toContain('unroute failed')
    expect(rejection.message).not.toContain('close failed')
    expect(harness.calls).toContain('unroute')
    expect(harness.calls).toContain('close')
  })
})
