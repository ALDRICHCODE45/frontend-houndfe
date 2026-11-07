import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

/*
 * Source contracts for the Sales detail visual adapter (T4 / S1,S3-S5).
 *
 * The detail view + its owned overlays opt into the shared `hf-theme hf-ui`
 * foundation through a feature-owned stylesheet. These tests read the real
 * local CSS and the real consumer sources with a CSS/DOM parser and prove
 * scoping, compatibility aliasing, forced-paint pairing and portal wiring at
 * the source level.
 *
 * They are NOT rendered visual proof and cannot establish light/dark fidelity,
 * measured contrast or touch ergonomics; browser/visual smoke remains
 * user-owned.
 */
const path = 'src/features/POS/sales/styles/sales-detail-visual.css'
const css = existsSync(path) ? readFileSync(path, 'utf8') : ''
const shared = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')

const view = readFileSync('src/features/POS/sales/views/SaleDetailView.vue', 'utf8')
const salesDataCard = readFileSync(
  'src/features/POS/sales/components/SaleDetailSalesDataCard.vue',
  'utf8',
)
const totalsCard = readFileSync('src/features/POS/sales/components/SaleDetailTotalsCard.vue', 'utf8')
const debtModal = readFileSync('src/features/POS/sales/components/DebtPaymentModal.vue', 'utf8')
const assignSeller = readFileSync(
  'src/features/POS/sales/components/AssignSellerSlideover.vue',
  'utf8',
)
const commentInput = readFileSync('src/features/POS/sales/components/SaleCommentInput.vue', 'utf8')
const commentSlideover = readFileSync(
  'src/features/POS/sales/components/SaleCommentSlideover.vue',
  'utf8',
)
const editReference = readFileSync(
  'src/features/POS/sales/components/EditReferenceSlideover.vue',
  'utf8',
)
const paymentsList = readFileSync('src/features/POS/sales/components/PaymentsListSection.vue', 'utf8')
const historyCard = readFileSync(
  'src/features/POS/sales/components/SaleDetailHistoryCard.vue',
  'utf8',
)

const PORTAL = 'hf-theme hf-ui hf-form-overlay sales-detail-portal'

const styles: HTMLStyleElement[] = []

function styleRules(source: string): CSSStyleRule[] {
  const style = document.createElement('style')
  // Local rules only: `@import` must not trigger network requests in jsdom.
  style.textContent = source.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)

  const collected: CSSStyleRule[] = []
  const walk = (list: CSSRuleList | undefined) => {
    if (!list) return
    Array.from(list).forEach((rule) => {
      if (rule.type === CSSRule.STYLE_RULE) {
        collected.push(rule as CSSStyleRule)
      } else {
        walk((rule as CSSGroupingRule).cssRules)
      }
    })
  }
  walk(style.sheet?.cssRules)
  return collected
}

