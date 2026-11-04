import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const path = 'src/features/POS/promotions/styles/promotions-visual.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
const view = readFileSync('src/features/POS/promotions/views/PromotionsView.vue', 'utf8')
const typeSelector = readFileSync(
  'src/features/POS/promotions/components/PromotionTypeSelector.vue',
  'utf8',
)

const listPortal = 'hf-theme hf-ui promotions-list-portal'
const formPortal = 'hf-theme hf-ui hf-form-overlay promotions-form-portal'

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('Promotions listing presentation adapter', () => {
  it('loads a scoped adapter without borrowing other modules or global overrides', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(view).toContain("import '../styles/promotions-visual.css'")
    expect(view).not.toContain('hf-shell-products-portal')
    expect(view).not.toContain('clients-list-portal')
    expect(css).not.toContain('.products-visual')
    expect(css).not.toContain('.clients-visual')
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    expect(css).not.toMatch(/\.promotions-visual\s+\[data-slot=/)
  })

  it('follows the canonical table workspace: heading outside one table surface', () => {
    expect(view).toContain('hf-theme hf-ui promotions-visual')
    expect(view).toContain('class="hf-page-header"')
    expect(view).toContain('class="hf-page-title"')
    expect(view).not.toContain('hf-page-subtitle')
    expect(view).toContain('hf-table-surface')
    expect(view).toContain('hf-table-content')
    expect(view).toContain('class="hf-data-table"')
    expect(view).not.toContain('TableHeaderDescription')
    expect(view).not.toContain('bg-coco-neutral')
  })

  it('declares no local palette: light and dark come from the shared roles', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(
      /--hf-(page|surface|surface-muted|field|ink|heading|muted|border|action|on-action|active|active-soft|focus)\s*:/,
    )
    expect(css).not.toContain('.dark .hf-theme.promotions-visual')
    for (const marker of [
      'promotions-visual',
      'promotions-list-portal',
      'promotions-form-portal',
    ]) {
      expect(css).toContain(`.hf-theme.${marker}`)
    }
    expect(css).toContain('--radius-xl: var(--hf-radius-card)')
  })

  it('themes toolbar, pagination, filter, row-menu and dialog portals', () => {
    expect(view).toContain(`portal-class="${listPortal}"`)
    expect(view).toContain(`pagination-portal-class="${listPortal}"`)
    expect(view.match(new RegExp(`portal-class="${listPortal}"`, 'g'))?.length).toBeGreaterThanOrEqual(
      5,
    )
    expect(view).toContain(`:ui="{ content: '${formPortal}' }"`)
    expect(view).toContain(`portal-class="${formPortal}"`)
    // PromotionTypeSelector forwarding is proven by its own mounted test.
    expect(typeSelector).toContain('portalClass')
  })

  it('replaces decorative gold in the type selector with owned semantic hooks', () => {
    expect(typeSelector).not.toContain('coco-gold')
    expect(typeSelector).toContain('promotions-type-option')
    expect(typeSelector).toContain('promotions-type-icon')
    expect(css).toContain('.promotions-form-portal .promotions-type-option:hover')
    expect(css).toContain('.promotions-form-portal .promotions-type-option:focus-visible')
    expect(css).toContain('.promotions-form-portal .promotions-type-icon')
  })

  it('retires the card grid, the view toggle and their dead rules', () => {
    expect(view).not.toContain('ViewToggle')
    expect(view).not.toContain('PromotionCardGrid')
    expect(view).not.toContain('usePromotionViewMode')
    expect(view).toContain('mobile-render="cards"')
    expect(view).toContain('#mobile-card')
    expect(css).not.toContain('promotions-card-grid')
    expect(css).not.toContain('promotions-view-toggle')
    expect(css).not.toContain('promotions-empty')
    expect(css).not.toContain('hf-pagination')
    // The toolbar container stays shared; only the select and search widths are fitted.
    expect(css).not.toMatch(/\.hf-toolbar(?![-\w])/)
  })

  it('takes the empty, no-match and error states from the shared table', () => {
    expect(view).toContain(':empty-state="emptyState"')
    expect(view).toContain(':filtered="filtered"')
    expect(view).toContain(':no-match-title="noMatchTitle"')
    expect(view).toContain('@empty-action="handleAddPromotion"')
    expect(view).not.toContain('#empty-state')
  })
})

