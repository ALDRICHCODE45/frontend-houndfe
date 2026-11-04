import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/admin/payment-details'
const cssPath = `${dir}/styles/payment-details-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/AdminPaymentDetailsView.vue')
const slideover = read('components/PaymentDetailUpsertSlideover.vue')

const listPortal = 'hf-theme hf-ui payment-details-list-portal'
const formPortal = 'hf-theme hf-ui hf-form-overlay payment-details-form-portal'
const count = (source: string, needle: string) => source.split(needle).length - 1

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('AdminPaymentDetailsView.vue presentation adapter', () => {
  it('loads a scoped adapter without global overrides', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(view).toContain("import '../styles/payment-details-visual.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    for (const marker of ['payment-details-visual', 'payment-details-list-portal', 'payment-details-form-portal']) {
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
    for (const retired of ['payment-details-card', 'payment-details-view-toggle', 'transform: none', 'hf-pagination']) {
      expect(css).not.toContain(retired)
    }
  })

  it('follows the canonical table workspace on the shared table pattern', () => {
    expect(view).toContain('hf-theme hf-ui payment-details-visual')
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
    for (const retired of ['ViewToggle', 'CardGrid', 'AppBadge', 'StatusDotBadge', 'UDropdownMenu']) {
      expect(view).not.toContain(retired)
    }
  })

  it('themes toolbar, pagination, row menu and the deactivate confirmation', () => {
    expect(view).toContain(`portal-class="${listPortal}"`)
    expect(view).toContain(`pagination-portal-class="${listPortal}"`)
    expect(view).toContain('portal-class="payment-details-list-portal"')
    expect(view).toContain(`:ui="{ content: '${formPortal}' }"`)
  })

  it('themes the upsert slideover and its menus', () => {
    expect(slideover).toContain("import '../styles/payment-details-visual.css'")
    expect(count(slideover, `:ui="{ content: '${formPortal}' }"`)).toBe(1)
  })
})

describe('Datos bancarios "Sin cuenta activa" notice', () => {
  it('uses the semantic warning role instead of the saturated solid warning', () => {
    const banner = view.slice(view.indexOf('<UAlert'), view.indexOf('/>', view.indexOf('<UAlert')))
    expect(banner).toContain('data-testid="no-active-account-banner"')
    expect(banner).toContain('variant="soft"')
    expect(banner).toContain('payment-details-notice')
    expect(css).toContain('.payment-details-visual .payment-details-notice')
    expect(css).toContain('var(--hf-warning-soft)')
  })
})
