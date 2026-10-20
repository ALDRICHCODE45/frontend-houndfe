import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/delivery-routes/styles/delivery-routes-visual.css', 'utf8')

// Source contracts, not rendered fidelity.
describe('Delivery routes presentation adapter', () => {
  it('maps the dark palette onto the listing and every owned portal', () => {
    for (const marker of [
      'delivery-routes-visual',
      'delivery-routes-driver',
      'delivery-routes-list-portal',
      'delivery-routes-form-portal',
    ]) {
      expect(css).toMatch(new RegExp(`(^|,\\s*)\\.dark \\.hf-theme\\.${marker}[,\\s{]`, 'm'))
    }
    expect(css).not.toContain('.dark .dark')
  })

  it('stays scoped: no global root, important overrides or other module markers', () => {
    expect(css).not.toContain(':root')
    expect(css).not.toContain('!important')
    expect(css).not.toContain('promotions-')
  })
})

// ── Driver views (active-route list + route-tracking cockpit) ───────────────
const dr = 'src/features/delivery-routes'
const read = (path: string) => readFileSync(`${dr}/${path}`, 'utf8')
const cockpitFiles = [
  'components/DriverRouteCard.vue',
  'components/cockpit/DriverCockpitDrawer.vue',
  'components/cockpit/DriverCockpitHeader.vue',
  'components/cockpit/DriverRouteCockpit.vue',
  'components/cockpit/DriverRouteSpine.vue',
  'components/cockpit/DriverRouteSummary.vue',
  'components/cockpit/DriverStopCard.vue',
  'components/cockpit/DriverStopPanel.vue',
]
const driverPortal = 'hf-theme hf-ui hf-form-overlay delivery-routes-form-portal'

describe('Delivery routes driver views adapter', () => {
  it('opts the driver list and the cockpit branch into the delivery-routes boundary', () => {
    const list = read('views/DeliveryRoutesListView.vue')
    const detail = read('views/DeliveryRouteDetailView.vue')
    expect(list).toMatch(/v-if="isDriver"[^>]*hf-theme hf-ui delivery-routes-driver/s)
    expect(detail).toContain("import '../styles/delivery-routes-visual.css'")
    expect(detail).toMatch(
      /data-testid="detail-driver-branch"[^>]*hf-theme hf-ui delivery-routes-driver/s,
    )
  })

  it('removes legacy coco paint from every driver surface', () => {
    for (const file of cockpitFiles)
      expect(read(file), file).not.toMatch(/coco-(gold|navy|neutral)/)
  })

  it('pairs every check-in call to action with the shared primary control', () => {
    expect(read('components/cockpit/DriverStopCard.vue')).toContain('hf-primary-control')
    expect(
      read('components/cockpit/DriverCockpitDrawer.vue').match(/hf-primary-control/g)?.length,
    ).toBe(2)
  })

  it('themes the drawer, the header menu and the check-in confirmation portals', () => {
    const drawer = read('components/cockpit/DriverCockpitDrawer.vue')
    expect(drawer.match(new RegExp(`content: '${driverPortal} `, 'g'))?.length).toBe(2)
    expect(drawer).toContain('motion-reduce:transition-none motion-reduce:duration-0')
    expect(drawer).toContain('overflow-hidden')
    expect(read('components/cockpit/DriverCockpitHeader.vue')).toContain(
      `content: '${driverPortal}'`,
    )
    expect(read('components/cockpit/DriverRouteCockpit.vue')).toContain(
      `content: '${driverPortal}'`,
    )
  })

  it('maps stop emphasis and progress to semantic roles', () => {
    expect(read('components/cockpit/DriverStopCard.vue')).toContain(
      'delivery-routes-stop-card--current',
    )
    expect(read('components/cockpit/DriverStopCard.vue')).toContain(
      'delivery-routes-stop-sequence--current',
    )
    expect(read('components/cockpit/DriverStopCard.vue')).toContain('delivery-routes-next-badge')
    expect(read('components/cockpit/DriverRouteSummary.vue')).toContain(
      'delivery-routes-progress-fill',
    )
    for (const hook of [
      '.delivery-routes-stop-current--pending',
      '.delivery-routes-stop-current--in-progress',
      '.delivery-routes-stop-card--current',
      '.delivery-routes-stop-sequence--current',
      '.delivery-routes-next-badge',
      '.delivery-routes-progress-fill',
    ]) {
      expect(css, hook).toContain(hook)
    }
    expect(css).toMatch(/\.delivery-routes-stop-current--in-progress\s*\{[^}]*--hf-warning/)
    expect(css).toMatch(/\.delivery-routes-progress-fill\s*\{[^}]*--hf-success/)
  })
})
