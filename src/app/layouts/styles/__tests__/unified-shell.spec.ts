import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Source-contract tests for the unified application shell stylesheet.
 *
 * These inspect the real local stylesheet with a CSS parser. They prove the
 * shell palette, hook ownership and the anti-leak boundary at the source
 * level. They are NOT rendered visual proof and cannot establish light/dark
 * fidelity, motion or touch ergonomics; rendered smoke remains user-owned.
 *
 * The suite intentionally reads the file through `existsSync` so a missing
 * stylesheet reports as ordinary assertion failures instead of a collection
 * crash, which keeps the RED phase meaningful.
 */
const SHELL_PATH = 'src/app/layouts/styles/unified-shell.css'
const shell = existsSync(SHELL_PATH) ? readFileSync(SHELL_PATH, 'utf8') : ''

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

function selectorsOf(source: string): string[] {
  return styleRules(source).flatMap((rule) => splitTopLevel(rule.selectorText))
}

function exactRule(source: string, selector: string): CSSStyleRule | undefined {
  return styleRules(source).find((rule) => rule.selectorText.trim() === selector)
}

/** Every rule that declares a non-empty value for a custom property. */
function declaring(source: string, property: string): CSSStyleRule[] {
  return styleRules(source).filter((rule) => rule.style.getPropertyValue(property).trim() !== '')
}

