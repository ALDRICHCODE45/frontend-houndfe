import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/procurement/purchase-orders/styles/purchase-orders-visual.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (selector: string) => {
  const found = [...css.matchAll(/(^|\n)\s*([^{}\n@][^{}]*)\{([^}]*)\}/g)].find(([, , selectors]) => selectors!.split(',').map(s => s.trim()).includes(selector))
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
  it('groups the confirm summary as label/value pairs, two per row from md', () => {
    expect(rule('.purchase-orders-portal .order-summary')).toMatch(/display: grid/)
    expect(inMedia('min-width: 768px')).toMatch(/\.order-summary[^{]*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  })
})

describe('compact lines table', () => {
  it('is a five-column grid on desktop (product, quantity, cost, subtotal, ⋮) and four columns when read-only', () => {
    const row = rule('.purchase-orders-portal .order-line-row')!
    expect(row).toMatch(/display: grid/)
    expect(row).toMatch(/grid-template-columns: minmax\(0, 1fr\) 104px 112px 120px 52px/)
    expect(rule('.purchase-orders-portal .order-lines.is-readonly .order-line-row')).toMatch(/grid-template-columns: minmax\(0, 1fr\) 104px 112px 120px;/)
  })
  it('tints a flagged line with the warning surface and marks the missing value in warning text', () => {
    expect(rule(".purchase-orders-portal .order-line-row[data-flagged='true']")).toMatch(/background: var\(--hf-warning-soft\)/)
    expect(rule('.purchase-orders-portal .order-missing')).toMatch(/color: var\(--hf-warning\)/)
  })
  it('draws an invalid field with the danger border and ring', () => {
    expect(rule(".purchase-orders-portal .order-line-edit [aria-invalid='true']")).toMatch(/border-color: var\(--hf-danger\)[^}]*box-shadow: 0 0 0 1px var\(--hf-danger\)/)
  })
  it('turns a line into a two-row card below 640px, without a table header', () => {
    const media = inMedia('max-width: 639px')
    expect(media).toMatch(/\.order-lines-head[^{]*\{[^}]*display: none/)
    expect(media).toMatch(/\.order-line-row[^{]*\{[^}]*display: flex/)
    expect(media).toMatch(/\.order-line-cost::before \{ content: '×'/)
  })
  it('keeps money tabular and right-aligned', () => {
    expect(rule('.purchase-orders-portal .order-money')).toMatch(/font-variant-numeric: tabular-nums; text-align: right/)
  })
})

describe('open order shell', () => {
  it('is a flex column: fixed header and footer around one scrolling body', () => {
    expect(rule('.purchase-orders-portal .order-shell')).toMatch(/display: flex; flex-direction: column; height: 100%/)
    expect(rule('.purchase-orders-portal .order-body')).toMatch(/overflow-y: auto/)
    expect(rule('.purchase-orders-portal .order-header')).toMatch(/flex: none/)
    expect(rule('.purchase-orders-portal .order-footer')).toMatch(/flex: none/)
  })
  it('pins the mobile action bar to the bottom with the primary wider than the secondary', () => {
    expect(rule('.purchase-orders-portal .order-action-bar')).toMatch(/position: sticky; bottom: 0/)
    expect(rule('.purchase-orders-portal .order-action-bar > .hf-primary-control')).toMatch(/flex: 1.6/)
  })
  it('titles in 22px semibold on desktop and 17px on mobile', () => {
    expect(rule('.purchase-orders-portal .order-header-title')).toMatch(/font-size: 22px; font-weight: 600/)
    expect(rule('.purchase-orders-portal .order-header.is-mobile .order-header-title')).toMatch(/font-size: 17px/)
  })
  it('shows done steps in success, the current one in the action color and the count in warning', () => {
    expect(rule(".purchase-orders-portal .order-steps li[data-state='done'] .order-step-mark")).toMatch(/background: var\(--hf-success\)/)
    expect(rule(".purchase-orders-portal .order-steps li[data-state='current'] .order-step-mark")).toMatch(/background: var\(--hf-action\)/)
    expect(rule('.purchase-orders-portal .order-step-count')).toMatch(/color: var\(--hf-warning\)/)
  })
  it('colors a counter in warning near the limit and in danger at the limit', () => {
    expect(rule('.purchase-orders-portal .order-counter')).toMatch(/color: var\(--hf-warning\)/)
    expect(rule('.purchase-orders-portal .order-counter.is-limit')).toMatch(/color: var\(--hf-danger\)/)
  })
  it('lets nothing but tokens decide the colors', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
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
