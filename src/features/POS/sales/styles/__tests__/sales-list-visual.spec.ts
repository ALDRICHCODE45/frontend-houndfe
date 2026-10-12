import { existsSync, readFileSync } from 'node:fs'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DOMWrapper, enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import DataTableFilters from '@/core/shared/data-table-filters/components/DataTableFilters.vue'
import DataTablePagination from '@/core/shared/components/DataTable/DataTablePagination.vue'
import DataTableToolbar from '@/core/shared/components/DataTable/DataTableToolbar.vue'
import { defineFiltersSchema, filter } from '@/core/shared/data-table-filters'

/**
 * Sales listing visual adapter contracts (T2 — S1, S3-S5).
 *
 * Two layers:
 *  1. Source/cascade contracts: the owned stylesheet, the routed view and the
 *     card/grid/tab components. They prove scoping, token mapping and where
 *     the class markers live. jsdom never renders light/dark fidelity or
 *     pixel geometry, so the visual smoke remains user-owned.
 *  2. Native portal ownership: the REAL installed `@nuxt/ui` / Reka UI
 *     components forward `ui.content` / `portalClass` onto the teleported
 *     `[data-slot="content"]` popup root, NOT the trigger or an inner
 *     positioning wrapper. Stubs and selector fixtures alone would not
 *     establish that.
 *
 * `houndfe-ui.css` is read, never changed: the shared adapter already pairs
 * solid action backgrounds with `--hf-on-action`, so this feature file only
 * paints its own boundary.
 */

const cssPath = 'src/features/POS/sales/styles/sales-list-visual.css'
const sharedPath = 'src/core/shared/design-system/houndfe-ui.css'
const viewPath = 'src/features/POS/sales/views/SalesListView.vue'
const cardPath = 'src/features/POS/sales/components/SaleCard.vue'
const gridPath = 'src/features/POS/sales/components/SaleCardGrid.vue'
const tabsPath = 'src/features/POS/sales/components/SalesListTabs.vue'

const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
const sharedCss = readFileSync(sharedPath, 'utf8')
const view = readFileSync(viewPath, 'utf8')
const card = readFileSync(cardPath, 'utf8')
const grid = readFileSync(gridPath, 'utf8')
const tabs = readFileSync(tabsPath, 'utf8')

const ROOT_MARKER = 'hf-theme hf-ui sales-list-visual'
const PORTAL_MARKER = 'hf-theme hf-ui sales-list-portal'

const styles: HTMLStyleElement[] = []

beforeAll(() => {
  // Reka highlights the active option through `scrollIntoView`, which jsdom
  // does not implement. Patch it for this file only.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

// Only the local <style> probes are torn down here; the mounted tree (and its
// teleported popups) is released by the auto-unmount hook below, so the body is
// never cleared while Vue still holds node references.
afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
})

// `mountWithUApp` returns a child wrapper, so unmount must be delegated to the
// test-utils auto-unmount hook rather than called directly.
enableAutoUnmount(afterEach)

function contentRoots(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-slot="content"]'))
}

function lastContentRoot(): HTMLElement | undefined {
  const roots = contentRoots()
  return roots[roots.length - 1]
}

/**
 * Reka teleports both the filter slideover and its nested select popup to
 * `document.body`, so a wrapper-scoped query is not enough. The slideover
 * content owns the filter layout testid; every other content root is a popup.
 */
function slideoverContentRoot(): HTMLElement | undefined {
  return contentRoots().find(
    (root) => root.querySelector('[data-testid="filters-slideover-layout"]') !== null,
  )
}

function popupContentRoot(): HTMLElement | undefined {
  return contentRoots().find(
    (root) => root.querySelector('[data-testid="filters-slideover-layout"]') === null,
  )
}

function hasPortalMarker(element: Element | undefined): boolean {
  if (!element) return false
  return element.classList.contains('sales-list-portal')
}

