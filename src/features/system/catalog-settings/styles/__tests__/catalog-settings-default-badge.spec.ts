import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// catalog-settings-rows S1 (browser check at 390): the default row said «Predeterminada» twice, on
// the badge and on the selected full-width pill. Below 640px only the pill stays; the read-only view
// keeps its badge (it has no pill).
const css = readFileSync('src/features/system/catalog-settings/styles/catalog-settings-visual.css', 'utf8')
const field = readFileSync('src/features/system/catalog-settings/components/CatalogPriceContextsField.vue', 'utf8')

describe('catalog settings default badge on mobile', () => {
  it('hides the editable default badge below 640px', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 639px)'))
    expect(mobile).toMatch(/\.cs-default-badge\s*\{[^}]*display: none/)
    expect(css.slice(0, css.indexOf('@media (max-width: 639px)'))).not.toMatch(/\.cs-default-badge/)
  })

  it('marks only the editable badge, not the read-only one', () => {
    expect(field.match(/class="cs-default-badge"/g)).toHaveLength(1)
    const readonlyBlock = field.slice(field.indexOf('v-else-if="props.readonly"'), field.indexOf('role="radiogroup"'))
    expect(readonlyBlock).not.toContain('cs-default-badge')
  })
})
