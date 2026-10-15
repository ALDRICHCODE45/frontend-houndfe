import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/analytics'
const cssPath = `${dir}/styles/dashboard-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const view = readFileSync(`${dir}/views/BranchSalesSummaryView.vue`, 'utf8')
const filters = readFileSync(`${dir}/components/BranchSalesSummaryFilters.vue`, 'utf8')

// Source contracts only: browser geometry and visual fidelity need a visual smoke.
describe('Dashboard shell presentation boundary', () => {
  it('reuses the paired foundation without duplicating palette literals', () => {
    expect(css).toContain("@import '../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|:root|!important/i)
    for (const marker of ['dashboard-visual', 'dashboard-range-portal']) {
      expect(css).toContain(`.hf-theme.${marker}`)
    }
    expect(css).toContain('--ui-primary: var(--hf-action)')
    expect(css).toContain('--ui-bg: var(--hf-surface)')
    expect(css).toContain('font-variant-numeric: tabular-nums')
  })

  it('owns the header, centered column and footer outside a wrapping card', () => {
    expect(view).toContain("import '../styles/dashboard-visual.css'")
    expect(view).toContain('hf-theme hf-ui dashboard-visual')
    expect(view).not.toContain('<UCard')
    expect(view).toContain('CONTROL DE VENTAS')
    expect(view).toContain('dashboard-page-header')
    expect(view).toContain('dashboard-page-footer')
    expect(view).toContain('Todos los importes en MXN · Hora de Ciudad de México')
    expect(css).toContain('max-width: 1320px')
    expect(css).toContain('gap: 24px')
    expect(css).toContain('background: var(--hf-gold)')
  })

  // The shell body already pads routed pages (`p-4 sm:p-6`) and paints the page
  // plane, so the reference gutter is the TOTAL and this root adds the
  // remainder. Painting a background here draws a seam inside that padding.
  it('adds only the remaining gutter over the shell padding and paints no page plane', () => {
    const root = css.slice(css.indexOf('.dashboard-visual {'))
    expect(root).toMatch(/^\.dashboard-visual \{[^}]*background: transparent;/)
    expect(root).not.toMatch(/^\.dashboard-visual \{[^}]*background: var\(--hf-page\)/)
    expect(css).toContain('padding: 12px 0 14px')
    expect(css).toContain('padding: 28px 16px 52px')
    expect(css).not.toContain('padding: 52px 40px 76px')
  })

  it('themes the range portal and provides a CSS sliding selection', () => {
    expect(filters).toContain('hf-theme hf-ui dashboard-range-portal')
    expect(filters).toContain('<UPopover')
    expect(filters).toContain('aria-label="Personalizar periodo"')
    expect(css).toContain('.dashboard-preset-indicator')
    expect(css).toContain('transform 250ms')
    expect(css).toContain('min-height: var(--hf-control-height)')
    expect(css).toContain('overflow-x: auto')
  })

  it('removes header entry and indicator motion for reduced motion', () => {
    expect(css).toContain('@keyframes dashboard-header-enter')
    expect(css).toContain('translateY(8px)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('animation: none')
    expect(css).toContain('transition: none')
  })
})