// ── CSS parsing helpers (local rules only; `@import` never hits the network) ──

function styleRules(source: string): CSSStyleRule[] {
  const style = document.createElement('style')
  style.textContent = source.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)

  const collected: CSSStyleRule[] = []
  const walk = (list: CSSRuleList | undefined) => {
    if (!list) return
    Array.from(list).forEach((rule) => {
      if ('selectorText' in rule) collected.push(rule as CSSStyleRule)
      else if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules)
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

// ── 1. Scope and tokens ──────────────────────────────────────────────────────

describe('Sales listing adapter — scope and tokens (S1/S3/S4)', () => {
  it('loads a feature-owned adapter on top of the shared opt-in foundation', () => {
    expect(css).toContain("@import '../../../../core/shared/design-system/houndfe-ui.css'")
    expect(view).toContain("import '../styles/sales-list-visual.css'")
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    expect(css).not.toContain('.products-visual')
    expect(css).not.toContain('.clients-visual')
    expect(css).not.toContain('.quotations-list-visual')
    expect(css).not.toContain('hf-shell-products-portal')
  })

  it('uses foundation semantic roles only: no palette literals and no global aliases', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(
      /--hf-(page|surface|surface-muted|field|ink|heading|muted|border|action|on-action|active|active-soft|focus)\s*:/,
    )
    expect(css).not.toMatch(/--ui-[a-z-]+\s*:/)
    // Only the geometry compatibility aliases are remapped; circles keep shape.
    expect(css).toContain('--radius-xl: var(--hf-radius-card)')
    expect(css).toContain('--radius-2xl: var(--hf-radius-card)')
    expect(css).not.toContain('--radius-full')
  })

  it('themes the routed root and forwards the owned portal boundary at each call site', () => {
    expect(view).toMatch(/class="hf-theme hf-ui sales-list-visual[^"]*"/)
    // AppDataTable owns two independent teleported menus.
    expect(view).toContain(`portal-class="${PORTAL_MARKER}"`)
    expect(view).toContain(`pagination-portal-class="${PORTAL_MARKER}"`)
    // The standalone filter slideover + nested popups.
    expect(view).toContain(`portal-class="${PORTAL_MARKER}"`)
    // The native sort select owns its own `ui.content` path.
    expect(view).toContain(`content: '${PORTAL_MARKER}'`)
    expect(view).not.toContain('hf-shell-products-portal')
  })

  it('keeps the Products-style page header outside the separate table surface', () => {
    expect(view).toContain('hf-page-header')
    expect(view).toContain('hf-page-title')
    expect(view).toContain('hf-page-subtitle')
    expect(view).toContain('hf-table-surface')
    expect(view).toContain('hf-table-content')
    expect(view).toContain('hf-data-table')
    // The fixed Coco body override of the old wrapping card is gone.
    expect(view).not.toMatch(/bg-coco-neutral-/)
    // Spanish copy preserved verbatim.
    expect(view).toContain('Listado de ventas confirmadas')
  })

  it('compacts toolbar, pagination and numeric cells inside the listing only', () => {
    expect(css).toContain('.sales-list-visual .hf-toolbar-actions')
    expect(css).toContain('.sales-list-visual .hf-toolbar-filters')
    expect(css).toContain('.sales-list-visual .sales-view-toggle')
    expect(css).toContain('.sales-list-visual .hf-pagination-size')
    expect(css).toContain('.sales-list-visual .hf-pagination-navigation')
    expect(css).toContain('.sales-list-visual .sales-total-value')
    expect(css).toContain('font-variant-numeric: tabular-nums')
  })

  it('styles the card surface and grid behind the opted-in root, never globally', () => {
    expect(css).toContain('.sales-list-visual .sales-card-grid')
    expect(css).toContain('.sales-list-visual .sales-card')
    expect(css).toContain('.sales-list-visual .sales-card:hover')
    expect(css).toContain('.sales-list-visual .sales-card:focus-within')
    expect(grid).toContain('sales-card-grid')
    expect(card).toContain('sales-card')
    // Effective child paint stays feature-owned: every card/grid selector is
    // anchored on the routed root so another consumer is never repainted.
    for (const selector of selectorsOf(css)) {
      if (selector.includes('.sales-card')) {
        expect(selector).toContain('.sales-list-visual')
      }
    }
  })

  it('gives the quick tabs an owned hook without changing their behaviour', () => {
    expect(tabs).toContain('sales-status-tab')
    expect(css).toContain('.sales-list-visual .sales-status-tab:focus-visible')
  })

  it('never selects shared data slots or global elements from the listing scope', () => {
    const selectors = selectorsOf(css)
    expect(selectors.length).toBeGreaterThan(0)
    expect(selectors.some((selector) => /^(?:\*|html|body|:root)$/.test(selector))).toBe(false)
    for (const selector of selectors) {
      expect(selector).toMatch(/\.sales-list-(?:visual|portal)/)
      expect(selector).not.toContain('[data-slot=')
      expect(selector).not.toMatch(
        /^(?:\*|html|body|:root|button|input|select|textarea|a|table)\b/,
      )
    }
  })

  it('paints the teleported boundary from the foundation roles only once opted in', () => {
    const rules = styleRules(css)
    const portalRule = rules.find(
      (rule) => rule.selectorText.trim() === '.hf-theme.sales-list-portal',
    )
    expect(portalRule).toBeDefined()
    expect(portalRule!.style.getPropertyValue('background-color').trim()).toBe('var(--hf-surface)')
    expect(portalRule!.style.getPropertyValue('border-color').trim()).toBe('var(--hf-border)')
    expect(portalRule!.style.getPropertyValue('color').trim()).toBe('var(--hf-ink)')

    const portal = document.createElement('div')
    portal.className = `${PORTAL_MARKER}`
    document.body.append(portal)
    expect(portal.matches(portalRule!.selectorText)).toBe(true)
    const adapterRoot = styleRules(sharedCss).find((rule) => rule.selectorText.trim() === '.hf-ui')!
    // The shared adapter pairs the solid action with the matching foreground,
    // including the dark-mode value.
    expect(adapterRoot.style.getPropertyValue('--ui-primary').trim()).toBe('var(--hf-action)')

    // Negative control: a plain shared boundary without the local marker, and
    // an unrelated feature marker, must not inherit the Sales portal surface.
    const plain = document.createElement('div')
    plain.className = 'hf-theme hf-ui'
    const other = document.createElement('div')
    other.className = 'hf-theme hf-ui quotations-list-portal'
    document.body.append(plain, other)
    expect(plain.matches(portalRule!.selectorText)).toBe(false)
    expect(other.matches(portalRule!.selectorText)).toBe(false)

    portal.remove()
    plain.remove()
    other.remove()
  })
})

// ── 2. Native portal ownership (installed @nuxt/ui + Reka UI) ────────────────

const filterSchema = defineFiltersSchema([
  filter.multiEnum({
    id: 'status',
    label: 'Estado',
    param: 'status',
    options: [{ label: 'Confirmada', value: 'CONFIRMED' }],
  }),
])

describe('Sales listing adapter — installed native popup ownership (S3/S4)', () => {
  it('forwards the marker onto the real filter slideover content root', async () => {
    const wrapper = mountWithUApp(DataTableFilters, {
      attachTo: document.body,
      props: { schema: filterSchema, portalClass: PORTAL_MARKER },
    })
    await wrapper.get('[data-testid="filters-trigger"]').trigger('click')
    await flushPromises()

    const slideoverContent = slideoverContentRoot()
    expect(slideoverContent).toBeDefined()
    expect(hasPortalMarker(slideoverContent)).toBe(true)
  })

  it('keeps the filter slideover inert when portalClass is absent', async () => {
    const wrapper = mountWithUApp(DataTableFilters, {
      attachTo: document.body,
      props: { schema: filterSchema },
    })

    await wrapper.get('[data-testid="filters-trigger"]').trigger('click')
    await flushPromises()

    const slideoverContent = slideoverContentRoot()
    expect(slideoverContent).toBeDefined()
    expect(hasPortalMarker(slideoverContent)).toBe(false)
  })

  it('forwards the marker onto the real nested filter select popup root', async () => {
    const wrapper = mountWithUApp(DataTableFilters, {
      attachTo: document.body,
      props: { schema: filterSchema, portalClass: PORTAL_MARKER },
    })
    await wrapper.get('[data-testid="filters-trigger"]').trigger('click')
    await flushPromises()

    const enumTrigger = document.body.querySelector<HTMLElement>('[data-testid="enum-select"]')
    expect(enumTrigger).not.toBeNull()
    expect(hasPortalMarker(enumTrigger!)).toBe(false)

    await new DOMWrapper(enumTrigger!).trigger('click')
    await flushPromises()

    const popupContent = popupContentRoot()
    expect(popupContent).toBeDefined()
    expect(hasPortalMarker(popupContent)).toBe(true)
    // Teleported: the themed root is not nested inside its trigger.
    expect(popupContent!.closest('[data-testid="enum-select"]')).toBeNull()
  })

  it('forwards paginationPortalClass onto the real page-size menu content root', async () => {
    const wrapper = mountWithUApp(DataTablePagination, {
      attachTo: document.body,
      props: {
        pageIndex: 0,
        pageSize: 10,
        pageCount: 3,
        totalCount: 50,
        showingFrom: 1,
        showingTo: 10,
        pageSizeOptions: [10, 20],
        portalClass: PORTAL_MARKER,
      },
    })
    await wrapper.get('.hf-pagination-size').trigger('click')
    await flushPromises()

    const pageSizeContent = lastContentRoot()
    expect(pageSizeContent).toBeDefined()
    expect(hasPortalMarker(pageSizeContent)).toBe(true)
  })

  it('keeps the page-size menu on its native defaults when portalClass is absent', async () => {
    const wrapper = mountWithUApp(DataTablePagination, {
      attachTo: document.body,
      props: {
        pageIndex: 0,
        pageSize: 10,
        pageCount: 3,
        totalCount: 50,
        showingFrom: 1,
        showingTo: 10,
        pageSizeOptions: [10, 20],
      },
    })
    expect(wrapper.findComponent({ name: 'DropdownMenu' }).props('ui')).toBeUndefined()

    await wrapper.get('.hf-pagination-size').trigger('click')
    await flushPromises()
    expect(hasPortalMarker(lastContentRoot())).toBe(false)
  })

  it('forwards portalClass onto the real toolbar column menu content root', async () => {
    const column = {
      id: 'customer',
      columnDef: { header: 'Cliente' },
      getCanHide: () => true,
      getIsVisible: () => true,
      toggleVisibility: () => {},
    }
    mountWithUApp(DataTableToolbar, {
      attachTo: document.body,
      props: {
        globalFilter: '',
        portalClass: PORTAL_MARKER,
        showColumnVisibility: true,
        tableApi: { getAllColumns: () => [column] },
      },
    })

    const columnButton = Array.from(document.body.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Columnas'),
    )
    expect(columnButton).toBeDefined()
    await new DOMWrapper(columnButton!).trigger('click')
    await flushPromises()

    const menuContent = lastContentRoot()
    expect(menuContent).toBeDefined()
    expect(hasPortalMarker(menuContent)).toBe(true)
  })

  it('never paints the shared adapter root itself with the sales marker', () => {
    expect(sharedCss).not.toContain('sales-list-portal')
    expect(view).toMatch(new RegExp(ROOT_MARKER.replace(/ /g, '\\s+')))
  })
})
