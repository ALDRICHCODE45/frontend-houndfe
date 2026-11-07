import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const cssPath = 'src/features/analytics/styles/dashboard-trend.css'
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const component = readFileSync('src/features/analytics/components/BranchSalesTrendChart.vue', 'utf8')

describe('Dashboard trend presentation contract', () => {
  it('uses a feature-owned semantic panel and paired Unovis chrome', () => {
    expect(component).toContain("import '../styles/dashboard-trend.css'")
    expect(css).toContain('.dashboard-visual .dashboard-trend')
    expect(css).toContain('border-radius: var(--hf-radius-card)')
    expect(css).toContain('html.dark .dashboard-visual .branch-sales-trend-chart')
    expect(css).toContain('--vis-axis-grid-color: var(--hf-border)')
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|!important|--color-coco/i)
  })

  it('pins chart geometry, gradient and horizontal grid styling', () => {
    expect(component).toContain('stop-opacity="0.16"')
    expect(component).toContain('stop-opacity="0.01"')
    expect(component).toContain(':line-width="2.5"')
    expect(component).toContain(':circle-radius="5"')
    expect(component).toContain('left: 58')
    expect(css).toContain('stroke-dasharray: 3 5')
    expect(css).toContain('--vis-crosshair-line-stroke-dasharray: 4 4')
    expect(css).toContain('height: 240px')
    expect(css).toContain('overflow-x: auto')
  })

  it('defines entry, draw, slide and refresh motion with explicit reduced-motion overrides', () => {
    expect(css).toContain('dashboard-trend-enter 350ms ease-out 100ms both')
    expect(css).toContain('dashboard-trend-draw 500ms')
    expect(css).toContain('transform 200ms')
    expect(css).toContain('opacity 200ms')
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toContain('animation: none')
    expect(reduced).toContain('transition: none')
    expect(reduced).toContain('clip-path: none')
  })

  it('wraps the metric tabs into a grid on narrow screens instead of clipping them', () => {
    expect(css).toMatch(/@media \(max-width: 1190px\) \{[^@]*dashboard-trend-tabs \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
    expect(css).toContain('.dashboard-trend-tab[aria-pressed="true"] { background: var(--hf-active-soft); }')
  })

  it('shapes the loading skeleton like the chart: tabs, grid lines and bars', () => {
    for (const hook of ['skeleton-shape', 'skeleton-tabs', 'skeleton-chart', 'skeleton-line', 'skeleton-bars']) {
      expect(css).toContain(`.dashboard-trend-${hook}`)
    }
  })

  // Premium tables S7: the chart's accessible data table stays plain, with the AppDataTable look.
  it('dresses the data table like AppDataTable: header wash, muted 13px/600 headings, hairlines, hover', () => {
    const shared = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
    const wash = shared.match(/--hf-table-head: (color-mix\([^;]+\));/)![1]!
    const table = '.dashboard-visual .dashboard-trend-data'
    expect(component).toMatch(/<table[^>]*class="dashboard-trend-data/)
    expect(css).toMatch(new RegExp(`${table.replace(/\./g, '\\.')} thead \\{[^}]*background-color: ${wash.replace(/[()%]/g, '\\$&')}`))
    expect(css).toMatch(/\.dashboard-trend-data th \{[^}]*color: var\(--hf-muted\);[^}]*font-size: 13px;[^}]*font-weight: 600/s)
    expect(css).toMatch(/\.dashboard-trend-data :is\(th, td\) \{[^}]*border-bottom: 1px solid var\(--hf-border\)/s)
    expect(css).toMatch(/\.dashboard-trend-data tbody tr:hover \{[^}]*var\(--hf-active-soft\)/s)
  })
})
