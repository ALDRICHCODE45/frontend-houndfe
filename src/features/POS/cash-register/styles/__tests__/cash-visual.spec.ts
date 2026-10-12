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
  it('decorates button controls without painting a second box on Nuxt input roots', () => {
    const wrapper = document.createElement('div')
    wrapper.className = 'cash-control w-full'
    wrapper.dataset.slot = 'root'
    wrapper.append(document.createElement('input'))
    const button = document.createElement('button')
    button.className = 'cash-control'
    const controls = rules(adapter).filter((rule) => rule.selectorText.includes('.cash-control'))
    const painted = controls.filter((rule) => rule.style.getPropertyValue('border'))

    expect(
      painted.filter((rule) => wrapper.matches(rule.selectorText)).map((rule) => rule.selectorText),
    ).toEqual([])
    expect(painted.some((rule) => button.matches(rule.selectorText))).toBe(true)
    expect(
      controls.some(
        (rule) =>
          rule.selectorText.includes(':focus-visible') &&
          rule.style.getPropertyValue('outline').includes('--cash-primary'),
      ),
    ).toBe(true)
    expect(
      rules(adapter).some(
        (rule) =>
          rule.selectorText.includes('input') &&
          rule.selectorText.includes(':focus-visible') &&
          rule.style.getPropertyValue('outline').includes('--hf-focus'),
      ),
    ).toBe(true)
  })

  it('maps warning utilities locally to readable semantic amber in both themes, not decorative gold', () => {
    const scope = rules(adapter).find(
      (rule) =>
        rule.selectorText.includes('.cash-visual') && rule.style.getPropertyValue('--cash-warning'),
    )!
    expect(scope.style.getPropertyValue('--ui-warning').trim()).toBe('var(--cash-warning)')
    expect(scope.style.getPropertyValue('--color-warning').trim()).toBe('var(--cash-warning)')
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
})
