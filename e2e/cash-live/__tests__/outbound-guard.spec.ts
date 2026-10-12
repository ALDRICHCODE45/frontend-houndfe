/**
 * Focused unit tests for the bounded cash-live outbound guard.
 *
 * The guard may ONLY forward the exact frontend/declared-backend origins and
 * ABORT every other origin. It must never fabricate a response (`fulfill`), so
 * the synthetic `Route` stub counts every terminal operation. Recorded
 * violations must be safe: method + origin only, never userinfo, path, query,
 * hash or token. The guard is installed on a `Page`/`BrowserContext`-shaped
 * target, so a minimal context stub exercises registration and teardown without
 * a browser, network or services.
 */
import { describe, expect, it } from 'vitest'
import type { BrowserContext, Page, Request, Route } from '@playwright/test'

import {
  UNKNOWN_ORIGIN,
  installOutboundGuard,
  isOriginAllowed,
  safeOriginLabel,
  type RouteCapable,
} from '../support/outbound-guard'

const FRONTEND = 'http://127.0.0.1:4189'
const BACKEND = 'http://127.0.0.1:36383'
const ALLOWED = [FRONTEND, BACKEND] as const

// Compile-time proof that the real Playwright targets satisfy the guard's surface.
const acceptsRealTargets = (page: Page, context: BrowserContext): RouteCapable[] => [page, context]
void acceptsRealTargets

interface RouteCall {
  readonly pattern: string
  readonly handler: (route: Route, request: Request) => unknown
}

function createTargetStub(options: { readonly failUnroute?: boolean } = {}) {
  const registered: RouteCall[] = []
  const unregistered: RouteCall[] = []
  const target: RouteCapable = {
    async route(pattern, handler) {
      registered.push({ pattern, handler })
    },
    async unroute(pattern, handler) {
      if (handler) unregistered.push({ pattern, handler })
      if (options.failUnroute) throw new Error('unroute failed')
    },
  }
  return { target, registered, unregistered }
}

function registeredHandler(calls: RouteCall[]): RouteCall['handler'] {
  const [first] = calls
  if (!first) throw new Error('guard did not register a route handler')
  return first.handler
}

interface RouteStubOptions {
  readonly method?: string
  readonly fail?: 'abort' | 'fallback'
}

function createRouteStub(url: string, options: RouteStubOptions = {}) {
  const calls = { abort: 0, continue: 0, fallback: 0, fulfill: 0 }
  const request = { method: () => options.method ?? 'GET', url: () => url } as unknown as Request
  const route = {
    request: () => request,
    abort: async () => {
      calls.abort += 1
      if (options.fail === 'abort') throw new Error('abort failed')
    },
    continue: async () => {
      calls.continue += 1
    },
    fallback: async () => {
      calls.fallback += 1
      if (options.fail === 'fallback') throw new Error('fallback failed')
    },
    fulfill: async () => {
      calls.fulfill += 1
    },
  } as unknown as Route
  return { route, calls }
}

describe('isOriginAllowed — exact origin allowlist only', () => {
  it('accepts the exact frontend and declared backend origins', () => {
    expect(isOriginAllowed(FRONTEND, ALLOWED)).toBe(true)
    expect(isOriginAllowed(BACKEND, ALLOWED)).toBe(true)
  })

  it('rejects sibling ports, other hosts, empty and unknown origins', () => {
    expect(isOriginAllowed('http://127.0.0.1:8082', ALLOWED)).toBe(false)
    expect(isOriginAllowed('https://api.example.com', ALLOWED)).toBe(false)
    expect(isOriginAllowed('http://localhost:4189', ALLOWED)).toBe(false)
    expect(isOriginAllowed('', ALLOWED)).toBe(false)
    expect(isOriginAllowed(UNKNOWN_ORIGIN, ALLOWED)).toBe(false)
  })

  it('rejects everything with an empty allowlist', () => {
    expect(isOriginAllowed(FRONTEND, [])).toBe(false)
  })
})

describe('safeOriginLabel — no userinfo, path, query, hash or token', () => {
  it('reduces a credential-bearing URL to its origin only', () => {
    expect(safeOriginLabel('http://user:secret@evil.example.com:8443/path?token=abc#frag')).toBe(
      'http://evil.example.com:8443',
    )
  })

  it('returns a generic label for malformed URLs without echoing the raw string', () => {
    expect(safeOriginLabel('not a url ?token=secret')).toBe(UNKNOWN_ORIGIN)
  })

  it('returns a generic label for opaque non-http origins', () => {
    expect(safeOriginLabel('data:text/plain,secret-token')).toBe(UNKNOWN_ORIGIN)
  })
})

