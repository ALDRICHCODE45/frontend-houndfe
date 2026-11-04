import { expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// The Reintentar button is the retry action. An error message only says what failed, so the text
// never ends in "Reintenta." (nor asks to retry the same attempt next to the button).
const SRC = resolve(process.cwd(), 'src')
const RETRY_TEXT = /Reintenta\.|Reintenta (?:el|para)\b/
const SPECS = /(?:\.spec|\.test)\.ts$|\/__tests__\//
// Owned by the products, promotions and quotations writer.
const OTHER_WRITER = /^features\/POS\/(?:products|promotions|quotations)\//

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sources(full)
    return /\.(?:ts|vue)$/.test(name) ? [full] : []
  })
}

it('error messages do not repeat the retry action', () => {
  const offenders = sources(SRC)
    .map((file) => relative(SRC, file))
    .filter((file) => !SPECS.test(file) && !OTHER_WRITER.test(file))
    .filter((file) => RETRY_TEXT.test(readFileSync(join(SRC, file), 'utf8')))
  expect(offenders).toEqual([])
})
