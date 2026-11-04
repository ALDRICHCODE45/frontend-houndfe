import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

describe('row primary text button', () => {
  it('is a text button without the 44px control box: the hit area is the whole row, not the button', () => {
    expect(block('.hf-ui .hf-row-primary')).toMatch(/min-height: 0/)
    expect(block('.hf-ui .hf-row-primary')).not.toMatch(/min-height: var\(--hf-control-height\)/)
  })
  it('keeps a visible focus ring, since it is the tab stop of the row', () => {
    expect(block('.hf-ui .hf-row-primary:focus-visible')).toMatch(/outline: 2px solid var\(--hf-focus\)/)
  })
})
