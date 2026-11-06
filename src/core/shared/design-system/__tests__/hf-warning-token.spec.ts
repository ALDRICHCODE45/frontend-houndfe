import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Warning ink. Nuxt's `text-warning`, `color="warning"` and `bg-warning/N` read
// `--ui-warning` directly (`@theme default inline`), which defaults to the
// library's yellow-500 (~1.9:1 on white). Like the one red (`--ui-error`), the
// warning role is bound once in `.hf-ui` so every warning text follows
// `--hf-warning` in both themes, not only the features that remapped it locally.
const themeCss = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')
const uiCss = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1]!, m[2]!.trim()]))
}

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const lum = (c: number[]) => {
  const [r, g, b] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const ratio = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(path)
    return /\.(vue|ts|css)$/.test(name) && !/\.(spec|test)\.ts$/.test(name) ? [path] : []
  })
}

describe('Nuxt warning role follows the warning token', () => {
  it('binds --ui-warning to --hf-warning inside .hf-ui, like --ui-error to --hf-danger', () => {
    const root = block(uiCss, '.hf-ui {')
    expect(root['--ui-error']).toBe('var(--hf-danger)')
    expect(root['--ui-warning']).toBe('var(--hf-warning)')
  })

  it.each([
    ['light', '.hf-theme,'],
    ['dark', '.dark .hf-theme'],
  ])('keeps warning text at WCAG AA on the surface and the page in %s', (_, selector) => {
    const vars = block(themeCss, selector)
    const warning = rgb(vars['--hf-warning']!)
    for (const bg of ['--hf-surface', '--hf-page', '--hf-warning-soft'])
      expect(ratio(warning, rgb(vars[bg]!)), `warning over ${bg}`).toBeGreaterThanOrEqual(4.5)
  })

  it('never paints text with a raw palette yellow or amber', () => {
    const offenders = sourceFiles('src')
      .filter(file => /\btext-(yellow|amber)-\d{2,3}\b/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
