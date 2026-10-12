/**
 * Pure, fail-closed redacted evidence primitives for the cash-live journey.
 *
 * This module never touches the filesystem, the network, a browser or any
 * service. It only transforms caller-selected strings into a record shape that
 * is safe to persist and to read back in a handoff.
 *
 * Security contract:
 *
 * - `redactSecrets` replaces every occurrence of every explicitly supplied
 *   secret (and, where meaningful, its URL-encoded / URL-decoded variant) with
 *   `[REDACTED]`. Occurrences are merged as an interval union over the original
 *   text, so crossing/overlapping secrets fully cover their span. Empty and
 *   whitespace-only secrets are ignored so a degenerate secret can never blank
 *   out or corrupt unrelated text.
 * - `assertNoSecrets` fails closed if a secret variant survives in a candidate
 *   string. The error is generic: it NEVER echoes the offending value.
 * - `createEvidenceCollector` validates the controlled fields (run id, kind,
 *   verdict) and REDACTES every externally supplied string (step, summary)
 *   BEFORE the record exists. The whole serialized record is then asserted
 *   secret-free: a secret colliding with a controlled field is rejected
 *   generically and appended nothing. There is no API to store headers, bodies,
 *   storage dumps or tokens — only the caller's own redacted summary text.
 *
 * Secrets are only ever the access tokens the caller passes explicitly. This
 * module invents nothing (in particular, no refresh token): the owned backend
 * issues access-only tokens.
 */
import { CASH_LIVE_RUN_ID_PATTERN } from './env'

/** Replacement marker written in place of every redacted secret occurrence. */
export const REDACTED = '[REDACTED]'

/** The controlled evidence kinds. Adding a kind is a deliberate contract change. */
export const EVIDENCE_KINDS = ['http', 'ui'] as const
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

/** The controlled verdicts. */
export const EVIDENCE_VERDICTS = ['pass', 'fail', 'skip'] as const
export type EvidenceVerdict = (typeof EVIDENCE_VERDICTS)[number]

/** Sole schema version emitted by this collector. */
export const EVIDENCE_SCHEMA_VERSION = 1

/** Rejection of a controlled field or an unsafe candidate string. Never carries the rejected value. */
export class EvidenceError extends Error {}

/** One immutable, already-redacted evidence record. */
export interface EvidenceRecord {
  readonly schemaVersion: typeof EVIDENCE_SCHEMA_VERSION
  readonly runId: string
  readonly step: string
  readonly kind: EvidenceKind
  readonly verdict: EvidenceVerdict
  readonly summary: string
}

export interface EvidenceCollector {
  /** Redacts and appends one record. Throws `EvidenceError` on invalid input. */
  collect(step: string, kind: EvidenceKind, verdict: EvidenceVerdict, summary: string): void
  /** A frozen snapshot of the records collected so far (each record is frozen too). */
  records(): readonly EvidenceRecord[]
}

/**
 * Expands one secret into every text form that could plausibly appear in
 * evidence: the literal value plus its URL-encoded and URL-decoded forms when
 * those differ. This catches tokens that are quoted inside a URL/query/log.
 * Malformed percent-encoding is left alone rather than throwing.
 */
function expandSecretVariants(secret: string): readonly string[] {
  const variants = new Set<string>()
  if (secret.length > 0) variants.add(secret)
  try {
    const encoded = encodeURIComponent(secret)
    if (encoded.length > 0) variants.add(encoded)
  } catch {
    // encodeURIComponent throws on lone surrogates; the literal value is enough.
  }
  try {
    const decoded = decodeURIComponent(secret)
    if (decoded.length > 0) variants.add(decoded)
  } catch {
    // Malformed percent-encoding: keep the literal value only.
  }
  return [...variants]
}

/**
 * Normalizes the caller's secret list into redaction variants. Empty and
 * whitespace-only secrets are dropped (they would match everywhere); everything
 * else is kept, longest first so an overlapping shorter secret cannot leave a
 * fragment of a longer one behind.
 */
function normalizeSecrets(secrets: readonly string[]): readonly string[] {
  const variants = new Set<string>()
  for (const secret of secrets) {
    if (typeof secret !== 'string' || secret.trim().length === 0) continue
    for (const variant of expandSecretVariants(secret)) variants.add(variant)
  }
  return [...variants].sort((a, b) => b.length - a.length)
}

/**
 * Replaces every occurrence of every supplied secret with `[REDACTED]`.
 *
 * Redaction is computed as an interval UNION over the ORIGINAL text: every
 * occurrence interval of every secret variant is collected, overlapping and
 * crossing intervals are merged, and each merged interval is replaced by a
 * single marker. This is not sequential destructive replacement (which can
 * leave a tail uncovered when two secrets cross, e.g. `abcdef`/`cdefgh` in
 * `abcdefgh`): the whole union span is masked. Uses `indexOf` only, so no
 * secret is ever interpreted as a regular expression.
 */
