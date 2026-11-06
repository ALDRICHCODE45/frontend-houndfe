import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/system/notifications'
const cssPath = `${dir}/styles/notifications-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/NotificationConfigView.vue')
const copy = read('copy.ts')
const recipients = read('components/RecipientSelect.vue')

const formPortal = 'hf-theme hf-ui hf-form-overlay'

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Notification switches (non-text contrast)', () => {
  const css = readFileSync('src/features/system/notifications/styles/notifications-visual.css', 'utf8')

  // The off-switch outline is shared by every .hf-ui switch (houndfe-ui.css, hf-switch-off.spec);
  // this adapter must not keep a second copy of it.
  it('takes the unchecked switch outline from core instead of redefining it', () => {
    expect(css).not.toMatch(/\[role='switch'\]/)
  })
})

describe('Notificaciones presentation adapter', () => {
  it('reuses the shared hf roles without a local palette', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    expect(css).not.toMatch(/#[\da-f]{3,8}\b/i)
    expect(css).not.toContain('.dark')
    expect(css).toContain('--ui-warning: var(--hf-warning)')
    expect(recipients).not.toContain('notifications-form-portal')
  })

  it('adds the canonical page header, with no subtitle, centered at the Caja width', () => {
    expect(view).toContain("import '../styles/notifications-visual.css'")
    expect(view).toContain('hf-theme hf-ui notifications-visual')
    expect(view).toContain('mx-auto')
    expect(view).toContain('max-w-[1320px]')
    expect(view).toContain('class="hf-page-header"')
    expect(view).toContain('NOTIFICATION_CONFIG_COPY.pageTitle')
    expect(view).not.toContain('hf-page-subtitle')
    expect(copy).toContain("pageTitle: 'Configuración de notificaciones'")
    expect(copy).not.toMatch(/pageSubtitle|masterDescription|recipientsDescription|actionsDescription/)
  })

  it('paints the three section cards through an owned surface hook', () => {
    expect(view.match(/notifications-section/g)?.length).toBeGreaterThanOrEqual(3)
    expect(css).toContain('.notifications-visual .notifications-section')
  })

  it('themes the recipient menu', () => {
    expect(recipients).toContain(`:ui="{ content: '${formPortal}' }"`)
  })
})
