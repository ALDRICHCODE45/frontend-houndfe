import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanToneMapSource } from '../utils/neutralToneGuard.utils'

// Drafts are neutral everywhere, and a payment method is a plain chip, not a state. A map from a
// draft (DRAFT / Borrador) or a payment method to a status tone other than neutral fails here, so a
// screen cannot paint "Borrador" warm in one module and blue in another again (design-system.md,
// Status badge).

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.(vue|ts)$/.test(name) && !/\.(spec|test)\./.test(name) ? [path] : []
  })
}

const root = resolve(__dirname, '../../..')
const offenders = new Map<string, string[]>()
for (const file of sourceFiles(root)) {
  const found = scanToneMapSource(readFileSync(file, 'utf8'))
  if (found.length > 0) offenders.set(file.slice(root.length + 1).replace(/\\/g, '/'), found)
}

describe('status tones: drafts and payment methods are neutral', () => {
  it('has no map, in the core or in a feature, that colours a draft or a payment method', () => {
    expect([...offenders]).toEqual([])
  })
})
