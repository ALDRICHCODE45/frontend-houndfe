import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/admin/users'
const cssPath = `${dir}/styles/users-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/AdminUsersView.vue')
const upsert = read('components/UserUpsertSlideover.vue')
const drawer = read('seller-report/components/SellerSalesReportDrawer.vue')
const dateFilter = read('seller-report/components/SellerReportDateRangeFilter.vue')
const content = read('seller-report/components/SellerSalesReportContent.vue')

const listPortal = 'hf-theme hf-ui users-list-portal'
const formPortal = 'hf-theme hf-ui hf-form-overlay users-form-portal'
const count = (source: string, needle: string) => source.split(needle).length - 1

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Users listing presentation adapter', () => {
  it('loads a scoped adapter without global overrides', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(view).toContain("import '../styles/users-visual.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    for (const marker of ['users-visual', 'users-list-portal', 'users-form-portal']) {
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
    for (const retired of ['users-card', 'users-view-toggle', 'transform: none', 'hf-pagination']) {
      expect(css).not.toContain(retired)
    }
  })

  it('follows the canonical table workspace on the shared table pattern', () => {
    expect(view).toContain('hf-theme hf-ui users-visual')
    expect(view).toContain('class="hf-page-header"')
    expect(view).toContain('class="hf-page-title"')
    expect(view).toContain('hf-table-surface')
    expect(view).toContain('class="hf-data-table"')
    expect(view).toContain('mobile-render="cards"')
    expect(view).toContain('#mobile-card')
    expect(view).toContain(':row-open="rowOpen"')
    expect(view).toContain('<RowActionsMenu')
    expect(view).toContain('<StatusBadge')
    expect(view).not.toContain('AdminPageHeader')
    expect(view).not.toContain('bg-coco-neutral')
    for (const retired of ['ViewToggle', 'UserCardGrid', 'AppBadge', 'StatusDotBadge', 'UDropdownMenu']) {
      expect(view).not.toContain(retired)
    }
  })

  it('themes toolbar, pagination, row menu and the delete confirmation', () => {
    expect(view).toContain(`portal-class="${listPortal}"`)
    expect(view).toContain(`pagination-portal-class="${listPortal}"`)
    expect(view).toContain('portal-class="users-list-portal"')
    expect(view).toContain(`:ui="{ content: '${formPortal}' }"`)
  })

  it('draws the partial-save notice with the warning role, not the danger one', () => {
    expect(view).toContain('class="users-notice"')
    expect(css).toContain('.users-visual .users-notice')
    expect(css).toContain('var(--hf-warning-soft)')
    expect(view).not.toContain('text-warning')
  })

  it('themes the create/edit slideover and its role and tenant menus', () => {
    expect(upsert).toContain("import '../styles/users-visual.css'")
    expect(count(upsert, `:ui="{ content: '${formPortal}' }"`)).toBe(3)
  })
})

describe('Seller sales report drawer adapter', () => {
  it('opts the responsive drawer into the users form portal', () => {
    expect(drawer).toContain("import '../../styles/users-visual.css'")
    expect(drawer).toContain(`portal-class="${formPortal}"`)
  })

  it('themes both date popovers of the range filter', () => {
    expect(count(dateFilter, `:ui="{ content: '${formPortal}' }"`)).toBe(2)
  })

  it('uses the shared design system inside the report: StatusBadge, EmptyState, semibold names', () => {
    expect(content).toContain('<StatusBadge')
    expect(content).toContain('<EmptyState')
    expect(content).not.toContain('AppBadge')
    expect(content).not.toContain('font-bold')
  })
})
