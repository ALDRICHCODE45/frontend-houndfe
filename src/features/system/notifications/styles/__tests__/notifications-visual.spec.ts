import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/system/notifications'
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const css = read('styles/notifications-visual.css')
const view = read('views/NotificationConfigView.vue')
const copy = read('copy.ts')
const components = [
  'components/MasterToggle.vue',
  'components/ActionRow.vue',
  'components/ActionModuleGroup.vue',
  'components/RecipientSelect.vue',
].map(read)

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Notificaciones presentation adapter (artboard 01 + 04)', () => {
  it('reuses the shared hf roles without a local palette', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    expect(css).not.toMatch(/#[\da-f]{3,8}\b/i)
    expect(css).not.toMatch(/rgba?\(|hsla?\(/)
    expect(css).not.toContain('.dark')
  })

  it('takes switches, marks and skeleton colour from core instead of redefining them', () => {
    expect(css).not.toMatch(/\[role='switch'\]/)
    expect(css).not.toMatch(/skeleton/)
    expect(css).not.toMatch(/hf-switch-row__track|hf-sel-mark/)
  })

  it('centres an 880px column with the canonical header and subtitle', () => {
    expect(view).toContain("import '../styles/notifications-visual.css'")
    expect(view).toContain('hf-theme hf-ui notifications-visual')
    expect(css).toMatch(/max-width:\s*880px/)
    expect(view).toContain('class="hf-page-header"')
    expect(view).toContain('class="hf-page-subtitle"')
    expect(copy).toContain("pageSubtitle: 'Elige qué avisos se envían por correo y a quién. Nada cambia hasta que guardas.'")
  })

  it('stacks the module label column above its rows on narrow containers', () => {
    expect(css).toMatch(/@container[^{]*\(max-width:\s*600px\)/)
    expect(css).toContain('.notifications-visual .nc-mod')
  })

  it('uses the shared selection primitives and HfSaveBar, never UCheckbox, USwitch or USelectMenu', () => {
    const all = [view, ...components].join('\n')
    expect(all).toContain('HfSwitchRow')
    expect(all).toContain('HfSelectableRows')
    expect(view).toContain('HfSaveBar')
    expect(all).not.toMatch(/<UCheckbox|<USwitch|<USelectMenu|type="checkbox"/)
  })
})