function splitTopLevel(selectorText: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of selectorText) {
    if (char === '(' || char === '[') depth += 1
    if (char === ')' || char === ']') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function selectorsOf(source: string): string[] {
  return styleRules(source).flatMap((rule) => splitTopLevel(rule.selectorText))
}

function normalize(selector: string): string {
  return selector.replace(/\s+/g, ' ').trim()
}

/** First rule whose selector list contains `selector` and declares `property`. */
function ruleWith(
  source: string,
  selector: string,
  property: string,
): CSSStyleRule | undefined {
  return styleRules(source).find(
    (rule) =>
      splitTopLevel(rule.selectorText).some((part) => normalize(part) === selector) &&
      rule.style.getPropertyValue(property) !== '',
  )
}

afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

describe('Sales detail visual adapter', () => {
  it('imports the shared adapter and scopes every rule to the owned boundary', () => {
    expect(css).toMatch(/@import\s+['"][^'"]*houndfe-ui\.css['"]/)
    // No forced paint: check every parsed declaration's priority, so a prose
    // mention in a comment cannot satisfy or fail this rule.
    const forced = styleRules(css).some((rule) => {
      for (let index = 0; index < rule.style.length; index += 1) {
        if (rule.style.getPropertyPriority(rule.style.item(index)) === 'important') return true
      }
      return false
    })
    expect(forced).toBe(false)
    expect(css).not.toContain(':root')
    // No new palette literals: the detail aliases the foundation instead.
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)

    for (const selector of selectorsOf(css)) {
      expect(selector).toMatch(/sales-detail-(?:visual|portal)/)
      expect(selector).not.toMatch(/^(?:\*|html|body|:root|button|input|select|textarea|a|table)\b/)
    }
    expect(selectorsOf(css).some((selector) => /^(?:\*|html|body|:root)$/.test(selector))).toBe(
      false,
    )
  })

  it('does not borrow another module boundary', () => {
    expect(css).not.toContain('products-visual')
    expect(css).not.toContain('clients-visual')
    expect(css).not.toContain('quotations-workspace')
    expect(css).not.toContain('cash-visual')
  })

  it('carries no legacy brand, gold or neutral palette alias', () => {
    // The markup uses the `--hf-*` roles (and the shared `hf-primary-control`
    // pairing for the primary action), so nothing is remapped here.
    expect(css).not.toMatch(/--brand-[a-z-]+\s*:/)
    expect(css).not.toMatch(/--color-(?:black|coco-[a-z0-9-]+)\s*:/)
    expect(css).not.toContain('coco-')

    // Semantic status roles are not remapped here either.
    expect(css).not.toMatch(/--(?:coco|ui|color)-(?:info|danger|error|warning|success)\s*:/)
  })

  it('sets the detail title, meta and section title on the typography scale', () => {
    const title = ruleWith(css, '.sales-detail-visual .sale-detail-title', 'font-weight')
    expect(title!.style.getPropertyValue('font-weight')).toBe('600')
    expect(title!.style.getPropertyValue('color')).toBe('var(--hf-heading)')

    const section = ruleWith(css, '.sales-detail-visual .sale-detail-section-title', 'font-size')
    expect(section!.style.getPropertyValue('font-size')).toBe('16px')
    expect(section!.style.getPropertyValue('font-weight')).toBe('600')

    expect(view).toContain('sale-detail-title')
    expect(view).not.toMatch(/font-bold|coco-neutral|--brand-/)
  })

  it('repaints the sticky header on the foundation surface and keeps the facts neutral', () => {
    const header = ruleWith(css, '.sales-detail-visual .sales-detail-sticky-header', 'background-color')
    expect(header).toBeDefined()
    expect(header!.style.getPropertyValue('background-color')).toContain('var(--hf-surface)')

    // The facts are a read-only `<dl>` on the card surface: no tinted box.
    expect(css).not.toContain('.sales-detail-fact ')
    expect(salesDataCard).not.toContain('sales-detail-fact ')
    expect(salesDataCard).toContain('<dl')
    // Cajero, Vendedor, Cliente, Dirección de envío, Lista de precios, Métodos de pago.
    expect(salesDataCard.match(/<dt\b/g) ?? []).toHaveLength(6)

    expect(view).toContain('sales-detail-sticky-header')
  })

  it('keeps the fought primary actions on the opted-in control geometry', () => {
    const action = ruleWith(
      css,
      '.sales-detail-visual .sales-detail-primary-action',
      'min-height',
    )
    expect(action).toBeDefined()
    expect(action!.style.getPropertyValue('min-height').trim()).toBe('var(--hf-control-height)')
    expect(action!.style.getPropertyValue('border-radius').trim()).toBe(
      'var(--hf-radius-control)',
    )

    expect(view).toContain('sales-detail-primary-action')
    // The totals card carries no primary: header / sticky bar own it.
    expect(totalsCard).not.toContain('UButton')
    expect(debtModal).toContain('sales-detail-primary-action')
  })

  it('paints the feature portal and rejects unmarked boundaries', () => {
    const portal = ruleWith(css, '.hf-theme.sales-detail-portal', 'background-color')
    expect(portal).toBeDefined()
    expect(portal!.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    expect(portal!.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
    expect(portal!.style.getPropertyValue('color').trim()).toBe('var(--hf-ink)')

    // Teleported overlays put `hf-theme hf-ui ... sales-detail-portal` on one
    // element, so the self-root selector is the one that matches.
    const fixture = document.createElement('div')
    fixture.className = PORTAL
    document.body.append(fixture)
    expect(
      splitTopLevel(portal!.selectorText).some((part) => fixture.matches(normalize(part))),
    ).toBe(true)

    // The shared adapter already maps the semantic aliases on that same
    // element, so the native content root inherits them.
    const adapter = styleRules(shared).find((rule) => rule.selectorText.trim() === '.hf-ui')!
    expect(fixture.matches(adapter.selectorText)).toBe(true)

    // Negative control: a shared boundary without the feature marker must not
    // inherit the feature portal paint.
    const unmarked = document.createElement('div')
    unmarked.className = 'hf-theme hf-ui'
    document.body.append(unmarked)
    expect(
      splitTopLevel(portal!.selectorText).some((part) => unmarked.matches(normalize(part))),
    ).toBe(false)

    fixture.remove()
    unmarked.remove()
  })
})

describe('Sales detail visual wiring', () => {
  it('imports the adapter only from the detail view and marks the detail root', () => {
    expect(view).toContain("import '../styles/sales-detail-visual.css'")
    expect(view).toMatch(/class="sales-detail-visual hf-theme hf-ui/)
    expect(css).toContain('.sales-detail-visual')
    expect(css).toContain('.sales-detail-portal')
  })

  it('routes every owned overlay through the detail portal opt-in', () => {
    // Four owned children receive the portal class; ConfirmModal keeps its
    // existing shared `ui` opt-in and the action menu gets its own boundary.
    const portalPropCount = (
      view.match(/portal-class="hf-theme hf-ui hf-form-overlay sales-detail-portal"/g) ?? []
    ).length
    expect(portalPropCount).toBe(4)
    expect(view).toContain(`:ui="{ content: '${PORTAL}' }"`)
    expect(view).toContain(":ui=\"{ content: 'hf-theme hf-ui sales-detail-portal' }\"")
  })

  it('gives every owned teleport owner an optional portalClass forwarded to ui.content', () => {
    for (const [name, source] of [
      ['DebtPaymentModal', debtModal],
      ['AssignSellerSlideover', assignSeller],
      ['SaleCommentSlideover', commentSlideover],
      ['EditReferenceSlideover', editReference],
    ] as const) {
      expect(source, `${name} must accept the optional prop`).toContain('portalClass?: string')
      expect(source, `${name} must forward to a native ui content path`).toMatch(/:ui=/)
      expect(source, `${name} must read props.portalClass`).toContain('portalClass')
    }

    // The merged controls preserve their previous ui value when omitted.
    expect(debtModal).toContain('slideoverUi')
    expect(editReference).toContain('slideoverUi')
    // The default-shaped controls keep the omit-equals-undefined contract.
    expect(assignSeller).toContain(':ui="portalClass ? { content: portalClass } : undefined"')
    expect(commentSlideover).toContain(':ui="portalClass ? { content: portalClass } : undefined"')
  })

  it('forwards the opt-in through the intermediate detail children to the owners', () => {
    expect(commentInput).toContain('portalClass?: string')
    expect(commentInput).toContain(':portal-class="portalClass"')
    expect(historyCard).toContain('portalClass?: string')
    expect(historyCard).toContain(':portal-class="portalClass"')
    expect(paymentsList).toContain('portalClass?: string')
    expect(paymentsList).toContain(':portal-class="portalClass"')
  })

  // Premium tables S7: the items of a sale stay a small plain table with the shared `.hf-plain-table`
  // look (guarded in hf-plain-table.spec.ts). Rows are not clickable: no hover modifier, no hover rule.
  it('dresses the items table with the shared plain-table look and no row hover', () => {
    const items = '.sales-detail-visual .sale-detail-items-table'
    const list = readFileSync('src/features/POS/sales/components/SaleDetailItemsList.vue', 'utf8')
    expect(list).toMatch(/<table[^>]*class="hf-plain-table sale-detail-items-table/)
    expect(list).not.toContain('hf-plain-table--hover')
    expect(shared).toMatch(/\.hf-ui \.hf-plain-table thead \{[^}]*background-color: var\(--hf-table-head\)/)
    expect(ruleWith(css, `${items} th`, 'height')!.style.getPropertyValue('height')).toBe('40px')
    expect(ruleWith(css, `${items} td`, 'padding')!.style.getPropertyValue('padding')).toBe('12px')
    expect(ruleWith(css, `${items} tbody tr:hover`, 'background-color')).toBeUndefined()
    expect(ruleWith(css, `${items} thead`, 'background-color')).toBeUndefined()
  })
})
