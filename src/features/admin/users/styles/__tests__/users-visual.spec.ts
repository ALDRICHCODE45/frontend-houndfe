import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/admin/users'
const cssPath = `${dir}/styles/users-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/AdminUsersView.vue')
const card = read('components/UserCard.vue')
const grid = read('components/UserCardGrid.vue')
const upsert = read('components/UserUpsertSlideover.vue')
const drawer = read('seller-report/components/SellerSalesReportDrawer.vue')
const dateFilter = read('seller-report/components/SellerReportDateRangeFilter.vue')

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
      expect(css).toContain(`.dark .hf-theme.${marker}`)
    }
  })

  it('follows the canonical table workspace: heading outside one table surface', () => {
    expect(view).toContain('hf-theme hf-ui users-visual')
    expect(view).toContain('class="hf-page-header"')
    expect(view).toContain('class="hf-page-title"')
    expect(view).toContain('class="hf-page-subtitle"')
    expect(view).toContain('hf-table-surface')
    expect(view).toContain('class="hf-data-table"')
    expect(view).not.toContain('AdminPageHeader')
    expect(view).not.toContain('bg-coco-neutral')
  })

  it('themes toolbar, pagination, row menu and the delete confirmation', () => {
    expect(view).toContain(`portal-class="${listPortal}"`)
    expect(view).toContain(`pagination-portal-class="${listPortal}"`)
    expect(view).toContain(`:ui="{ content: '${listPortal}' }"`)
    expect(view).toContain(`:ui="{ content: '${formPortal}' }"`)
  })

  it('keeps the view toggle content-sized and cards restrained', () => {
    expect(view).toContain('users-view-toggle')
    expect(css).toContain('.users-visual .users-view-toggle')
    expect(grid).toContain('users-card-grid')
    expect(card).toContain('users-card')
    expect(css).toContain('.users-visual .users-card:hover')
    expect(css).toContain('transform: none')
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
})
