import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/admin/tenants'
const cssPath = `${dir}/styles/tenants-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const tenants = read('views/AdminTenantsView.vue')
const members = read('memberships/views/AdminTenantMembersView.vue')
const cards = {
  tenant: [read('components/TenantCard.vue'), read('components/TenantCardGrid.vue')],
  member: [read('memberships/components/MemberCard.vue'), read('memberships/components/MemberCardGrid.vue')],
}
const tenantSlideover = read('components/TenantUpsertSlideover.vue')
const memberSlideover = read('memberships/components/MembershipUpsertSlideover.vue')

const listPortal = 'hf-theme hf-ui tenants-list-portal'
const formPortal = 'hf-theme hf-ui hf-form-overlay tenants-form-portal'
const count = (source: string, needle: string) => source.split(needle).length - 1

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Sucursales presentation adapter', () => {
  it('loads a scoped adapter with light and dark palettes for every surface', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    for (const marker of ['tenants-visual', 'tenants-list-portal', 'tenants-form-portal']) {
      expect(css).toContain(`.hf-theme.${marker}`)
      expect(css).toContain(`.dark .hf-theme.${marker}`)
    }
  })

  for (const [name, view] of [['tenants', tenants], ['members', members]] as const) {
    it(`${name}: canonical workspace with themed toolbar, pagination, row menu and confirmation`, () => {
      expect(view, name).toMatch(/import '\.\.\/(\.\.\/)?styles\/tenants-visual\.css'/)
      expect(view, name).toContain('hf-theme hf-ui tenants-visual')
      expect(view, name).toContain('class="hf-page-header"')
      expect(view, name).toContain('class="hf-page-title"')
      expect(view, name).toContain('hf-page-subtitle')
      expect(view, name).toContain('hf-table-surface')
      expect(view, name).toContain('class="hf-data-table"')
      expect(view, name).not.toContain('AdminPageHeader')
      expect(view, name).not.toContain('bg-coco-neutral')
      expect(view, name).toContain(`portal-class="${listPortal}"`)
      expect(view, name).toContain(`pagination-portal-class="${listPortal}"`)
      expect(view, name).toContain(`:ui="{ content: '${listPortal}' }"`)
      expect(view, name).toContain(`:ui="{ content: '${formPortal}' }"`)
      expect(view, name).toContain('tenants-view-toggle')
    })
  }

  it('members: keeps the subtitle skeleton while the tenant name loads', () => {
    expect(members).toContain('isLoadingTenantName')
    expect(members).toContain('<USkeleton')
  })

  it('keeps cards restrained through owned hooks', () => {
    for (const [name, [card, grid]] of Object.entries(cards)) {
      expect(card, name).toContain('tenants-card')
      expect(grid, name).toContain('tenants-card-grid')
    }
    expect(css).toContain('.tenants-visual .tenants-card:hover')
    expect(css).toContain('transform: none')
    expect(css).toContain('.tenants-visual .tenants-view-toggle')
  })

  it('themes both slideovers and the membership menus', () => {
    expect(tenantSlideover).toContain("import '../styles/tenants-visual.css'")
    expect(memberSlideover).toContain("import '../../styles/tenants-visual.css'")
    expect(count(tenantSlideover, `:ui="{ content: '${formPortal}' }"`)).toBe(1)
    expect(count(memberSlideover, `:ui="{ content: '${formPortal}' }"`)).toBe(3)
  })
})
