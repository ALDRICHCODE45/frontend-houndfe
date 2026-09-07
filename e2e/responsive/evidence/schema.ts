/** Versioned evidence records and target-independent validation for browser responsive runs. */

import {
  ASSERTION_IDS, findViewportCase, isSurfaceId, RESPONSIVE_STRATEGIES, RISK_IDS, surfaceArchetype,
  type Archetype, type AssertionId, type ResponsiveStrategy, type SurfaceId, type ViewportWidth,
} from '../targets/types'

export const SCHEMA_VERSION = 1

/** Sub-pixel CSS-px rounding tolerance recorded with every geometry measurement. */
export const MEASUREMENT_TOLERANCE_PX = 1

export const EVIDENCE_AUTHORITIES = ['browser-geometry', 'browser-interaction'] as const
export type EvidenceAuthority = (typeof EVIDENCE_AUTHORITIES)[number]

export const EVIDENCE_STATUSES = ['pass', 'fail', 'excluded'] as const
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number]

export const FAILURE_TAXONOMY = [
  'document-overflow', 'surface-outside-owner', 'uncontained-local-overflow', 'missing-scroll-discoverability',
  'unexpected-local-overflow', 'essential-content-loss', 'long-data-clipping', 'target-size',
  'semantic-or-name', 'keyboard-activation', 'focus-order', 'focus-obscured', 'focus-restoration',
  'sticky-header-misalignment', 'pinned-column-misalignment', 'shell-overlay-containment',
  'state-usability', 'preference-compatibility', 'harness-or-fixture',
] as const
export type FailureTaxonomy = (typeof FAILURE_TAXONOMY)[number]

export type ScrollExtreme = 'left' | 'right'

/** CSS-pixel box with derived edges, recorded with every containment measurement. */
export interface GeometryBox { x: number; y: number; width: number; height: number; top: number; right: number; bottom: number; left: number }

/** Requested versus settled scroll position at one horizontal extreme. */
export interface ScrollExtremeMeasurement { extreme: ScrollExtreme; requested: number; actual: number; max: number }

export interface EvidenceViewport {
  key: string
  width: ViewportWidth
  height: number
}

export interface ResponsiveEvidenceRecord {
  schemaVersion: typeof SCHEMA_VERSION
  runId: string
  authority: EvidenceAuthority
  surfaceId: SurfaceId
  archetype: Archetype
  route: string
  fixtureId: string
  stateId: string
  viewport: EvidenceViewport
  strategy: ResponsiveStrategy
  effectiveMode: string
  containerOwner: string
  assertionId: AssertionId
  riskIds: readonly string[]
  status: EvidenceStatus
  scrollExtreme?: ScrollExtreme
  overlayContext?: string
  measurements?: Record<string, unknown>
  exclusion?: { reason: string; followUp: string }
  failure?: { taxonomy: FailureTaxonomy; message: string; expected?: unknown; actual?: unknown }
}

export type EvidenceValidationResult =
  | { ok: true; record: ResponsiveEvidenceRecord }
  | { ok: false; errors: readonly string[] }

export type SessionValidationResult =
  | { ok: true; records: readonly ResponsiveEvidenceRecord[] }
  | { ok: false; errors: readonly string[] }

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const identityOf = (record: ResponsiveEvidenceRecord): string =>
  [record.surfaceId, record.stateId, record.viewport.key, record.assertionId, record.scrollExtreme ?? '-', record.overlayContext ?? '-'].join('|')

