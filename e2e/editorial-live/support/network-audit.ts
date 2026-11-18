/**
 * Request audit for the editorial-live journey: what the browser sent to the declared backend.
 *
 * Two jobs, both observational (no routing, no mocking, no fulfil):
 *
 * 1. Tenant absence (S66): the FE never sends a tenant override. For every backend request the
 *    header NAMES, the query parameter NAMES and the top-level JSON body KEYS are checked against
 *    /tenant/i. Only those names are ever recorded — never values, so no token can leak.
 * 2. Exchange log: `METHOD /path -> status` for backend requests, with the base path removed and
 *    the query string dropped. Publication endpoints are flagged: this journey must never publish.
 *
 * Third-party origins are the outbound guard's job (`e2e/cash-live/support/outbound-guard.ts`).
 */
import type { Page, Request, Response } from '@playwright/test'

const TENANT_NAME = /tenant/i
/** Editorial endpoints this journey must never call. */
const PUBLICATION_PATH = /\/editorial\/(?:draft\/publish|published\/unpublish)$/

export interface RequestShape {
  readonly method: string
  readonly url: string
  readonly headerNames: readonly string[]
  /** Raw request body text, or null. Parsed here; never stored. */
  readonly body: string | null
}

export interface AuditedExchange {
  readonly method: string
  readonly path: string
  readonly status: number | null
}

/** Names (never values) in one request that mention a tenant. Pure. */
export function tenantTraces(request: RequestShape): string[] {
  const traces: string[] = []
  let url: URL | null = null
  try {
    url = new URL(request.url)
  } catch {
    url = null
  }
  // The path is deliberately not inspected: a resource route such as a tenants list is not an override.
  if (url) for (const key of new Set(url.searchParams.keys())) if (TENANT_NAME.test(key)) traces.push(`query:${key}`)
  for (const name of request.headerNames) if (TENANT_NAME.test(name)) traces.push(`header:${name.toLowerCase()}`)
  if (request.body) {
    try {
      const parsed: unknown = JSON.parse(request.body)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const key of Object.keys(parsed)) if (TENANT_NAME.test(key)) traces.push(`body:${key}`)
      }
    } catch {
      // Not JSON: there is no structured key to inspect.
    }
  }
  return traces
}

/**
 * The backend-relative path of a URL under `backendBaseUrl` (query dropped), or null when the URL
 * is not a backend request. Pure.
 */
export function backendPath(rawUrl: string, backendBaseUrl: string): string | null {
  let url: URL
  let base: URL
  try {
    url = new URL(rawUrl)
    base = new URL(backendBaseUrl)
  } catch {
    return null
  }
  if (url.origin !== base.origin) return null
  const basePath = base.pathname.replace(/\/$/, '')
  if (basePath && url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) return null
  return url.pathname.slice(basePath.length) || '/'
}

export function isPublicationPath(pathname: string): boolean {
  return PUBLICATION_PATH.test(pathname)
}

export interface NetworkAudit {
  /** Every backend exchange, in request order. */
  exchanges(): readonly AuditedExchange[]
  /** `METHOD /path: trace` for every backend request that named a tenant. */
  tenantViolations(): readonly string[]
  /** `METHOD /path` for every publication request (must stay empty). */
  publicationAttempts(): readonly string[]
  /** Waits for in-flight header inspections, then detaches the listeners. */
  dispose(): Promise<void>
}

/** Minimal page surface, so a stub satisfies it in unit tests. */
export interface AuditablePage {
  on(event: 'request', listener: (request: Request) => void): unknown
  on(event: 'response', listener: (response: Response) => void): unknown
  off(event: 'request', listener: (request: Request) => void): unknown
  off(event: 'response', listener: (response: Response) => void): unknown
}

/** Attaches the audit to a page. Only backend requests (under `backendBaseUrl`) are audited. */
export function installNetworkAudit(page: AuditablePage | Page, backendBaseUrl: string): NetworkAudit {
  const exchanges: { method: string; path: string; status: number | null; request: Request }[] = []
  const violations: string[] = []
  const publications: string[] = []
  const pending = new Set<Promise<void>>()

  const onRequest = (request: Request): void => {
    const path = backendPath(request.url(), backendBaseUrl)
    if (path === null) return
    const method = request.method()
    exchanges.push({ method, path, status: null, request })
    if (isPublicationPath(path)) publications.push(`${method} ${path}`)
    // allHeaders() includes headers added by the network stack; the names are all we keep.
    const inspection = request.allHeaders()
      .then(headers => Object.keys(headers))
      .catch(() => Object.keys(request.headers()))
      .then(headerNames => {
        for (const trace of tenantTraces({ method, url: request.url(), headerNames, body: request.postData() })) {
          violations.push(`${method} ${path}: ${trace}`)
        }
      })
    pending.add(inspection)
    void inspection.finally(() => pending.delete(inspection))
  }
  const onResponse = (response: Response): void => {
    const entry = exchanges.find(candidate => candidate.request === response.request() && candidate.status === null)
    if (entry) entry.status = response.status()
  }
  ;(page as AuditablePage).on('request', onRequest)
  ;(page as AuditablePage).on('response', onResponse)

  return {
    exchanges: () => exchanges.map(({ method, path, status }) => Object.freeze({ method, path, status })),
    tenantViolations: () => [...violations],
    publicationAttempts: () => [...publications],
    dispose: async () => {
      await Promise.allSettled([...pending])
      ;(page as AuditablePage).off('request', onRequest)
      ;(page as AuditablePage).off('response', onResponse)
    },
  }
}
