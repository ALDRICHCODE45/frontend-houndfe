import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// T14 browser review: at 390px the chip row (896px) widened the product scroller
// (scrollWidth 883 against 375). Source contracts of the min-width chain from the
// scroller down to HfSectionNav (whose own row scrolls, hf-form.css.spec.ts); jsdom has no layout.
const workspace = readFileSync('src/features/POS/products/components/editorial/EditorialWorkspace.vue', 'utf8')
const detail = readFileSync('src/features/POS/products/views/ProductDetailView.vue', 'utf8')
const style = (source: string) => source.slice(source.indexOf('<style scoped>'))

describe('Contenido never scrolls the product page sideways', () => {
  it('lets the product scroller and every grid item shrink below their content', () => {
    expect(detail).toMatch(/class="mx-auto flex w-full min-w-0 max-w-\[1480px\][^"]*overflow-y-auto/)
    expect(style(detail)).toMatch(/\.product-workspace-grid > \*\s*\{[^}]*min-width: 0/)
    expect(style(workspace)).toMatch(/\.editorial-layout > \*\s*\{[^}]*min-width: 0/)
  })

  it('bleeds the sticky chip row to the scroller gutters (16px, 24px from sm)', () => {
    expect(style(workspace)).toMatch(/\.editorial-nav\s*\{[^}]*--hf-section-nav-bleed: 16px/)
    expect(style(workspace)).toMatch(/@media \(min-width: 640px\)\s*\{[^}]*\.editorial-nav\s*\{[^}]*--hf-section-nav-bleed: 24px/)
  })
})