describe('installOutboundGuard — forwards allowed, aborts the rest, never fulfills', () => {
  it('registers exactly one catch-all handler on the provided target', async () => {
    const { target, registered } = createTargetStub()
    await installOutboundGuard(target, ALLOWED)
    expect(registered).toHaveLength(1)
    expect(registered[0]?.pattern).toBe('**/*')
  })

  it('forwards an allowed origin untouched via fallback and records nothing', async () => {
    const { target, registered } = createTargetStub()
    const guard = await installOutboundGuard(target, ALLOWED)
    const handler = registeredHandler(registered)
    const { route, calls } = createRouteStub(`${BACKEND}/api/v1/cash-registers?page=1`)

    await handler(route, route.request())

    expect(calls.fallback).toBe(1)
    expect(calls.abort).toBe(0)
    expect(calls.continue).toBe(0)
    expect(calls.fulfill).toBe(0)
    expect(guard.violations()).toEqual([])
  })

  it('aborts a denied origin, records method + origin and never fulfills', async () => {
    const { target, registered } = createTargetStub()
    const guard = await installOutboundGuard(target, ALLOWED)
    const handler = registeredHandler(registered)
    const { route, calls } = createRouteStub('https://api.example.com/v1/ping?token=abc#frag')

    await handler(route, route.request())

    expect(calls.abort).toBe(1)
    expect(calls.fallback).toBe(0)
    expect(calls.continue).toBe(0)
    expect(calls.fulfill).toBe(0)
    expect(guard.violations()).toEqual(['GET https://api.example.com'])
  })

  it('never records userinfo, path, query, hash or token in violations', async () => {
    const { target, registered } = createTargetStub()
    const guard = await installOutboundGuard(target, ALLOWED)
    const handler = registeredHandler(registered)
    const { route } = createRouteStub(
      'http://user:secret@evil.example.com/path?token=super-secret#frag',
    )

    await handler(route, route.request())

    const [violation] = guard.violations()
    expect(violation).toBe('GET http://evil.example.com')
    for (const leaked of ['user', 'secret', 'token', '/path', '?', '#']) {
      expect(violation).not.toContain(leaked)
    }
  })

  it('records a generic method + origin for malformed request URLs', async () => {
    const { target, registered } = createTargetStub()
    const guard = await installOutboundGuard(target, ALLOWED)
    const handler = registeredHandler(registered)
    const { route } = createRouteStub('not a url ?token=secret')

    await handler(route, route.request())

    expect(guard.violations()).toEqual([`GET ${UNKNOWN_ORIGIN}`])
    expect(guard.violations()[0]).not.toContain('not a url')
  })

  it('awaits route operations: a rejected fallback rejects the handler', async () => {
    const { target, registered } = createTargetStub()
    await installOutboundGuard(target, ALLOWED)
    const handler = registeredHandler(registered)
    const { route } = createRouteStub(`${FRONTEND}/`, { fail: 'fallback' })

    await expect(handler(route, route.request())).rejects.toThrow('fallback failed')
  })

  it('awaits route operations: a rejected abort rejects the handler', async () => {
    const { target, registered } = createTargetStub()
    await installOutboundGuard(target, ALLOWED)
    const handler = registeredHandler(registered)
    const { route } = createRouteStub('https://evil.example.com', { fail: 'abort' })

    await expect(handler(route, route.request())).rejects.toThrow('abort failed')
  })

  it('surfaces a route registration failure instead of installing silently', async () => {
    const target: RouteCapable = {
      async route() {
        throw new Error('route failed')
      },
      async unroute() {},
    }

    await expect(installOutboundGuard(target, ALLOWED)).rejects.toThrow('route failed')
  })
})

describe('installOutboundGuard — teardown unregisters the exact handler', () => {
  it('unroutes the same pattern and handler reference it registered', async () => {
    const { target, registered, unregistered } = createTargetStub()
    const guard = await installOutboundGuard(target, ALLOWED)

    await guard.dispose()

    expect(unregistered).toHaveLength(1)
    expect(unregistered[0]?.pattern).toBe(registered[0]?.pattern)
    expect(unregistered[0]?.handler).toBe(registered[0]?.handler)
  })

  it('does not swallow an unroute rejection', async () => {
    const { target } = createTargetStub({ failUnroute: true })
    const guard = await installOutboundGuard(target, ALLOWED)

    await expect(guard.dispose()).rejects.toThrow('unroute failed')
  })
})
