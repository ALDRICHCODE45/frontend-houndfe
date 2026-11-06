import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// A disabled primary must not read as a soft enabled button. `--hf-surface-muted` is the light
// blue wash of selected and secondary surfaces, so on it «Continuar» (/select-tenant) and «Enviar
// verificación» (Caja) looked clickable in light mode. The disabled primary rests on the neutral
// page tone instead, and a solid Nuxt primary without the hf-primary-control hook gets the same
// treatment rather than its own `disabled:opacity-75` fade.
const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selectors: selector!.split(',').map(s => s.trim()),
  body: body!,
}))
const disabledRule = rules.find(({ selectors }) => selectors.includes('.hf-ui .hf-primary-control:disabled'))

describe('disabled primary', () => {
  it('rests on the neutral page tone, never on the blue muted wash', () => {
    expect(disabledRule?.body).toMatch(/background-color: var\(--hf-page\)/)
    expect(disabledRule?.body).not.toMatch(/--hf-surface-muted/)
  })

  it('covers solid Nuxt primaries that do not carry hf-primary-control', () => {
    expect(disabledRule?.selectors).toEqual(
      expect.arrayContaining([
        '.hf-ui button.bg-primary:disabled',
        ".hf-ui button.bg-primary[aria-disabled='true']",
        ".hf-ui a.bg-primary[aria-disabled='true']",
      ]),
    )
  })
})

// Dark mode: the page-tone well with the bright muted label (#adbcd0, ~9.6:1) read exactly like
// the enabled outline «Cancelar» beside it, so a disabled «Guardar cambios» looked clickable. The
// dark label is dimmed toward the page; light mode keeps the rule above unchanged.
const theme = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')
const darkBlock = theme.slice(theme.indexOf('{', theme.indexOf('.dark .hf-theme')) + 1, theme.indexOf('}', theme.indexOf('.dark .hf-theme')))
const darkTokens = Object.fromEntries([...darkBlock.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6});/gi)].map(m => [m[1]!, m[2]!]))
const darkToken = (name: string) => darkTokens[name]!
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const lum = (c: number[]) => {
  const [r, g, b] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const ratio = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
const darkDisabled = rules.find(({ selectors }) => selectors.includes('.dark .hf-ui .hf-primary-control:disabled'))

describe('disabled primary in dark mode', () => {
  it('dims the label for every disabled primary selector', () => {
    expect(darkDisabled?.selectors).toEqual(
      expect.arrayContaining([
        ".dark .hf-ui .hf-primary-control[aria-disabled='true']",
        '.dark .hf-ui button.bg-primary:disabled',
        ".dark .hf-ui button.bg-primary[aria-disabled='true']",
        ".dark .hf-ui a.bg-primary[aria-disabled='true']",
      ]),
    )
    expect(darkDisabled?.body).toMatch(/color: color-mix\(in srgb, var\(--hf-muted\) 60%, var\(--hf-page\)\)/)
  })

  it('reads clearly dimmer than an enabled outline label, yet still legible on the page tone', () => {
    const page = rgb(darkToken('--hf-page'))
    const [muted, ink] = [rgb(darkToken('--hf-muted')), rgb(darkToken('--hf-ink'))]
    const label = muted.map((v, i) => v * 0.6 + page[i]! * 0.4)
    expect(ratio(label, page)).toBeGreaterThanOrEqual(3)
    expect(ratio(label, page)).toBeLessThan(ratio(muted, page) / 2)
    expect(ratio(label, page)).toBeLessThan(ratio(ink, page) / 3)
  })
})
