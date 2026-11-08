import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/system/catalog-settings'
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const css = read('styles/catalog-settings-visual.css')
const view = read('views/TenantCatalogSettingsView.vue')
const components = readdirSync(`${dir}/components`)
  .filter((f) => f.endsWith('.vue'))
  .map((f) => [f, read(`components/${f}`)] as const)

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Catálogo online presentation adapter', () => {
  it('paints only with the shared hf roles: no local palette, no dark override', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    expect(css).not.toMatch(/#[\da-f]{3,8}\b/i)
    expect(css).not.toMatch(/rgba?\(|hsla?\(/)
    expect(css).not.toContain('.dark')
    expect(css).toContain('--ui-warning: var(--hf-warning)')
  })

  it('centres the settings column at ~880px with the canonical page header', () => {
    expect(view).toContain("import '../styles/catalog-settings-visual.css'")
    expect(view).toContain('hf-theme hf-ui catalog-settings-visual cs-page')
    expect(view).toContain('class="hf-page-header"')
    expect(css).toMatch(/\.cs-page \{[^}]*max-width: 880px/)
  })

  it('selected stock cards and pills use --hf-active-soft with the --hf-active border', () => {
    expect(css).toMatch(/\.cs-stock-card\[data-selected='true'\] \{[^}]*border-color: var\(--hf-active\)[^}]*background: var\(--hf-active-soft\)/)
    expect(css).toMatch(/\.cs-default-pill\[aria-checked='true'\] \{[^}]*border-color: var\(--hf-active\)/)
  })

  it('keeps the save bar sticky and turns it into the full-bleed mobile bar below 640px', () => {
    expect(css).toMatch(/\.cs-savebar \{[^}]*position: sticky/)
    expect(css).toMatch(/@media \(max-width: 639px\)[\s\S]*\.cs-savebar \{[^}]*bottom: 0/)
  })

  it('themes the publish confirmation portal', () => {
    expect(view).toContain(":ui=\"{ content: 'hf-theme hf-ui hf-form-overlay' }\"")
  })

  it('uses no classic checkbox in the screen sources (S3)', () => {
    for (const [name, source] of [...components, ['TenantCatalogSettingsView.vue', view] as const]) {
      expect(source, name).not.toMatch(/UCheckbox|type="checkbox"|role="checkbox"/)
    }
  })
})
