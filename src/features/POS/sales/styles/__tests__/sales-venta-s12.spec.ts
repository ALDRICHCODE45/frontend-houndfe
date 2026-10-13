import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * S12 source contracts for the Venta v0 catalog card and product detail.
 * Declarations are read from source text (jsdom drops some values such as
 * `color-mix()`); rendered fidelity and contrast remain user-owned.
 */

const read = (name: string) =>
  readFileSync(`src/features/POS/sales/styles/${name}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const workspaceCss = read('sales-pos-workspace.css')
const checkoutCss = read('sales-pos-checkout.css')

function block(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = [...source.matchAll(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'gm'))]
  expect(matches.length, `missing rule ${selector}`).toBeGreaterThan(0)
  return matches.map((match) => match[1]).join('\n')
}

const CARD = '.sales-pos-workspace .sales-pos-product-card-composition'

describe('S12 — v0 catalog card presentation', () => {
  it('paints one bordered 12px surface that highlights on hover', () => {
    const card = block(workspaceCss, CARD)
    expect(card).toMatch(/background-color:\s*var\(--hf-surface\)/)
    expect(card).toMatch(/border-radius:\s*var\(--hf-radius-card\)/)
    expect(block(workspaceCss, `${CARD}:hover`)).toMatch(/border-color:\s*var\(--hf-action\)/)
  })

  it('lets the media keep the v0 proportion without the old height ceiling', () => {
    const media = block(workspaceCss, `${CARD} .sales-pos-product-media`)
    expect(media).toMatch(/aspect-ratio:\s*1\.42/)
    expect(media).toMatch(/max-height:\s*none/)
    expect(media).toMatch(/background-color:\s*var\(--hf-page\)/)
  })

  it('keeps a full-width 44px add action and the action color for variants', () => {
    const add = block(workspaceCss, `${CARD} .sales-pos-product-add`)
    expect(add).toMatch(/min-height:\s*var\(--hf-control-height\)/)
    expect(add).toMatch(/width:\s*100%/)
    expect(block(workspaceCss, `${CARD} .sales-pos-product-add-variants`)).toMatch(/color:\s*var\(--hf-action\)/)
  })

  it('keeps supporting text readable (12px or larger) and marks low stock', () => {
    for (const selector of ['.sales-pos-product-brand', '.sales-pos-product-stock-line', '.sales-pos-product-image-badge']) {
      expect(block(workspaceCss, `${CARD} ${selector}`)).toMatch(/font-size:\s*0\.75rem/)
    }
    expect(block(workspaceCss, `${CARD} .sales-pos-product-stock-line[data-sales-pos-stock='low']`)).toMatch(
      /color:\s*var\(--hf-warning\)/,
    )
  })
})

describe('S12 — v0 product detail presentation', () => {
  it('uses a neutral fact sheet and v0 variant choices', () => {
    expect(block(checkoutCss, '.sales-pos-checkout .sales-pos-detail-data')).toMatch(
      /background-color:\s*var\(--hf-page\)/,
    )
    const choice = block(checkoutCss, '.sales-pos-checkout .sales-pos-detail-variant')
    expect(choice).toMatch(/min-height:\s*4rem/)
    expect(choice).toMatch(/border:\s*1px solid var\(--hf-border\)/)
    expect(block(checkoutCss, ".sales-pos-checkout .sales-pos-detail-variant[aria-pressed='true']")).toMatch(
      /border-color:\s*var\(--hf-action\)/,
    )
  })
})
