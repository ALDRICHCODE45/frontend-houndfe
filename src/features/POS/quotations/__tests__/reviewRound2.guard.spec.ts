import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// T4 review round 2: the mobile action bar must not paint on desktop. A scoped
// `display: grid` on the bar overrides Tailwind's `lg:hidden` (same specificity,
// later in the cascade), which showed two solid "Enviar cotización" at 1440.
const view = readFileSync(resolve(__dirname, '../views/QuotationDetailView.vue'), 'utf8')

describe('quotation detail action bar is mobile-only', () => {
  it('declares display only inside a max-width media query', () => {
    const base = view.match(/\.quotation-action-bar\s*\{[^}]*\}/)
    expect(base?.[0]).toBeDefined()
    expect(base![0]).not.toMatch(/display\s*:/)
    expect(view).toMatch(/@media\s*\(max-width:\s*1023px\)\s*\{\s*\.quotation-action-bar\s*\{[^}]*display:\s*grid/)
  })
})

describe('quotations review round 2 copy', () => {
  it('does not assume the cause of a failed load', () => {
    const root = resolve(__dirname, '..')
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path)
        return /\.(vue|ts)$/.test(name) && !/\.(spec|test)\./.test(name) ? [path] : []
      })
    const hits = walk(root).filter((file) => /Revisa tu conexión/.test(readFileSync(file, 'utf8')))
    expect(hits).toEqual([])
  })
})
