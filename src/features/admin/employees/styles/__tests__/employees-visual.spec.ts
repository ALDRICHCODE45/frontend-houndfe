import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/admin/employees'
const cssPath = `${dir}/styles/employees-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/EmployeesListView.vue')

const listPortal = 'hf-theme hf-ui employees-list-portal'

const LEGACY_LOOK =
  /\b(bg-primary|text-error|border-error|bg-error|font-bold|uppercase|tracking-wider)\b|(bg|text|border)-(red|blue|green|amber|orange|emerald|violet|pink|cyan|indigo|slate|gray|yellow|teal|purple|neutral)-\d|\bcoco-/

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Employees adapter', () => {
  it('loads a scoped adapter without borrowing other modules or global overrides', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(view).toContain("import '../styles/employees-visual.css'")
    expect(css).not.toContain('.promotions-visual')
    expect(css).not.toContain('.clients-visual')
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
  })

  it('paints on --hf roles only: no literal palette, no per-feature palette bridge', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(coco|brand|light)-/)
    expect(css).not.toContain('--hf-surface:')
    expect(css).not.toContain('--hf-action:')
    expect(css).not.toMatch(/uppercase|letter-spacing:\s*0\.0[4-9]|font-weight:\s*700/)
  })

  it('keeps no rule for the retired card grid, view toggle or modality badges', () => {
    for (const hook of ['employees-card', 'employees-view-toggle', 'employees-modality', 'employees-approval-card', 'employees-doc-category']) {
      expect(css, hook).not.toContain(hook)
    }
  })

  it('owns the teleported surfaces of the listing and its forms', () => {
    for (const marker of ['employees-visual', 'employees-list-portal', 'employees-form-portal']) {
      expect(css).toContain(`.hf-theme.${marker}`)
    }
  })
})

describe('Employees listing presentation', () => {
  it('follows the canonical table workspace: heading outside one table surface, no subtitle', () => {
    expect(view).toContain('hf-theme hf-ui employees-visual')
    expect(view).toContain('class="hf-page-header"')
    expect(view).toContain('class="hf-page-title"')
    expect(view).not.toContain('hf-page-subtitle')
    expect(view).toContain('hf-table-surface')
    expect(view).toContain('hf-table-content')
    expect(view).toContain('class="hf-data-table"')
    expect(view).not.toContain('AdminPageHeader')
    expect(view).not.toContain('bg-coco-neutral')
  })

  it('themes toolbar, pagination, the status filter and the row menu', () => {
    expect(view).toContain(`portal-class="${listPortal}"`)
    expect(view).toContain(`pagination-portal-class="${listPortal}"`)
    expect(view).toContain('portal-class="employees-list-portal"')
  })

  it('is one layout: table plus cards, no card grid, toggle or legacy badges', () => {
    expect(view).toContain('mobile-render="cards"')
    expect(view).toContain('#mobile-card')
    for (const legacy of ['ViewToggle', 'EmployeeCardGrid', 'StatusDotBadge', 'DotBadge', 'UBadge', 'UDropdownMenu']) {
      expect(view, legacy).not.toContain(legacy)
    }
    expect(view).toContain('StatusBadge')
    expect(view).toContain('RowActionsMenu')
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

  it('applies the text diet to the create and edit slideovers: no help paragraph, one primary, no Cancelar', () => {
    for (const [name, source] of [['create', formOwners.create], ['edit', formOwners.edit]] as const) {
      expect(source, name).not.toMatch(/\sdescription="/)
      expect(source.match(/type="submit"/g), name).toHaveLength(1)
      expect(source, name).not.toContain('label="Cancelar"')
    }
  })

  it('keeps the consequence of a decision dialog to one plain line, with no colored state words', () => {
    for (const [name, source] of Object.entries(formOwners)) {
      expect(source, name).not.toMatch(LEGACY_LOOK)
    }
    expect(formOwners.terminate).toContain('color="error"')
    expect(formOwners.batchTerminate).toContain('color="error"')
    expect(formOwners.reactivate).not.toMatch(/Confirmás/)
  })

  it('themes the bulk confirmation dialogs of the listing', () => {
    expect(view.match(new RegExp(`:ui="\\{ content: '${formPortal}' \\}"`, 'g'))?.length).toBe(2)
  })
})

// ── Collaborator detail ──────────────────────────────────────────────────────
const detail = read('views/EmployeeDetailView.vue')
const header = read('components/EmployeeDetailHeader.vue')

describe('Employee detail shell and header', () => {
  it('opts the detail into the employees boundary, centered at the page width', () => {
    expect(detail).toContain("import '../styles/employees-visual.css'")
    expect(detail).toContain('hf-theme hf-ui employees-visual employees-detail')
    expect(detail).toContain('mx-auto')
    expect(detail).toContain('max-w-5xl')
  })

  it('paints the tab bar with the owned hooks instead of literal white', () => {
    expect(detail).not.toContain('bg-white')
    expect(detail).toContain('employees-detail-tabs')
    expect(detail).toContain('employees-detail-tab')
    expect(css).toContain(".employees-detail .employees-detail-tab[aria-selected='true']")
  })

  it('has a detail header with one primary, the ⋮ menu, a neutral avatar-free identity and no eyebrows', () => {
    expect(header).toContain('StatusBadge')
    expect(header).toContain('RowActionsMenu')
    expect(header).not.toMatch(/StatusDotBadge|DotBadge|UBadge|uppercase|font-bold/)
    expect(css).toContain('.employees-detail .employee-detail-title')
    expect(css).toContain('font-weight: 600')
  })

  it('retired the profile card sidebar', () => {
    expect(existsSync(`${dir}/components/EmployeeProfileCard.vue`)).toBe(false)
    expect(detail).not.toContain('EmployeeProfileCard')
  })
})

// ── Detail panels ────────────────────────────────────────────────────────────
const panels = Object.fromEntries(
  ['ResumenPanel', 'PersonalPanel', 'EmergencyContactsPanel', 'LaboralPanel', 'CompensacionPanel', 'OrganigramaPanel', 'CvPanel', 'DocumentosPanel', 'AusenciasPanel']
    .map((name) => [name, read(`components/${name}.vue`)]),
)

describe('Employee detail panels adapter', () => {
  it('groups every panel in shared section cards: no legacy UCard stack, no nested card', () => {
    for (const [name, source] of Object.entries(panels)) {
      expect(source, name).not.toMatch(/<UCard\b/)
      expect(source, name).toContain("import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'")
      const cards = source.match(/<HfSectionCard\b/g)?.length ?? 0
      expect(cards, name).toBeGreaterThan(0)
      // Section headings stay h2 under the detail title (the page outline is unchanged).
      expect(source.match(/<HfSectionCard\b[^>]*:heading-level="2"/g)?.length ?? 0, name).toBe(cards)
      // No hand-built header strip inside a section: the card owns its heading.
      expect(source, name).not.toMatch(/border-b border-default px-5 py-4/)
    }
  })

  it('lays read-only pairs and figures out with one shared description list', () => {
    for (const name of ['PersonalPanel', 'LaboralPanel']) {
      expect(panels[name], name).toContain('class="employees-dl"')
      expect(panels[name], name).not.toMatch(/<dt class=/)
    }
    for (const name of ['ResumenPanel', 'AusenciasPanel']) {
      expect(panels[name], name).toContain('employees-figures')
    }
    expect(css).toContain('.employees-detail .employees-dl')
    expect(css).toContain('.employees-detail .employees-figures')
  })

  it('runs lists flush with the section edge and keeps the shared skeleton wash', () => {
    for (const [name, source] of Object.entries(panels)) {
      expect(source, name).not.toMatch(/animate-pulse[^"]*bg-\(--hf-surface-muted\)|bg-\(--hf-surface-muted\)[^"]*animate-pulse/)
      for (const pulse of source.match(/class="[^"]*animate-pulse[^"]*"/g) ?? []) {
        expect(pulse, name).toContain('hf-skeleton')
      }
    }
    expect(css).toContain('.employees-detail .employees-section-list')
  })

  it('turns options on and off only with the shared switch row, never a box', () => {
    for (const [name, source] of Object.entries(panels)) {
      expect(source, name).not.toMatch(/<USwitch\b|<UCheckbox\b|type="checkbox"/)
    }
  })

  it('gives section actions and the expiry window 44px touch targets', () => {
    expect(css).toMatch(/\.employees-detail \.hf-section-card__meta[^{]*\{[^}]*min-height: var\(--hf-form-control\)/)
    expect(css).toMatch(/\.employees-detail \.employees-threshold \{[^}]*min-height: var\(--hf-form-control\)/)
  })

  it('marks every teleport opened from a panel with an owned portal', () => {
    for (const [name, source] of Object.entries(panels)) {
      const teleports = source.match(/<(UModal|USelect|USelectMenu|UTooltip|UDropdownMenu|DateFieldPopover|ConfirmModal|RowActionsMenu)\b/g)?.length ?? 0
      const marked = source.match(/(hf-theme hf-ui (hf-form-overlay )?)?employees-(form|list)-portal/g)?.length ?? 0
      expect(marked, name).toBeGreaterThanOrEqual(teleports)
    }
  })

  it('keeps the existing upload footer alignment while theming its dialog', () => {
    expect(panels.DocumentosPanel).toContain(`:ui="{ content: '${formPortal}', footer: 'justify-end' }"`)
  })

  it('wears no legacy look: no decorative primary, palette, bold names, eyebrows or old badges', () => {
    for (const [name, source] of Object.entries(panels)) {
      expect(source, name).not.toMatch(LEGACY_LOOK)
      expect(source, name).not.toMatch(/<UBadge\b|AppBadge|StatusDotBadge|DotBadge/)
    }
  })

  it('uses the shared states and menus instead of hand-rolled ones', () => {
    for (const name of ['CompensacionPanel', 'OrganigramaPanel', 'DocumentosPanel', 'AusenciasPanel', 'EmergencyContactsPanel', 'CvPanel']) {
      expect(panels[name], name).toContain('EmptyState')
    }
    for (const name of ['DocumentosPanel', 'AusenciasPanel', 'EmergencyContactsPanel']) {
      expect(panels[name], name).toContain('RowActionsMenu')
    }
    expect(panels.AusenciasPanel).toContain('StatusBadge')
  })

  it('has a pressed-state expiry window instead of per-feature pill colors', () => {
    expect(panels.DocumentosPanel).toContain('employees-threshold')
    expect(css).toContain(".employees-detail .employees-threshold[aria-pressed='true']")
  })
})

// ── Employees trays: expiring documents and pending approvals ────────────────
const expiring = read('views/ExpiringDocumentsView.vue')
const pending = read('views/PendingApprovalsView.vue')

describe('Employees trays follow the canonical table workspace', () => {
  for (const [name, source] of [['expiring', expiring], ['pending', pending]] as const) {
    it(`${name}: heading outside one table surface inside the employees boundary, no subtitle`, () => {
      expect(source, name).toContain("import '../styles/employees-visual.css'")
      expect(source, name).toContain('hf-theme hf-ui employees-visual')
      expect(source, name).toContain('class="hf-page-header"')
      expect(source, name).toContain('class="hf-page-title"')
      expect(source, name).not.toContain('hf-page-subtitle')
      expect(source, name).toContain('hf-table-surface')
      expect(source, name).toContain('class="hf-data-table"')
      expect(source, name).not.toContain('AdminPageHeader')
      expect(source, name).not.toContain('bg-coco-neutral')
      expect(source, name).toContain(`portal-class="${listPortal}"`)
      expect(source, name).toContain(`pagination-portal-class="${listPortal}"`)
    })

    it(`${name}: is one layout of table plus cards with the shared badge, no legacy pieces`, () => {
      expect(source, name).toContain('mobile-render="cards"')
      expect(source, name).toContain('#mobile-card')
      expect(source, name).toContain('StatusBadge')
      expect(source, name).not.toMatch(/ViewToggle|UBadge|AppBadge|StatusDotBadge|DotBadge|PendingApprovalCard/)
      expect(source, name).not.toMatch(LEGACY_LOOK)
    })
  }

  it('expiring: themes the expiry-window select', () => {
    expect(expiring).toContain(`portal-class="${listPortal}"`)
    expect(expiring).toContain('ToolbarSelectFilter')
  })

  it('pending: themes the review dialog (no card inside it since T6e), and keeps the ⋮ menu', () => {
    expect(pending).toMatch(/content: '[^']*employees-form-portal/)
    expect(pending).not.toMatch(/<UCard\b/)
    expect(pending).toContain('RowActionsMenu')
    expect(css).toContain('.employees-form-portal .employees-detail-section')
  })
})
