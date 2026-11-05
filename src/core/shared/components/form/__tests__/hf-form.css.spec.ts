import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Source contracts of the shared form stylesheet: jsdom has no layout, so the
// rules that fix what the browser review found are pinned here; paint stays
// browser evidence.
const css = readFileSync('src/core/shared/components/form/hf-form.css', 'utf8')

/** The declarations of the first rule whose selector list contains `selector`. */
function rule(selector: string, source = css) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`(?:^|[},/]\\s*)[^{}]*${escaped}[^{}]*\\{([^}]*)\\}`, 'm'))
  return match?.[1] ?? ''
}

/** The body of the first `@media` block with exactly this query. */
function media(query: string) {
  const start = css.indexOf(`@media ${query} {`)
  if (start < 0) return ''
  let depth = 0
  for (let index = css.indexOf('{', start); index < css.length; index++) {
    if (css[index] === '{') depth++
    if (css[index] === '}' && --depth === 0) return css.slice(css.indexOf('{', start) + 1, index)
  }
  return ''
}

const finePointer = media('(hover: hover) and (pointer: fine)')

describe('HfCombobox footer', () => {
  it('scrolls the options group, not the viewport, so the footer group stays in view', () => {
    expect(rule('.hf-combobox__content--footer .hf-combobox__viewport')).toMatch(/overflow: hidden/)
    const options = rule('.hf-combobox__content--footer .hf-combobox__viewport > [data-slot=\'group\']')
    expect(options).toMatch(/overflow-y: auto/)
    expect(options).toMatch(/min-height: 0/)
    const footer = rule('.hf-combobox__content--footer .hf-combobox__viewport > [data-slot=\'group\']:last-child')
    expect(footer).toMatch(/flex-shrink: 0/)
    expect(footer).toMatch(/overflow: visible/)
    expect(footer).toMatch(/border-top: 1px solid var\(--hf-border\)/)
  })

  it('keeps the answers muted and in italic', () => {
    expect(rule('.hf-combobox__special [data-slot=\'itemLabel\']')).toMatch(/font-style: italic/)
  })
})

describe('HfUnitField unit trigger', () => {
  it('lays the chevron out in the flow, 8px after the text, never over it', () => {
    const trailing = rule('.hf-combobox__trigger [data-slot=\'trailing\']')
    expect(trailing).toMatch(/position: static/)
    expect(trailing).toMatch(/padding: 0/)
    const embedded = rule('.hf-combobox__trigger.hf-combobox__trigger--embedded')
    expect(embedded).toMatch(/min-width: 96px/)
    expect(embedded).toMatch(/gap: 8px/)
  })
})

