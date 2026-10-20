import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

const path = 'src/core/shared/design-system/hf-toast.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
const shell = readFileSync('src/app/layouts/styles/unified-shell.css', 'utf8')
const foundation = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')
const styles: HTMLStyleElement[] = []

afterEach(() => styles.splice(0).forEach((style) => style.remove()))

function paint(selector: string, reduced = false) {
  const style = document.createElement('style')
  style.textContent = css.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)
  const result: Record<string, string> = {}
  const walk = (rules: CSSRuleList | undefined, inReduced = false) => {
    for (const rule of Array.from(rules ?? [])) {
      if (rule.type === CSSRule.MEDIA_RULE) {
        walk(
          (rule as CSSMediaRule).cssRules,
          (rule as CSSMediaRule).conditionText.includes('prefers-reduced-motion'),
        )
      } else if (rule.type === CSSRule.STYLE_RULE && reduced === inReduced) {
        const entry = rule as CSSStyleRule
        if (
          !entry.selectorText
            .split(',')
            .map((s) => s.trim())
            .includes(selector)
        )
          continue
        for (const name of Array.from(entry.style))
          result[name] = entry.style.getPropertyValue(name).trim()
      }
    }
  }
  walk(style.sheet?.cssRules)
  return result
}

describe('toast presentation boundary', () => {
  it('shares paired shell and foundation palettes without local palette literals or priority hacks', () => {
    expect(css).not.toBe('')
    expect(css).not.toMatch(/!important|#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/i)
    for (const source of [shell, foundation]) {
      expect(source).toMatch(/(?:^|,)\s*\.hf-shell-toast\s*[,\{]/m)
      expect(source).toMatch(/\.dark \.hf-shell-toast\s*[,\{]/)
    }
    expect(paint('.hf-shell-toast')).toMatchObject({
      '--toast-accent': 'var(--shell-action)',
      '--toast-soft': 'var(--shell-active)',
    })
  })

  it.each([
    ['success', 'var(--hf-success)'],
    ['error', 'var(--ui-error)'],
    ['warning', 'var(--hf-warning)'],
    ['info', 'var(--shell-action)'],
    ['primary', 'var(--shell-action)'],
    ['secondary', 'var(--shell-action)'],
    ['neutral', 'var(--shell-muted)'],
  ])('maps %s to a semantic accent and soft tile', (color, accent) => {
    expect(paint(`.hf-shell-toast.hf-toast--${color}`)['--toast-accent']).toBe(accent)
    expect(paint(`.hf-shell-toast.hf-toast--${color}`)['--toast-soft']).toBeTruthy()
  })

  it('paints shell geometry, readable text, icon tiles and role progress', () => {
    expect(paint('.hf-shell-toast[data-state]')).toMatchObject({
      'background-color': 'var(--shell-card)',
      border: '1px solid var(--shell-border)',
      'border-radius': 'var(--shell-radius-panel)',
      'font-family': 'var(--shell-font)',
    })
    expect(paint('.hf-shell-toast [data-slot="title"]')).toMatchObject({
      color: 'var(--shell-ink)',
      'font-weight': '600',
    })
    expect(paint('.hf-shell-toast [data-slot="description"]')).toMatchObject({
      color: 'var(--shell-muted)',
    })
    expect(paint('.hf-shell-toast::before')['background-color']).toBe('var(--toast-soft)')
    expect(paint('.hf-shell-toast::after').color).toBe('var(--toast-accent)')
    expect(
      paint('.hf-shell-toast [data-slot="progress"] [data-slot="indicator"]')['background-color'],
    ).toBe('var(--toast-accent)')
    // jsdom drops nested min()/calc() lengths from CSSStyleDeclaration.
    expect(css).toMatch(/\.hf-toast-viewport\s*\{\s*width: min\(360px, calc\(100vw - 32px\)\);/)
  })

  it('uses semantic shadow roles rather than a palette token', () => {
    expect(css).not.toContain('--coco-')
    expect(paint('.hf-shell-toast[data-state]')['box-shadow']).toContain('var(--shell-shadow)')
    expect(paint('.hf-shell-toast[data-state]')['box-shadow']).toContain('var(--shell-shadow-soft)')
  })

  it('uses quiet controls with shell hover and keyboard focus', () => {
    for (const control of ['.hf-toast-close', '[data-slot="actions"] button']) {
      expect(paint(`.hf-shell-toast ${control}`)).toMatchObject({
        'background-color': 'transparent',
        color: 'var(--shell-muted)',
      })
      expect(paint(`.hf-shell-toast ${control}:hover`)).toMatchObject({
        'background-color': 'var(--shell-muted-surface)',
        color: 'var(--shell-ink)',
      })
      expect(paint(`.hf-shell-toast ${control}:focus-visible`).outline).toBe(
        '2px solid var(--shell-action)',
      )
    }
  })

  it('removes fallback glyphs for explicit icons/avatars, not caller content', () => {
    expect(paint('.hf-shell-toast:has(> [data-slot="icon"])::after').display).toBe('none')
    expect(paint('.hf-shell-toast:has(> .hf-toast-avatar)::after').display).toBe('none')
    expect(paint('.hf-shell-toast:has(> .hf-toast-avatar)::before').display).toBe('none')
  })

  it('removes entry, exit, stacking and progress motion for reduced motion', () => {
    expect(paint('.hf-shell-toast[data-state="open"]').animation).toContain('hf-toast-enter')
    expect(paint('.hf-shell-toast[data-state="closed"]').animation).toContain('hf-toast-exit')
    for (const selector of [
      '.hf-shell-toast[data-state]',
      '.hf-shell-toast[data-state] *',
      '.hf-toast-viewport',
    ]) {
      expect(paint(selector, true)).toMatchObject({ animation: 'none', transition: 'none' })
    }
  })
})
