import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Source-contract tests for the Products visual pilot adapter.
 *
 * These inspect real local stylesheets with a CSS parser. They prove scoping,
 * token mapping and primary-foreground pairing at the source level. They are
 * NOT rendered visual proof and cannot establish light/dark fidelity or touch
 * ergonomics; visual smoke remains user-owned.
 */
const shared = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const products = readFileSync('src/features/POS/products/styles/products-visual.css', 'utf8')
const foundation = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')

const styles: HTMLStyleElement[] = []

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
      if (rule.type === CSSRule.STYLE_RULE) {
        collected.push(rule as CSSStyleRule)
      } else {
        walk((rule as CSSGroupingRule).cssRules)
      }
    })
  }
  walk(style.sheet?.cssRules)
  return collected
}

function selectorsOf(source: string): string[] {
  return styleRules(source).flatMap((rule) => splitTopLevel(rule.selectorText))
}

/** Style rules nested inside a media query whose text contains the fragment. */
function rulesInMedia(source: string, mediaFragment: string): CSSStyleRule[] {
  const style = document.createElement('style')
  style.textContent = source.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)

  const collected: CSSStyleRule[] = []
  const walk = (list: CSSRuleList | undefined, mediaText: string) => {
    if (!list) return
    Array.from(list).forEach((rule) => {
      if (rule.type === CSSRule.MEDIA_RULE) {
        const media = rule as CSSMediaRule
        walk(media.cssRules, media.media.mediaText)
      } else if (rule.type === CSSRule.STYLE_RULE) {
        if (mediaText.includes(mediaFragment)) collected.push(rule as CSSStyleRule)
      } else {
        walk((rule as CSSGroupingRule).cssRules, mediaText)
      }
    })
  }
  walk(style.sheet?.cssRules, '')
  return collected
}

function exactRule(source: string, selector: string): CSSStyleRule | undefined {
  return styleRules(source).find((rule) => rule.selectorText.trim() === selector)
}

function inMedia(source: string, selector: string): CSSStyleRule | undefined {
  return rulesInMedia(source, 'min-width').find((rule) => rule.selectorText.trim() === selector)
}

/** A rule declared outside every media query. */
function topLevelRule(source: string, selector: string): CSSStyleRule | undefined {
  const style = document.createElement('style')
  style.textContent = source.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)
  return Array.from(style.sheet?.cssRules ?? [])
    .filter((rule): rule is CSSStyleRule => rule.type === CSSRule.STYLE_RULE)
    .find((rule) => rule.selectorText.trim() === selector)
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

