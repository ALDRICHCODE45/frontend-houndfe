import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../hf-selection.css'), 'utf8')

describe('hf-selection.css — a switch row disabled by its <fieldset> looks disabled', () => {
  it('drops the hover paint and shows not-allowed for :disabled as well as aria-disabled', () => {
    expect(css).toContain(".hf-switch-row__button:hover:not([aria-disabled='true']):not(:disabled)")
    expect(css).toMatch(/\.hf-switch-row__button\[aria-disabled='true'\],\s*\.hf-switch-row__button:disabled\s*\{\s*cursor: not-allowed;/)
    expect(css).toMatch(
      /\.hf-switch-row__button:disabled :is\(\.hf-switch-row__label, \.hf-switch-row__track\)/,
    )
  })
})
