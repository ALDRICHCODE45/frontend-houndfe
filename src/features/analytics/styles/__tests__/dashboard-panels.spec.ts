import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/analytics'
const path = `${dir}/styles/dashboard-panels.css`
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
const panel = readFileSync(`${dir}/components/DashboardOperationalPanel.vue`, 'utf8')

describe('Dashboard operational and summary state presentation', () => {
  it('owns divided operational rows and paired semantic state surfaces', () => {
    expect(panel).toContain("import '../styles/dashboard-panels.css'")
    for (const hook of ['operations', 'operation-header', 'operation-row', 'row-amount', 'refund-facts', 'loading-block', 'empty-block', 'error-block', 'stale-alert', 'refresh-note']) {
      expect(css).toContain(`.dashboard-${hook}`)
    }
    expect(css).toContain('border-bottom: 1px solid var(--hf-border)')
    expect(css).toContain('border-radius: 12px')
    expect(css).toContain('min-height: 450px')
    expect(css).toContain('min-height: 444px')
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|:root|!important/i)
  })

  it('animates entry, ordered rows, skeletons and refresh with a reduced-motion escape', () => {
    expect(css).toContain('350ms ease-out 150ms both')
    expect(css).toContain('45ms')
    expect(css).toContain('opacity: 0.6')
    expect(css).toContain('opacity 200ms')
    expect(css).toContain('@keyframes dashboard-panel-shimmer')
    // Own the hook rather than depending on v0's component-specific slots.
    expect(panel.match(/<USkeleton class="dashboard-state-skeleton/g)).toHaveLength(3)
    expect(css).toContain('.dashboard-loading-block .dashboard-state-skeleton')
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    for (const hook of ['dashboard-panel-grid', 'dashboard-operation-row', 'dashboard-loading-block', 'animate-spin', 'dashboard-state-content']) expect(reduced).toContain(hook)
    expect(reduced).toContain('animation: none')
    expect(reduced).toContain('transition: none')
  })

  it('uses the granted panel count and stacks without a fixed three-column utility', () => {
    expect(css).toContain('repeat(var(--dashboard-panel-count), minmax(0, 1fr))')
    expect(css).toContain('@media (max-width: 1190px)')
    expect(css).toContain('@media (max-width: 700px)')
  })
})