// ── Creation / edit workspace (route-switched PromotionDetailView) ──────────
const dir = 'src/features/POS/promotions'
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const detail = read('views/PromotionDetailView.vue')
const form = read('components/PromotionForm.vue')
const conditions = read('components/PromotionConditionsSection.vue')
const targets = read('components/PromotionTargetItemsSection.vue')
const summary = read('components/PromotionSummaryCard.vue')
const targetModal = read('components/PromotionTargetSelection/PromotionTargetSelectionModal.vue')
const variantRow = read('components/PromotionTargetSelection/VariantAccordionRow.vue')
const workspaceSources = [detail, form, conditions, targets, summary, targetModal, variantRow]

describe('Promotions creation/edit workspace adapter', () => {
  it('opts the shared create/edit view into the promotions boundary without a new layout', () => {
    expect(detail).toContain("import '../styles/promotions-visual.css'")
    expect(detail).toContain('hf-theme hf-ui promotions-workspace')
    expect(detail).toContain('promotions-workspace-header')
    expect(detail).toContain('promotions-workspace-title')
    expect(detail).toContain('max-w-6xl')
    expect(css).toContain('.hf-theme.promotions-workspace')
    expect(css).not.toContain('.dark .hf-theme.promotions-workspace')
    expect(css).toContain('.promotions-workspace .promotions-workspace-header')
  })

  it('removes decorative gold and forced legacy paint from every workspace surface', () => {
    for (const source of workspaceSources) {
      expect(source).not.toContain('coco-gold')
      expect(source).not.toContain('!bg-(--brand-action)')
      expect(source).not.toContain('!text-black')
    }
  })

  it('pairs primary actions with the shared action foreground', () => {
    expect(form).toContain('data-testid="submit-btn"')
    expect(form.match(/hf-primary-control/g)?.length).toBe(1)
    // "Agregar productos" is outline: the page keeps one solid primary.
    expect(targets).not.toContain('hf-primary-control')
    expect(targetModal).toContain('hf-primary-control')
  })

  it('marks selection with action/active roles and keeps the identity accents neutral', () => {
    expect(form).toContain('promotions-choice-selected')
    expect(form).toContain('promotions-choice')
    expect(form).toContain('promotions-preset')
    expect(form).toContain('promotions-type-badge')
    expect(summary).toContain('promotions-accent-icon')
    expect(targets).toContain('promotions-segment')
    expect(variantRow).toContain('promotions-link')
    expect(css).toContain('.promotions-workspace .promotions-choice-selected')
    expect(css).toContain(".promotions-workspace .promotions-segment[aria-checked='true']")
    expect(css).toContain('.promotions-workspace .promotions-segment:focus-visible')
    // Color is reserved for status/urgency/action: the identity accents are neutral.
    expect(css).not.toContain('var(--hf-gold')
    expect(css).toContain('.promotions-workspace .promotions-chip')
  })

  it('repaints every section card over the global literal UCard theme', () => {
    // vite.config.ts paints UCard roots with literal bg-white/dark:bg-coco-neutral-900,
    // which no semantic alias reaches; each card needs the owned section hook.
    for (const source of [form, conditions, summary]) {
      const cards = source.match(/<UCard\b[^>]*>/g) ?? []
      expect(cards.length).toBeGreaterThan(0)
      for (const card of cards) expect(card).toContain('promotions-form-section')
    }
    expect(css).toContain('.promotions-workspace .promotions-form-section')
    expect(css).toMatch(
      /\.promotions-workspace \.promotions-form-section \{[^}]*background-color: var\(--hf-surface\)/,
    )
  })

  it('themes every teleported form surface with the owned form portal marker', () => {
    const portal = "content: 'hf-theme hf-ui hf-form-overlay promotions-form-portal'"
    expect(form.split(portal).length - 1).toBe(4)
    expect(conditions.split(portal).length - 1).toBe(4)
    expect(targetModal).toContain(portal)
    expect(targetModal).toContain("width: 'max-w-2xl'")
  })
})

describe('Promotions toolbar fit (review round 1)', () => {
  it('narrows the three filters and the search so they never cover the primary at 1440', () => {
    expect(css).toMatch(
      /@media \(min-width: 768px\) \{[^}]*\.promotions-visual \.hf-toolbar-select\.hf-toolbar-select \{ width: 9\.5rem; \}/s,
    )
    expect(css).toMatch(/\.promotions-visual \.hf-toolbar-search \{ max-width: 16rem; \}/)
  })

  it('names each filter by its prefix, so the options read just "Todos"', () => {
    expect(view).not.toMatch(/label: 'Todos los (tipos|estados|métodos)'/)
    expect(view.match(/label: 'Todos', value: ALL_FILTER_VALUE/g)).toHaveLength(3)
  })
})
