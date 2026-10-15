import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = 'src/features/analytics'
const path = `${root}/styles/dashboard-metrics.css`
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
const component = readFileSync(`${root}/components/BranchSalesSummaryMetrics.vue`, 'utf8')
const view = readFileSync(`${root}/views/BranchSalesSummaryView.vue`, 'utf8')

describe('Dashboard metrics presentation contract', () => {
  it('uses semantic paired-theme roles inside the feature boundary', () => {
    expect(component).toContain("import '../styles/dashboard-metrics.css'")
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|:root|!important/i)
    for (const role of ['surface', 'border', 'heading', 'muted', 'action', 'warning']) {
      expect(css).toContain(`var(--hf-${role})`)
    }
    expect(css).toContain('.dashboard-visual .dashboard-metrics')
    expect(css).toContain('.dark .dashboard-visual .dashboard-sparkline')
  })

  it('pins hero, five-card grid and refund-band geometry', () => {
    for (const declaration of ['min-height: 201px', 'padding: 28px 32px', 'font-size: 48px', 'width: 55%', 'height: 120px', 'repeat(5, minmax(0, 1fr))', 'gap: 12px', 'padding: 20px', 'min-height: 147px', 'font-size: 25px', 'height: 30px', 'opacity: 0.6']) {
      expect(css).toContain(declaration)
    }
    expect(css).toContain('@media (max-width: 1190px)')
    expect(css).toContain('@media (max-width: 700px)')
  })

  it('provides entry, hover and draw-in with a reduced-motion escape', () => {
    expect(css).toContain('350ms ease-out 50ms both')
    expect(css).toContain('translateY(10px)')
    expect(css).toContain('translateY(-2px)')
    expect(css).toContain('border-color: var(--hf-action)')
    expect(css).toContain('dashboard-spark-reveal 500ms')
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    for (const declaration of ['animation: none', 'transition: none', 'transform: none', 'clip-path: none']) expect(reduced).toContain(declaration)
    expect(component).toContain('useTransition')
    expect(component).toContain('duration: 500')
    expect(component).toContain("usePreferredReducedMotion()")
    expect(component).toContain("reducedMotion.value === 'reduce'")
    expect(view).toContain(':points="timeseriesState.points.value"')
  })
})
