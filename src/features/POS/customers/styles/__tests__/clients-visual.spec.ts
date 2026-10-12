import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

const path = 'src/features/POS/customers/styles/clients-visual.css'
const sharedPath = 'src/core/shared/design-system/houndfe-ui.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
const sharedCss = readFileSync(sharedPath, 'utf8')
const view = readFileSync('src/features/POS/customers/views/CustomersView.vue', 'utf8')
const card = readFileSync('src/features/POS/customers/components/CustomerCard.vue', 'utf8')
const grid = readFileSync('src/features/POS/customers/components/CustomerCardGrid.vue', 'utf8')

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Clients local presentation adapter', () => {
  it('loads a scoped adapter and leaves the business script untouched except presentation imports', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(view).toContain("import '../styles/clients-visual.css'")
    expect(view).not.toContain('hf-shell-products-portal')
    expect(css).not.toContain('.products-visual')
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
  })

  it('owns light and dark list portal palettes locally with restrained geometry', () => {
    expect(css).toContain('.hf-theme.clients-list-portal')
    expect(css).toContain('.dark .hf-theme.clients-list-portal')
    expect(css).toContain('--hf-surface: #ffffff')
    expect(css).toContain('--hf-surface: #1b2736')
    expect(css).not.toContain('--hf-field-border:')
    expect(css).toContain('--radius-xl: var(--hf-radius-card)')
  })

  it('keeps cards bounded and badges content sized without changing legacy tracks', () => {
    expect(css).toContain('repeat(auto-fill, minmax(min(100%, 14rem), 1fr))')
    expect(css).toContain('.clients-visual .clients-card-grid')
    expect(css).toContain('.clients-visual .clients-badge')
    expect(css).toContain('width: fit-content')
    expect(card).toContain('clients-card')
    expect(grid).toContain('clients-card-grid')
    expect(grid).toContain('auto-fit')
  })

  it('shares the empty-state presentation and forwards only owned card menu portals', () => {
    expect(view).toContain('<template #empty>')
    expect(view.match(/<CustomersEmptyState/g)?.length).toBe(2)
    expect(grid).toContain('<slot name="empty">')
    expect(grid).toContain(':portal-class="portalClass"')
    expect(card).toContain('portalClass ? { content: portalClass } : undefined')
  })

  it('wraps toolbar controls, compacts pagination and never selects arbitrary data slots', () => {
    expect(css).toContain('.clients-visual .hf-toolbar-actions')
    expect(css).toContain('flex-wrap: wrap')
    expect(css).toContain('.clients-visual .hf-pagination-size')
    expect(css).toContain('.clients-visual .clients-view-toggle')
    expect(css).not.toMatch(/\.clients-visual\s+\[data-slot=/)
    expect(css).toContain('.clients-visual .clients-empty-state')
  })
})

// ── Form overlay adapter ─────────────────────────────────────────────────────
// Real CSS parser fixtures. These prove source/cascade scoping only; jsdom
// never renders light/dark fidelity, so visual smoke remains user-owned.

const marker = 'hf-theme hf-ui hf-form-overlay clients-form-portal'
const styles: HTMLStyleElement[] = []

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

function styleRules(source: string): CSSStyleRule[] {
  const style = document.createElement('style')
  // Local rules only: `@import` must not trigger network requests in jsdom.
  style.textContent = source.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)

  const collected: CSSStyleRule[] = []
  const walk = (list: CSSRuleList | undefined) => {
    if (!list) return
    Array.from(list).forEach((rule) => {
      if (rule.type === CSSRule.STYLE_RULE) collected.push(rule as CSSStyleRule)
      else walk((rule as CSSGroupingRule).cssRules)
    })
  }
  walk(style.sheet?.cssRules)
  return collected
}