export function validateEvidenceRecord(input: unknown): EvidenceValidationResult {
  if (typeof input !== 'object' || input === null) return { ok: false, errors: ['evidence record must be an object'] }
  const candidate = input as Record<string, unknown>
  const errors: string[] = []
  const fail = (message: string) => errors.push(message)

  if (candidate.schemaVersion !== SCHEMA_VERSION) fail(`schemaVersion must be ${SCHEMA_VERSION}`)
  if (!nonEmpty(candidate.runId) || !nonEmpty(candidate.route)) fail('runId and route must be non-empty strings')
  if (!(EVIDENCE_AUTHORITIES as readonly string[]).includes(candidate.authority as string)) fail('authority must be browser-geometry or browser-interaction')
  if (!isSurfaceId(candidate.surfaceId)) fail('surfaceId must be an accepted inventory identifier')
  else if (candidate.archetype !== surfaceArchetype(candidate.surfaceId)) fail('archetype must match the surface identifier prefix')
  if (!nonEmpty(candidate.route)) fail('route must be a non-empty string')
  if (!nonEmpty(candidate.fixtureId) || !nonEmpty(candidate.stateId)) fail('fixtureId and stateId must be non-empty strings')

  const viewport = candidate.viewport as Record<string, unknown> | undefined
  const viewportCase = typeof viewport?.width === 'number' ? findViewportCase(viewport.width) : undefined
  if (!viewport || !viewportCase) fail('viewport.width must be an exact matrix width (320, 375, 768, 1024)')
  else {
    if (viewport.key !== viewportCase.key) fail('viewport.key must match the canonical key for its width')
    if (typeof viewport.height !== 'number' || viewport.height <= 0) fail('viewport.height must be a positive number')
  }

  if (!(RESPONSIVE_STRATEGIES as readonly string[]).includes(candidate.strategy as string)) fail('strategy must be one of the declared responsive strategies')
  if (!nonEmpty(candidate.effectiveMode)) fail('effectiveMode must be a non-empty string')
  if (!nonEmpty(candidate.containerOwner)) fail('containerOwner must be a non-empty string')
  if (!(ASSERTION_IDS as readonly string[]).includes(candidate.assertionId as string)) fail('assertionId must be a known assertion identifier')
  if (!Array.isArray(candidate.riskIds) || candidate.riskIds.length === 0 || !candidate.riskIds.every((risk) => (RISK_IDS as readonly string[]).includes(risk))) fail('riskIds must be a non-empty subset of the root-cause families R1-R8')

  if (!(EVIDENCE_STATUSES as readonly string[]).includes(candidate.status as string)) fail('status must be pass, fail, or excluded')
  else if (candidate.status === 'fail') {
    const failure = candidate.failure as Record<string, unknown> | undefined
    if (!failure) fail('a failed record must carry a failure object')
    else {
      if (!(FAILURE_TAXONOMY as readonly string[]).includes(failure.taxonomy as string)) fail('failure.taxonomy must be a known failure taxonomy code')
      if (!nonEmpty(failure.message)) fail('failure.message must be a non-empty string')
    }
  } else if (candidate.status === 'excluded') {
    const exclusion = candidate.exclusion as Record<string, unknown> | undefined
    if (!exclusion) fail('an excluded record must carry an exclusion object')
    else {
      if (!nonEmpty(exclusion.reason)) fail('exclusion.reason must be a non-empty string')
      if (!nonEmpty(exclusion.followUp)) fail('exclusion.followUp must be a non-empty string')
    }
  } else if (candidate.failure !== undefined) fail('a passing record must not carry a failure')

  if (candidate.scrollExtreme !== undefined && candidate.scrollExtreme !== 'left' && candidate.scrollExtreme !== 'right') fail('scrollExtreme must be left or right')

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, record: candidate as unknown as ResponsiveEvidenceRecord }
}

export function validateEvidenceSession(records: readonly unknown[]): SessionValidationResult {
  const errors: string[] = []
  const accepted: ResponsiveEvidenceRecord[] = []
  const seen = new Set<string>()
  records.forEach((record, index) => {
    const result = validateEvidenceRecord(record)
    if (!result.ok) {
      errors.push(...result.errors.map((error) => `records[${index}]: ${error}`))
    } else if (seen.has(identityOf(result.record))) {
      errors.push(`records[${index}]: duplicate evidence identity ${identityOf(result.record)}`)
    } else {
      seen.add(identityOf(result.record))
      accepted.push(result.record)
    }
  })
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, records: accepted }
}
