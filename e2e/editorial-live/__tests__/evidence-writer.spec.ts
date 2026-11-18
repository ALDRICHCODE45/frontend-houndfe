/** Tests for the editorial-live evidence writer with injected IO (nothing written to the project). */
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { createEvidenceCollector } from '../../cash-live/support/evidence'
import { EVIDENCE_FILE_NAME, EvidenceWriteError, serializeEvidence, writeEvidence, type WriterIo } from '../support/evidence-writer'

const ROOT = '/repo/frontend'
const SCRATCH = path.resolve(ROOT, 'artifacts/editorial-live')
const RUN_DIR = path.join(SCRATCH, 'run-1')
const SECRET = 'live-token-secret'

function io(realpath: (p: string) => string = p => p): WriterIo & { written: Map<string, string> } {
  const written = new Map<string, string>()
  return { written, mkdir: vi.fn(), realpath, writeFile: (p, c) => { written.set(p, c) } }
}
function doc() {
  const collector = createEvidenceCollector('run-1', [SECRET])
  collector.collect('superadmin-global:save', 'http', 'pass', `PUT -> 200 with Bearer ${SECRET}`)
  return { schemaVersion: 1 as const, runId: 'run-1', resourceId: 'res', records: collector.records() }
}

describe('writeEvidence', () => {
  it('writes redacted evidence.json inside the run directory', () => {
    const target = io()
    const file = writeEvidence(RUN_DIR, doc(), [SECRET], ROOT, target)
    expect(file).toBe(path.join(RUN_DIR, EVIDENCE_FILE_NAME))
    const content = target.written.get(file)!
    expect(content).toContain('[REDACTED]')
    expect(content).not.toContain(SECRET)
    expect(JSON.parse(content)).toMatchObject({ schemaVersion: 1, runId: 'run-1', resourceId: 'res' })
  })

  it.each([SCRATCH, path.resolve(ROOT, 'artifacts/cash-live/run'), '/tmp/run', path.resolve(ROOT, 'artifacts/editorial-live/../x')])(
    'refuses directory %s before any IO', dir => {
      const target = io()
      expect(() => writeEvidence(dir, doc(), [SECRET], ROOT, target)).toThrow(EvidenceWriteError)
      expect(target.mkdir).not.toHaveBeenCalled()
      expect(target.written.size).toBe(0)
    })

  it('refuses a run directory that is a symlink out of the scratch root', () => {
    const target = io(p => (p === RUN_DIR ? '/tmp/escape' : p))
    expect(() => writeEvidence(RUN_DIR, doc(), [SECRET], ROOT, target)).toThrow(/resolve inside/)
    expect(target.written.size).toBe(0)
  })

  it('refuses a document that still carries a secret (e.g. in a controlled field)', () => {
    const leaky = { ...doc(), resourceId: SECRET }
    const target = io()
    expect(() => writeEvidence(RUN_DIR, leaky, [SECRET], ROOT, target)).toThrow(/secret/)
    expect(target.written.size).toBe(0)
  })

  it('serializeEvidence never echoes the secret in its error', () => {
    try {
      serializeEvidence({ ...doc(), runId: SECRET }, [SECRET])
      expect.unreachable()
    } catch (error) {
      expect((error as Error).message).not.toContain(SECRET)
    }
  })
})
