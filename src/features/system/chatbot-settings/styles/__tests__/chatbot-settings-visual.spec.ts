import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/system/chatbot-settings'
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const css = read('styles/chatbot-settings.css')
const view = read('views/ChatbotSettingsView.vue')
const components = readdirSync(`${dir}/components`)
  .filter((f) => f.endsWith('.vue'))
  .map((f) => [f, read(`components/${f}`)] as const)

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Atención del chatbot presentation adapter', () => {
  it('paints only with the shared hf roles: no local palette, no dark override', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    expect(css).not.toMatch(/#[\da-f]{3,8}\b/i)
    expect(css).not.toMatch(/rgba?\(|hsla?\(/)
    expect(css).not.toContain('.dark')
  })

  it('imports the stylesheet from the view and uses the canonical page header', () => {
    expect(view).toContain("import '../styles/chatbot-settings.css'")
    expect(view).toContain('hf-theme hf-ui chatbot-settings')
    expect(view).toContain('class="hf-page-header')
  })

  it('keeps the save bar sticky and full-bleed below 640px', () => {
    expect(css).toMatch(/\.cbs-savebar \{[^}]*position: sticky/)
    expect(css).toMatch(/@media \(max-width: 639px\)[\s\S]*\.cbs-savebar \{[^}]*position: fixed/)
  })

  it('collapses the side index into chips on narrow containers', () => {
    expect(css).toMatch(/@container cbs-page \(max-width: 1000px\)[\s\S]*\.cbs-index \{[^}]*overflow-x: auto/)
  })

  it('themes the dialog portal', () => {
    for (const file of ['ApplyToAllDialog.vue', 'ConflictDialog.vue']) {
      expect(read(`components/${file}`)).toContain('hf-theme hf-ui hf-form-overlay chatbot-settings-dialog')
    }
  })

  it('uses no classic checkbox anywhere in the screen sources', () => {
    for (const [name, source] of [...components, ['ChatbotSettingsView.vue', view] as const]) {
      expect(source, name).not.toMatch(/UCheckbox|type="checkbox"|role="checkbox"/)
    }
  })

  it('never sends read-only response fields: the sources do not build a body with version or recompute', () => {
    const api = read('api/chatbotSettings.api.ts')
    expect(api).not.toMatch(/wire\.(version|recompute)/)
    expect(api).toContain('expectedVersion: body.expectedVersion')
  })
})

/** The body of the first rule whose selector is exactly `selector`, searching `source` (or the whole CSS). */
function ruleBody(selector: string, source = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`).exec(source)
  if (!match) throw new Error(`rule not found: ${selector}`)
  return match[1]!
}
/** The inside of the `@container <name> (<condition>)` block that holds `needle` (a name can have several blocks). */
function containerBlock(name: string, condition: string, needle?: string): string {
  const header = `@container ${name} (${condition})`
  for (let at = css.indexOf(header); at >= 0; at = css.indexOf(header, at + 1)) {
    const open = css.indexOf('{', at)
    let depth = 0
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++
      if (css[i] === '}' && --depth === 0) {
        const block = css.slice(open + 1, i)
        if (!needle || block.includes(needle)) return block
        break
      }
    }
  }
  throw new Error(`container block not found: ${header} ${needle ?? ''}`)
}

describe('time fields fit the 12-hour value with AM/PM and the clock icon', () => {
  it('the desktop time field is at least 9rem wide with compact side padding (7.5rem clipped «09:00 AI»)', () => {
    const body = ruleBody('.chatbot-settings .cbs-time')
    const width = /width:\s*([\d.]+)rem/.exec(body)
    expect(Number(width?.[1])).toBeGreaterThanOrEqual(9)
    const padding = /padding-inline:\s*([\d.]+)rem/.exec(body)
    expect(Number(padding?.[1])).toBeLessThanOrEqual(0.5)
  })

  it('a range wraps instead of clipping, and its times keep a floor width that holds the value', () => {
    expect(ruleBody('.chatbot-settings .cbs-range')).toMatch(/flex-wrap:\s*wrap/)
    const compact = containerBlock('cbs-main', 'max-width: 919px')
    const time = ruleBody('.chatbot-settings .cbs-time', compact)
    expect(time).toMatch(/flex:\s*1 1 6\.75rem/)
    expect(time).toMatch(/min-width:\s*6\.75rem/)
    expect(time).toMatch(/font-size:\s*0\.875rem/)
  })

  it('the day row stacks its ranges full width in the compact layout, so it never overflows at 390', () => {
    expect(ruleBody('.chatbot-settings .cbs-main')).toMatch(/container:\s*cbs-main \/ inline-size/)
    const compact = containerBlock('cbs-main', 'max-width: 919px')
    expect(ruleBody('.chatbot-settings .cbs-day__ranges', compact)).toMatch(/grid-column:\s*1 \/ -1/)
    expect(ruleBody('.chatbot-settings .cbs-day__ranges', compact)).toMatch(/align-items:\s*stretch/)
    expect(ruleBody('.chatbot-settings .cbs-day__total', compact)).toMatch(/display:\s*none/)
    expect(ruleBody('.chatbot-settings .cbs-day', css)).toMatch(/min-width:\s*0/)
  })
})

describe('the mobile section index', () => {
  const narrow = containerBlock('cbs-page', 'max-width: 1000px', 'overflow-x')

  it('hides the native scrollbar and its arrows but stays scrollable', () => {
    const index = ruleBody('.chatbot-settings .cbs-index', narrow)
    expect(index).toMatch(/overflow-x:\s*auto/)
    expect(index).toMatch(/scrollbar-width:\s*none/)
    expect(index).toMatch(/-ms-overflow-style:\s*none/)
    expect(ruleBody('.chatbot-settings .cbs-index::-webkit-scrollbar', narrow)).toMatch(/display:\s*none/)
  })

  it('fades the right edge (and keeps room on the left) so it reads as scrollable', () => {
    const index = ruleBody('.chatbot-settings .cbs-index', narrow)
    expect(index).toMatch(/mask-image:\s*linear-gradient\(to right/)
    expect(index).toMatch(/-webkit-mask-image:\s*linear-gradient\(to right/)
    expect(index).toMatch(/padding-inline:\s*0\.75rem/)
  })

  it('keeps «Copiar a…» on one line (seen live wrapping to «Copiar / a…» at 1440)', () => {
    const trigger = ruleBody('.chatbot-settings .cbs-copy-trigger', css)
    expect(trigger).toMatch(/white-space:\s*nowrap/)
    expect(trigger).toMatch(/flex-shrink:\s*0/)
    expect(read('components/HoursSection.vue')).toContain('cbs-btn cbs-btn--ghost cbs-copy-trigger')
  })
})
