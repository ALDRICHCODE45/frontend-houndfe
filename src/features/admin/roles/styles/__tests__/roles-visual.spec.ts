import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/admin/roles'
const cssPath = `${dir}/styles/roles-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/AdminRolesView.vue')
const card = read('components/RoleCard.vue')
const grid = read('components/RoleCardGrid.vue')
const upsert = read('components/RoleUpsertSlideover.vue')
const permissions = read('components/RolePermissionsSlideover.vue')

const listPortal = 'hf-theme hf-ui roles-list-portal'
const formPortal = 'hf-theme hf-ui hf-form-overlay roles-form-portal'

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Roles listing presentation adapter', () => {
  it('loads a scoped adapter with light and dark palettes for every surface', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(view).toContain("import '../styles/roles-visual.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    for (const marker of ['roles-visual', 'roles-list-portal', 'roles-form-portal']) {
      expect(css).toContain(`.hf-theme.${marker}`)
      expect(css).toContain(`.dark .hf-theme.${marker}`)
    }
  })

  it('follows the canonical table workspace: heading outside one table surface', () => {
    expect(view).toContain('hf-theme hf-ui roles-visual')
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
    expect(view).toContain('roles-view-toggle')
    expect(css).toContain('.roles-visual .roles-view-toggle')
    expect(grid).toContain('roles-card-grid')
    expect(card).toContain('roles-card')
    expect(css).toContain('.roles-visual .roles-card:hover')
    expect(css).toContain('transform: none')
  })

  it('themes both slideovers, keeping the permissions width', () => {
    for (const source of [upsert, permissions]) expect(source).toContain("import '../styles/roles-visual.css'")
    expect(upsert).toContain(`:ui="{ content: '${formPortal}' }"`)
    expect(permissions).toContain(`:ui="{ content: '!max-w-2xl ${formPortal}' }"`)
  })
})
