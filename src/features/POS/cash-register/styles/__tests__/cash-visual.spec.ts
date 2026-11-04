import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

// Vitest's CSS stubbing also strips ?raw imports; inspect the real local files.
const adapter = readFileSync('src/features/POS/cash-register/styles/cash-visual.css', 'utf8')
const foundation = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')

const styles: HTMLStyleElement[] = []

function rules(source: string): CSSStyleRule[] {
  const style = document.createElement('style')
  // Inspect local rules only: fonts and imported styles must not make requests.
  style.textContent = source.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)
  return Array.from(style.sheet!.cssRules).filter(
    (rule): rule is CSSStyleRule => rule.type === CSSRule.STYLE_RULE,
  )
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

describe('Caja presentation boundaries', () => {
  it('keeps native fields on the shared field and focus tokens, with no second box on Nuxt roots', () => {
    const fields = rules(adapter).filter((rule) => rule.selectorText.includes('input'))
    expect(fields.some((rule) => rule.style.getPropertyValue('border'))).toBe(false)
    expect(
      fields.some(
        (rule) =>
          rule.selectorText.includes(':focus-visible') &&
          rule.style.getPropertyValue('outline').includes('--hf-focus'),
      ),
    ).toBe(true)
    expect(
      fields.some(
        (rule) =>
          rule.style.getPropertyValue('min-height') === 'var(--hf-control-height)' &&
          rule.style.getPropertyValue('background-color') === 'var(--hf-field)',
      ),
    ).toBe(true)
  })

  it('maps warning utilities locally to readable semantic amber in both themes, not decorative gold', () => {
    const scope = rules(adapter).find(
      (rule) =>
        rule.selectorText.includes('.cash-visual') && rule.style.getPropertyValue('--ui-warning'),
    )!
    expect(scope.style.getPropertyValue('--ui-warning').trim()).toBe('var(--hf-warning)')
    expect(scope.style.getPropertyValue('--color-warning').trim()).toBe('var(--hf-warning)')
    expect(scope.selectorText).not.toContain(':root')

    const themes = rules(foundation).filter((rule) => rule.style.getPropertyValue('--hf-warning'))
    expect(themes).toHaveLength(2)
    for (const theme of themes) {
      const warning = theme.style.getPropertyValue('--hf-warning').trim()
      expect(warning).not.toBe(theme.style.getPropertyValue('--hf-gold').trim())
      for (const surface of ['--hf-surface', '--hf-warning-soft']) {
        expect(
          contrast(warning, theme.style.getPropertyValue(surface).trim()),
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('speaks only the --hf token vocabulary: no palette, hex, coco, legacy brand or local --cash aliases', () => {
    const declarations = rules(adapter)
      .map((rule) => rule.cssText)
      .join('\n')
    expect(declarations).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(declarations).not.toMatch(/coco-|--brand-|--light-|--cash-(?!page-max|rail)/)
    expect(declarations).not.toMatch(/\b(red|green|amber|blue|emerald|slate|gray)-\d{2,3}\b/)
  })

  it('keeps the task strip inside 390px: compact tabs and a fade that hints at more to scroll', () => {
    expect(adapter).toMatch(/\.cash-task-nav-list\s*\{[^}]*mask-image:\s*linear-gradient/)
    expect(adapter).toMatch(/\.cash-task-nav-list\s*\{[^}]*overflow-x:\s*auto/)
    // The fade is a mobile affordance: the desktop rail is a column and never masks.
    expect(adapter).toMatch(/@media \(min-width: 1024px\)\s*\{\s*\.cash-task-nav-list\s*\{[^}]*mask-image:\s*none/)
  })

  it('puts the task strip above the content below lg and back in the rail from lg', () => {
    expect(adapter).toMatch(/\.cash-workspace-context\s*\{[^}]*order:\s*-1/)
    expect(adapter).toMatch(/@media \(min-width: 1024px\)\s*\{[^@]*\.cash-workspace-context\s*\{[^}]*order:\s*0/)
  })

  it('stacks the reception facts in the rail so a label never wraps to a second line', () => {
    expect(adapter).toMatch(/\.cash-facts-rail\s*\{[^}]*grid-template-columns:\s*1fr/)
    expect(adapter).toMatch(/\.cash-facts-rail\s+\.cash-fact dt\s*\{[^}]*white-space:\s*nowrap/)
  })
})
