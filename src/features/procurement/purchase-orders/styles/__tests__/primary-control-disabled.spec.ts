import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ui = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const theme = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')
const feature = readFileSync('src/features/procurement/purchase-orders/styles/purchase-orders-visual.css', 'utf8')

function declarations(css: string, selector: string) {
  const start = css.search(new RegExp(`${selector.replace(/[.:[\]]/g, '\\$&')}(,[^{]*)?\\s*\\{`))
  if (start < 0) return null
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries(body.split(';').map(item => item.split(/:(.*)/s).map(part => part.trim())).filter(([name]) => name).map(([name, value]) => [name, value]))
}
function tokens(block: 'light' | 'dark') {
  const head = block === 'light' ? '.hf-theme,' : '.dark .hf-theme,'
  const start = theme.indexOf(head)
  const body = theme.slice(theme.indexOf('{', start) + 1, theme.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/--(hf-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name, value]) => [name, value]))
}
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05) }

describe('shared disabled primary control', () => {
  it('lets a disabled destructive confirm fall back to the shared treatment instead of staying red', () => {
    expect(feature).toMatch(/\.order-confirm-danger:not\(:disabled\)/)
  })
  const rule = declarations(ui, '.hf-ui .hf-primary-control:disabled')
  it('ships one token-based disabled treatment that never fades the control', () => {
    expect(rule, 'houndfe-ui.css must define .hf-ui .hf-primary-control:disabled').not.toBeNull()
    expect(rule).toMatchObject({ opacity: '1', cursor: 'not-allowed', 'background-color': 'var(--hf-page)', color: 'var(--hf-muted)', 'border-color': 'var(--hf-border)' })
    expect(Object.values(rule!).join(' ')).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i)
  })
  it('covers aria-disabled, the other way Nuxt UI marks a disabled button', () => {
    expect(ui).toMatch(/\.hf-ui \.hf-primary-control\[aria-disabled='true'\]/)
  })
  it.each(['light', 'dark'] as const)('keeps the disabled label legible in %s mode (>= 4.5:1)', mode => {
    const palette = tokens(mode)
    expect(contrast(palette['hf-muted']!, palette['hf-page']!)).toBeGreaterThanOrEqual(4.5)
  })
  it('replaces the purchase-orders local disabled opacity instead of stacking on it', () => {
    expect(feature).not.toMatch(/:disabled[^{]*\{[^}]*opacity/)
    expect(feature).toMatch(/:disabled \{ cursor: not-allowed; \}/)
  })
})
