import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync('src/core/shared/components/data-table-filters/primitives/hf-filter-primitives.css', 'utf8')

// Source-level role guard, not browser contrast/layout evidence.
describe('HF filter paint boundary (A4/S2,S3,S6)', () => {
  it('uses field, surface, selection and focus roles without literal palettes', () => {
    for (const role of ['control-height', 'radius-control', 'field', 'field-border', 'ink', 'font', 'surface', 'border', 'active', 'active-soft', 'focus']) {
      expect(css).toContain(`var(--hf-${role})`)
    }
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(|coco-|!important/i)
  })

  it('limits paint to the owned HF family and leaves overlay mechanics alone', () => {
    const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)]
    for (const [, selector] of selectors) {
      for (const branch of selector!.split(',')) {
        // Commas inside :is() belong to a preceding family-owned selector.
        if (branch.includes('.hf-ui')) expect(branch).toContain('.hf-filter-')
      }
    }
    expect(css).not.toMatch(/(?:z-index|position|pointer-events|overflow|display)\s*:/)
    expect(css).toContain(":not([aria-invalid='true'])")
    expect(css).not.toMatch(/--ui-(?:error|success|warning)\s*:/)
  })
})
