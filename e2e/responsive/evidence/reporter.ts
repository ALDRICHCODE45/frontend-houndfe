/** Final-attempt evidence aggregation: deterministic sorted JSONL, honest summary, and all-27/R1–R8 coverage. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import {
  EVIDENCE_ATTACHMENT_NAME, SCHEMA_VERSION, SETUP_FAILURE_TAXONOMY, evidenceIdentity,
  type CoverageStatus, type FailureTaxonomy, type ResponsiveEvidenceRecord,
} from './schema'
import { INVENTORY_SURFACE_IDS, RISK_IDS, type RiskId, type SurfaceId } from '../targets/types'
import { EvidenceSession } from './session'

export interface FinalTestOutcome { readonly id: string; readonly title: string; readonly attempt: number; readonly status: string; readonly records: number; readonly diagnostics: readonly string[] }
export interface EvidenceFailure { readonly testId: string; readonly title: string; readonly taxonomy: FailureTaxonomy; readonly setupFailure: boolean; readonly message?: string }
export interface EvidenceSummary {
  readonly schemaVersion: typeof SCHEMA_VERSION
  readonly runId: string
  readonly aggregate: 'pass' | 'fail'
  readonly totals: { readonly tests: number; readonly records: number; readonly passed: number; readonly failed: number; readonly excluded: number; readonly setupFailures: number }
  readonly tests: readonly FinalTestOutcome[]
  readonly failures: readonly EvidenceFailure[]
  readonly errors: readonly string[]
}
export interface CoverageReport { readonly schemaVersion: typeof SCHEMA_VERSION; readonly surfaces: Readonly<Record<SurfaceId, CoverageStatus>>; readonly risks: Readonly<Record<RiskId, CoverageStatus>> }
export interface EvidenceOutput { readonly records: readonly ResponsiveEvidenceRecord[]; readonly summary: EvidenceSummary; readonly coverage: CoverageReport }

interface EvidenceAttachment { readonly name: string; readonly contentType: string; readonly path?: string; readonly body?: Buffer }
interface AttemptRaw { readonly raw: readonly unknown[] }

/** Classifies all 27 surface IDs and R1–R8 from the validated records alone: exercised, excluded, or unverified. */
export function buildCoverage(records: readonly ResponsiveEvidenceRecord[]): CoverageReport {
  const statusOf = (owned: readonly ResponsiveEvidenceRecord[]): CoverageStatus =>
    owned.length === 0 ? 'unverified' : owned.some((record) => record.status !== 'excluded') ? 'exercised' : 'excluded'
  const surfaces = {} as Record<SurfaceId, CoverageStatus>
  for (const surfaceId of INVENTORY_SURFACE_IDS) surfaces[surfaceId] = statusOf(records.filter((record) => record.surfaceId === surfaceId))
  const risks = {} as Record<RiskId, CoverageStatus>
  for (const riskId of RISK_IDS) risks[riskId] = statusOf(records.filter((record) => record.riskIds.includes(riskId)))
  return { schemaVersion: SCHEMA_VERSION, surfaces, risks }
}

const parseAttachments = (attachments: readonly EvidenceAttachment[]): { raw: unknown[]; error?: string } => {
  const raw: unknown[] = []
  for (const attachment of attachments) {
    if (attachment.name !== EVIDENCE_ATTACHMENT_NAME || attachment.body === undefined) continue
    try { raw.push(...(JSON.parse(attachment.body.toString('utf8')) as unknown[])) } catch { return { raw, error: 'unparsable responsive evidence attachment' } }
  }
  return { raw }
}

/** Playwright reporter retaining only the final retry attempt per test id and writing deterministic evidence artifacts. */
export class ResponsiveEvidenceReporter implements Reporter {
  private readonly finalAttempts = new Map<string, { title: string; result: TestResult }>()

  constructor(private readonly options: { runId: string; outputRoot?: string }) {}

  /** Overwrites any prior attempt for the same test id, so only the final retry attempt survives. */
  onTestEnd(test: TestCase, result: TestResult): void {
    this.finalAttempts.set(test.id, { title: test.title, result })
  }

  collect(): EvidenceOutput {
    const errors: string[] = []
    const tests: FinalTestOutcome[] = []
    const failures: EvidenceFailure[] = []
    const attempts: AttemptRaw[] = []
    for (const [testId, { title, result }] of [...this.finalAttempts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const { raw, error } = parseAttachments(result.attachments as readonly EvidenceAttachment[])
      if (error) errors.push(`${testId}: ${error}`)
      const { records, errors: sessionErrors } = new EvidenceSession(this.options.runId).with(raw).finalize()
      errors.push(...sessionErrors.map((sessionError) => `${testId}: ${sessionError}`))
      const diagnostics = (result.attachments as readonly EvidenceAttachment[]).filter((a) => a.path !== undefined && a.name !== EVIDENCE_ATTACHMENT_NAME).map((a) => a.path as string)
      const failedRecords = records.filter((record) => record.status === 'fail')
      for (const record of failedRecords) failures.push({ testId, title, taxonomy: record.failure!.taxonomy, setupFailure: false, message: record.failure!.message })
      if (result.status !== 'passed' && result.status !== 'skipped' && failedRecords.length === 0) {
        failures.push({ testId, title, taxonomy: SETUP_FAILURE_TAXONOMY, setupFailure: true, message: result.errors?.[0]?.message ?? 'test failed without classified evidence records' })
      }
      tests.push({ id: testId, title, attempt: result.retry, status: result.status, records: raw.length, diagnostics })
      attempts.push({ raw })
    }
    const { records: unsorted, errors: duplicateErrors } = new EvidenceSession(this.options.runId).with(attempts.flatMap(({ raw }) => raw)).finalize()
    errors.push(...duplicateErrors.map((duplicateError) => `aggregate: ${duplicateError}`))
    const records = [...unsorted].sort((a, b) => evidenceIdentity(a).localeCompare(evidenceIdentity(b)))
    const aggregate: 'pass' | 'fail' = failures.length === 0 && errors.length === 0 ? 'pass' : 'fail'
    return {
      records,
      summary: {
        schemaVersion: SCHEMA_VERSION, runId: this.options.runId, aggregate,
        totals: {
          tests: tests.length, records: records.length,
          passed: records.filter((record) => record.status === 'pass').length,
          failed: records.filter((record) => record.status === 'fail').length,
          excluded: records.filter((record) => record.status === 'excluded').length,
          setupFailures: failures.filter((failure) => failure.setupFailure).length,
        },
        tests, failures, errors,
      },
      coverage: buildCoverage(records),
    }
  }

  /** Writes deterministic sorted artifacts (overwriting any prior run) and returns the aggregated output. */
  finalize(outputRoot?: string): EvidenceOutput {
    const output = this.collect()
    const root = outputRoot ?? this.options.outputRoot
    if (root) {
      mkdirSync(root, { recursive: true })
      writeFileSync(join(root, 'evidence.jsonl'), output.records.map((record) => JSON.stringify(record)).join('\n') + (output.records.length > 0 ? '\n' : ''))
      writeFileSync(join(root, 'summary.json'), JSON.stringify(output.summary, null, 2) + '\n')
      writeFileSync(join(root, 'coverage.json'), JSON.stringify(output.coverage, null, 2) + '\n')
    }
    return output
  }

  onEnd(): void { this.finalize() }
}

export default ResponsiveEvidenceReporter
