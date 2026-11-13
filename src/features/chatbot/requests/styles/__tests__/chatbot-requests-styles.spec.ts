import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Visual rules of the requests screens, asserted on the stylesheet text: jsdom has no layout, so
// these keep the fixes of the T5L/T10 live check (inline icons, disabled buttons, short sheet,
// bounded thread, readable chip) from silently regressing. Tokens only: no hex, no px for type.
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const load = (name: string) => strip(readFileSync(`src/features/chatbot/requests/styles/${name}.css`, 'utf8'))
const detail = load('chatbot-request-detail')
const live = load('chatbot-live-chat')
const commands = load('chatbot-request-commands')

/** Selectors split on top-level commas only (`:is(a, b)` stays whole). */
function splitSelectors(list: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const char of list) {
    if (char === '(' || char === '[') depth++
    if (char === ')' || char === ']') depth--
    if (char === ',' && depth === 0) {
      out.push(current.trim())
      current = ''
    } else current += char
  }
  out.push(current.trim())
  return out
}

/** Every declaration block of a rule that lists `selector`, joined; `undefined` when none does. */
function rule(css: string, selector: string): string | undefined {
  const bodies: string[] = []
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (splitSelectors(match[1]!).includes(selector)) bodies.push(match[2]!)
  }
  return bodies.length > 0 ? bodies.join('\n') : undefined
}

const ICON = ":is(svg, .iconify, [class*='i-lucide'])"

describe('inline icons keep their real size (never shrunk by the flex row)', () => {
  it.each([
    ['detail', detail, ['.rd-alert', '.lc-note', '.lb-head', '.lb-cost', '.rd-help']],
    ['commands', commands, ['.rd-alert', '.rc-hint', '.rc-impact']],
  ])('%s scope: a direct icon child is 1rem and does not shrink', (_name, css, containers) => {
    const scope = _name === 'detail' ? '.chatbot-request-detail' : '.chatbot-request-commands'
    for (const container of containers) {
      const selector = `${scope} ${container} > ${ICON}`
      const body = rule(css, selector) ?? rule(live, selector)
      expect(body, selector).toBeDefined()
      expect(body).toMatch(/flex: none/)
      expect(body).toMatch(/width: 1rem/)
      expect(body).toMatch(/height: 1rem/)
    }
  })
})

describe('reschedule note tones', () => {
  it('the warning note uses the system warning tokens, the info note the info wash', () => {
    const warn = rule(commands, '.chatbot-request-commands .rc-hint--warn')!
    expect(warn).toMatch(/background-color: var\(--hf-warning-soft\)/)
    expect(warn).toMatch(/--hf-warning\)/)
    const info = rule(commands, '.chatbot-request-commands .rc-hint--info')!
    expect(info).toMatch(/background-color: var\(--hf-active-soft\)/)
  })

  it('the text is its own flexible child, so wrapped lines never move under the icon', () => {
    const text = rule(commands, '.chatbot-request-commands .rc-hint__text')!
    expect(text).toMatch(/flex: 1/)
    expect(text).toMatch(/min-width: 0/)
    expect(rule(commands, '.chatbot-request-commands .rc-hint--warn')).toMatch(/flex-wrap: nowrap/)
    expect(rule(commands, '.chatbot-request-commands .rc-hint--info')).toMatch(/flex-wrap: nowrap/)
  })
})

describe('disabled action buttons read as disabled', () => {
  it('follow the design-system disabled look (page well, muted label, hairline, opacity 1, not-allowed)', () => {
    const body = rule(detail, '.chatbot-request-detail .rd-action button:disabled')!
    expect(body).toMatch(/background-color: var\(--hf-page\)/)
    expect(body).toMatch(/color: var\(--hf-muted\)/)
    expect(body).toMatch(/border-color: var\(--hf-border\)/)
    expect(body).toMatch(/opacity: 1/)
    expect(body).toMatch(/cursor: not-allowed/)
  })

  it('the dark label is dimmed toward the page like the other disabled buttons', () => {
    const dark = rule(detail, '.dark .chatbot-request-detail .rd-action button:disabled')!
    expect(dark).toMatch(/color-mix\(in srgb, var\(--hf-muted\) 60%, var\(--hf-page\)\)/)
  })

  it('the mobile bar reason sits under the button, readable', () => {
    expect(rule(detail, '.chatbot-request-detail .rd-bar__reason')).toBeDefined()
  })
})

describe('short attach sheet at 390', () => {
  it('lets the content decide the height of the bottom sheet', () => {
    const body = rule(commands, '.chatbot-request-commands.rc-portal--short')!
    expect(body).toMatch(/height: auto/)
  })
})

describe('live block at desktop', () => {
  it('the thread scrolls inside a height bounded by the viewport, so the composer stays in view', () => {
    const body = rule(live, '.chatbot-request-detail .rc--live .rc-log')!
    expect(body).toMatch(/height: clamp\([^;]*dvh[^;]*\)/)
    expect(body).toMatch(/overflow-y: auto/)
  })

  it('the live conversation is the first panel of the main column (design A)', () => {
    const body = rule(live, '.chatbot-request-detail .rd-main > .rc--live')!
    expect(body).toMatch(/order: -1/)
  })
})

describe('«Agendada para…» chip', () => {
  it('uses the secondary body size (13 px), not a badge size', () => {
    expect(rule(detail, '.chatbot-request-detail .rd-tag')).toMatch(/font-size: 0\.8125rem/)
  })
})

describe('«Esta conversación» card', () => {
  it('hides below 768 px, where the mobile card of the chat says the same', () => {
    expect(rule(detail, '.chatbot-request-detail .rd-panel.rd-rail__session')).toMatch(/display: none/)
  })
})
