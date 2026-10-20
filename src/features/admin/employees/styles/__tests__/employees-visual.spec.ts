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

// ── Dialogs and slideovers launched from the listing (S3) ───────────────────
const formPortal = 'hf-theme hf-ui hf-form-overlay employees-form-portal'
const formOwners = {
  terminate: read('components/TerminateEmployeeDialog.vue'),
  reactivate: read('components/ReactivateEmployeeDialog.vue'),
  batchTerminate: read('components/BatchTerminateModal.vue'),
  create: read('components/CreateEmployeeSlideover.vue'),
  edit: read('components/EmployeeEditSlideover.vue'),
}

describe('Employees dialogs and slideovers presentation adapter', () => {
  it('themes every dialog and slideover content and loads the adapter wherever it is mounted', () => {
    for (const [name, source] of Object.entries(formOwners)) {
      expect(source, name).toContain("import '../styles/employees-visual.css'")
      expect(source, name).toContain(`:ui="{ content: '${formPortal}' }"`)
    }
  })

  it('themes the nested selects of the create and edit forms', () => {
    const count = (source: string) => source.match(new RegExp(`:ui="\\{ content: '${formPortal}' \\}"`, 'g'))?.length ?? 0
    // slideover + 2 selects + manager select menu
    expect(count(formOwners.create)).toBe(4)
    // slideover + 3 selects + manager select menu
    expect(count(formOwners.edit)).toBe(5)
  })

  it('themes the date popovers of the create and edit forms', () => {
    for (const [name, source] of [['create', formOwners.create], ['edit', formOwners.edit]] as const) {
      const popovers = source.match(/<DateFieldPopover\b/g)?.length ?? 0
      expect(popovers, name).toBeGreaterThan(0)
      expect(source.split(`portal-class="${formPortal}"`).length - 1, name).toBe(popovers)
    }
  })

  it('themes the bulk confirmation dialogs of the listing', () => {
    expect(view.match(new RegExp(`:ui="\\{ content: '${formPortal}' \\}"`, 'g'))?.length).toBe(2)
  })
})

// ── Collaborator detail (odd employee-detail-visual) ─────────────────────────
const detail = read('views/EmployeeDetailView.vue')
const profile = read('components/EmployeeProfileCard.vue')

describe('Employee detail shell and profile card adapter', () => {
  it('opts the detail into the employees boundary, centered at the Caja page width', () => {
    expect(detail).toContain("import '../styles/employees-visual.css'")
    expect(detail).toContain('hf-theme hf-ui employees-visual employees-detail')
    expect(detail).toContain('mx-auto')
    expect(detail).toContain('max-w-[1320px]')
  })

  it('paints the tab bar with semantic roles instead of literal white', () => {
    expect(detail).not.toContain('bg-white')
    expect(detail).toContain('employees-detail-tabs')
    expect(detail).toContain('employees-detail-tab')
    expect(css).toContain('.employees-detail .employees-detail-tab[aria-selected=\'true\']')
  })

  it('gives the profile card an owned section hook and themes its action menu', () => {
    expect(profile).toContain('employees-detail-section')
    expect(css).toContain('.employees-detail .employees-detail-section')
    expect(profile).toContain(`:ui="{ content: '${formPortal}' }"`)
  })

  it('replaces literal palette chips and rings in the profile card with semantic hooks', () => {
    expect(profile).not.toMatch(/(bg|text|border)-(blue|orange|slate|emerald)-|ring-white|border-white|dark:ring-gray|dark:border-gray/)
    for (const modality of ['remote', 'hybrid', 'onsite']) expect(profile).toContain(`employees-modality--${modality}`)
    expect(profile).toContain('employees-active-dot')
    expect(css).toContain('.employees-detail .employees-active-dot')
  })
})

const panels = Object.fromEntries(
  ['ResumenPanel', 'PersonalPanel', 'EmergencyContactsPanel', 'LaboralPanel', 'CompensacionPanel', 'OrganigramaPanel', 'CvPanel', 'DocumentosPanel', 'AusenciasPanel']
    .map((name) => [name, read(`components/${name}.vue`)]),
)

describe('Employee detail panels adapter', () => {
  it('gives every panel card an owned section hook', () => {
    for (const [name, source] of Object.entries(panels)) {
      const cards = source.match(/<UCard\b/g)?.length ?? 0
      const hooked = source.match(/<UCard\b[^>]*employees-detail-section/g)?.length ?? 0
      expect(hooked, name).toBe(cards)
    }
  })

  it('marks every teleport opened from a panel with an owned portal', () => {
    for (const [name, source] of Object.entries(panels)) {
      const teleports = source.match(/<(UModal|USelect|USelectMenu|UTooltip|UDropdownMenu|DateFieldPopover)\b/g)?.length ?? 0
      const marked = source.match(/hf-theme hf-ui (hf-form-overlay )?employees-(form|list)-portal/g)?.length ?? 0
      expect(marked, name).toBe(teleports)
    }
  })

  it('keeps the existing upload footer alignment while theming its dialog', () => {
    expect(panels.DocumentosPanel).toContain(`:ui="{ content: '${formPortal}', footer: 'justify-end' }"`)
  })

  it('maps document categories and the expiry chip to semantic owned hooks', () => {
    expect(panels.DocumentosPanel).not.toMatch(/(bg|text)-(blue|purple|green|teal|orange|yellow|cyan|red|neutral|amber)-\d/)
    for (const tone of ['active', 'success', 'warning', 'neutral']) {
      expect(panels.DocumentosPanel).toContain(`employees-doc-category--${tone}`)
      expect(css).toContain(`.employees-detail .employees-doc-category--${tone}`)
    }
    expect(panels.DocumentosPanel).toContain('employees-doc-expiry')
    expect(css).toContain('.employees-detail .employees-doc-expiry')
  })
})

// ── Employees dashboards (odd employees-dashboards-visual) ───────────────────
const expiring = read('views/ExpiringDocumentsView.vue')
const pending = read('views/PendingApprovalsView.vue')
const approvalCard = read('components/PendingApprovalCard.vue')

describe('Employees dashboards follow the canonical table workspace', () => {
  for (const [name, source] of [['expiring', expiring], ['pending', pending]] as const) {
    it(`${name}: heading outside one table surface inside the employees boundary`, () => {
      expect(source, name).toContain("import '../styles/employees-visual.css'")
      expect(source, name).toContain('hf-theme hf-ui employees-visual')
      expect(source, name).toContain('class="hf-page-header"')
      expect(source, name).toContain('class="hf-page-title"')
      expect(source, name).toContain('class="hf-page-subtitle"')
      expect(source, name).toContain('hf-table-surface')
      expect(source, name).toContain('class="hf-data-table"')
      expect(source, name).not.toContain('AdminPageHeader')
      expect(source, name).not.toContain('bg-coco-neutral')
      expect(source, name).toContain(`portal-class="${listPortal}"`)
      expect(source, name).toContain(`pagination-portal-class="${listPortal}"`)
    })
  }

  it('expiring: themes the expiry-window select', () => {
    expect(expiring).toContain(`:ui="{ content: '${listPortal}' }"`)
  })

  it('pending: themes the review dialog, its card and the approval cards', () => {
    expect(pending).toContain(`:ui="{ content: '${formPortal}' }"`)
    expect(pending).toMatch(/<UCard\b[^>]*employees-detail-section/)
    expect(pending).toContain('employees-view-toggle')
    expect(approvalCard).toContain('employees-approval-card')
    expect(css).toContain('.employees-visual .employees-approval-card')
    expect(css).toContain('.employees-form-portal .employees-detail-section')
  })
})
