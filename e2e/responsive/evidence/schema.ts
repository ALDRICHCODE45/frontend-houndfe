/** Versioned evidence records and target-independent validation for browser responsive runs. */

import {
  ASSERTION_EVIDENCE_RULES, ASSERTION_IDS, findViewportCase, isSurfaceId, RESPONSIVE_STRATEGIES, surfaceArchetype,
  type Archetype, type AssertionEvidenceAuthority, type AssertionId, type ResponsiveStrategy, type RiskId, type SurfaceId, type ViewportWidth,
} from '../targets/types'

export const SCHEMA_VERSION = 1

/** Sub-pixel CSS-px rounding tolerance recorded with every geometry measurement. */
export const MEASUREMENT_TOLERANCE_PX = 1

export const EVIDENCE_AUTHORITIES = ['browser-geometry', 'browser-interaction'] as const satisfies readonly AssertionEvidenceAuthority[]
export type EvidenceAuthority = AssertionEvidenceAuthority

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

/** Named targets prevent a containment assertion from comparing an element with itself. */
export interface EvidenceRegions {
  owner: { locator: string }
  surface: { locator: string }
  related: readonly { label: string; locator: string }[]
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
  riskIds: readonly RiskId[]
  regions: EvidenceRegions
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

/** Aggregation output statuses for the all-27/R1–R8 coverage report. */
export const COVERAGE_STATUSES = ['exercised', 'excluded', 'unverified'] as const
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number]

/** Per-test evidence attachment name shared by the session fixture and the reporter. */
export const EVIDENCE_ATTACHMENT_NAME = 'responsive-evidence'

/** Taxonomy applied when a test fails without classified evidence records (fixture or setup failure). */
export const SETUP_FAILURE_TAXONOMY: FailureTaxonomy = 'harness-or-fixture'

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const identityOf = (record: ResponsiveEvidenceRecord): string => evidenceIdentity(record)

/** Deterministic identity of one evidence record within a session (used for duplicate rejection and stable sorting). */
export function evidenceIdentity(record: ResponsiveEvidenceRecord): string {
  return [record.surfaceId, record.stateId, record.viewport.key, record.assertionId, record.scrollExtreme ?? '-', record.overlayContext ?? '-'].join('|')
}

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
      const rule = ASSERTION_EVIDENCE_RULES[candidate.assertionId as AssertionId]
      if (rule && candidate.authority !== rule.authority) fail(`authority must be ${rule.authority} for ${candidate.assertionId}`)
      if (!Array.isArray(candidate.riskIds) || !rule || candidate.riskIds.length !== rule.riskIds.length || candidate.riskIds.some((risk, index) => risk !== rule.riskIds[index])) fail('riskIds must match the assertion-specific exercised risks')

      const regions = candidate.regions as Record<string, unknown> | undefined
      const owner = regions?.owner as Record<string, unknown> | undefined
      const surface = regions?.surface as Record<string, unknown> | undefined
      const related = regions?.related
      if (!regions || !nonEmpty(owner?.locator) || !nonEmpty(surface?.locator) || !Array.isArray(related) || related.length === 0) fail('regions must identify an owner, surface, and at least one related region')
      else {
        const locators = [owner.locator, surface.locator, ...related.map((region) => typeof region === 'object' && region !== null ? (region as Record<string, unknown>).locator : undefined)]
        if (locators.some((locator) => !nonEmpty(locator)) || new Set(locators).size !== locators.length) fail('regions must use distinct non-empty owner, surface, and related locators')
      }

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