function contrast(foreground: string, background: string): number {
  function luminance(hex: string): number {
    const channels = hex.match(/[a-f\d]{2}/gi)!.map((channel) => {
      const value = parseInt(channel, 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  }
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

describe('shared opt-in UI adapter', () => {
  it('reuses the theme foundation without global resets or fixed palettes', () => {
    expect(shared).toMatch(/@import\s+['"][^'"]*houndfe-theme\.css['"]/)
    expect(shared).not.toContain('!important')
    expect(shared).not.toContain('coco-')
    expect(shared).not.toMatch(/#[0-9a-fA-F]{3,8}/)

    const optIn =
      /\.hf-(?:ui|theme|page-header|page-title|page-subtitle|table-surface|table-content|data-table|form-overlay|primary-control)/
    for (const selector of selectorsOf(shared)) {
      expect(selector).not.toMatch(/^(?:\*|html|body|:root|button|input|select|textarea|a|table)\b/)
      expect(selector).toMatch(optIn)
    }
  })

  it('maps both Nuxt --ui-* and Tailwind aliases inside .hf-ui', () => {
    const root = styleRules(shared).find((rule) => rule.selectorText.trim() === '.hf-ui')
    expect(root).toBeDefined()

    const expected: Record<string, string> = {
      '--ui-primary': 'var(--hf-action)',
      '--ui-text': 'var(--hf-ink)',
      '--ui-bg': 'var(--hf-surface)',
      '--ui-border': 'var(--hf-border)',
      '--text-color-default': 'var(--hf-ink)',
      '--text-color-muted': 'var(--hf-muted)',
      '--background-color-default': 'var(--hf-surface)',
      '--border-color-default': 'var(--hf-border)',
    }

    for (const [property, value] of Object.entries(expected)) {
      expect(root!.style.getPropertyValue(property).trim()).toBe(value)
    }
    expect(root!.style.getPropertyValue('--ui-text-dimmed')).toContain('color-mix')
    expect(root!.style.getPropertyValue('--text-color-dimmed')).toContain('color-mix')
  })

  it('pairs primary action foreground with --hf-on-action and keeps destructive roles semantic', () => {
    const primary = styleRules(shared).filter(
      (rule) =>
        rule.selectorText.includes('.bg-primary') ||
        rule.selectorText.includes('.hf-primary-control'),
    )
    expect(
      primary.some(
        (rule) =>
          rule.style.getPropertyValue('--ui-text-inverted').trim() === 'var(--hf-on-action)',
      ),
    ).toBe(true)
    expect(
      primary.some(
        (rule) =>
          rule.style.getPropertyValue('--text-color-inverted').trim() === 'var(--hf-on-action)',
      ),
    ).toBe(true)

    const control = primary.find((rule) => rule.style.getPropertyValue('background-color'))
    expect(control!.style.getPropertyValue('background-color').trim()).toBe('var(--hf-action)')
    expect(control!.style.getPropertyValue('color').trim()).toBe('var(--hf-on-action)')

    // Destructive/status roles keep their existing semantic colors; the adapter
    // must never remap every colored control onto the primary hue.
    for (const source of [shared, products]) {
      expect(source).not.toMatch(
        /--(?:ui|color|text-color|background-color|border-color)[-a-z]*-(?:error|danger|destructive)\s*:/,
      )
    }
  })

  it('exposes table workspace hooks backed by foundation tokens', () => {
    const rules = styleRules(shared)
    const find = (fragment: string) => rules.find((rule) => rule.selectorText.includes(fragment))

    expect(find('.hf-page-header')).toBeDefined()
    expect(find('.hf-page-title')!.style.getPropertyValue('color').trim()).toBe('var(--hf-heading)')
    expect(find('.hf-page-subtitle')!.style.getPropertyValue('color').trim()).toBe(
      'var(--hf-muted)',
    )

    const surface = find('.hf-table-surface')!
    expect(surface.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    expect(surface.style.getPropertyValue('border')).toContain('--hf-border')
    expect(surface.style.getPropertyValue('border-radius').trim()).toBe('var(--hf-radius-card)')

    expect(find('.hf-table-content')).toBeDefined()
    expect(find('.hf-form-overlay')!.style.getPropertyValue('background-color').trim()).toBe(
      'var(--hf-surface)',
    )

    const header = rules.find(
      (rule) =>
        rule.selectorText.includes('.hf-data-table') &&
        /\[data-slot=['"]th['"]\]/.test(rule.selectorText),
    )
    expect(header!.style.getPropertyValue('color').trim()).toBe('var(--hf-heading)')

    const menuItem = rules.find((rule) => /\[role=['"]menuitem['"]\]/.test(rule.selectorText))
    expect(menuItem!.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')
  })

  it('leaves data-table column alignment to the consumer column metadata', () => {
    const header = styleRules(shared).find(
      (rule) =>
        rule.selectorText.includes('.hf-data-table') &&
        /\[data-slot=['"]th['"]\]/.test(rule.selectorText),
    )
    expect(header).toBeDefined()
    // A blanket `text-align` here outranks the consumer's `.text-right` on
    // numeric and action columns, so the shared rule must not declare it.
    expect(header!.style.getPropertyValue('text-align')).toBe('')
  })

  it('applies the form overlay surface when the portal root carries both classes', () => {
    // Teleported overlays put `hf-theme hf-ui hf-form-overlay` on one element,
    // which a descendant-only selector would miss.
    const root = document.createElement('div')
    root.className = 'hf-theme hf-ui hf-form-overlay'
    const overlay = styleRules(shared).filter((rule) =>
      rule.selectorText.includes('.hf-form-overlay'),
    )
    expect(overlay.length).toBeGreaterThan(0)
    expect(
      overlay.some(
        (rule) =>
          rule.style.getPropertyValue('background-color').trim() === 'var(--hf-surface)' &&
          root.matches(rule.selectorText),
      ),
    ).toBe(true)
  })

  it('keeps table structure owned by real table elements', () => {
    // Nuxt UI reuses `data-slot="base"`/`"root"` across Button, Badge, Input
    // and other primitives. A table rule that keys only on the slot name
    // restyles every control nested inside the workspace.
    const fixture = document.createElement('div')
    fixture.className = 'hf-theme hf-ui'
    fixture.innerHTML = `
      <div class="hf-data-table">
        <div data-slot="root">
          <table data-slot="base">
            <thead data-slot="thead">
              <tr data-slot="tr"><th data-slot="th">Encabezado</th></tr>
            </thead>
            <tbody data-slot="tbody">
              <tr data-slot="tr">
                <td data-slot="td">
                  <div data-slot="root" class="nested-control"><input data-slot="base" /></div>
                  <button data-slot="base" type="button">Acción</button>
                  <span data-slot="base">Estado</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>`
    document.body.append(fixture)

    const tableFixture = fixture.querySelector('table[data-slot="base"]')!
    const nested = Array.from(
      fixture.querySelectorAll(
        '.nested-control, button[data-slot="base"], span[data-slot="base"], input[data-slot="base"]',
      ),
    )
    const tableOnlyProperties = [
      'width',
      'max-width',
      'border-collapse',
      'border-spacing',
      'font-size',
      'white-space',
      'vertical-align',
      'background-color',
      'color',
    ]

    const leaks: string[] = []
    for (const rule of styleRules(shared)) {
      if (!rule.selectorText.includes('.hf-data-table')) continue
      for (const element of nested) {
        if (!element.matches(rule.selectorText)) continue
        for (const property of tableOnlyProperties) {
          const value = rule.style.getPropertyValue(property).trim()
          if (value) {
            leaks.push(
              `${rule.selectorText} { ${property}: ${value} } → ${element.tagName.toLowerCase()}[data-slot="${element.getAttribute('data-slot')}"]`,
            )
          }
        }
      }
    }
    fixture.remove()

    expect(leaks).toEqual([])

    // Positive control: the real table must still own the table geometry,
    // otherwise deleting every rule would also pass the leak assertion.
    const tableRules = styleRules(shared).filter(
      (rule) =>
        rule.selectorText.includes('.hf-data-table') && tableFixture.matches(rule.selectorText),
    )
    expect(
      tableRules.some((rule) => rule.style.getPropertyValue('border-collapse') === 'separate'),
    ).toBe(true)
    expect(tableRules.some((rule) => rule.style.getPropertyValue('font-size') === '0.875rem')).toBe(
      true,
    )
  })

  it('keeps focus indicators readable against both theme surfaces', () => {
    const themes = styleRules(foundation).filter((rule) =>
      rule.style.getPropertyValue('--hf-focus'),
    )
    expect(themes).toHaveLength(2)

    for (const theme of themes) {
      const focus = theme.style.getPropertyValue('--hf-focus').trim()
      const surface = theme.style.getPropertyValue('--hf-surface').trim()
      expect(contrast(focus, surface)).toBeGreaterThanOrEqual(3)
    }

    expect(
      styleRules(shared).some((rule) =>
        rule.style.getPropertyValue('outline').includes('--hf-focus'),
      ),
    ).toBe(true)
  })
})

describe('Products pilot adapter', () => {
  it('imports the shared adapter and scopes every rule to .products-visual', () => {
    expect(products).toMatch(/@import\s+['"][^'"]*houndfe-ui\.css['"]/)
    expect(products).not.toContain('!important')
    expect(products).not.toContain('coco-')
    expect(products).not.toMatch(/#[0-9a-fA-F]{3,8}/)

    for (const selector of selectorsOf(products)) {
      expect(selector).toContain('.products-visual')
    }
    expect(selectorsOf(products).some((selector) => selector.includes('.products-card-grid'))).toBe(
      true,
    )
  })

  it('paints a single visible field boundary on the select trigger', () => {
    const rules = styleRules(products)
    // `.products-select` never reaches the DOM; an inert wrapper rule would
    // suggest a second field box that does not exist.
    expect(exactRule(products, '.products-visual .products-select')).toBeUndefined()

    const trigger = rules.find(
      (rule) =>
        rule.selectorText.includes('.products-select-trigger') &&
        !rule.selectorText.includes(':focus-visible'),
    )!
    expect(trigger.style.getPropertyValue('border')).toContain('--hf-field-border')
    expect(trigger.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')

    const focus = rules.find(
      (rule) =>
        rule.selectorText.includes('.products-select-trigger') &&
        rule.selectorText.includes(':focus-visible'),
    )!
    expect(focus.style.getPropertyValue('outline')).toContain('--hf-focus')
  })

  it('overrides legacy focus and action colors only inside the pilot', () => {
    const rules = styleRules(products)
    const focus = rules.find(
      (rule) => rule.selectorText.trim() === '.products-visual .products-select-trigger:focus',
    )
    expect(focus).toBeDefined()
    expect(focus!.style.getPropertyValue('--tw-ring-color').trim()).toBe('var(--hf-focus)')
    const action = rules.find(
      (rule) => rule.selectorText.trim() === '.products-visual .products-select-action',
    )
    expect(action).toBeDefined()
    expect(action!.style.getPropertyValue('color').trim()).toBe('var(--hf-action)')
  })

  it('preserves the existing SAT field error border over the normal field border', () => {
    const error = styleRules(products).find(
      (rule) =>
        rule.selectorText.trim() === '.products-visual .products-select-trigger.border-error',
    )
    expect(error).toBeDefined()
    expect(error!.style.getPropertyValue('border-color').trim()).toBe('var(--ui-error)')
  })

  it('restrains the legacy radius ramp inside the pilot without flattening circles', () => {
    const scope = exactRule(products, '.products-visual')!
    expect(scope).toBeDefined()
    expect(scope.style.getPropertyValue('--radius-xl').trim()).not.toBe('')
    expect(scope.style.getPropertyValue('--radius-lg').trim()).not.toBe('')
    // The legacy 28px `rounded-xl` must not survive inside Products.
    expect(scope.style.getPropertyValue('--radius-xl').trim()).not.toContain('28px')
    // Circles and avatars keep the legacy full radius.
    expect(scope.style.getPropertyValue('--radius-full')).toBe('')
  })

  it('balances the desktop toolbar into a search/actions row plus a filters row', () => {
    const toolbar = inMedia(products, '.products-visual .hf-toolbar')!
    expect(toolbar.style.getPropertyValue('display').trim()).toBe('grid')
    expect(toolbar.style.getPropertyValue('grid-template-columns').trim()).toContain(
      'minmax(0, 1fr)',
    )

    const searchRegion = inMedia(products, '.products-visual .hf-toolbar-search-region')!
    expect(searchRegion.style.getPropertyValue('display').trim()).toBe('contents')

    const search = inMedia(products, '.products-visual .hf-toolbar-search')!
    const actions = inMedia(products, '.products-visual .hf-toolbar-actions')!
    const filters = inMedia(products, '.products-visual .hf-toolbar-filters')!
    expect(search.style.getPropertyValue('grid-area').trim()).toMatch(/^1\s*\/\s*1$/)
    expect(actions.style.getPropertyValue('grid-area').trim()).toMatch(/^1\s*\/\s*2$/)
    expect(filters.style.getPropertyValue('grid-area').trim()).toMatch(/^2\s*\//)

    const controls = styleRules(products).find(
      (rule) =>
        rule.selectorText.includes('.hf-toolbar') &&
        rule.style.getPropertyValue('min-height').trim() === 'var(--hf-control-height)',
    )
    expect(controls).toBeDefined()
    expect(controls!.selectorText).toContain('button')

    // The grid must stay desktop-only: the shared mobile three-row stack must
    // not be replaced by an unscoped toolbar rule.
    expect(exactRule(products, '.products-visual .hf-toolbar')).toBeDefined()
    expect(topLevelRule(products, '.products-visual .hf-toolbar')).toBeUndefined()
    expect(inMedia(products, '.products-visual .hf-toolbar')).toBeDefined()
  })

  it('keeps the segmented view toggle intact so its labels never truncate', () => {
    const toggle = exactRule(products, '.products-visual .products-view-toggle')!
    expect(toggle.style.getPropertyValue('flex-shrink').trim()).toBe('0')
    expect(toggle.style.getPropertyValue('width').trim()).toBe('auto')

    // The shared ViewToggle renders real `<button role="tab">` segments. Target
    // them with a fixture element so the selector is proven to reach the DOM.
    const scope = document.createElement('div')
    scope.className = 'products-visual'
    const tablist = document.createElement('div')
    tablist.className = 'products-view-toggle'
    tablist.setAttribute('role', 'tablist')
    const segment = document.createElement('button')
    segment.setAttribute('role', 'tab')
    segment.type = 'button'
    segment.textContent = 'Tarjetas'
    tablist.append(segment)
    scope.append(tablist)
    document.body.append(scope)

    const segmentRules = styleRules(products).filter(
      (rule) =>
        rule.selectorText.includes('.products-view-toggle') && segment.matches(rule.selectorText),
    )
    expect(segmentRules.length).toBeGreaterThan(0)
    expect(
      segmentRules.some((rule) => rule.style.getPropertyValue('white-space').trim() === 'nowrap'),
    ).toBe(true)
    expect(
      segmentRules.some(
        (rule) => rule.style.getPropertyValue('min-width').trim() === 'max-content',
      ),
    ).toBe(true)
    scope.remove()
  })

  it('compacts the pagination controls and keeps the summary on a single line', () => {
    const summary = exactRule(products, '.products-visual .hf-pagination-summary')!
    expect(summary.style.getPropertyValue('white-space').trim()).toBe('nowrap')

    const size = exactRule(products, '.products-visual .hf-pagination-size')!
    expect(size.style.getPropertyValue('width').trim()).toBe('auto')
    expect(size.style.getPropertyValue('min-height').trim()).toBe('36px')

    const navigation = exactRule(products, '.products-visual .hf-pagination-navigation')!
    expect(navigation.style.getPropertyValue('margin-inline-start').trim()).toBe('auto')

    // The shared pagination-controls wrapper keeps its own responsive layout.
    expect(
      styleRules(products).some((rule) => rule.selectorText.includes('pagination-controls')),
    ).toBe(false)

    // Footer navigation buttons stay compact like the page-size trigger, not
    // the 44px toolbar height.
    const navButtons = styleRules(products).find(
      (rule) =>
        rule.selectorText.includes('.hf-pagination-navigation') &&
        rule.selectorText.includes('button'),
    )
    expect(navButtons).toBeDefined()
    expect(navButtons!.style.getPropertyValue('min-height').trim()).toBe('36px')
  })

  it('applies the restrained radius to every product badge shell and leaves the dot alone', () => {
    const badge = exactRule(products, '.products-visual .products-badge')!
    expect(badge.style.getPropertyValue('width').trim()).toBe('fit-content')
    expect(badge.style.getPropertyValue('max-width').trim()).toBe('100%')
    expect(badge.style.getPropertyValue('border-radius').trim()).toBe('var(--hf-radius-control)')

    // A round leading dot does not require a pill-shaped shell: the DotBadge
    // and StatusDotBadge roots must match the same restrained rule.
    const scope = document.createElement('div')
    scope.className = 'products-visual'
    scope.innerHTML = `
      <span class="products-badge"></span>
      <span class="products-badge"><span class="rounded-full"></span></span>`
    document.body.append(scope)
    const [plain, pill] = Array.from(scope.querySelectorAll('.products-badge')) as HTMLElement[]
    expect(plain!.matches(badge.selectorText)).toBe(true)
    expect(pill!.matches(badge.selectorText)).toBe(true)

    // The circular child dot keeps its own shape; the adapter never restyles
    // avatars or dot indicators.
    expect(styleRules(products).some((rule) => rule.selectorText.includes('.rounded-full'))).toBe(
      false,
    )
    scope.remove()
  })

  it('stops a lone product card from stretching across the grid', () => {
    const grid = exactRule(products, '.products-visual .products-card-grid')!
    const columns = grid.style.getPropertyValue('grid-template-columns').trim()
    expect(columns).toContain('auto-fill')
    expect(columns).toContain('min(100%')
  })

  it('gives the empty state a soft tile, a larger title and vertical breathing room', () => {
    const state = exactRule(products, '.products-visual .products-empty-state')!
    // About 20rem of minimum vertical space gives the empty view reference
    // breathing room without a fixed height that could break small viewports.
    expect(Number.parseFloat(state.style.getPropertyValue('min-height'))).toBeGreaterThanOrEqual(18)
    expect(state.style.getPropertyValue('height')).toBe('')
    expect(state.style.getPropertyValue('padding-block').trim()).toBe('2rem')

    const icon = exactRule(products, '.products-visual .products-empty-icon')!
    expect(icon.style.getPropertyValue('background-color').trim()).toBe('var(--hf-active-soft)')
    expect(icon.style.getPropertyValue('color').trim()).toBe('var(--hf-heading)')
    expect(icon.style.getPropertyValue('border-radius').trim()).toContain('--hf-radius')
    expect(Number.parseFloat(icon.style.getPropertyValue('width'))).toBeCloseTo(3.5, 5)
    expect(Number.parseFloat(icon.style.getPropertyValue('height'))).toBeCloseTo(3.5, 5)

    const title = exactRule(products, '.products-visual .products-empty-title')!
    expect(Number.parseFloat(title.style.getPropertyValue('font-size'))).toBeCloseTo(1.125, 5)
    expect(['500', '600']).toContain(title.style.getPropertyValue('font-weight').trim())
    expect(title.style.getPropertyValue('color').trim()).toBe('var(--hf-heading)')

    const description = exactRule(products, '.products-visual .products-empty-description')!
    expect(description.style.getPropertyValue('color').trim()).toBe('var(--hf-muted)')
    expect(description.style.getPropertyValue('max-width').trim()).toBe('42ch')

    // The glyph inside the tile must actually read as heading-colored; the
    // unit's own `text-muted` utility must be overridden by the scoped tile.
    const scope = document.createElement('div')
    scope.className = 'products-visual'
    const tile = document.createElement('div')
    tile.className = 'products-empty-icon'
    const glyph = document.createElement('span')
    glyph.className = 'text-muted'
    tile.append(glyph)
    scope.append(tile)
    document.body.append(scope)
    const glyphRules = styleRules(products).filter(
      (rule) =>
        rule.selectorText.includes('.products-empty-icon') && glyph.matches(rule.selectorText),
    )
    expect(
      glyphRules.some(
        (rule) =>
          rule.style.getPropertyValue('color').trim() === 'inherit' ||
          rule.style.getPropertyValue('color').trim() === 'var(--hf-heading)',
      ),
    ).toBe(true)
    scope.remove()
  })

  it('themes product cards with foundation tokens and keeps operational controls operable', () => {
    const rules = styleRules(products)
    const card = rules.find((rule) => rule.selectorText.trim().endsWith('.products-card'))!
    expect(card.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    expect(card.style.getPropertyValue('border')).toContain('--hf-border')
    expect(card.style.getPropertyValue('border-radius').trim()).toBe('var(--hf-radius-card)')

    const primary = rules.find((rule) => rule.selectorText.includes('.hf-primary-control'))!
    expect(primary.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')
  })
})