function propertyNames(rule: CSSStyleRule): string[] {
  const names: string[] = []
  for (let index = 0; index < rule.style.length; index += 1) {
    const name = rule.style.item(index)
    if (name) names.push(name)
  }
  return names
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

/** The single palette rule that declares `--shell-page`. */
function paletteRule(): CSSStyleRule | undefined {
  return declaring(shell, '--shell-page')[0]
}

function token(rule: CSSStyleRule | undefined, name: string): string {
  return (rule?.style.getPropertyValue(name).trim() ?? '').toLowerCase()
}

/** True when any selector of `rule` matches the real DOM element. */
function matchesAny(rule: CSSStyleRule, element: Element): boolean {
  return splitTopLevel(rule.selectorText).some((selector) => element.matches(selector))
}

/** A real `.hf-shell` root class token (never the `.hf-shell-*` hooks). */
const SHELL_ROOT_ANCESTOR = /(^|[\s>+~])\.hf-shell(?![\w-])/

/** The shell names are aliases of the foundation roles: one palette, never hex. */
const ALIASES: Record<string, string> = {
  '--shell-page': 'var(--hf-page)',
  '--shell-chrome': 'var(--hf-surface)',
  '--shell-card': 'var(--hf-surface)',
  '--shell-ink': 'var(--hf-ink)',
  '--shell-muted': 'var(--hf-muted)',
  '--shell-border': 'var(--hf-border)',
  '--shell-muted-surface': 'var(--hf-surface-muted)',
  '--shell-action': 'var(--hf-action)',
  '--shell-active': 'var(--hf-active-soft)',
  '--shell-on-action': 'var(--hf-on-action)',
}

const GEOMETRY: Record<string, string> = {
  '--shell-radius-control': '6px',
  '--shell-radius-panel': '12px',
  '--shell-radius-tenant': '8px',
}

const FOUNDATION_PATH = 'src/core/shared/design-system/houndfe-theme.css'
const foundation = readFileSync(FOUNDATION_PATH, 'utf8')

/** `--hf-*` values of the light (`.hf-theme`) or dark (`.dark .hf-theme`) foundation block. */
function foundationRoles(dark: boolean): Record<string, string> {
  const marker = dark ? '.dark .hf-theme,' : '.hf-theme,'
  const start = foundation.indexOf(marker)
  const body = foundation.slice(foundation.indexOf('{', start) + 1, foundation.indexOf('}', start))
  const roles: Record<string, string> = {}
  for (const match of body.matchAll(/(--hf-[\w-]+):\s*([^;]+);/g)) roles[match[1]!] = match[2]!.trim()
  return roles
}

const CONTRACT_HOOKS = [
  'hf-shell-sidebar',
  'hf-shell-nav-portal',
  'hf-shell-brand',
  'hf-shell-tenant',
  'hf-shell-search',
  'hf-shell-nav',
  'hf-shell-footer',
  'hf-shell-user',
  'hf-shell-navbar',
  'hf-shell-breadcrumb',
  'hf-shell-actions',
  'hf-shell-workspace',
  'hf-shell-portal',
]

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

describe('unified shell stylesheet boundaries', () => {
  it('ships a non-empty sheet scoped to the shell and free of Caja tokens', () => {
    expect(shell).not.toBe('')
    expect(shell).not.toMatch(/coco-/)
    expect(shell).not.toContain('!important')
    expect(selectorsOf(shell).length).toBeGreaterThan(0)
    // Every selector is shell-scoped; nothing here is global.
    for (const selector of selectorsOf(shell)) {
      expect(selector).toContain('.hf-shell')
    }
  })

  it('defines every contracted hook', () => {
    const all = selectorsOf(shell).join(' ')
    for (const hook of CONTRACT_HOOKS) {
      expect(all, `missing .${hook}`).toContain(`.${hook}`)
    }
    expect(selectorsOf(shell).some((selector) => selector.trim() === '.hf-shell')).toBe(true)
  })

  it('never blanket-leaks a root .hf-shell element or slot selector into routed pages', () => {
    // `.hf-shell button`, `.hf-shell input`, `.hf-shell [data-slot=...]` style
    // selectors would restyle every routed control. Only the bare root, a
    // `.hf-shell-*` hook may follow `.hf-shell`.
    for (const selector of selectorsOf(shell)) {
      const bareRoot =
        selector
          .trim()
          .replace(/^\.dark\s+/, '')
          .trim() === '.hf-shell'
      const allowed = bareRoot || selector.includes('.hf-shell-')
      expect(allowed, `unsafe shell selector: ${selector}`).toBe(true)
    }
  })

  it('consumes --shell-* only from shell hooks', () => {
    for (const rule of styleRules(shell)) {
      const consumes = propertyNames(rule).some((name) =>
        (rule.style.getPropertyValue(name) ?? '').includes('var(--shell-'),
      )
      if (!consumes) continue
      for (const selector of splitTopLevel(rule.selectorText)) {
        const allowed = selector.includes('.hf-shell-')
        expect(allowed, `global --shell-* consumer: ${selector}`).toBe(true)
      }
    }
  })

  it('keeps --ui-* aliases out of the shell root and inside .hf-shell-portal only', () => {
    const aliasPrefixes = ['--ui-', '--text-color-', '--background-color-', '--border-color-']
    const rootRules = styleRules(shell).filter((rule) =>
      splitTopLevel(rule.selectorText).includes('.hf-shell'),
    )
    expect(rootRules.length).toBeGreaterThan(0)
    for (const rule of rootRules) {
      for (const name of propertyNames(rule)) {
        expect(
          aliasPrefixes.some((prefix) => name.startsWith(prefix)),
          `shell root must not remap ${name}`,
        ).toBe(false)
      }
    }

    const portal = styleRules(shell).find(
      (rule) =>
        splitTopLevel(rule.selectorText).includes('.hf-shell-portal') &&
        rule.style.getPropertyValue('--ui-primary').trim() !== '',
    )
    expect(portal).toBeDefined()
    expect(portal!.style.getPropertyValue('--ui-primary').trim()).toBe('var(--shell-action)')
    expect(portal!.style.getPropertyValue('--ui-bg').trim()).toBe('var(--shell-card)')
    expect(portal!.style.getPropertyValue('--ui-text').trim()).toBe('var(--shell-ink)')
    expect(portal!.style.getPropertyValue('--ui-border').trim()).toBe('var(--shell-border)')
    expect(portal!.style.getPropertyValue('background-color').trim()).toBe('var(--shell-card)')
    expect(portal!.style.getPropertyValue('font-family').trim()).toContain('--shell-font')
  })
})

describe('unified shell palette', () => {
  it('aliases every shell role to a foundation role, on root, portal and toast, in one rule', () => {
    const rule = paletteRule()
    expect(rule, 'a palette rule declaring --shell-page must exist').toBeDefined()
    for (const [name, value] of Object.entries({ ...ALIASES, ...GEOMETRY })) {
      expect(token(rule, name), name).toBe(value)
    }
    const selectors = splitTopLevel(rule!.selectorText)
    for (const selector of ['.hf-shell', '.hf-shell-portal', '.hf-shell-toast']) {
      expect(selectors, selector).toContain(selector)
    }
  })

  it('has no second palette: no hex in the shell, no .dark palette branch, no retired table-head token', () => {
    const code = shell.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/#[\da-f]{3,8}\b/i)
    expect(declaring(shell, '--shell-page')).toHaveLength(1)
    expect(code).not.toMatch(/--shell-table-head/)
    expect(code).not.toMatch(/\.dark\b[^{]*\{[^}]*--shell-(page|card|ink)/)
  })

  it('keeps the alias targets in the foundation, in both themes', () => {
    for (const dark of [false, true]) {
      const roles = foundationRoles(dark)
      for (const value of Object.values(ALIASES)) {
        const role = value.replace(/^var\((--hf-[\w-]+)\)$/, '$1')
        expect(roles[role], `${role} (${dark ? 'dark' : 'light'})`).toBeTruthy()
      }
    }
  })

  it('keeps text and state colors at accessible contrast in both themes, through the foundation roles', () => {
    for (const dark of [false, true]) {
      const roles = foundationRoles(dark)
      const label = dark ? 'dark' : 'light'
      const get = (shellName: string) => roles[ALIASES[shellName]!.replace(/^var\((.+)\)$/, '$1')]!.toLowerCase()
      expect(contrast(get('--shell-ink'), get('--shell-page')), `${label} ink/page`).toBeGreaterThanOrEqual(7)
      expect(contrast(get('--shell-ink'), get('--shell-card')), `${label} ink/card`).toBeGreaterThanOrEqual(7)
      expect(contrast(get('--shell-muted'), get('--shell-card')), `${label} muted/card`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(get('--shell-action'), get('--shell-active')), `${label} action/active`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(get('--shell-on-action'), get('--shell-action')), `${label} on-action/action`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('unified shell geometry', () => {
  it('matches the reference chrome: navbar 65px desktop / 60px mobile and brand 76px', () => {
    const navbar = exactRule(shell, '.hf-shell-navbar')
    expect(navbar).toBeDefined()
    expect(navbar!.style.getPropertyValue('height').trim()).toBe('65px')
    expect(navbar!.style.getPropertyValue('background-color').trim()).toBe('var(--shell-chrome)')

    const mobile = rulesInMedia(shell, 'max-width: 700px').find(
      (rule) => rule.selectorText.trim() === '.hf-shell-navbar',
    )
    expect(mobile).toBeDefined()
    expect(mobile!.style.getPropertyValue('height').trim()).toBe('60px')

    const brand = exactRule(shell, '.hf-shell-brand')
    expect(brand).toBeDefined()
    expect(brand!.style.getPropertyValue('height').trim()).toBe('76px')
  })

  it('keeps the reference nav row rhythm at 35px, 38px on tall viewports', () => {
    const row = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        /\bdata-slot=['"]link['"]/.test(rule.selectorText) &&
        rule.style.getPropertyValue('min-height').trim() === 'var(--shell-row)',
    )
    expect(row, 'nav link rows must use the 35px row token').toBeDefined()

    const rowToken = declaring(shell, '--shell-row').find(
      (candidate) => !/\.dark\b/.test(candidate.selectorText),
    )
    expect(rowToken, '--shell-row must be declared').toBeDefined()
    expect(token(rowToken, '--shell-row')).toBe('35px')

    const tall = rulesInMedia(shell, 'min-height: 950px').find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        rule.style.getPropertyValue('min-height').trim() === 'var(--shell-row-tall)',
    )
    expect(tall, 'nav link rows must grow on tall viewports').toBeDefined()

    const tallToken = declaring(shell, '--shell-row-tall').find(
      (candidate) => !/\.dark\b/.test(candidate.selectorText),
    )
    expect(tallToken, '--shell-row-tall must be declared').toBeDefined()
    expect(token(tallToken, '--shell-row-tall')).toBe('38px')
  })

  it('uses control 6px, panel 12px and tenant 8px corners through the hooks', () => {
    const radii = {
      '--shell-radius-control': '6px',
      '--shell-radius-panel': '12px',
      '--shell-radius-tenant': '8px',
    }
    for (const [name, value] of Object.entries(radii)) {
      const rule = declaring(shell, name).find(
        (candidate) => !/\.dark\b/.test(candidate.selectorText),
      )
      expect(rule, `${name} must be declared`).toBeDefined()
      expect(token(rule, name)).toBe(value)
    }

    expect(shell).not.toContain('hf-shell-panel')

    const tenant = exactRule(shell, '.hf-shell-tenant')
    expect(tenant).toBeDefined()
    expect(tenant!.style.getPropertyValue('border-radius').trim()).toBe(
      'var(--shell-radius-tenant)',
    )
    expect(tenant!.style.getPropertyValue('background-color').trim()).toBe('var(--shell-card)')
  })

  it('never hard-overrides the resizable sidebar width', () => {
    const sidebarRules = styleRules(shell).filter(
      (rule) => rule.selectorText.trim() === '.hf-shell-sidebar',
    )
    expect(sidebarRules.length).toBeGreaterThan(0)
    for (const rule of sidebarRules) {
      expect(rule.style.getPropertyValue('width').trim()).toBe('')
      expect(rule.style.getPropertyValue('min-width').trim()).toBe('')
      expect(rule.style.getPropertyValue('max-width').trim()).toBe('')
    }
  })

  it('gives the workspace only a background, never routed controls', () => {
    const workspace = exactRule(shell, '.hf-shell-workspace')
    expect(workspace).toBeDefined()
    expect(workspace!.style.getPropertyValue('background-color').trim()).toBe('var(--shell-page)')
    for (const selector of selectorsOf(shell)) {
      if (!selector.includes('.hf-shell-workspace')) continue
      expect(selector).not.toMatch(/\b(?:button|input|select|textarea)\b/)
    }
  })
})

describe('unified shell nav states', () => {
  it('provides a readable active nav state bounded to the nav hook', () => {
    const active = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        /\bdata-slot=['"]link['"]/.test(rule.selectorText) &&
        rule.style.getPropertyValue('background-color').trim() === 'var(--shell-active)',
    )
    expect(active).toBeDefined()
    expect(active!.style.getPropertyValue('color').trim()).toBe('var(--shell-action)')
    expect(active!.style.getPropertyValue('font-weight').trim()).toBe('600')
    // Hover, not just the resting state, must also stay bound to the hook.
    expect(
      styleRules(shell).some(
        (rule) =>
          rule.selectorText.includes('.hf-shell-nav') &&
          rule.selectorText.includes(':hover') &&
          rule.style.getPropertyValue('background-color').trim() === 'var(--shell-muted-surface)',
      ),
    ).toBe(true)
  })

  it('has no Products-only palette bridge: the --hf-* roles are never remapped onto the shell', () => {
    expect(shell).not.toMatch(/products-visual|products-portal/)
    for (const rule of styleRules(shell)) {
      for (const name of propertyNames(rule)) {
        expect(name.startsWith('--hf-'), `${rule.selectorText} remaps ${name}`).toBe(false)
      }
    }
    expect(shell).not.toMatch(/--coco-/)
  })
})

describe('shell selector boundary detector (triangulation)', () => {
  // The boundary test above is only meaningful if its predicate rejects real
  // violations. These cases pin the detector itself, not the stylesheet.
  const isSafeShellSelector = (selector: string): boolean => {
    const bareRoot =
      selector
        .trim()
        .replace(/^\.dark\s+/, '')
        .trim() === '.hf-shell'
    return bareRoot || selector.includes('.hf-shell-')
  }

  it('rejects blanket root selectors that would leak into routed pages', () => {
    expect(isSafeShellSelector('.hf-shell')).toBe(true)
    expect(isSafeShellSelector('.dark .hf-shell')).toBe(true)
    expect(isSafeShellSelector('.hf-shell-sidebar [data-slot="body"]')).toBe(true)
    expect(isSafeShellSelector('.hf-shell .products-visual')).toBe(false)
    expect(isSafeShellSelector(".hf-shell-nav-portal [data-slot='childLink']")).toBe(true)
    expect(isSafeShellSelector('.hf-ui')).toBe(false)
    expect(isSafeShellSelector('.hf-theme.hf-ui')).toBe(false)
    expect(isSafeShellSelector('.hf-shell button')).toBe(false)
    expect(isSafeShellSelector('.hf-shell input')).toBe(false)
    expect(isSafeShellSelector(".hf-shell [data-slot='base']")).toBe(false)
    expect(isSafeShellSelector('.hf-shell :where(input, select)')).toBe(false)
  })

  it('rejects global --shell-* consumers outside a hook', () => {
    const isAllowedConsumer = (selector: string): boolean => selector.includes('.hf-shell-')
    expect(isAllowedConsumer('.hf-shell-navbar')).toBe(true)
    expect(isAllowedConsumer('.dark .hf-shell .products-visual')).toBe(false)
    expect(isAllowedConsumer('body')).toBe(false)
    expect(isAllowedConsumer(':root')).toBe(false)
    expect(isAllowedConsumer('.hf-shell')).toBe(false)
  })
})

describe('compact rail, group hierarchy and shell token scoping', () => {
  const attrIs = (rule: CSSStyleRule, name: string, value: string) =>
    new RegExp(`\\[${name}=['"]${value}['"]\\]`).test(rule.selectorText)

  const find = (predicate: (rule: CSSStyleRule) => boolean) => styleRules(shell).find(predicate)

  it('centers the brand mark in the 76px rail and drops the layout gap', () => {
    const brand = find(
      (rule) =>
        attrIs(rule, 'data-collapsed', 'true') && rule.selectorText.includes('.hf-shell-brand'),
    )
    expect(brand).toBeDefined()
    expect(Number.parseFloat(brand!.style.getPropertyValue('padding'))).toBe(0)
    expect(brand!.style.getPropertyValue('justify-content').trim()).toBe('center')
    expect(Number.parseFloat(brand!.style.getPropertyValue('gap'))).toBe(0)
  })

  it('fits the compact tenant inside the 76px rail', () => {
    const wrapper = find(
      (rule) =>
        rule.selectorText.includes(':has(') && rule.selectorText.includes('.hf-shell-tenant'),
    )
    expect(wrapper).toBeDefined()
    expect(wrapper!.style.getPropertyValue('padding-inline').trim()).toBe('14px')

    const tenant = find(
      (rule) =>
        attrIs(rule, 'data-collapsed', 'true') &&
        rule.selectorText.includes('.hf-shell-tenant') &&
        rule.style.getPropertyValue('justify-content').trim() === 'center',
    )
    expect(tenant).toBeDefined()
    const padding = Number.parseFloat(tenant!.style.getPropertyValue('padding'))
    // 76px rail - 2*14px wrapper - 2px border - 2*padding must still fit a 32px avatar.
    expect(76 - 28 - 2 - 2 * padding).toBeGreaterThanOrEqual(32)
  })

  it('centers the compact search and keeps the nav rail inside 14px gutters', () => {
    const search = find(
      (rule) =>
        attrIs(rule, 'data-collapsed', 'true') &&
        rule.selectorText.includes('.hf-shell-search') &&
        rule.style.getPropertyValue('justify-content').trim() === 'center',
    )
    expect(search).toBeDefined()

    const nav = find(
      (rule) =>
        attrIs(rule, 'data-collapsed', 'true') &&
        rule.selectorText.includes('.hf-shell-nav') &&
        rule.style.getPropertyValue('padding-inline').trim() === '14px',
    )
    expect(nav).toBeDefined()

    const row = find(
      (rule) =>
        attrIs(rule, 'data-collapsed', 'true') &&
        rule.selectorText.includes('.hf-shell-nav') &&
        /data-slot=['"]link['"]/.test(rule.selectorText) &&
        rule.style.getPropertyValue('justify-content').trim() === 'center',
    )
    expect(row).toBeDefined()
  })

  it('pins the sidebar footer to the bottom of a bounded body column', () => {
    const body = find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-sidebar') && attrIs(rule, 'data-slot', 'body'),
    )
    expect(body).toBeDefined()
    expect(body!.style.getPropertyValue('display').trim()).toBe('flex')
    expect(body!.style.getPropertyValue('flex-direction').trim()).toBe('column')
    expect(body!.style.getPropertyValue('flex-grow').trim()).toBe('1')
    expect(Number.parseFloat(body!.style.getPropertyValue('min-height'))).toBe(0)
    expect(body!.style.getPropertyValue('overflow').trim()).toBe('hidden')

    const nav = exactRule(shell, '.hf-shell-nav')
    expect(nav!.style.getPropertyValue('flex-grow').trim()).toBe('1')
    expect(Number.parseFloat(nav!.style.getPropertyValue('min-height'))).toBe(0)

    const footer = find(
      (rule) =>
        attrIs(rule, 'data-collapsed', 'true') &&
        rule.selectorText.includes('.hf-shell-footer') &&
        rule.style.getPropertyValue('justify-content').trim() === 'center',
    )
    expect(footer).toBeDefined()
  })

  it('treats group headings as quiet labels, never a competing selection', () => {
    const heading = find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        rule.selectorText.includes('[aria-expanded') &&
        rule.style.getPropertyValue('font-size').trim() === '12px',
    )
    expect(heading).toBeDefined()
    expect(heading!.style.getPropertyValue('color').trim()).toBe('var(--shell-muted)')
    expect(heading!.style.getPropertyValue('font-weight').trim()).toBe('600')
    expect(heading!.style.getPropertyValue('letter-spacing').trim()).toBe('')
    expect(heading!.style.getPropertyValue('text-transform').trim()).toBe('')
    // The reference group label is shorter than a destination row.
    expect(['0', '0px']).toContain(heading!.style.getPropertyValue('min-height').trim())

    const neutralized = find(
      (rule) =>
        rule.selectorText.includes('[aria-expanded') &&
        rule.selectorText.includes('.hf-shell-nav-active') &&
        rule.style.getPropertyValue('background-color').trim() === 'transparent',
    )
    expect(neutralized).toBeDefined()
    expect(neutralized!.style.getPropertyValue('background-color').trim()).toBe('transparent')
    expect(neutralized!.style.getPropertyValue('color').trim()).toBe('var(--shell-muted)')
  })

  it('hides expanded group leading icons but keeps them in the compact rail', () => {
    const hidden = find(
      (rule) =>
        rule.selectorText.includes(':not([data-collapsed') &&
        /data-slot=['"]linkLeadingIcon['"]/.test(rule.selectorText) &&
        rule.style.getPropertyValue('display').trim() === 'none',
    )
    expect(hidden).toBeDefined()
  })

  it('neutralizes the native vertical accordion indent and rail', () => {
    const childList = find((rule) => attrIs(rule, 'data-slot', 'childList'))
    expect(childList).toBeDefined()
    expect(Number.parseFloat(childList!.style.getPropertyValue('margin-inline-start'))).toBe(0)
    expect(Number.parseFloat(childList!.style.getPropertyValue('border-inline-start')) || 0).toBe(0)

    const childItem = find((rule) => attrIs(rule, 'data-slot', 'childItem'))
    expect(childItem).toBeDefined()
    expect(Number.parseFloat(childItem!.style.getPropertyValue('margin-inline-start'))).toBe(0)
    expect(Number.parseFloat(childItem!.style.getPropertyValue('padding-inline-start'))).toBe(0)
  })

  it('marks the selected destination with the reference dot', () => {
    const dot = find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav-active') &&
        rule.selectorText.includes('::after') &&
        /^["']{2}$/.test(rule.style.getPropertyValue('content').trim()),
    )
    expect(dot).toBeDefined()
    expect(dot!.style.getPropertyValue('width').trim()).toBe('5px')
    expect(dot!.style.getPropertyValue('height').trim()).toBe('5px')
    expect(dot!.style.getPropertyValue('border-radius').trim()).toBe('50%')
    expect(dot!.style.getPropertyValue('background-color').trim()).toBe('var(--shell-action)')
  })

  it('recolors shell icons and the tenant slug from explicit shell tokens', () => {
    const icon = find(
      (rule) =>
        /data-slot=['"]leadingIcon['"]/.test(rule.selectorText) &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-muted)',
    )
    expect(icon).toBeDefined()
    expect(icon!.selectorText.includes('.hf-shell-')).toBe(true)

    const slug = find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-tenant') &&
        rule.selectorText.includes('small') &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-muted)',
    )
    expect(slug).toBeDefined()
  })

  it('keeps navbar icon buttons at 32px while the native mobile trigger stays 44px', () => {
    const buttons = find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-actions') &&
        rule.selectorText.includes('button') &&
        rule.style.getPropertyValue('width').trim() === '32px' &&
        rule.style.getPropertyValue('height').trim() === '32px',
    )
    expect(buttons).toBeDefined()

    const toggle = find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-navbar') &&
        attrIs(rule, 'data-slot', 'toggle') &&
        rule.style.getPropertyValue('width').trim() === '44px' &&
        rule.style.getPropertyValue('height').trim() === '44px',
    )
    expect(toggle).toBeDefined()
  })
})

describe('compact nav portal rows and icon roles', () => {
  /** The real installed compact popover subtree (`UPopover` content). */
  function mountCompactPortal(): HTMLElement {
    const portal = document.createElement('div')
    portal.className = 'hf-shell-portal hf-shell-nav-portal'
    portal.innerHTML = `
      <ul data-slot="childList">
        <li data-slot="childLabel">Productos</li>
        <li data-slot="childItem">
          <a data-slot="childLink" class="group relative size-full flex items-start text-start text-sm">
            <span data-slot="childLinkIcon" class="size-5 shrink-0 text-dimmed transition-colors"></span>
            <span data-slot="childLinkLabel" class="truncate">Listado</span>
          </a>
        </li>
        <li data-slot="childItem">
          <a data-slot="childLink" class="hf-shell-nav-active group relative size-full flex items-start text-start text-sm text-highlighted">
            <span data-slot="childLinkIcon" class="size-5 shrink-0 text-default"></span>
            <span data-slot="childLinkLabel" class="truncate">Nuevo</span>
          </a>
        </li>
      </ul>`
    document.body.append(portal)
    return portal
  }

  it('styles teleported childLink rows for rest, hover and active states', () => {
    const portal = mountCompactPortal()
    const rows = portal.querySelectorAll('[data-slot="childLink"]')
    expect(rows).toHaveLength(2)

    const rest = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('hf-shell-nav-portal') &&
        /data-slot=['"]childLink['"]/.test(rule.selectorText) &&
        !rule.selectorText.includes(':hover') &&
        !rule.selectorText.includes('.hf-shell-nav-active') &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-muted)',
    )
    expect(rest, 'compact portal childLink rest rule').toBeDefined()
    expect(rest!.style.getPropertyValue('border-radius').trim()).toBe('var(--shell-radius-control)')
    expect(matchesAny(rest!, rows[0]!)).toBe(true)

    const hover = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('hf-shell-nav-portal') &&
        /data-slot=['"]childLink['"]/.test(rule.selectorText) &&
        rule.selectorText.includes(':hover') &&
        rule.style.getPropertyValue('background-color').trim() === 'var(--shell-muted-surface)',
    )
    expect(hover, 'compact portal childLink hover rule').toBeDefined()
    expect(hover!.style.getPropertyValue('color').trim()).toBe('var(--shell-ink)')

    const active = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('hf-shell-nav-portal') &&
        rule.selectorText.includes('.hf-shell-nav-active') &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-action)',
    )
    expect(active, 'compact portal active childLink rule').toBeDefined()
    expect(matchesAny(active!, rows[1]!)).toBe(true)

    // Nothing in the teleported popover may depend on a real `.hf-shell` root.
    for (const selector of selectorsOf(shell).filter((value) =>
      value.includes('hf-shell-nav-portal'),
    )) {
      expect(selector, `nav portal selector relies on .hf-shell: ${selector}`).not.toMatch(
        SHELL_ROOT_ANCESTOR,
      )
    }
    portal.remove()
  })

  it('paints linkLeadingIcon roles inside the nav hook and the compact portal', () => {
    const navLeading = /data-slot=['"]linkLeadingIcon['"]/
    const portalLeading = /data-slot=['"](?:childLinkIcon|linkLeadingIcon)['"]/

    const navRest = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        navLeading.test(rule.selectorText) &&
        !rule.selectorText.includes(':hover') &&
        !rule.selectorText.includes('.hf-shell-nav-active') &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-muted)',
    )
    expect(navRest, 'nav resting link icon paint').toBeDefined()

    const navHover = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        navLeading.test(rule.selectorText) &&
        rule.selectorText.includes(':hover') &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-ink)',
    )
    expect(navHover, 'nav hover link icon paint').toBeDefined()

    const navActive = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        rule.selectorText.includes('.hf-shell-nav-active') &&
        navLeading.test(rule.selectorText) &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-action)',
    )
    expect(navActive, 'nav active link icon paint').toBeDefined()

    const portalRest = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('hf-shell-nav-portal') &&
        portalLeading.test(rule.selectorText) &&
        !rule.selectorText.includes(':hover') &&
        !rule.selectorText.includes('.hf-shell-nav-active') &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-muted)',
    )
    expect(portalRest, 'portal resting icon paint').toBeDefined()

    const portalHover = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('hf-shell-nav-portal') &&
        portalLeading.test(rule.selectorText) &&
        rule.selectorText.includes(':hover') &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-ink)',
    )
    expect(portalHover, 'portal hover icon paint').toBeDefined()

    const portalActive = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('hf-shell-nav-portal') &&
        portalLeading.test(rule.selectorText) &&
        rule.selectorText.includes('.hf-shell-nav-active') &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-action)',
    )
    expect(portalActive, 'portal active icon paint').toBeDefined()

    // The real icon element carries the Nuxt `text-dimmed`/`text-default`
    // utilities. The shell rule targets the icon node itself, so the explicit
    // utility color cannot keep the Coco hue by beating an inherited link color.
    const portal = mountCompactPortal()
    const restingIcon = portal.querySelector('[data-slot="childLinkIcon"]')!
    expect(restingIcon.className).toContain('text-dimmed')
    expect(matchesAny(portalRest!, restingIcon)).toBe(true)
    expect(matchesAny(navRest!, restingIcon)).toBe(false)
    portal.remove()
  })

  it('keeps the quiet group-heading icon muted while the selected destination uses the action paint', () => {
    const rules = styleRules(shell)
    const destination = rules.find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        rule.selectorText.includes('.hf-shell-nav-active') &&
        /data-slot=['"]linkLeadingIcon['"]/.test(rule.selectorText) &&
        !rule.selectorText.includes('[aria-expanded') &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-action)',
    )
    expect(destination, 'selected destination icon uses the action paint').toBeDefined()

    const heading = rules.find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        rule.selectorText.includes('[aria-expanded') &&
        rule.selectorText.includes('.hf-shell-nav-active') &&
        /data-slot=['"]linkLeadingIcon['"]/.test(rule.selectorText) &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-muted)',
    )
    expect(heading, 'quiet group heading icon stays muted').toBeDefined()
    // Equal specificity: the quiet heading rule must come after the action rule.
    expect(rules.indexOf(heading!)).toBeGreaterThan(rules.indexOf(destination!))

    // Real installed row: a group heading that also carries the active item
    // class (a child is the selected destination).
    const nav = document.createElement('div')
    nav.className = 'hf-shell-nav'
    nav.innerHTML = `
      <a data-slot="link" class="hf-shell-nav-active" aria-expanded="true" data-state="open">
        <span data-slot="linkLeadingIcon" class="size-5 shrink-0 text-primary"></span>
        <span data-slot="linkLabel">Catálogo</span>
      </a>`
    document.body.append(nav)
    const icon = nav.querySelector('[data-slot="linkLeadingIcon"]')!
    expect(matchesAny(heading!, icon)).toBe(true)
    nav.remove()
  })
})

