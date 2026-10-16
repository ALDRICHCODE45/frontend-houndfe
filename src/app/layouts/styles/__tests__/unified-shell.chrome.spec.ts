import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Source contracts for the shell chrome controls (feat/shell-chrome-polish):
 * navbar icon buttons, the sidebar collapse toggle, the branch switcher trigger
 * and the shell dropdown menus.
 *
 * Why these rules exist: the shell root declares only `--shell-*` variables, so
 * Nuxt UI's ghost buttons inside it still resolve their hover (`bg-elevated`)
 * from the legacy Coco palette. Inside teleported shell menus `bg-elevated` maps
 * to the card itself, so a highlighted row painted `bg-elevated/50` over the
 * card was barely visible. Each control therefore states its own shell paint.
 *
 * Source evidence only: rendered fidelity and motion remain user-owned.
 */
const shell = readFileSync('src/app/layouts/styles/unified-shell.css', 'utf8')

const styles: HTMLStyleElement[] = []

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

function rules(mediaFragment?: string): CSSStyleRule[] {
  const style = document.createElement('style')
  style.textContent = shell.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)
  const collected: CSSStyleRule[] = []
  const walk = (list: CSSRuleList | undefined, media: string) => {
    for (const rule of Array.from(list ?? [])) {
      if (rule.type === CSSRule.MEDIA_RULE) {
        walk((rule as CSSMediaRule).cssRules, (rule as CSSMediaRule).media.mediaText)
      } else if (rule.type === CSSRule.STYLE_RULE) {
        if (mediaFragment === undefined ? media === '' : media.includes(mediaFragment)) {
          collected.push(rule as CSSStyleRule)
        }
      }
    }
  }
  walk(style.sheet?.cssRules, '')
  return collected
}

/** Merged declarations of every top-level rule whose selector list includes `selector`. */
function paint(selector: string, mediaFragment?: string): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const rule of rules(mediaFragment)) {
    const selectors = rule.selectorText.split(/,(?![^(]*\))/).map((part) => part.trim())
    if (!selectors.includes(selector)) continue
    for (let index = 0; index < rule.style.length; index += 1) {
      const name = rule.style.item(index)
      merged[name] = rule.style.getPropertyValue(name).trim()
    }
  }
  return merged
}

describe('shell chrome — navbar and collapse icon buttons', () => {
  // Size stays owned by the accepted shell rule (32px navbar targets, 44px
  // mobile trigger); this hook only paints and animates.
  it('paints a quiet resting state in shell tokens without resizing', () => {
    expect(paint('.hf-shell-icon-button').width).toBeUndefined()
    expect(paint('.hf-shell-icon-button')).toMatchObject({
      'border-radius': 'var(--shell-radius-control)',
      'background-color': 'transparent',
      color: 'var(--shell-muted)',
    })
  })

  it('answers hover, press, focus and an open menu with shell tokens', () => {
    expect(paint('.hf-shell-icon-button:hover')).toMatchObject({
      'background-color': 'var(--shell-muted-surface)',
      color: 'var(--shell-ink)',
    })
    expect(paint('.hf-shell-icon-button:hover [data-slot="leadingIcon"]')).toMatchObject({
      color: 'var(--shell-ink)',
    })
    expect(paint('.hf-shell-icon-button:active').transform).toBe('scale(0.94)')
    expect(paint('.hf-shell-icon-button:focus-visible')).toMatchObject({
      outline: '2px solid var(--shell-action)',
    })
    expect(paint('.hf-shell-icon-button[data-state="open"]')).toMatchObject({
      'background-color': 'var(--shell-active)',
      color: 'var(--shell-action)',
    })
  })

  it('rings the account avatar instead of filling a square behind it', () => {
    expect(paint('.hf-shell-avatar-button')['border-radius']).toBe('999px')
    expect(paint('.hf-shell-avatar-button:hover')['box-shadow']).toBe(
      '0 0 0 3px var(--shell-active)',
    )
  })
})

describe('shell chrome — branch switcher trigger', () => {
  it('turns the initial into an action-tinted tile', () => {
    expect(paint('.hf-shell-tenant .hf-shell-tenant-tile')).toMatchObject({
      width: '34px',
      height: '34px',
      'border-radius': '8px',
      'background-color': 'var(--shell-active)',
      color: 'var(--shell-action)',
    })
  })

  it('tints the border on hover and holds the open state while the menu is open', () => {
    expect(paint('button.hf-shell-tenant:hover')['border-color']).toBe(
      'color-mix(in srgb, var(--shell-action) 40%, var(--shell-border))',
    )
    expect(paint('button.hf-shell-tenant[data-state="open"]')).toMatchObject({
      'border-color': 'var(--shell-action)',
      'box-shadow': '0 0 0 3px var(--shell-active)',
    })
    expect(paint('button.hf-shell-tenant:focus-visible').outline).toBe(
      '2px solid var(--shell-action)',
    )
  })
})

describe('shell chrome — dropdown menus', () => {
  it('replaces the near-invisible elevated highlight with a visible shell row', () => {
    expect(paint('.hf-shell-menu [data-slot="item"]::before').display).toBe('none')
    expect(paint('.hf-shell-menu [data-slot="item"][data-highlighted]')).toMatchObject({
      'background-color': 'var(--shell-muted-surface)',
      color: 'var(--shell-ink)',
    })
  })

  it('marks the current branch with the selection tokens, not a swapped icon', () => {
    expect(paint('.hf-shell-tenant-menu [data-slot="item"][data-state="checked"]')).toMatchObject({
      'background-color': 'var(--shell-active)',
      color: 'var(--shell-action)',
    })
    expect(
      paint('.hf-shell-tenant-menu [data-slot="item"][data-state="checked"] [data-slot="itemLeadingAvatar"]'),
    ).toMatchObject({
      'background-color': 'var(--shell-action)',
      color: 'var(--shell-on-action)',
    })
  })

  it('renders the S + number hint as restrained uppercase keycaps', () => {
    expect(paint('.hf-shell-tenant-menu [data-slot="itemTrailingKbds"] kbd')).toMatchObject({
      'text-transform': 'uppercase',
      'background-color': 'var(--shell-chrome)',
      color: 'var(--shell-muted)',
    })
  })

  it('heads the branch menu with a quiet uppercase label', () => {
    expect(paint('.hf-shell-tenant-menu [data-slot="label"]')).toMatchObject({
      'text-transform': 'uppercase',
      color: 'var(--shell-muted)',
    })
  })
})

describe('shell chrome — motion', () => {
  it('removes every chrome transition and press scale under reduced motion', () => {
    const reduced = rules('prefers-reduced-motion').map((rule) => rule.selectorText).join(' ')
    for (const hook of ['.hf-shell-icon-button', '.hf-shell-tenant', '.hf-shell-menu']) {
      expect(reduced).toContain(hook)
    }
    expect(paint('.hf-shell-icon-button', 'prefers-reduced-motion')).toMatchObject({
      transition: 'none',
      transform: 'none',
    })
  })
})
