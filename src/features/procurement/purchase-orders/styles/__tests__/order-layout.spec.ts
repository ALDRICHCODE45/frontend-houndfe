import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/procurement/purchase-orders/styles/purchase-orders-visual.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (selector: string) => {
  const found = [...css.matchAll(/(^|\n)([^{}\n@][^{}]*)\{([^}]*)\}/g)].find(([, , selectors]) => selectors!.split(',').map(s => s.trim()).includes(selector))
  return found ? found[3]! : null
}
const inMedia = (query: string) => {
  const start = css.indexOf(`@media (${query})`)
  return start < 0 ? '' : css.slice(start, css.indexOf('\n}', start))
}

describe('order read-only layout', () => {
  it('lays the details out as one column on mobile and two label/value columns from md', () => {
    expect(rule('.purchase-orders-portal .order-readonly-details')).toMatch(/display: grid/)
    expect(rule('.purchase-orders-portal .order-readonly-details')).toMatch(/grid-template-columns: minmax\(0, 1fr\)/)
    expect(inMedia('min-width: 768px')).toMatch(/\.order-readonly-details[^{]*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
    expect(rule('.purchase-orders-portal .order-detail dt')).toMatch(/color: var\(--hf-muted\)/)
    expect(rule('.purchase-orders-portal .order-detail-wide')).toMatch(/grid-column: 1 \/ -1/)
  })
  it('keeps each line label next to its value: a compact grid with money in a bounded column', () => {
    const figures = rule('.purchase-orders-portal .order-readonly-figures')!
    expect(figures).toMatch(/display: grid/)
    expect(figures).toMatch(/grid-template-columns: minmax\(0, max-content\) minmax\(0, 14rem\)/)
    expect(figures).toMatch(/justify-content: start/)
    expect(rule('.purchase-orders-portal .order-readonly-figures > div')).toMatch(/display: contents/)
    expect(css).not.toMatch(/order-readonly-figures > div[^{]*\{[^}]*space-between/)
    expect(rule('.purchase-orders-portal .order-readonly-figures dd')).toMatch(/text-align: right/)
  })
  it('groups the confirm summary as label/value pairs, two per row from md', () => {
    expect(rule('.purchase-orders-portal .order-summary')).toMatch(/display: grid/)
    expect(inMedia('min-width: 768px')).toMatch(/\.order-summary[^{]*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  })
})

describe('transition action bar', () => {
  it('is a bordered surface that keeps the buttons and their explanation together', () => {
    const bar = rule('.purchase-orders-portal .order-transition-bar')!
    expect(bar).toMatch(/display: grid/)
    expect(bar).toMatch(/border: 1px solid var\(--hf-border\)/)
    expect(bar).toMatch(/border-radius: 12px/)
    expect(bar).toMatch(/background: var\(--hf-surface-muted\)/)
    expect(rule('.purchase-orders-portal .order-transition-bar .order-actions')).toMatch(/justify-content: flex-start/)
  })
})

describe('editor overlay width', () => {
  it('caps the slideover at a readable width instead of the viewport', () => {
    const view = readFileSync('src/features/procurement/purchase-orders/views/PurchaseOrderView.vue', 'utf8')
    const content = view.match(/<USlideover[^>]*:ui="\{ content: '([^']*)' \}"/)?.[1] ?? ''
    expect(content).toContain('hf-form-overlay')
    expect(content).toMatch(/(^|\s)max-w-(3xl|4xl)(\s|$)/)
  })
})
