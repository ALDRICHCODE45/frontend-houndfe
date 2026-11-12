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
