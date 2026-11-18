/**
 * Redacted evidence writer for the editorial-live journey.
 *
 * Records are produced by the cash-live collector (`e2e/cash-live/support/evidence.ts`), which
 * redacts every supplied secret before a record exists. This writer adds the persistence step:
 *
 * - the target directory must be strictly inside `artifacts/editorial-live/` (lexically and by
 *   real path, so a symlinked run directory cannot escape);
 * - the serialized document is asserted secret-free once more before it is written;
 * - the file name is fixed (`evidence.json`); nothing caller-controlled reaches the path except
 *   the run directory resolved by the env contract.
 *
 * IO is injectable so the guards are unit-tested without touching the project tree.
 */
import fs from 'node:fs'
import path from 'node:path'

import { assertNoSecrets, type EvidenceRecord } from '../../cash-live/support/evidence'
import { EDITORIAL_LIVE_SCRATCH_ROOT, isStrictlyInside } from './env'

export const EVIDENCE_FILE_NAME = 'evidence.json'

export class EvidenceWriteError extends Error {}

export interface EvidenceDocument {
  readonly schemaVersion: 1
  readonly runId: string
  readonly resourceId: string
  readonly records: readonly EvidenceRecord[]
}

export interface WriterIo {
  readonly mkdir: (absolutePath: string) => void
  readonly realpath: (absolutePath: string) => string
  readonly writeFile: (absolutePath: string, content: string) => void
}

const defaultIo: WriterIo = {
  mkdir: (absolutePath) => fs.mkdirSync(absolutePath, { recursive: true }),
  realpath: (absolutePath) => fs.realpathSync(absolutePath),
  writeFile: (absolutePath, content) => fs.writeFileSync(absolutePath, content, { encoding: 'utf8', mode: 0o600 }),
}

/** Serializes a document after a final secret check. Pure. */
export function serializeEvidence(document: EvidenceDocument, secrets: readonly string[]): string {
  const content = `${JSON.stringify(document, null, 2)}\n`
  try {
    assertNoSecrets(content, secrets)
  } catch {
    throw new EvidenceWriteError('evidence document still contains a secret value; refusing to write it')
  }
  return content
}

/**
 * Writes `<runDir>/evidence.json`. `runDir` must be strictly inside the scratch root under
 * `projectRoot`, before and after resolving symlinks. Returns the written absolute path.
 */
export function writeEvidence(
  runDir: string,
  document: EvidenceDocument,
  secrets: readonly string[],
  projectRoot: string,
  io: WriterIo = defaultIo,
): string {
  const scratch = path.resolve(projectRoot, EDITORIAL_LIVE_SCRATCH_ROOT)
  const target = path.resolve(runDir)
  if (!isStrictlyInside(scratch, target)) {
    throw new EvidenceWriteError(`evidence directory must be inside ${EDITORIAL_LIVE_SCRATCH_ROOT}/`)
  }
  const content = serializeEvidence(document, secrets)
  io.mkdir(target)
  let realTarget: string
  let realScratch: string
  try {
    realTarget = io.realpath(target)
    realScratch = io.realpath(scratch)
  } catch {
    throw new EvidenceWriteError('evidence directory real path could not be resolved')
  }
  if (!isStrictlyInside(realScratch, realTarget)) {
    throw new EvidenceWriteError(`evidence directory must resolve inside ${EDITORIAL_LIVE_SCRATCH_ROOT}/`)
  }
  const file = path.join(realTarget, EVIDENCE_FILE_NAME)
  io.writeFile(file, content)
  return file
}