describe('HfFormField help disclosure', () => {
  it('hides the help visually (never display:none) until focus within or the info toggle', () => {
    const collapsed = rule('.hf-form-field__message[data-tone=\'help\']')
    expect(collapsed).toMatch(/clip-path: inset\(50%\)/)
    expect(collapsed).toMatch(/position: absolute/)
    expect(collapsed).not.toMatch(/display: none/)
    const shown = rule('.hf-form-field[data-help=\'open\'] .hf-form-field__message[data-tone=\'help\']')
    expect(shown).toMatch(/position: static/)
    expect(shown).toMatch(/clip-path: none/)
    expect(css).toMatch(/\.hf-form-field:focus-within:not\(:has\(\.hf-form-field__info:focus\)\) \.hf-form-field__message\[data-tone='help'\]/)
  })

  it('never hides the error line', () => {
    expect(css).not.toMatch(/\.hf-form-field__message\[data-tone='error'\][^{]*\{[^}]*(clip-path|opacity: 0|display: none)/)
  })

  it('draws the info button as a 28px ghost with a 44px target on touch', () => {
    const info = rule('.hf-form-field__info')
    expect(info).toMatch(/width: 28px/)
    expect(info).toMatch(/height: 28px/)
    expect(rule('.hf-form-field__info::after')).toMatch(/inset: -8px/)
  })
})

describe('HfFormField action reveal', () => {
  it('shows ghosts and icon actions on hover or focus within, only with a fine pointer', () => {
    expect(finePointer).toMatch(/\.hf-form-field__ghosts,\s*\.hf-ui \.hf-form-field__actions > :not\(\[data-active='true'\]\)\s*\{[^}]*opacity: 0/)
    expect(finePointer).toMatch(/\.hf-form-field:is\(:hover, :focus-within\) :is\(\.hf-form-field__ghosts, \.hf-form-field__actions > \*\)\s*\{[^}]*opacity: 1/)
    // Outside that query (touch) nothing hides them, and nothing ever leaves the tab order.
    const outside = css.replace(finePointer, '')
    expect(outside).not.toMatch(/\.hf-form-field__(ghosts|actions)[^{]*\{[^}]*opacity: 0/)
    expect(css).not.toMatch(/\.hf-form-field__(ghosts|actions)[^{]*\{[^}]*(display: none|visibility: hidden)/)
  })
})

describe('HfFormField label row', () => {
  it('gives the label the free width first and never reserves a fixed slot for the actions', () => {
    const row = rule('.hf-form-field__row')
    expect(row).toMatch(/flex-wrap: wrap/)
    const title = rule('.hf-form-field__title')
    expect(title).toMatch(/flex: 1 1 auto/)
    expect(title).toMatch(/min-width: 0/)
    expect(title).toMatch(/gap: 4px/)
    const label = rule('.hf-form-field__label')
    expect(label).toMatch(/min-width: 0/)
    expect(label).not.toMatch(/flex: 1/)
    const end = rule('.hf-form-field__end')
    expect(end).toMatch(/flex: none/)
    expect(end).toMatch(/margin-left: auto/)
    // No fixed reserved width anywhere in the row.
    for (const selector of ['.hf-form-field__row', '.hf-form-field__end', '.hf-form-field__actions', '.hf-form-field__ghosts']) {
      expect(rule(selector)).not.toMatch(/\bwidth: [1-9]|flex-basis: [1-9]/)
    }
    // The info button sits right after the text: no negative inline margin pulling it in or out.
    expect(rule('.hf-form-field__info')).toMatch(/margin: -2px 0;/)
  })
})

describe('HfUnitField special answer', () => {
  it('lets a bare unit trigger shrink to its chevron', () => {
    const bare = rule('.hf-combobox__trigger--embedded.hf-combobox__trigger--bare')
    expect(bare).toMatch(/min-width: 0/)
  })
})

describe('HfSectionNav chip row', () => {
  it('scrolls inside its own row and never widens the page', () => {
    const nav = rule('.hf-ui .hf-section-nav')
    expect(nav).toMatch(/min-width: 0/)
    expect(nav).toMatch(/contain: inline-size/)
    const list = rule('.hf-section-nav__list')
    expect(list).toMatch(/min-width: 0/)
    expect(list).toMatch(/overflow-x: auto/)
    expect(list).toMatch(/scroll-snap-type: x proximity/)
    expect(list).toMatch(/scrollbar-width: none/)
    // The chips' sr-only text is absolutely positioned: the list must be its containing block, or it
    // escapes the list's clip and widens the page scroller (seen at 390px: 883px of scroll width).
    expect(list).toMatch(/position: relative/)
    expect(css).toMatch(/\.hf-section-nav__list::-webkit-scrollbar\s*\{[^}]*display: none/)
    expect(rule('.hf-section-nav__list > li')).toMatch(/scroll-snap-align: start/)
  })

  it('paints the page behind the sticky row, full bleed, with a hairline once stuck', () => {
    const nav = rule('.hf-ui .hf-section-nav')
    expect(nav).toMatch(/background-color: var\(--hf-page\)/)
    // One pixel above the edge, so the observer sees the row clipped once it sticks.
    expect(nav).toMatch(/top: -1px/)
    expect(nav).toMatch(/padding-block: 9px 8px/)
    expect(nav).toMatch(/margin-inline: calc\(-1 \* var\(--hf-section-nav-bleed, 0px\)\)/)
    expect(nav).toMatch(/padding-inline: var\(--hf-section-nav-bleed, 0px\)/)
    expect(rule('.hf-section-nav[data-stuck]')).toMatch(/box-shadow: inset 0 -1px 0 var\(--hf-border\)/)
  })

  it('lands a card title below the sticky row', () => {
    expect(rule('.hf-ui .hf-section-card')).toMatch(/scroll-margin-top: 24px/)
    expect(css).toMatch(/:has\(\.hf-section-nav--chips\) \.hf-section-card\s*\{[^}]*scroll-margin-top: 80px/)
    expect(media('(max-width: 767px)')).toMatch(/\.hf-section-card\s*\{[^}]*scroll-margin-top: 80px/)
  })
})
