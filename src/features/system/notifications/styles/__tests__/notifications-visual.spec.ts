import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/system/notifications'
const cssPath = `${dir}/styles/notifications-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/NotificationConfigView.vue')
const copy = read('copy.ts')
const recipients = read('components/RecipientSelect.vue')

const formPortal = 'hf-theme hf-ui hf-form-overlay notifications-form-portal'

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Notificaciones presentation adapter', () => {
  it('loads a scoped adapter with light and dark palettes', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    for (const marker of ['notifications-visual', 'notifications-form-portal']) {
      expect(css).toContain(`.hf-theme.${marker}`)
      expect(css).toContain(`.dark .hf-theme.${marker}`)
    }
  })

  it('adds the canonical page header and centers the page at the Caja width', () => {
    expect(view).toContain("import '../styles/notifications-visual.css'")
    expect(view).toContain('hf-theme hf-ui notifications-visual')
    expect(view).toContain('mx-auto')
    expect(view).toContain('max-w-[1320px]')
    expect(view).toContain('class="hf-page-header"')
    expect(view).toContain('NOTIFICATION_CONFIG_COPY.pageTitle')
    expect(view).toContain('NOTIFICATION_CONFIG_COPY.pageSubtitle')
    expect(copy).toContain("pageTitle: 'Configuración de notificaciones'")
    expect(copy).toContain("pageSubtitle: 'Elige quién recibe notificaciones y qué acciones las disparan.'")
  })

  it('paints the three section cards through an owned surface hook', () => {
    expect(view.match(/notifications-section/g)?.length).toBeGreaterThanOrEqual(3)
    expect(css).toContain('.notifications-visual .notifications-section')
  })

  it('themes the recipient menu', () => {
    expect(recipients).toContain(`:ui="{ content: '${formPortal}' }"`)
  })
})
