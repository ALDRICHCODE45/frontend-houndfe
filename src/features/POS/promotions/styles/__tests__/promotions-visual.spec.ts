import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const path = 'src/features/POS/promotions/styles/promotions-visual.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
const view = readFileSync('src/features/POS/promotions/views/PromotionsView.vue', 'utf8')
const card = readFileSync('src/features/POS/promotions/components/PromotionCard.vue', 'utf8')
const grid = readFileSync('src/features/POS/promotions/components/PromotionCardGrid.vue', 'utf8')
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
    expect(view).toContain('class="hf-page-subtitle"')
    expect(view).toContain('hf-table-surface')
    expect(view).toContain('hf-table-content')
    expect(view).toContain('class="hf-data-table"')
    expect(view).not.toContain('TableHeaderDescription')
    expect(view).not.toContain('bg-coco-neutral')
  })

  it('owns light and dark palettes for the listing and every teleported surface', () => {
    for (const marker of [
      'promotions-visual',
      'promotions-list-portal',
      'promotions-form-portal',
    ]) {
      expect(css).toContain(`.hf-theme.${marker}`)
      expect(css).toContain(`.dark .hf-theme.${marker}`)
    }
    expect(css).toContain('--hf-surface: #ffffff')
    expect(css).toContain('--hf-surface: #1b2736')
    expect(css).toContain('--radius-xl: var(--hf-radius-card)')
  })

  it('themes toolbar, pagination, filter, row-menu and dialog portals', () => {
    expect(view).toContain(`portal-class="${listPortal}"`)
    expect(view).toContain(`pagination-portal-class="${listPortal}"`)
    expect(view.match(new RegExp(`:ui="\\{ content: '${listPortal}' \\}"`, 'g'))?.length).toBe(4)
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

  it('keeps cards bounded, restrained and content-sized', () => {
    expect(grid).toContain('promotions-card-grid')
    expect(card).toContain('promotions-card')
    expect(css).toContain('.promotions-visual .promotions-card-grid')
    expect(css).toContain('repeat(auto-fill, minmax(min(100%, 14rem), 1fr))')
    expect(css).toContain('.promotions-visual .promotions-card:hover')
    expect(css).toContain('transform: none')
  })

  it('wraps toolbar controls with filters on their own row and compacts pagination', () => {
    expect(css).toContain('.promotions-visual .hf-toolbar-actions')
    expect(css).toContain('.promotions-visual .hf-toolbar-filters')
    expect(css).toContain('flex-wrap: wrap')
    expect(css).toContain('.promotions-visual .hf-pagination-size')
    expect(view).toContain('promotions-view-toggle')
    expect(css).toContain('.promotions-visual .promotions-view-toggle')
  })

  it('restyles the existing empty state through owned hooks only', () => {
    expect(view).toContain('promotions-empty-state')
    expect(view).toContain('promotions-empty-icon')
    expect(view).toContain('promotions-empty-title')
    expect(css).toContain('.promotions-visual .promotions-empty-icon')
    expect(css).toContain('.promotions-visual .promotions-empty-title')
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
    expect(css).toContain('.dark .hf-theme.promotions-workspace')
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
    expect(targets).toContain('hf-primary-control')
    expect(targetModal).toContain('hf-primary-control')
  })

  it('marks selection with action/active roles and keeps gold as a restrained accent', () => {
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
    expect(css).toContain('var(--hf-gold-soft)')
    expect(css).toContain('var(--hf-gold-ink)')
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
