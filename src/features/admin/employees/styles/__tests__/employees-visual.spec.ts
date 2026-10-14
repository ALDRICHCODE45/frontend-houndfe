import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/admin/employees'
const cssPath = `${dir}/styles/employees-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/EmployeesListView.vue')
const card = read('components/EmployeeCard.vue')
const grid = read('components/EmployeeCardGrid.vue')

const listPortal = 'hf-theme hf-ui employees-list-portal'

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Employees listing presentation adapter', () => {
  it('loads a scoped adapter without borrowing other modules or global overrides', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(view).toContain("import '../styles/employees-visual.css'")
    expect(css).not.toContain('.promotions-visual')
    expect(css).not.toContain('.clients-visual')
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
  })

  it('follows the canonical table workspace: heading outside one table surface', () => {
    expect(view).toContain('hf-theme hf-ui employees-visual')
    expect(view).toContain('class="hf-page-header"')
    expect(view).toContain('class="hf-page-title"')
    expect(view).toContain('class="hf-page-subtitle"')
    expect(view).toContain('hf-table-surface')
    expect(view).toContain('hf-table-content')
    expect(view).toContain('class="hf-data-table"')
    expect(view).not.toContain('AdminPageHeader')
    expect(view).not.toContain('bg-coco-neutral')
  })

  it('owns light and dark palettes for the listing and every teleported surface', () => {
    for (const marker of ['employees-visual', 'employees-list-portal', 'employees-form-portal']) {
      expect(css).toContain(`.hf-theme.${marker}`)
      expect(css).toContain(`.dark .hf-theme.${marker}`)
    }
    expect(css).toContain('--hf-surface: #ffffff')
    expect(css).toContain('--hf-surface: #1b2736')
  })

  it('themes toolbar, pagination and both row-action menus', () => {
    expect(view).toContain(`portal-class="${listPortal}"`)
    expect(view).toContain(`pagination-portal-class="${listPortal}"`)
    expect(view).toContain(`:ui="{ content: '${listPortal}' }"`)
    expect(card).toContain(`:ui="{ content: '${listPortal}' }"`)
  })

  it('wraps the toolbar and keeps the view toggle content-sized', () => {
    expect(view).toContain('employees-view-toggle')
    expect(css).toContain('.employees-visual .employees-view-toggle')
    expect(css).toContain('.employees-visual .hf-toolbar-actions')
    expect(css).toContain('.employees-visual .hf-pagination-size')
  })

  it('keeps cards restrained through owned hooks', () => {
    expect(grid).toContain('employees-card-grid')
    expect(card).toContain('employees-card')
    expect(css).toContain('.employees-visual .employees-card:hover')
    expect(css).toContain('transform: none')
  })

  it('paints work modality badges with semantic owned hooks instead of literal palette', () => {
    expect(view).not.toMatch(/border-blue-200|bg-blue-50|border-orange-200|bg-orange-50|bg-slate-100/)
    for (const modality of ['remote', 'hybrid', 'onsite']) {
      expect(view).toContain(`employees-modality--${modality}`)
      expect(css).toContain(`.employees-visual .employees-modality--${modality}`)
    }
  })
})
