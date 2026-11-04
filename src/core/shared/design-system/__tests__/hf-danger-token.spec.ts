import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const themeCss = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')
const uiCss = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')

type Rgb = [number, number, number]
type Tokens = Record<string, string>

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`missing ${what}`)
  return value
}

const get = (map: Tokens, key: string) => need(map[key], key)

function declarations(body: string, pattern: RegExp): Tokens {
  return Object.fromEntries(
    [...body.matchAll(pattern)].map(m => [need(m[1], 'name'), need(m[2], 'value').trim()]),
  )
}

// The light block is `.hf-theme, ...`; the dark block starts with `.dark .hf-theme`.
function tokens(theme: 'light' | 'dark'): Tokens {
  const start = theme === 'light' ? themeCss.indexOf('.hf-theme,') : themeCss.indexOf('.dark .hf-theme')
  const block = themeCss.slice(themeCss.indexOf('{', start) + 1, themeCss.indexOf('}', start))
  return declarations(block, /(--[\w-]+):\s*([^;]+);/g)
}

function rule(css: string, selector: string): Tokens {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return {}
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return declarations(body, /([\w-]+):\s*([^;]+);/g)
}

function hex(value: string): Rgb {
  const h = value.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function splitArgs(source: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of source) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = '' } else current += ch
  }
  return [...parts, current.trim()]
}

// Minimal resolver for the colour syntax HF tokens use: hex, var() and
// `color-mix(in srgb, A p%, B)`. Browser paint stays separate evidence.
function color(expr: string, vars: Tokens): Rgb {
  const value = expr.trim()
  if (value.startsWith('#')) return hex(value)
  const variable = value.match(/^var\((--[\w-]+)\)$/)
  if (variable) return color(need(vars[need(variable[1], 'variable')], `token ${variable[1]}`), vars)
  const mix = value.match(/^color-mix\((.*)\)$/)
  if (mix) {
    const [, first = '', second = ''] = splitArgs(need(mix[1], 'color-mix arguments'))
    const pct = parseFloat(need(first.match(/([\d.]+)%$/)?.[1], 'mix percentage')) / 100
    const a = color(first.replace(/\s+[\d.]+%$/, ''), vars)
    const b = color(second, vars)
    return [0, 1, 2].map(i => a[i]! * pct + b[i]! * (1 - pct)) as Rgb
  }
  throw new Error(`unsupported colour expression: ${expr}`)
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const [la, lb] = [luminance(a), luminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const AA = 4.5
const themes = ['light', 'dark'] as const
const TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const

describe('--hf-danger token', () => {
  it('uses the approved values in both themes', () => {
    expect(tokens('light')['--hf-danger']).toBe('#b42318')
    expect(tokens('dark')['--hf-danger']).toBe('#ffb4ab')
  })

  it.each(themes)('defines the soft background and border pair in %s', theme => {
    expect(tokens(theme)['--hf-danger-soft']).toMatch(/^#[0-9a-f]{6}$/i)
    expect(tokens(theme)['--hf-danger-border']).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it.each(themes)('keeps danger text at WCAG AA over every surface it sits on in %s', theme => {
    const vars = tokens(theme)
    const text = color(get(vars, '--hf-danger'), vars)
    const surfaces: Record<string, string> = {
      surface: get(vars, '--hf-surface'),
      page: get(vars, '--hf-page'),
      'surface-muted': get(vars, '--hf-surface-muted'),
      'danger-soft': get(vars, '--hf-danger-soft'),
      'menu-item hover': 'color-mix(in srgb, var(--hf-danger) 10%, var(--hf-surface))',
    }
    for (const [name, bg] of Object.entries(surfaces))
      expect(contrast(text, color(bg, vars)), `danger over ${name}`).toBeGreaterThanOrEqual(AA)
  })
})

describe('Nuxt error role follows the one red', () => {
  it('binds --ui-error to --hf-danger inside .hf-ui, like --ui-primary to --hf-action', () => {
    const root = rule(uiCss, '.hf-ui')
    expect(get(root, '--ui-primary')).toBe('var(--hf-action)')
    expect(get(root, '--ui-error')).toBe('var(--hf-danger)')
  })

  it('reaches the toast error accent, which reads --ui-error', () => {
    const toastCss = readFileSync('src/core/shared/design-system/hf-toast.css', 'utf8')
    const error = rule(toastCss, '.hf-shell-toast.hf-toast--error')
    expect(get(error, '--toast-accent')).toBe('var(--ui-error)')
  })
})

describe('status badge tones keep WCAG AA in both themes', () => {
  it('has a tone recipe for every tone', () => {
    for (const tone of TONES) {
      const recipe = rule(uiCss, `.hf-ui .hf-status-badge[data-tone='${tone}']`)
      expect(get(recipe, '--hf-badge-fg'), tone).toBeTruthy()
      expect(get(recipe, '--hf-badge-bg'), tone).toBeTruthy()
    }
  })

  it.each(themes)('label over the calm tint passes in %s', theme => {
    const vars = tokens(theme)
    for (const tone of TONES) {
      const recipe = rule(uiCss, `.hf-ui .hf-status-badge[data-tone='${tone}']`)
      const ratio = contrast(color(get(recipe, '--hf-badge-fg'), vars), color(get(recipe, '--hf-badge-bg'), vars))
      expect(ratio, `${tone} calm`).toBeGreaterThanOrEqual(AA)
    }
  })

  it.each(themes)('label over the stronger urgent tint passes in %s', theme => {
    const vars = tokens(theme)
    const urgent = rule(uiCss, ".hf-ui .hf-status-badge[data-urgent='true']")
    expect(urgent.background).toBeTruthy()
    for (const tone of TONES) {
      const recipe = rule(uiCss, `.hf-ui .hf-status-badge[data-tone='${tone}']`)
      const scoped = { ...vars, '--hf-badge-fg': get(recipe, '--hf-badge-fg') }
      const ratio = contrast(color(get(recipe, '--hf-badge-fg'), vars), color(get(urgent, 'background'), scoped))
      expect(ratio, `${tone} urgent`).toBeGreaterThanOrEqual(AA)
    }
  })
})
