/**
 * T10 browser check (S13): in the two-column card layout a question whose chips wrap to a second row
 * kept its label vertically centered against all the rows, so it floated away from its first chip.
 * The label sits on the first chip row instead (chips are 40px tall, the label line is 20px).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../EditorialPresentationCard.vue'), 'utf8')
const wide = /@container \(min-width: 40rem\) \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''
const rule = (selector: string) => new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(wide)?.[1] ?? ''

describe('EditorialPresentationCard two-column layout', () => {
  it('puts each question label on its first chip row, not in the middle of wrapped chips', () => {
    expect(rule('.pcard__question')).toMatch(/align-items: start/)
    expect(rule('.pcard__question')).not.toMatch(/align-items: center/)
    expect(rule('.pcard__question > .pcard__label')).toMatch(/padding-top: 10px/)
  })
})
