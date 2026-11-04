import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

const path = 'src/features/POS/customers/styles/clients-visual.css'
const sharedPath = 'src/core/shared/design-system/houndfe-ui.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
const sharedCss = readFileSync(sharedPath, 'utf8')
const view = readFileSync('src/features/POS/customers/views/CustomersView.vue', 'utf8')

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

  it('paints only on --hf roles: no palette literals, no local re-theme', () => {
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(declarations).not.toMatch(/--hf-(?:page|surface|surface-muted|field|ink|heading|muted|border|action|on-action|active|focus):/)
    expect(declarations).not.toMatch(/coco|--brand|--light/)
    expect(css).toContain('--radius-xl: var(--hf-radius-card)')
  })

  it('has no rules for the retired card grid, view toggle, badge or custom empty state', () => {
    for (const retired of ['clients-card', 'clients-view-toggle', 'clients-badge', 'clients-empty', 'auto-fill']) {
      expect(css).not.toContain(retired)
    }
  })

  it('uses the shared table pattern: table on desktop, cards on mobile, no toggle', () => {
    expect(view).toContain('mobile-render="cards"')
    expect(view).toContain('#mobile-card')
    expect(view).toContain(':row-open="rowOpen"')
    expect(view).not.toContain('ViewToggle')
    expect(view).not.toContain('CustomerCardGrid')
    expect(view).not.toContain('AppBadge')
    expect(view).not.toContain('UDropdownMenu')
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
  it('keeps the overlay marker on the listing and portal groups without a local palette', () => {
    const rules = styleRules(css)
    const group = rules.find((rule) =>
      splitTopLevel(rule.selectorText).includes('.hf-theme.clients-form-portal'),
    )
    expect(group).toBeDefined()
    const groupSelectors = splitTopLevel(group!.selectorText)
    expect(groupSelectors).toContain('.hf-theme.clients-visual')
    expect(groupSelectors).toContain('.hf-theme.clients-list-portal')
    expect(group!.style.getPropertyValue('--hf-action')).toBe('')
    expect(group!.style.getPropertyValue('--hf-surface')).toBe('')
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

  it('keeps the listing and portal boundaries next to the overlay adapter', () => {
    const selectors = selectorsOf(css)
    expect(selectors).toContain('.hf-theme.clients-visual')
    expect(selectors).toContain('.hf-theme.clients-list-portal')
    expect(selectors).toContain('.clients-form-portal .clients-form-section')
  })
})
