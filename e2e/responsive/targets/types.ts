/** Target-independent responsive policy contracts: exact viewport matrix, strategy/archetype unions, accepted inventory identities, and the exclusion shape. */

export const INVENTORY_SURFACE_IDS = [
  'DT-01', 'DT-02', 'DT-03', 'DT-04', 'DT-05', 'DT-06', 'DT-07', 'DT-08', 'DT-09', 'DT-10',
  'DT-11', 'DT-12', 'DT-13', 'DT-14', 'DT-15', 'NT-01', 'NT-02', 'NT-03', 'NT-04', 'NT-05',
  'NT-06', 'NT-07', 'HY-01', 'HY-02', 'HY-03', 'HY-04', 'HY-05',
] as const

export type SurfaceId = (typeof INVENTORY_SURFACE_IDS)[number]

export function isSurfaceId(value: unknown): value is SurfaceId {
  return typeof value === 'string' && (INVENTORY_SURFACE_IDS as readonly string[]).includes(value)
}

export type Archetype = 'DT' | 'NT' | 'HY'

export function surfaceArchetype(surfaceId: SurfaceId): Archetype {
  return surfaceId.slice(0, 2) as Archetype
}

export type ViewportWidth = 320 | 375 | 768 | 1024
export type ViewportKey = 'phone-320' | 'phone-375' | 'tablet-768' | 'shell-1024'

export interface ViewportCase {
  key: ViewportKey
  width: ViewportWidth
  height: number
}

export const RESPONSIVE_VIEWPORTS: readonly ViewportCase[] = [
  { key: 'phone-320', width: 320, height: 568 },
  { key: 'phone-375', width: 375, height: 667 },
  { key: 'tablet-768', width: 768, height: 1024 },
  { key: 'shell-1024', width: 1024, height: 768 },
] as const

export function findViewportCase(width: number): ViewportCase | undefined {
  return RESPONSIVE_VIEWPORTS.find((viewport) => viewport.width === width)
}

export function isMatrixWidth(width: number): width is ViewportWidth {
  return findViewportCase(width) !== undefined
}

export const RESPONSIVE_STRATEGIES = [
  'contained-table-scroll', 'cards', 'stacked-list', 'native-table-scroll', 'hybrid',
] as const
export type ResponsiveStrategy = (typeof RESPONSIVE_STRATEGIES)[number]

/** Geometry overflow policy consumed by target-independent overflow assertions. */
export const OVERFLOW_POLICIES = ['local-scroll', 'no-horizontal-scroll'] as const
export type OverflowPolicy = (typeof OVERFLOW_POLICIES)[number]

export type ContainerOwner = 'dashboard-panel' | 'card' | 'modal' | 'slideover' | (string & {})

export const RISK_IDS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'] as const
export type RiskId = (typeof RISK_IDS)[number]

export const ASSERTION_IDS = [
  'exact-viewport', 'document-overflow', 'owner-containment', 'overflow-contract', 'long-data',
  'scroll-extremes', 'sticky-pinned-alignment', 'minimum-targets', 'semantics', 'keyboard',
  'focus', 'overlay-lifecycle', 'surface-state', 'preference-compatibility',
] as const
export type AssertionId = (typeof ASSERTION_IDS)[number]

export interface AssertionExclusion {
  assertionId: AssertionId
  stateId?: string
  viewports?: readonly ViewportWidth[]
  reason: string
  followUp: string
}

export interface ResponsiveTarget {
  surfaceId: SurfaceId
  archetype: Archetype
  route: string
  containerOwner: ContainerOwner
  strategy: ResponsiveStrategy
  essentialFields: readonly string[]
  supportedStates: readonly string[]
  preferenceKeys: readonly string[]
  risks: readonly RiskId[]
  exclusions: readonly AssertionExclusion[]
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: readonly string[] }

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

function exclusionErrors(exclusion: unknown, prefix: string): string[] {
  if (typeof exclusion !== 'object' || exclusion === null) return [`${prefix} must be an object`]
  const candidate = exclusion as Record<string, unknown>
  const errors: string[] = []
  if (!(ASSERTION_IDS as readonly string[]).includes(candidate.assertionId as string)) errors.push(`${prefix}.assertionId must be a known assertion identifier`)
  if (!nonEmpty(candidate.reason)) errors.push(`${prefix}.reason must be a non-empty string`)
  if (!nonEmpty(candidate.followUp)) errors.push(`${prefix}.followUp must be a non-empty string`)
  if (candidate.viewports !== undefined && (!Array.isArray(candidate.viewports) || !candidate.viewports.every((width) => typeof width === 'number' && isMatrixWidth(width)))) errors.push(`${prefix}.viewports must only contain exact matrix widths`)
  return errors
}

export function parseResponsiveTarget(input: unknown): ParseResult<ResponsiveTarget> {
  if (typeof input !== 'object' || input === null) return { ok: false, errors: ['target must be an object'] }
  const candidate = input as Record<string, unknown>
  const errors: string[] = []
  if (!isSurfaceId(candidate.surfaceId)) errors.push('surfaceId must be an accepted inventory identifier')
  else if (candidate.archetype !== surfaceArchetype(candidate.surfaceId)) errors.push('archetype must match the surface identifier prefix')
  if (!nonEmpty(candidate.route) || !nonEmpty(candidate.containerOwner)) errors.push('route and containerOwner must be non-empty strings')
  if (!(RESPONSIVE_STRATEGIES as readonly string[]).includes(candidate.strategy as string)) errors.push('strategy must be one of the declared responsive strategies')
  for (const [field, value] of [['essentialFields', candidate.essentialFields], ['supportedStates', candidate.supportedStates]] as const) {
    if (!isStringArray(value) || value.length === 0) errors.push(`${field} must be a non-empty string array`)
  }
  if (!isStringArray(candidate.preferenceKeys)) errors.push('preferenceKeys must be a string array')
  if (!Array.isArray(candidate.risks) || candidate.risks.length === 0 || !candidate.risks.every((risk) => (RISK_IDS as readonly string[]).includes(risk))) errors.push('risks must be a non-empty subset of the root-cause families R1-R8')
  if (!Array.isArray(candidate.exclusions)) errors.push('exclusions must be an array')
  else candidate.exclusions.forEach((exclusion, index) => errors.push(...exclusionErrors(exclusion, `exclusions[${index}]`)))
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: candidate as unknown as ResponsiveTarget }
}
