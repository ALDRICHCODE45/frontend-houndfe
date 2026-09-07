/** Fixed deterministic scenario/state catalog (success/loading/fetching/empty/no-match/4xx/5xx/paginated). */
import type { DeclaredRoute } from './network'
import { STRESS_ROWS } from './stress-data'

export const SCENARIO_STATES = ['success', 'loading', 'fetching', 'empty', 'no-match', 'error-4xx', 'error-5xx', 'paginated'] as const
export type ScenarioState = (typeof SCENARIO_STATES)[number]
export type ScenarioSelection = readonly ScenarioState[]

/** One catalogued scenario state; deferred states hold their response until the release gate fulfills it. */
export interface ScenarioDefinition { readonly state: ScenarioState; readonly status: number; readonly deferred: boolean; readonly json: unknown }

const page = (items: readonly unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> => ({ items, total: items.length, ...extra })
const PAGE_ROWS = page(STRESS_ROWS.slice(0, 6), { page: 1, pageSize: 6 })

export const SCENARIO_CATALOG: Readonly<Record<ScenarioState, ScenarioDefinition>> = Object.freeze({
  success: { state: 'success', status: 200, deferred: false, json: PAGE_ROWS },
  loading: { state: 'loading', status: 200, deferred: true, json: PAGE_ROWS },
  fetching: { state: 'fetching', status: 200, deferred: true, json: PAGE_ROWS },
  empty: { state: 'empty', status: 200, deferred: false, json: page([]) },
  'no-match': { state: 'no-match', status: 200, deferred: false, json: page([], { query: 'sin-coincidencia' }) },
  'error-4xx': { state: 'error-4xx', status: 422, deferred: false, json: { message: 'Solicitud inválida (e2e)' } },
  'error-5xx': { state: 'error-5xx', status: 503, deferred: false, json: { message: 'Servicio no disponible (e2e)' } },
  paginated: { state: 'paginated', status: 200, deferred: false, json: page(STRESS_ROWS.slice(6, 12), { page: 2, pageSize: 6 }) },
})

export type ScenarioParseResult = { ok: true; value: ScenarioSelection } | { ok: false; errors: readonly string[] }

/** Rejects malformed scenario selections: empty or containing non-catalogued states. */
export function parseScenarioSelection(input: unknown): ScenarioParseResult {
  if (!Array.isArray(input) || input.length === 0 || !input.every((state) => (SCENARIO_STATES as readonly string[]).includes(state))) {
    return { ok: false, errors: ['scenario selection must be a non-empty array of catalogued scenario states'] }
  }
  return { ok: true, value: input as ScenarioSelection }
}

/** Builds the declared `/__e2e-api` route for one catalogued scenario state. */
export function scenarioRoute(path: string, state: ScenarioState, overrides: Partial<DeclaredRoute> = {}): DeclaredRoute {
  const scenario = SCENARIO_CATALOG[state]
  return { method: 'GET', path, query: { page: state === 'paginated' ? '2' : '1' }, status: scenario.status, json: scenario.json, deferred: scenario.deferred, ...overrides }
}
