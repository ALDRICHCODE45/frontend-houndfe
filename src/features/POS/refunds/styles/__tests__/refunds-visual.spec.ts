import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/POS/refunds/styles/refunds-visual.css', 'utf8')

/** Declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`Missing rule ${selector}`)
  return match[1]!.replace(/\s+/g, ' ')
}

// Source contracts, not rendered fidelity (jsdom has no layout).
describe('refunds presentation', () => {
  it('keeps the settle sheet inside its gutter at 390: the grid tracks can shrink', () => {
    expect(rule('.hf-ui .refund-settle__body')).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(rule('.hf-ui .refund-settle__form')).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(rule('.hf-ui .refund-settle__body')).toContain('padding: 1.25rem 1rem 1.5rem')
  })

  it('fits «Monto a devolver» with «Devolver todo» inside: the box is the content width', () => {
    const box = rule('.hf-ui .refund-amount')
    expect(box).toContain('width: 100%')
    expect(box).toContain('min-width: 0')
    expect(box).toContain('box-sizing: border-box')
    const input = rule('.hf-ui .refund-amount__input')
    expect(input).toContain('min-width: 0')
    expect(input).toContain('width: 0')
    expect(input).toContain('flex: 1 1 0')
    expect(rule('.hf-ui .refund-amount__all')).toContain('flex-shrink: 0')
  })

  it('lets «Motivo» wrap to two lines with a minimum width, the cancellation day on one line', () => {
    const reason = rule('.hf-ui .refund-reason')
    expect(reason).toContain('min-width: 11rem')
    expect(reason).toContain('white-space: normal')
    expect(reason).not.toContain('text-overflow: ellipsis')
    expect(rule('.hf-ui .refund-reason-when')).toContain('white-space: nowrap')
  })

  it('declares no palette of its own', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(css).not.toContain('!important')
  })
})
