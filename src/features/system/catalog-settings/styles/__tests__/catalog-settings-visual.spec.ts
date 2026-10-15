import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/system/catalog-settings'
const cssPath = `${dir}/styles/catalog-settings-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/TenantCatalogSettingsView.vue')
const contexts = read('components/CatalogPriceContextsField.vue')

const formPortal = 'hf-theme hf-ui hf-form-overlay catalog-settings-form-portal'
const count = (source: string, needle: string) => source.split(needle).length - 1

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Catálogo en línea presentation adapter', () => {
  it('loads a scoped adapter with light and dark palettes', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    for (const marker of ['catalog-settings-visual', 'catalog-settings-form-portal']) {
      expect(css).toContain(`.hf-theme.${marker}`)
      expect(css).toContain(`.dark .hf-theme.${marker}`)
    }
  })

  it('puts the canonical page header outside the settings card, centered at the Caja width', () => {
    expect(view).toContain("import '../styles/catalog-settings-visual.css'")
    expect(view).toContain('hf-theme hf-ui catalog-settings-visual')
    expect(view).toContain('mx-auto')
    expect(view).toContain('max-w-[1320px]')
    expect(view).toContain('class="hf-page-header"')
    expect(view).not.toContain('<template #header>')
    expect(view).toContain('catalog-settings-surface')
    expect(css).toContain('.catalog-settings-visual .catalog-settings-surface')
  })

  it('themes the publish confirmation and both price-list menus', () => {
    expect(view).toContain(`:ui="{ content: '${formPortal}' }"`)
    expect(contexts).toContain("import '../styles/catalog-settings-visual.css'")
    expect(count(contexts, `:ui="{ content: '${formPortal}' }"`)).toBe(2)
  })
})


describe('Catálogo en línea: every teleporting control is themed', () => {
  it('marks every select menu, select and popover of the screen with the form portal', () => {
    const sources = [
      ...readdirSync(`${dir}/components`).filter((f) => f.endsWith('.vue')).map((f) => [f, read(`components/${f}`)] as const),
      ['TenantCatalogSettingsView.vue', view] as const,
    ]
    for (const [name, source] of sources) {
      const teleports = source.match(/<(USelectMenu|USelect|UPopover|UDropdownMenu)\b/g)?.length ?? 0
      expect(count(source, `:ui="{ content: '${formPortal}' }"`) - (name === 'TenantCatalogSettingsView.vue' ? 1 : 0), name).toBe(teleports)
    }
  })
})