function splitTopLevel(selectorText: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of selectorText) {
    if (char === '(' || char === '[') depth += 1
    if (char === ')' || char === ']') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function selectorsOf(source: string): string[] {
  return styleRules(source).flatMap((rule) => splitTopLevel(rule.selectorText))
}

function exactRule(source: string, selector: string): CSSStyleRule | undefined {
  return styleRules(source).find((rule) => rule.selectorText.trim() === selector)
}

describe('Clients form overlay adapter (S1-S3)', () => {
  const palette: Record<string, string> = {
    '--hf-surface': '#ffffff',
    '--hf-surface-muted': '#eaf0f8',
    '--hf-field': '#f3f6fa',
    '--hf-ink': '#1e3555',
    '--hf-heading': '#1e3555',
    '--hf-muted': '#63748b',
    '--hf-border': '#dce3ed',
    '--hf-action': '#315ce7',
    '--hf-on-action': '#ffffff',
    '--hf-focus': '#315ce7',
  }
  const darkPalette: Record<string, string> = {
    '--hf-surface': '#1b2736',
    '--hf-surface-muted': '#223044',
    '--hf-field': '#101720',
    '--hf-ink': '#e4ebf5',
    '--hf-heading': '#e4ebf5',
    '--hf-border': '#2d3b4d',
    '--hf-action': '#91b0ff',
    '--hf-on-action': '#172b51',
    '--hf-focus': '#91b0ff',
  }

  it('joins the form-portal marker to the existing listing palette groups', () => {
    const rules = styleRules(css)
    for (const [selector, expected] of [
      ['.hf-theme.clients-form-portal', palette],
      ['.dark .hf-theme.clients-form-portal', darkPalette],
    ] as Array<[string, Record<string, string>]>) {
      const group = rules.find((rule) => splitTopLevel(rule.selectorText).includes(selector))
      expect(group).toBeDefined()
      for (const [property, value] of Object.entries(expected)) {
        expect(group!.style.getPropertyValue(property).trim()).toBe(value)
      }
      // The listing portals share the same group, so values are reused rather
      // than duplicated in a new global override.
      const groupSelectors = splitTopLevel(group!.selectorText)
      const darkPrefix = selector.startsWith('.dark') ? '.dark ' : ''
      expect(groupSelectors).toContain(`${darkPrefix}.hf-theme.clients-visual`)
      expect(groupSelectors).toContain(`${darkPrefix}.hf-theme.clients-list-portal`)
    }
  })

  it('repeats the controlled radius scale for form panels without flattening circles', () => {
    const scope = styleRules(css).find((rule) =>
      splitTopLevel(rule.selectorText).includes('.hf-theme.clients-form-portal'),
    )!
    expect(scope.style.getPropertyValue('--radius-sm').trim()).toBe('6px')
    expect(scope.style.getPropertyValue('--radius-md').trim()).toBe('var(--hf-radius-control)')
    expect(scope.style.getPropertyValue('--radius-lg').trim()).toBe('var(--hf-radius-card)')
    expect(scope.style.getPropertyValue('--radius-xl').trim()).toBe('var(--hf-radius-card)')
    // Circles and avatars keep the legacy full radius.
    expect(css).not.toContain('--radius-full')
  })

  it('styles sections, billing link and primary control inside the overlay only', () => {
    const section = exactRule(css, '.clients-form-portal .clients-form-section')!
    expect(section.style.getPropertyValue('background-color').trim()).toBe(
      'var(--hf-surface-muted)',
    )
    expect(section.style.getPropertyValue('border')).toContain('--hf-border')
    expect(section.style.getPropertyValue('border-radius').trim()).toBe('var(--hf-radius-card)')

    const link = exactRule(css, '.clients-form-portal .clients-form-link')!
    expect(link.style.getPropertyValue('color').trim()).toBe('var(--hf-action)')

    const linkFocus = exactRule(css, '.clients-form-portal .clients-form-link:focus-visible')!
    expect(linkFocus.style.getPropertyValue('outline')).toContain('--hf-focus')

    const primary = exactRule(css, '.clients-form-portal .hf-primary-control')!
    expect(primary.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')
  })

  it('keeps every overlay selector scoped and free of element-blind data-slot ownership', () => {
    const selectors = selectorsOf(css)
    const overlay = selectors.filter((selector) => selector.includes('clients-form-portal'))
    expect(overlay.length).toBeGreaterThan(0)

    for (const selector of overlay) {
      expect(selector).toContain('.clients-form-portal')
      expect(selector).not.toMatch(/^(?:\*|html|body|:root|button|input|select|textarea|a|table)\b/)
      // Native overlay header/body/footer adapt through the palette boundary,
      // so no rule blindly keys on a shared data-slot name.
      expect(selector).not.toContain('[data-slot=')
      // The default `variant="link"` tabs stay native; the overlay adapter
      // must not own tab markup and lets the theme aliases drive the color.
      expect(selector).not.toMatch(/role=['"]tab/)
    }
    expect(selectors.some((selector) => /^(?:\*|html|body|:root)$/.test(selector))).toBe(false)
    expect(css).not.toContain('customer-tabs')
  })

  it('adapts a native overlay header/body/footer and a select popup through the portal boundary', () => {
    const root = document.createElement('div')
    root.className = marker
    root.innerHTML = `
      <div data-slot="header"><h2 data-slot="title">Nuevo cliente</h2></div>
      <div data-slot="body">
        <div class="clients-form-section">Precios</div>
        <button class="clients-form-link" type="button">Mostrar dirección</button>
      </div>
      <div data-slot="footer"><button class="hf-primary-control" type="button">Crear cliente</button></div>`
    document.body.append(root)

    // The shared adapter applies the semantic aliases on this very element, so
    // the native header/body/footer inherit bg/text/border by cascade.
    const adapterRoot = styleRules(sharedCss).find((rule) => rule.selectorText.trim() === '.hf-ui')!
    expect(adapterRoot).toBeDefined()
    expect(root.matches(adapterRoot.selectorText)).toBe(true)
    expect(adapterRoot.style.getPropertyValue('--ui-bg').trim()).toBe('var(--hf-surface)')
    expect(adapterRoot.style.getPropertyValue('--ui-text').trim()).toBe('var(--hf-ink)')

    const overlayRules = styleRules(css).filter((rule) =>
      rule.selectorText.includes('clients-form-portal'),
    )
    const section = root.querySelector('.clients-form-section')!
    const link = root.querySelector('.clients-form-link')!
    const primary = root.querySelector('.hf-primary-control')!
    expect(
      overlayRules.some(
        (rule) =>
          section.matches(rule.selectorText) &&
          rule.style.getPropertyValue('background-color').trim() === 'var(--hf-surface-muted)',
      ),
    ).toBe(true)
    expect(
      overlayRules.some(
        (rule) =>
          link.matches(rule.selectorText) &&
          rule.style.getPropertyValue('color').trim() === 'var(--hf-action)',
      ),
    ).toBe(true)
    // The shared `hf-primary-control` owns the action foreground/background;
    // the Clients adapter only constrains its hit area.
    expect(
      overlayRules.some(
        (rule) =>
          primary.matches(rule.selectorText) &&
          rule.style.getPropertyValue('min-height').trim() === 'var(--hf-control-height)',
      ),
    ).toBe(true)
    expect(
      styleRules(sharedCss).some(
        (rule) =>
          primary.matches(rule.selectorText) &&
          rule.style.getPropertyValue('background-color').trim() === 'var(--hf-action)' &&
          rule.style.getPropertyValue('color').trim() === 'var(--hf-on-action)',
      ),
    ).toBe(true)

    // Nested select popups carry the same palette boundary without an overlay.
    const popup = document.createElement('div')
    popup.className = 'hf-theme hf-ui clients-form-portal'
    document.body.append(popup)
    expect(popup.matches(adapterRoot.selectorText)).toBe(true)
    const surfaceRule = overlayRules.find(
      (rule) => rule.style.getPropertyValue('background-color').trim() === 'var(--hf-surface)',
    )
    expect(surfaceRule).toBeDefined()
    expect(popup.matches(surfaceRule!.selectorText)).toBe(true)

    // Negative control: a shared `hf-theme hf-ui` boundary without the Clients
    // marker must not inherit the local palette surface.
    const other = document.createElement('div')
    other.className = 'hf-theme hf-ui'
    document.body.append(other)
    expect(other.matches(surfaceRule!.selectorText)).toBe(false)

    // AddressModal applies the marker through `content.class` next to the
    // retained width utility, while the slideover uses `ui.content`; both land
    // on the same content root and must match the same cascade hook.
    const addressContent = document.createElement('div')
    addressContent.className = 'sm:max-w-lg hf-theme hf-ui hf-form-overlay clients-form-portal'
    document.body.append(addressContent)
    expect(addressContent.matches(surfaceRule!.selectorText)).toBe(true)
    expect(addressContent.matches(adapterRoot.selectorText)).toBe(true)

    root.remove()
    popup.remove()
    other.remove()
    addressContent.remove()
  })

  it('preserves the listing palette and geometry rules next to the overlay adapter', () => {
    const selectors = selectorsOf(css)
    expect(selectors).toContain('.hf-theme.clients-visual')
    expect(selectors).toContain('.hf-theme.clients-list-portal')
    expect(selectors).toContain('.clients-visual .clients-card')
    expect(selectors).toContain('.clients-visual .clients-card-grid')
    expect(css).toContain('repeat(auto-fill, minmax(min(100%, 14rem), 1fr))')
  })
})
