import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Nuxt's USkeleton paints `bg-elevated`, and inside `.hf-ui` that role is `--hf-surface`, so every
// skeleton was invisible on a white card. The core rebinds it once (and `.hf-skeleton` for our own
// bars) to a wash of ink over the surface that stays readable in both themes.
const themeCss = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')
const uiCss = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

type Rgb = [number, number, number]

function themeTokens(theme: 'light' | 'dark'): Record<string, string> {
  const start = theme === 'light' ? themeCss.indexOf('.hf-theme,') : themeCss.indexOf('.dark .hf-theme')
  const block = themeCss.slice(themeCss.indexOf('{', start) + 1, themeCss.indexOf('}', start))
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6});/g)].map(m => [m[1]!, m[2]!]))
}
const hex = (value: string): Rgb => {
  const h = value.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb
}
const luminance = ([r, g, b]: Rgb) => {
  const [lr, lg, lb] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!
}
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const SELECTOR = '.hf-ui :is(.hf-skeleton, .animate-pulse.bg-elevated)'
const start = uiCss.indexOf(`${SELECTOR} {`)
const body = start < 0 ? '' : uiCss.slice(start, uiCss.indexOf('}', start))
const mix = body.match(/background-color: color-mix\(in srgb, var\(--hf-ink\) (\d+)%, var\(--hf-surface\)\)/)

describe('skeleton bars are readable in both themes', () => {
  it('rebinds USkeleton and .hf-skeleton to a wash of ink over the surface', () => {
    expect(mix).not.toBeNull()
  })

  it.each(['light', 'dark'] as const)('contrasts with the surface in %s (at least 1.3:1)', theme => {
    const tokens = themeTokens(theme)
    const pct = Number(mix![1]) / 100
    const ink = hex(tokens['--hf-ink']!)
    const surface = hex(tokens['--hf-surface']!)
    const bar = [0, 1, 2].map(i => ink[i]! * pct + surface[i]! * (1 - pct)) as Rgb
    expect(ratio(bar, surface)).toBeGreaterThanOrEqual(1.3)
  })

  it('also reads on the muted card the mobile skeleton sits on', () => {
    for (const theme of ['light', 'dark'] as const) {
      const tokens = themeTokens(theme)
      const pct = Number(mix![1]) / 100
      const ink = hex(tokens['--hf-ink']!)
      const muted = hex(tokens['--hf-surface-muted']!)
      const bar = [0, 1, 2].map(i => ink[i]! * pct + hex(tokens['--hf-surface']!)[i]! * (1 - pct)) as Rgb
      expect(ratio(bar, muted)).toBeGreaterThanOrEqual(1.15)
    }
  })
})
