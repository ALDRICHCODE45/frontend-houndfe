import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/admin/tenants'
const cssPath = `${dir}/styles/tenants-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const tenants = read('views/AdminTenantsView.vue')
const members = read('memberships/views/AdminTenantMembersView.vue')
const tenantSlideover = read('components/TenantUpsertSlideover.vue')
const memberSlideover = read('memberships/components/MembershipUpsertSlideover.vue')

const listPortal = 'hf-theme hf-ui tenants-list-portal'
const formPortal = 'hf-theme hf-ui hf-form-overlay tenants-form-portal'
const count = (source: string, needle: string) => source.split(needle).length - 1

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Sucursales presentation adapter', () => {
  it('loads a scoped adapter without global overrides', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    for (const marker of ['tenants-visual', 'tenants-list-portal', 'tenants-form-portal']) {
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
    for (const retired of ['tenants-card', 'tenants-view-toggle', 'transform: none', 'hf-pagination']) {
      expect(css).not.toContain(retired)
    }
  })

  for (const [name, view] of [['tenants', tenants], ['members', members]] as const) {
    it(`${name}: canonical workspace on the shared table pattern`, () => {
      expect(view, name).toMatch(/import '\.\.\/(\.\.\/)?styles\/tenants-visual\.css'/)
      expect(view, name).toContain('hf-theme hf-ui tenants-visual')
      expect(view, name).toContain('class="hf-page-header"')
      expect(view, name).toContain('class="hf-page-title"')
      expect(view, name).toContain('hf-table-surface')
      expect(view, name).toContain('class="hf-data-table"')
      expect(view, name).toContain('mobile-render="cards"')
      expect(view, name).toContain('#mobile-card')
      expect(view, name).toContain(':row-open="rowOpen"')
      expect(view, name).toContain('<RowActionsMenu')
      expect(view, name).toContain('<StatusBadge')
      expect(view, name).not.toContain('AdminPageHeader')
      expect(view, name).not.toContain('bg-coco-neutral')
      for (const retired of ['ViewToggle', 'CardGrid', 'AppBadge', 'StatusDotBadge', 'UDropdownMenu']) {
        expect(view, name).not.toContain(retired)
      }
    })

    it(`${name}: themes toolbar, pagination, row menu and the confirmation`, () => {
      expect(view, name).toContain(`portal-class="${listPortal}"`)
      expect(view, name).toContain(`pagination-portal-class="${listPortal}"`)
      expect(view, name).toContain('portal-class="tenants-list-portal"')
      expect(view, name).toContain(`:ui="{ content: '${formPortal}' }"`)
    })
  }

  it('members: keeps the subtitle skeleton while the tenant name loads', () => {
    expect(members).toContain('isLoadingTenantName')
    expect(members).toContain('<USkeleton')
  })

  it('members: the confirmation is labelled with the shared ConfirmModal props', () => {
    expect(members).toContain('confirm-label="Eliminar"')
    expect(members).toContain('confirm-color="error"')
    expect(members).not.toContain('confirm-text')
  })

  it('themes both slideovers and the membership menus', () => {
    expect(tenantSlideover).toContain("import '../styles/tenants-visual.css'")
    expect(memberSlideover).toContain("import '../../styles/tenants-visual.css'")
    expect(count(tenantSlideover, `:ui="{ content: '${formPortal}' }"`)).toBe(1)
    expect(count(memberSlideover, `:ui="{ content: '${formPortal}' }"`)).toBe(3)
  })
})

describe('Sucursales status filter', () => {
  it('is a named single-choice select, not a switch', () => {
    expect(tenants).toContain('<ToolbarSelectFilter')
    expect(tenants).toContain('label="Estado"')
    expect(tenants).not.toContain('USwitch')
    expect(tenants).not.toContain('Mostrar inactivos')
  })
})
