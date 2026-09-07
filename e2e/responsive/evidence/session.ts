/** Per-test evidence collection: records are validated at finalize, so valid evidence survives an aggregate rejection. */
import { evidenceIdentity, validateEvidenceRecord, type ResponsiveEvidenceRecord } from './schema'

export interface EvidenceSessionOutcome { readonly records: readonly ResponsiveEvidenceRecord[]; readonly errors: readonly string[] }

/** Collects candidate evidence records for one test; validation is deferred so attach never throws. */
export class EvidenceSession {
  private readonly raw: unknown[] = []

  constructor(readonly runId: string) {}

  /** Stages one candidate record for finalize-time validation. */
  attach(record: unknown): void { this.raw.push(record) }

  /** Stages a batch of candidate records; chainable for reporter collection. */
  with(records: readonly unknown[]): this { records.forEach((record) => this.attach(record)); return this }

  /** Validates every staged record; valid records stay attached and are returned even when other records are rejected. */
  finalize(): EvidenceSessionOutcome {
    const records: ResponsiveEvidenceRecord[] = []
    const errors: string[] = []
    const seen = new Set<string>()
    this.raw.forEach((input, index) => {
      const candidate = input !== null && typeof input === 'object' && !('runId' in input) ? { runId: this.runId, ...input } : input
      const result = validateEvidenceRecord(candidate)
      if (!result.ok) errors.push(...result.errors.map((error) => `records[${index}]: ${error}`))
      else if (result.record.runId !== this.runId) errors.push(`records[${index}]: runId must match this evidence session`)
      else {
        const identity = evidenceIdentity(result.record)
        if (seen.has(identity)) errors.push(`records[${index}]: duplicate evidence identity ${identity}`)
        else {
          seen.add(identity)
          records.push(result.record)
        }
      }
    })
    return { records, errors }
  }
}
