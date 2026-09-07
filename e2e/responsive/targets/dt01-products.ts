import type { Locator, Page } from '@playwright/test'
import {
  stampEvidenceSurface,
  uniqueAnchor,
  type ResponsiveTargetAdapter,
} from './types'

type ProductActions = { viewToggle: Locator; rowMenu: Locator; pinnedActions: Locator; search: Locator; typeFilter: Locator; pageSize: Locator }
type ProductStates = { error: Locator; errorRetry: Locator; loading: Locator; empty: Locator }

export const DT01_PRODUCTS: ResponsiveTargetAdapter<ProductActions, ProductStates> = {
  surfaceId: 'DT-01', archetype: 'DT', route: '/pos/products', containerOwner: 'dashboard-panel',
  strategy: 'contained-table-scroll', fixtureId: 'products-stress',
  essentialFields: ['product identity/SKU', 'price/stock/status', 'product actions'],
  supportedStates: ['loading', 'fetching', 'success', 'empty', 'no-match', 'error', 'paginated'],
  preferenceKeys: ['products-view-mode', 'table-preferences-pos-products'], risks: ['R1', 'R2', 'R3', 'R5', 'R6', 'R7', 'R8'],
  exclusions: [
    { assertionId: 'overlay-lifecycle', reason: 'DT-01 adapter does not open product overlays in this representative slice', followUp: 'WU-4d strict surface specs' },
    { assertionId: 'surface-state', stateId: 'selection-bulk', reason: 'Product rows disable selection and expose no bulk action', followUp: 'Batch B bulk-action evidence' },
    { assertionId: 'scroll-extremes', stateId: 'cards', reason: 'DT-01 card strategy renders a no-horizontal-scroll grid with no local scroll region, so left/right scroll extremes do not apply', followUp: 'Batch C card scroll targets' },
    { assertionId: 'sticky-pinned-alignment', stateId: 'cards', reason: 'DT-01 card strategy renders no sticky header and no pinned columns, so sticky/pinned alignment does not apply', followUp: 'Batch C card sticky targets' },
  ],
  stateDrivers: {
    success: { scenario: 'success', status: 'ready' }, loading: { scenario: 'loading', status: 'ready' },
    fetching: { scenario: 'fetching', status: 'ready' }, empty: { scenario: 'empty', status: 'ready' },
    noMatch: { scenario: 'no-match', status: 'ready' }, error: { scenario: 'error-5xx', status: 'ready' },
    paginated: { scenario: 'paginated', status: 'ready' },
  },
  async resolve(page: Page) {
    const owner = await uniqueAnchor(page.locator('#hound-dashboard-panel-main-panel'), 'DT-01 dashboard owner')
    const heading = owner.getByRole('heading', { name: 'Productos' })
    await heading.waitFor()
    await uniqueAnchor(heading, 'DT-01 Products heading')
    const table = owner.getByTestId('table-view'), cards = owner.getByTestId('product-cards-grid')
    const total = await table.count() + await cards.count()
    if (total !== 1) throw new Error(`DT-01 table or cards anchor must resolve exactly once; found ${total}`)
    const mode = await table.count() === 1 ? 'table' as const : 'cards' as const
    const anchor = await uniqueAnchor(mode === 'table' ? table : cards, `DT-01 ${mode} anchor`)
    await stampEvidenceSurface(owner, 'DT-01')
        return {
          target: DT01_PRODUCTS, anchor: owner, mode, preferences: DT01_PRODUCTS.preferenceKeys,
          // Toolbar controls resolve lazily: the spec enforces uniqueness and visibility when it consumes them,
          // because representative slices (card mode, minimal fixtures) legitimately do not render the toolbar.
          actions: {
            viewToggle: await uniqueAnchor(owner.getByRole('tablist', { name: 'Seleccionar vista de productos' }), 'DT-01 view toggle'),
            rowMenu: mode === 'table'
              ? anchor.locator('tbody tr').first().locator('td').last().getByRole('button')
              : anchor.locator('article').first().getByRole('button', { name: 'Acciones del producto' }),
            pinnedActions: anchor.locator('[data-pinned="right"]'),
            search: owner.getByPlaceholder('Buscar productos...'),
            typeFilter: owner.getByRole('combobox', { name: 'Filtrar por tipo' }),
            pageSize: owner.getByRole('button', { name: /por página/ }),
          },
      states: { error: anchor.getByTestId('table-error-state'), errorRetry: anchor.getByTestId('table-error-retry'), loading: anchor.getByTestId('mobile-cards-loading'), empty: anchor.getByTestId('mobile-empty-state') },
    }
  },
}