describe('T7 corrections: active group hover, search trigger and brand logo', () => {
  /** Match an element against a selector whose dynamic pseudo-classes are
   * stripped. jsdom never reports `:hover` as matching, so the paint rules are
   * validated on their stable part (`.hf-shell-nav-active`, `[aria-expanded]`). */
  const matchesPaintSelector = (rule: CSSStyleRule, element: Element): boolean =>
    splitTopLevel(rule.selectorText).some((selector) => {
      const stable = selector.replace(/:(?:hover|focus-visible)/g, '')
      return element.matches(stable)
    })

  function mountSelectedGroupHeading(): HTMLElement {
    const nav = document.createElement('div')
    nav.className = 'hf-shell-nav'
    nav.innerHTML = `
      <a data-slot="link" class="hf-shell-nav-active" aria-expanded="true" data-state="open">
        <span data-slot="linkLeadingIcon" class="size-5 shrink-0"></span>
        <span data-slot="linkLabel">Catálogo</span>
      </a>`
    document.body.append(nav)
    return nav
  }

  it('paints hover on the selected group heading and keeps the default quiet', () => {
    const rules = styleRules(shell)
    const quiet = rules.find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        rule.selectorText.includes('[aria-expanded') &&
        rule.selectorText.includes('.hf-shell-nav-active') &&
        !rule.selectorText.includes(':hover') &&
        rule.style.getPropertyValue('background-color').trim() === 'transparent' &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-muted)',
    )
    expect(quiet, 'default selected group heading must stay quiet').toBeDefined()

    const hover = rules.find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        rule.selectorText.includes('[aria-expanded') &&
        rule.selectorText.includes('.hf-shell-nav-active') &&
        rule.selectorText.includes(':hover') &&
        rule.style.getPropertyValue('background-color').trim() === 'var(--shell-muted-surface)' &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-ink)',
    )
    expect(hover, 'selected group heading must still paint hover').toBeDefined()
    // Same-or-higher specificity: the hover paint must land after the quiet
    // reset, otherwise the selected parent cancels its own hover.
    expect(rules.indexOf(hover!)).toBeGreaterThan(rules.indexOf(quiet!))

    const nav = mountSelectedGroupHeading()
    const heading = nav.querySelector('[data-slot="link"]')!
    expect(matchesPaintSelector(hover!, heading)).toBe(true)
    expect(matchesPaintSelector(quiet!, heading)).toBe(true)
    nav.remove()
  })

  it('keeps the active child on the action hue while only the heading hovers', () => {
    const activeChild = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-nav') &&
        /data-slot=['"]childLink['"]/.test(rule.selectorText) &&
        rule.selectorText.includes('.hf-shell-nav-active') &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-action)',
    )
    expect(activeChild, 'active child keeps the action hue').toBeDefined()

    const nav = document.createElement('div')
    nav.className = 'hf-shell-nav'
    nav.innerHTML = `
      <a data-slot="childLink" class="hf-shell-nav-active" href="/pos/productos">
        <span data-slot="childLinkLabel" class="truncate">Listado</span>
      </a>`
    document.body.append(nav)
    const child = nav.querySelector('[data-slot="childLink"]')!
    expect(matchesAny(activeChild!, child)).toBe(true)
    nav.remove()
  })

  function mountSearchTrigger(): HTMLElement {
    const button = document.createElement('button')
    button.type = 'button'
    // Real installed DOM: UDashboardSearchButton -> UButton base slot with the
    // `hf-shell-search` class, a `data-slot="label"` span and a `trailing`
    // wrapper holding two `UKbd` <kbd> nodes.
    button.className = 'hf-shell-search'
    button.innerHTML = `
      <span data-slot="leadingIcon" class="iconify shrink-0 size-4.5"></span>
      <span data-slot="label" class="truncate">Buscar...</span>
      <span data-slot="trailing" class="hidden lg:flex items-center gap-0.5 ms-auto">
        <kbd class="align-text-top">⌘</kbd>
        <kbd class="align-text-top">K</kbd>
      </span>`
    document.body.append(button)
    return button
  }

  it('restyles the search trigger outline, surface, focus and label', () => {
    const trigger = mountSearchTrigger()
    const base = exactRule(shell, '.hf-shell-search')
    expect(base).toBeDefined()
    expect(base!.style.getPropertyValue('border').trim()).toBe('1px solid var(--shell-border)')
    expect(base!.style.getPropertyValue('border-radius').trim()).toBe('var(--shell-radius-control)')
    expect(base!.style.getPropertyValue('background-color').trim()).toBe('transparent')
    // The installed neutral/outline variant paints a `ring` (box-shadow) and
    // `bg-default`; the shell hook must neutralize both without `!important`.
    expect(base!.style.getPropertyValue('box-shadow').trim()).toBe('none')
    expect(base!.style.getPropertyValue('color').trim()).toBe('var(--shell-muted)')

    const focus = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-search') &&
        rule.selectorText.includes(':focus-visible'),
    )
    expect(focus, 'search trigger must keep an accessible focus ring').toBeDefined()
    expect(focus!.style.getPropertyValue('outline').trim()).toContain('var(--shell-action)')
    expect(focus!.style.getPropertyValue('box-shadow').trim()).toBe('none')

    const label = styleRules(shell).find(
      (rule) =>
        rule.selectorText.includes('.hf-shell-search') &&
        /data-slot=['"]label['"]/.test(rule.selectorText),
    )
    expect(label, 'search label shell paint').toBeDefined()
    expect(label!.style.getPropertyValue('color').trim()).toBe('var(--shell-muted)')
    expect(matchesAny(label!, trigger.querySelector('[data-slot="label"]')!)).toBe(true)

    const icon = styleRules(shell).find(
      (rule) =>
        splitTopLevel(rule.selectorText).some((selector) =>
          /data-slot=['"]leadingIcon['"]/.test(selector),
        ) &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-muted)' &&
        rule.selectorText.includes('.hf-shell-search'),
    )
    expect(icon, 'search leading icon shell paint').toBeDefined()
    expect(matchesAny(icon!, trigger.querySelector('[data-slot="leadingIcon"]')!)).toBe(true)
    trigger.remove()
  })

  it('recolors the real trailing UKbd keycaps without global --ui aliases', () => {
    const trigger = mountSearchTrigger()
    const keycaps = trigger.querySelectorAll('kbd')
    expect(keycaps).toHaveLength(2)

    const kbd = styleRules(shell).find(
      (rule) =>
        /kbd/.test(rule.selectorText) &&
        rule.style.getPropertyValue('border-radius').trim() === '4px' &&
        rule.style.getPropertyValue('color').trim() === 'var(--shell-muted)',
    )
    expect(kbd, 'actual trailing keycap shell paint').toBeDefined()
    expect(kbd!.style.getPropertyValue('border').trim()).toBe('1px solid var(--shell-border)')
    expect(kbd!.style.getPropertyValue('background-color').trim()).toBe('var(--shell-chrome)')
    expect(kbd!.style.getPropertyValue('box-shadow').trim()).toBe('none')
    expect(matchesAny(kbd!, keycaps[0]!)).toBe(true)

    // No root alias globals: the search hook states shell tokens only.
    const aliasPrefixes = ['--ui-', '--text-color-', '--background-color-', '--border-color-']
    for (const rule of styleRules(shell).filter((candidate) =>
      candidate.selectorText.includes('.hf-shell-search'),
    )) {
      for (const name of propertyNames(rule)) {
        expect(
          aliasPrefixes.some((prefix) => name.startsWith(prefix)),
          `search hook must not remap ${name}`,
        ).toBe(false)
      }
    }
    trigger.remove()
  })

  it('ships an additive brand logo hook with contain fit and no recolor', () => {
    const logo = styleRules(shell).find((rule) =>
      splitTopLevel(rule.selectorText).some(
        (selector) => selector.trim() === '.hf-shell-brand-logo',
      ),
    )
    expect(logo, 'additive .hf-shell-brand-logo hook').toBeDefined()
    expect(logo!.style.getPropertyValue('display').trim()).toBe('block')
    expect(logo!.style.getPropertyValue('object-fit').trim()).toBe('contain')
    // The real asset is a full-colour PNG: no invented recolor distortion.
    expect(logo!.style.getPropertyValue('filter').trim()).toBe('')

    const compact = styleRules(shell).find(
      (rule) =>
        /\[data-collapsed=['"]true['"]\]/.test(rule.selectorText) &&
        rule.selectorText.includes('.hf-shell-brand-logo') &&
        Number.parseFloat(rule.style.getPropertyValue('height')) > 0,
    )
    expect(compact, 'brand logo must fit the compact 76px rail').toBeDefined()
    expect(Number.parseFloat(compact!.style.getPropertyValue('height'))).toBeLessThanOrEqual(76)

    // Real login asset inside the real brand row (expanded and compact rail).
    const brand = document.createElement('div')
    brand.className = 'hf-shell-brand'
    const image = document.createElement('img')
    image.className = 'hf-shell-brand-logo'
    image.src = '/hounfeLogos/primary.png'
    image.alt = 'houndfe'
    brand.append(image)
    document.body.append(brand)
    expect(matchesAny(logo!, image)).toBe(true)

    const rail = document.createElement('div')
    rail.className = 'hf-shell-sidebar'
    rail.setAttribute('data-collapsed', 'true')
    rail.innerHTML =
      '<div class="hf-shell-brand"><img class="hf-shell-brand-logo" alt="houndfe"></div>'
    document.body.append(rail)
    expect(matchesAny(compact!, rail.querySelector('img')!)).toBe(true)
    rail.remove()
    brand.remove()
  })
})
