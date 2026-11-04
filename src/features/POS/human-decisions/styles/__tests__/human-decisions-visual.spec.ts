import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/POS/human-decisions'
const cssPath = `${dir}/styles/human-decisions-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const panel = read('components/HumanDecisionsListPanel.vue')
const drawer = read('components/HumanDecisionDetailSlideover.vue')

const listPortal = 'hf-theme hf-ui human-decisions-list-portal'
const formPortal = 'hf-theme hf-ui hf-form-overlay human-decisions-form-portal'
const count = (source: string, needle: string) => source.split(needle).length - 1

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Solicitudes presentation adapter', () => {
  it('loads a scoped adapter on --hf roles only, with no local palette', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(declarations).not.toMatch(/--hf-(?:page|surface|surface-muted|field|ink|heading|muted|border|action|on-action|active|focus):/)
    for (const marker of ['human-decisions-visual', 'human-decisions-list-portal', 'human-decisions-form-portal']) {
      expect(css).toContain(`.hf-theme.${marker}`)
    }
    expect(css).toContain(":not([role='switch'], [role='checkbox'])")
  })

  it('has no rules for the retired view toggle or the toolbar grid', () => {
    expect(css).not.toContain('human-decisions-view-toggle')
    expect(css).not.toContain('grid-template-columns')
  })

  it('follows the canonical table workspace inside the panel, shared by the live and demo views', () => {
    expect(panel).toContain("import '../styles/human-decisions-visual.css'")
    expect(panel).toContain('hf-theme hf-ui human-decisions-visual')
    expect(panel).toContain('class="hf-page-header"')
    expect(panel).toContain('class="hf-page-title"')
    expect(panel).not.toContain('hf-page-subtitle')
    expect(panel).toContain('hf-table-surface')
    expect(panel).toContain('class="hf-data-table"')
    expect(panel).not.toContain('TableHeaderDescription')
    expect(panel).not.toContain('bg-coco-neutral')
    expect(panel).toContain(`portal-class="${listPortal}"`)
    expect(panel).toContain(`pagination-portal-class="${listPortal}"`)
    expect(panel).not.toContain('ViewToggle')
    expect(panel).not.toContain('useViewMode')
    expect(panel).toContain(':row-open="selectDecision"')
    expect(panel).toContain('mobile-render="cards"')
    expect(panel).not.toMatch(/\bUBadge\b|\bAppBadge\b|StatusDotBadge/)
  })

  it('opts the detail drawer into the form portal', () => {
    expect(drawer).toContain("import '../styles/human-decisions-visual.css'")
    expect(drawer).toContain(`portal-class="${formPortal}"`)
  })

  it('marks every teleporting control of the module', () => {
    for (const file of readdirSync(`${dir}/components`).filter((f) => f.endsWith('.vue'))) {
      const source = read(`components/${file}`)
      const teleports = source.match(/<(USelectMenu|USelect|UPopover|UDropdownMenu|UModal|USlideover|ConfirmModal)\b/g)?.length ?? 0
      const marked = count(source, `:ui="{ content: '${listPortal}' }"`) + count(source, `:ui="{ content: '${formPortal}' }"`)
      expect(marked, file).toBe(teleports)
    }
  })

  it('keeps the mobile cards on owned surface hooks', () => {
    for (const file of ['HumanDecisionCard.vue', 'ResolvedHumanDecisionCard.vue']) {
      expect(read(`components/${file}`), file).toContain('human-decisions-card')
    }
    expect(css).toContain('.human-decisions-visual .human-decisions-card')
  })
})
