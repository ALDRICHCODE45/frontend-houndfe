import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/admin/roles'
const cssPath = `${dir}/styles/roles-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/AdminRolesView.vue')
const upsert = read('components/RoleUpsertSlideover.vue')
const permissions = read('components/RolePermissionsSlideover.vue')

const listPortal = 'hf-theme hf-ui roles-list-portal'
const formPortal = 'hf-theme hf-ui hf-form-overlay roles-form-portal'

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Roles listing presentation adapter', () => {
  it('loads a scoped adapter without global overrides', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(view).toContain("import '../styles/roles-visual.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    for (const marker of ['roles-visual', 'roles-list-portal', 'roles-form-portal']) {
      expect(css).toContain(`.hf-theme.${marker}`)
    }
    expect(css).toContain('--radius-xl: var(--hf-radius-card)')
  })

  it('paints only on --hf roles: no palette literals, no local re-theme', () => {
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(declarations).not.toMatch(
      /--hf-(?:page|surface|surface-muted|field|ink|heading|muted|border|action|on-action|active|focus):/,
    )
    expect(declarations).not.toMatch(/coco|--brand|--light/)
    expect(css).not.toContain('.dark ')
  })

  it('has no rules for the retired card grid or view toggle', () => {
    for (const retired of ['roles-card', 'roles-view-toggle', 'transform: none']) {
      expect(css).not.toContain(retired)
    }
  })

  it('follows the canonical table workspace: heading outside one table surface', () => {
    expect(view).toContain('hf-theme hf-ui roles-visual')
    expect(view).toContain('class="hf-page-header"')
    expect(view).toContain('class="hf-page-title"')
    expect(view).toContain('hf-table-surface')
    expect(view).toContain('class="hf-data-table"')
    expect(view).not.toContain('AdminPageHeader')
    expect(view).not.toContain('bg-coco-neutral')
  })

  it('uses the shared table pattern: table on desktop, cards on mobile, no toggle', () => {
    expect(view).toContain('mobile-render="cards"')
    expect(view).toContain('#mobile-card')
    expect(view).toContain(':row-open="rowOpen"')
    expect(view).toContain('<RowActionsMenu')
    expect(view).toContain('<StatusBadge')
    for (const retired of ['ViewToggle', 'RoleCardGrid', 'AppBadge', 'StatusDotBadge', 'UDropdownMenu']) {
      expect(view).not.toContain(retired)
    }
  })

  it('themes toolbar, pagination, row menu and the delete confirmation', () => {
    expect(view).toContain(`portal-class="${listPortal}"`)
    expect(view).toContain(`pagination-portal-class="${listPortal}"`)
    expect(view).toContain('portal-class="roles-list-portal"')
    expect(view).toContain(`:ui="{ content: '${formPortal}' }"`)
  })

  it('themes both slideovers, keeping the permissions width', () => {
    for (const source of [upsert, permissions]) expect(source).toContain("import '../styles/roles-visual.css'")
    expect(upsert).toContain(`:ui="{ content: '${formPortal}' }"`)
    expect(permissions).toContain(`:ui="{ content: '!max-w-2xl ${formPortal}' }"`)
    expect(permissions).not.toContain('AppBadge')
  })
})
