import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The navbar breadcrumb shares one row with the menu and icon buttons; a long
// page name must never wrap into a stack of words there.
const css = readFileSync('src/app/layouts/styles/unified-shell.css', 'utf8')
const layout = readFileSync('src/app/layouts/DashboardLayout.vue', 'utf8')
const rule = (selector: string, source = css) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? null
}

describe('shell breadcrumb', () => {
  it('stays on one line and truncates instead of wrapping', () => {
    expect(rule('.hf-shell-breadcrumb')).toMatch(/min-width: 0/)
    expect(rule('.hf-shell-breadcrumb')).toMatch(/overflow: hidden/)
    const item = rule('.hf-shell-breadcrumb-item')
    expect(item).toMatch(/white-space: nowrap/)
    expect(item).toMatch(/text-overflow: ellipsis/)
    expect(item).toMatch(/min-width: 0/)
  })
  it('shows only the current page on mobile', () => {
    const mobile = css.match(/@media \(max-width: 767px\)\s*\{[^@]*?\.hf-shell-breadcrumb-ancestor[^}]*\}/)?.[0] ?? ''
    expect(mobile).toMatch(/display: none/)
    expect(layout).toMatch(/hf-shell-breadcrumb-ancestor/)
    expect(layout).toMatch(/hf-shell-breadcrumb-item/)
  })
})