export function redactSecrets(text: string, secrets: readonly string[]): string {
  if (typeof text !== 'string' || text === '') return text
  const variants = normalizeSecrets(secrets)
  if (variants.length === 0) return text

  const intervals: Array<[number, number]> = []
  for (const variant of variants) {
    let from = text.indexOf(variant)
    while (from !== -1) {
      intervals.push([from, from + variant.length])
      // Advance by one so overlapping occurrences of the same variant are all recorded.
      from = text.indexOf(variant, from + 1)
    }
  }
  if (intervals.length === 0) return text

  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: Array<[number, number]> = []
  for (const [start, end] of intervals) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) {
      if (end > last[1]) last[1] = end
    } else {
      merged.push([start, end])
    }
  }

  let result = ''
  let cursor = 0
  for (const [start, end] of merged) {
    result += text.slice(cursor, start) + REDACTED
    cursor = end
  }
  return result + text.slice(cursor)
}

/** True when any supplied secret variant appears literally in `text`. */
function containsSecret(text: string, secrets: readonly string[]): boolean {
  for (const variant of normalizeSecrets(secrets)) {
    if (text.includes(variant)) return true
  }
  return false
}

/**
 * Fails closed if any supplied secret variant still appears in `text`. The
 * thrown `EvidenceError` is generic and never repeats the offending value.
 */
export function assertNoSecrets(text: string, secrets: readonly string[]): void {
  if (typeof text !== 'string' || text === '') return
  if (containsSecret(text, secrets)) {
    throw new EvidenceError(
      'evidence text still contains a secret value after redaction; refusing to store it',
    )
  }
}

/**
 * Guards EVERY serialized field of a candidate record — including the
 * controlled `runId`, `kind` and `verdict`, which are validated but never
 * redacted. The record is checked both as JSON and as a raw field join so a
 * secret cannot survive in a controlled field or hide behind JSON escaping.
 */
function assertRecordClean(record: EvidenceRecord, secrets: readonly string[]): void {
  const serialized = JSON.stringify(record)
  const rawFields = [record.runId, record.step, record.kind, record.verdict, record.summary].join(
    '\u0000',
  )
  if (containsSecret(serialized, secrets) || containsSecret(rawFields, secrets)) {
    throw new EvidenceError(
      'evidence record would still contain a supplied secret after redaction; refusing to store it',
    )
  }
}

/** Validates the run id against the current cash-live safe-segment rule, generically. */
function resolveRunId(runId: string): string {
  if (typeof runId !== 'string' || !CASH_LIVE_RUN_ID_PATTERN.test(runId)) {
    throw new EvidenceError(
      'evidence runId must be a single safe ASCII filename segment matching the cash-live run-id rule (no path separators, no dot segments, no control characters)',
    )
  }
  return runId
}

/**
 * Creates an evidence collector bound to one validated run id and an explicit
 * set of secrets. Every record is redacted before it is stored and frozen so a
 * caller can never mutate evidence it already received.
 */
export function createEvidenceCollector(
  runId: string,
  secrets: readonly string[],
): EvidenceCollector {
  const safeRunId = resolveRunId(runId)
  const collected: EvidenceRecord[] = []

  function collect(
    step: string,
    kind: EvidenceKind,
    verdict: EvidenceVerdict,
    summary: string,
  ): void {
    if (typeof step !== 'string' || step.trim().length === 0) {
      throw new EvidenceError('evidence step must be a non-empty string')
    }
    if (!EVIDENCE_KINDS.includes(kind)) {
      throw new EvidenceError(
        `unsupported evidence kind; expected one of: ${EVIDENCE_KINDS.join(', ')}`,
      )
    }
    if (!EVIDENCE_VERDICTS.includes(verdict)) {
      throw new EvidenceError(
        `unsupported evidence verdict; expected one of: ${EVIDENCE_VERDICTS.join(', ')}`,
      )
    }
    if (typeof summary !== 'string') {
      throw new EvidenceError('evidence summary must be caller-selected text')
    }

    // Redact BEFORE the record exists, then fail closed if anything survived.
    const safeStep = redactSecrets(step, secrets)
    const safeSummary = redactSecrets(summary, secrets)
    assertNoSecrets(safeStep, secrets)
    assertNoSecrets(safeSummary, secrets)

    const record: EvidenceRecord = Object.freeze({
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
      runId: safeRunId,
      step: safeStep,
      kind,
      verdict,
      summary: safeSummary,
    })
    // Controlled fields (runId/kind/verdict) are validated, never redacted: if a
    // supplied secret collides with one, reject generically and append nothing.
    assertRecordClean(record, secrets)
    collected.push(record)
  }

  function records(): readonly EvidenceRecord[] {
    return Object.freeze([...collected])
  }

  return Object.freeze({ collect, records })
}
