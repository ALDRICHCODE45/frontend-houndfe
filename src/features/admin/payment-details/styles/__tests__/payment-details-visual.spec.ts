import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/features/admin/payment-details'
const cssPath = `${dir}/styles/payment-details-visual.css`
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const read = (p: string) => readFileSync(`${dir}/${p}`, 'utf8')
const view = read('views/AdminPaymentDetailsView.vue')
const grid = read('components/PaymentDetailCardGrid.vue')
const slideover = read('components/PaymentDetailUpsertSlideover.vue')

const listPortal = 'hf-theme hf-ui payment-details-list-portal'
const formPortal = 'hf-theme hf-ui hf-form-overlay payment-details-form-portal'
const count = (source: string, needle: string) => source.split(needle).length - 1

// Source contracts, not rendered geometry or browser fidelity evidence.
describe('AdminPaymentDetailsView.vue presentation adapter', () => {
  it('loads a scoped adapter with light and dark palettes for every surface', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    for (const marker of ['payment-details-visual', 'payment-details-list-portal', 'payment-details-form-portal']) {
      expect(css).toContain(`.hf-theme.${marker}`)
      expect(css).toContain(`.dark .hf-theme.${marker}`)
    }
    expect(css).toContain(":not([role='switch'], [role='checkbox'])")
  })

  it('follows the canonical table workspace with themed toolbar, pagination, row menu and confirmation', () => {
    expect(view).toContain("import '../styles/payment-details-visual.css'")
    expect(view).toContain('hf-theme hf-ui payment-details-visual')
    expect(view).toContain('class="hf-page-header"')
    expect(view).toContain('class="hf-page-title"')
    expect(view).toContain('class="hf-page-subtitle"')
    expect(view).toContain('hf-table-surface')
    expect(view).toContain('class="hf-data-table"')
    expect(view).not.toContain('AdminPageHeader')
    expect(view).not.toContain('bg-coco-neutral')
    expect(view).toContain(`portal-class="${listPortal}"`)
    expect(view).toContain(`pagination-portal-class="${listPortal}"`)
    expect(view).toContain(`:ui="{ content: '${listPortal}' }"`)
    expect(view).toContain(`:ui="{ content: '${formPortal}' }"`)
    expect(view).toContain('payment-details-view-toggle')
  })

  it('keeps cards restrained through owned hooks', () => {
    expect(grid).toContain('payment-details-card-grid')
    expect(grid).toContain('payment-details-card ')
    expect(css).toContain('.payment-details-visual .payment-details-card:hover')
    expect(css).toContain('transform: none')
  })

  it('themes the upsert slideover and its menus', () => {
    expect(slideover).toContain("import '../styles/payment-details-visual.css'")
    expect(count(slideover, `:ui="{ content: '${formPortal}' }"`)).toBe(1)
  })
})
