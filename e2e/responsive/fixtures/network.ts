/** Strict same-origin `/__e2e-api/**` interception: exact method/path/query/body/count matching; undeclared and external requests fail deterministically (never hang). */
import type { Page, Route } from '@playwright/test'

export const API_PREFIX = '/__e2e-api'
export const UNDECLARED_REQUEST = 'e2e-network: undeclared request'
export const EXCEEDED_REQUEST_COUNT = 'e2e-network: declared request count exceeded'
export const EXTERNAL_REQUEST = 'e2e-network: unexpected external request'

export interface DeclaredRoute {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Exact path after the `/__e2e-api` prefix, e.g. `/products`. */
  readonly path: string
  /** Exact query key/value match; declared queries must match every parameter. */
  readonly query?: Readonly<Record<string, string>>
  /** Exact JSON request-body match when declared. */
  readonly body?: unknown
  readonly status?: number
  readonly json?: unknown
  /** Hold the response until the release gate fulfills it (loading/fetching states). */
  readonly deferred?: boolean
  /** Exact expected number of matching requests; further matches fail deterministically. */
  readonly count?: number
}

export interface RouteRequestLog { readonly method: string; readonly path: string; readonly query: Readonly<Record<string, string>>; readonly body: unknown }
/** An external startup request that remains blocked, but is expected and audited separately. */
export interface ExpectedBlockedExternal { readonly origin: string; readonly pathPrefix: string }
export const EXPECTED_BLOCKED_STARTUP_EXTERNALS: readonly ExpectedBlockedExternal[] = [
  { origin: 'https://fonts.googleapis.com', pathPrefix: '/css2' },
  { origin: 'https://api.iconify.design', pathPrefix: '/lucide.json' },
  { origin: 'https://api.unisvg.com', pathPrefix: '/lucide.json' },
  { origin: 'https://api.simplesvg.com', pathPrefix: '/lucide.json' },
]

export interface StrictNetworkController {
  requests(): readonly RouteRequestLog[]
  violations(): readonly string[]
  expectedBlockedExternals(): readonly string[]
  /** Fulfills every held deferred response; idempotent, used by the fixture teardown. */
  releaseDeferred(): Promise<void>
}

const canonicalQuery = (query: Readonly<Record<string, string>>): string => Object.keys(query).sort().map((key) => `${key}=${query[key]}`).join('&')
const jsonResponse = (route: DeclaredRoute): { status: number; contentType: string; body: string } => ({ status: route.status ?? 200, contentType: 'application/json', body: JSON.stringify(route.json ?? null) })

export async function installStrictNetwork(page: Page, origin: string, declared: readonly DeclaredRoute[], expectedBlocked: readonly ExpectedBlockedExternal[] = []): Promise<StrictNetworkController> {
  const requests: RouteRequestLog[] = []
  const violations: string[] = []
  const expectedBlockedExternals: string[] = []
  const pending: Array<{ route: DeclaredRoute; route0: Route; resolve: () => void }> = []
  const counts = new Map<DeclaredRoute, number>()

  // Registered first so the later `/__e2e-api/**` handler wins for API paths; same-origin non-API traffic passes through.
  await page.route('**/*', (route0) => {
    const url = new URL(route0.request().url())
    if (url.origin !== origin) {
      const request = route0.request(), external = expectedBlocked.find((rule) => rule.origin === url.origin && url.pathname.startsWith(rule.pathPrefix))
      const entry = `${request.method()} ${url.origin}${url.pathname}${url.search}`
      if (external) { expectedBlockedExternals.push(entry); return route0.abort() }
      violations.push(`${EXTERNAL_REQUEST} ${entry}`); return route0.abort()
    }
    return route0.fallback()
  })

  await page.route(`**${API_PREFIX}/**`, (route0) => {
    const request = route0.request()
    const url = new URL(request.url())
    const path = url.pathname.slice(API_PREFIX.length) || '/'
    const query = Object.fromEntries(url.searchParams)
    const raw = request.postData()
    let body: unknown
    try { body = raw === null ? undefined : JSON.parse(raw) } catch { body = raw }
    const match = declared.find((candidate) => candidate.method === request.method() && candidate.path === path
      && (candidate.query === undefined || canonicalQuery(candidate.query) === canonicalQuery(query))
      && (candidate.body === undefined || JSON.stringify(candidate.body) === JSON.stringify(body)))
    if (!match || (match.count !== undefined && (counts.get(match) ?? 0) >= match.count)) {
      violations.push(`${match ? EXCEEDED_REQUEST_COUNT : UNDECLARED_REQUEST} ${request.method()} ${path}${url.search}`)
      return route0.abort()
    }
    requests.push({ method: request.method(), path, query, body }); counts.set(match, (counts.get(match) ?? 0) + 1)
    if (match.deferred) return new Promise<void>((resolve) => pending.push({ route: match, route0, resolve }))
    return route0.fulfill(jsonResponse(match))
  })

  return {
    requests: () => [...requests], violations: () => [...violations], expectedBlockedExternals: () => [...expectedBlockedExternals],
      releaseDeferred: async () => {
        const batch = pending.splice(0)
        // Resolve every held gate even when one fulfill rejects; retain the first error and rethrow after the loop.
        let firstError: unknown
        for (const entry of batch) {
          try { await entry.route0.fulfill(jsonResponse(entry.route)) } catch (error) { firstError ??= error } finally { entry.resolve() }
        }
        if (firstError !== undefined) throw firstError
      },
  }
}
