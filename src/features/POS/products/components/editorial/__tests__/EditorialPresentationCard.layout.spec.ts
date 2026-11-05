/**
 * T10 Contenido review: the two-column card layout (label beside the chips) wrapped "Área" and "No sé"
 * to a second row at 1440. The label now sits above its chips at every width.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../EditorialPresentationCard.vue'), 'utf8')
const wide = /@container \(min-width: 40rem\) \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''

describe('EditorialPresentationCard layout', () => {
  it('stacks each question label above its chips, so the chips get the whole card width', () => {
    expect(wide).toBe('')
    expect(source).not.toMatch(/grid-template-columns: 15rem/)
  })
  it('wraps "No sé" together with the chip before it, never alone', () => {
    const tail = /\.pcard__tail \{([^}]*)\}/.exec(source)?.[1] ?? ''
    expect(tail).toMatch(/flex-wrap: nowrap/)
    expect(tail).toMatch(/white-space: nowrap/)
  })

  it('has no native date input: "Revisada el" is the calendar field', () => {
    expect(source).not.toMatch(/type="date"/)
    expect(source).toMatch(/<UInputDate/)
    expect(source).toMatch(/<UCalendar/)
    expect(source).toMatch(/calendarPartsToDateString/)
  })
})
