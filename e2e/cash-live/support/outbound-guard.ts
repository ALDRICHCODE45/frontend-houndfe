/**
 * Bounded outbound-network guard for the cash-live journey.
 *
 * The journey may talk to ONLY the owned frontend origin and the declared
 * loopback backend origin. This guard ABORTS every other origin and records a
 * REDACTED violation (method + origin only — never userinfo, path, query, hash
 * or token) so a leaked credential in a URL can never reach the evidence.
 *
 * There is deliberately no `route.fulfill` anywhere: the guard may never mock
 * a positive HTTP response for the real backend journey. Allowed requests are
 * forwarded untouched to the network via `fallback()`.
 *
 * It installs on a `Page` OR `BrowserContext` (any object with Playwright's
 * `route`/`unroute` surface). Context-level installation covers popups; it does
 * NOT cover requests intercepted by a Service Worker — Playwright requires
 * `serviceWorkers: 'block'` to intercept those (see Playwright docs).
 */
import type { BrowserContext, Page, Request, Route } from '@playwright/test'

import { normalizeOrigin } from './env'

/** Generic label used whenever a request URL cannot yield a safe origin. */
export const UNKNOWN_ORIGIN = '<unknown-origin>'
/** Generic label used whenever a request method is not a plain HTTP token. */
export const UNKNOWN_METHOD = '<unknown-method>'

const HTTP_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

export interface OutboundGuard {
  /** Every aborted outbound request, as safe `METHOD origin` entries. */
  violations(): readonly string[]
  /** Teardown: unregisters the guard so nothing leaks past the test. */
  dispose(): Promise<void>
}

/**
 * Minimal structural surface shared by `Page` and `BrowserContext`. Both real
 * Playwright targets satisfy it, and a plain stub satisfies it in unit tests.
 */
export interface RouteCapable {
  route(url: string, handler: (route: Route, request: Request) => unknown): Promise<unknown>
  unroute(url: string, handler?: (route: Route, request: Request) => unknown): Promise<unknown>
}

/** Pure allowlist decision used by the guard (unit-testable without a browser). */
export function isOriginAllowed(origin: string, allowedOrigins: readonly string[]): boolean {
  if (origin === '' || origin === UNKNOWN_ORIGIN) return false
  const normalized = normalizeOrigin(origin)
  return allowedOrigins.some((allowed) => normalizeOrigin(allowed) === normalized)
}

/**
 * Reduces any request URL to a safe origin label. `URL.origin` never contains
 * userinfo, path, query or hash; malformed and opaque (non-http) URLs collapse
 * to `UNKNOWN_ORIGIN` so the raw string is never echoed.
 */
export function safeOriginLabel(rawUrl: string): string {
  try {
    const origin = new URL(rawUrl).origin
    return origin === '' || origin === 'null' ? UNKNOWN_ORIGIN : origin
  } catch {
    return UNKNOWN_ORIGIN
  }
}

/** Keeps only well-formed HTTP method tokens; anything else becomes generic. */
export function safeMethodLabel(method: string): string {
  return HTTP_TOKEN.test(method) ? method : UNKNOWN_METHOD
}

/**
 * Installs the guard on a page/context-shaped target. Allowed origins are
 * forwarded untouched (`fallback()`), everything else is aborted and recorded
 * as `METHOD origin`. Every route operation is awaited so failures surface.
 */
export async function installOutboundGuard(
  target: Page | BrowserContext | RouteCapable,
  allowedOrigins: readonly string[],
): Promise<OutboundGuard> {
  const violations: string[] = []

  const handler = async (route: Route): Promise<void> => {
    const request = route.request()
    const origin = safeOriginLabel(request.url())
    if (!isOriginAllowed(origin, allowedOrigins)) {
      violations.push(`${safeMethodLabel(request.method())} ${origin}`)
      await route.abort()
      return
    }
    await route.fallback()
  }

  await target.route('**/*', handler)

  return {
    violations: () => [...violations],
    dispose: async () => {
      await target.unroute('**/*', handler)
    },
  }
}
