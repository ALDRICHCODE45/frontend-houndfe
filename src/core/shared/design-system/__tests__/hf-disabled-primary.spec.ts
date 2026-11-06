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
