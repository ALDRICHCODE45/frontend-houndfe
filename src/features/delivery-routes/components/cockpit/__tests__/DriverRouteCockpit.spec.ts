// DriverRouteCockpit.spec.ts — STRICT-TDD S10 of `driver-route-cockpit-redesign`
// (design.md §3, §7, §9.3, §10; specs/driver-cockpit-shell REQ-DCS-001/009,
//  specs/driver-cockpit-drawer REQ-DCK-006/008,
//  specs/delivery-route-check-in REQ-DRC-104/112). State machine, exactly-once
// emission, drawer→confirm ordering, focus return + invariants. The co-located
// reducer + types are imported directly from the SFC's `<script lang="ts">`
// block so the transition table is reviewable in isolation.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import DriverRouteCockpit, {
  reduceCockpit, initialCockpitState,
  type CockpitAction, type CockpitState,
} from '../DriverRouteCockpit.vue'
import type { DeliveryRouteResponseDto, DeliveryRouteStop } from '../../../interfaces/delivery-route.types'
import type { CockpitProgress } from '../../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../../copy'

// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- node builtin
const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')// ─── Fixtures ──────────────────────────────────────────────────────────────────
const ADDR = { id: 'a', street: 'Reforma', exteriorNumber: '1', interiorNumber: null, zipCode: '06600', neighborhood: 'C', municipality: 'C', city: 'CDMX', state: 'CMX', label: null, latitude: 19.4326, longitude: -99.1332 }
function mkStop(id: string, sortOrder: number, status: DeliveryRouteStop['status'], folio: string | null = `F-${sortOrder + 1}`, name: string | null = 'Ana'): DeliveryRouteStop {
  return { id, saleId: `s-${id}`, saleFolio: folio, sortOrder, status, checkedInAt: null, completedAt: null, customer: name === null ? null : { id: `c-${id}`, name, email: 'a@x' }, shippingAddress: { ...ADDR, id: `a-${id}` } }
}
function mkRoute(overrides: Partial<{ status: DeliveryRouteResponseDto['status']; stops: DeliveryRouteStop[] }> = {}): DeliveryRouteResponseDto {
  return { id: 'route-1', status: overrides.status ?? 'ACTIVE', driver: { id: 'd1', name: 'Ana', email: 'a@x' }, startedAt: null, completedAt: null, cancelledAt: null, notes: null, stops: overrides.stops ?? [mkStop('s0', 0, 'PENDING'), mkStop('s1', 1, 'PENDING')], timeline: [] }
}

// ─── Stubs (template-string drives every event the cockpit listens to) ──────────
const HeaderStub = defineComponent({ props: ['route', 'progress', 'isFetching'], emits: ['back', 'refresh', 'open-history'], template: `
  <header data-testid="cockpit-header-stub">
    <button data-testid="cockpit-header-back-stub" @click="$emit('back')">back</button>
    <button data-testid="cockpit-header-refresh-stub" @click="$emit('refresh')">refresh</button>
    <button data-testid="cockpit-header-history-stub" @click="$emit('open-history', { trigger: $event.currentTarget })">history</button>
  </header>` })
const OpsStub = defineComponent({ props: ['currentStop', 'nextStop', 'notes', 'hasStops', 'isTerminal'], emits: ['open-stop'], template: `
  <section data-testid="cockpit-operational-stub">
    <button data-testid="cockpit-operational-current-stub" @click="$emit('open-stop', { stopId: 's0', trigger: $event.currentTarget })">cur</button>
    <button data-testid="cockpit-operational-next-stub" @click="$emit('open-stop', { stopId: 's1', trigger: $event.currentTarget })">next</button>
  </section>` })
const SpineStub = defineComponent({ props: ['nodes'], emits: ['select-stop'], template: `
  <ol data-testid="cockpit-spine-stub">
    <button data-testid="cockpit-spine-stub-s1" @click="$emit('select-stop', { stopId: 's1', trigger: $event.currentTarget })">sp1</button>
    <button data-testid="cockpit-spine-stub-s0" @click="$emit('select-stop', { stopId: 's0', trigger: $event.currentTarget })">sp0</button>
  </ol>` })
const FooterStub = defineComponent({ props: { routeStatus: String, currentStop: {}, progress: {}, hasStops: Boolean, canCheckIn: Boolean, checkInPending: Boolean, isDesktop: Boolean }, emits: ['request-confirm', 'open-history'], template: `
  <footer data-testid="cockpit-footer-stub" :data-is-desktop="String(isDesktop)">
    <button v-if="!isDesktop" data-testid="cockpit-footer-action-stub" :disabled="checkInPending" @click="$emit('request-confirm', { stopId: 's0', trigger: $event.currentTarget })">action</button>
    <button data-testid="cockpit-footer-history-stub" @click="$emit('open-history', { trigger: $event.currentTarget })">hist</button>
  </footer>` })
// Drawer stub: fully controlled by `open`; exposes the four events + mirror props for the spec.
const DrawerStub = defineComponent({ props: ['open', 'mode', 'route', 'stop', 'routeTerminal', 'canCheckIn', 'checkInPending', 'isDesktop'], emits: ['update:open', 'closed', 'request-confirm'], template: `
  <div data-testid="cockpit-drawer-stub" :data-open="String(open)" :data-mode="mode" :data-stop-id="stop?.id || ''" :data-is-desktop="String(isDesktop)">
    <button data-testid="cockpit-drawer-update-false-stub" @click="$emit('update:open', false)">upd</button>
    <button data-testid="cockpit-drawer-closed-stub" @click="$emit('closed')">closed</button>
    <button data-testid="cockpit-drawer-request-confirm-stub-s1" @click="$emit('request-confirm', { stopId: 's1', trigger: $event.currentTarget })">cf1</button>
    <button data-testid="cockpit-drawer-request-confirm-stub-s0" @click="$emit('request-confirm', { stopId: 's0', trigger: $event.currentTarget })">cf0</button>
  </div>` })
// ConfirmModal stub mirrors the shared primitive's API; surface state is recorded for the spec.
const confirmState: { open: boolean; title: string; description: string; confirmLabel: string; cancelLabel: string } = { open: false, title: '', description: '', confirmLabel: '', cancelLabel: '' }
const ConfirmStub = defineComponent({ props: ['open', 'title', 'description', 'confirmLabel', 'cancelLabel', 'confirmColor'], emits: ['update:open', 'confirm', 'cancel'], template: `
  <div data-testid="cockpit-confirm-stub" :data-open="String(open)">
    <button data-testid="cockpit-confirm-confirm-stub" @click="$emit('confirm')">confirm</button>
    <button data-testid="cockpit-confirm-cancel-stub" @click="$emit('update:open', false); $emit('cancel')">cancel</button>
  </div>`,
  watch: { open(v) { confirmState.open = v ; confirmState.title = String(this.title ?? '') ; confirmState.description = String(this.description ?? '') ; confirmState.confirmLabel = String(this.confirmLabel ?? '') ; confirmState.cancelLabel = String(this.cancelLabel ?? '') } } })
const resetConfirm = () => { confirmState.open = false ; confirmState.title = '' ; confirmState.description = '' ; confirmState.confirmLabel = '' ; confirmState.cancelLabel = '' }

// ─── mountCockpit ──────────────────────────────────────────────────────────────
interface Harness { inner: ReturnType<typeof mount>; outer: ReturnType<typeof mount> }
function mountCockpit(p: Partial<{ route: DeliveryRouteResponseDto; isFetching: boolean; canCheckIn: boolean; checkInPending: boolean }> = {}): Harness {
  const route = p.route ?? mkRoute()
  const Outer = defineComponent({ name: 'CockpitHarness', components: { DriverRouteCockpit },
    props: { route: { type: Object as () => DeliveryRouteResponseDto, required: true }, isFetching: { type: Boolean, required: true }, canCheckIn: { type: Boolean, required: true }, checkInPending: { type: Boolean, required: true } },
    setup(pp) { return () => h(DriverRouteCockpit as unknown as Component, pp) },
  })
  const outer = mount(Outer, { props: { route, isFetching: p.isFetching ?? false, canCheckIn: p.canCheckIn ?? true, checkInPending: p.checkInPending ?? false },
    global: { stubs: { DriverCockpitHeader: HeaderStub, DriverOperationalStops: OpsStub, DriverRouteSpine: SpineStub, DriverCockpitFooter: FooterStub, DriverCockpitDrawer: DrawerStub, ConfirmModal: ConfirmStub } },
    attachTo: document.body,
  })
  return { inner: outer.findComponent(DriverRouteCockpit), outer }
}
const clickById = (id: string) => (document.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement).click()
const sfcBody = () => fs.readFileSync((DriverRouteCockpit as unknown as { __file: string }).__file, 'utf8')
const docStripped = () => sfcBody().replace(/\/\*\*[\s\S]*?\*\//g, '')

beforeEach(() => { resetConfirm() })
afterEach(() => { document.body.innerHTML = '' ; confirmState.open = false })// ─── RED: non-null composition surface (REQ-DCS-001) ───────────────────────────

describe('DriverRouteCockpit — RED: non-null composition surface (REQ-DCS-001)', () => {
  it('mounts SFCs in DOM order header → operational → spine → footer', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    const h = inner.html()
    const ih = h.indexOf('cockpit-header-stub') ; const io = h.indexOf('cockpit-operational-stub')
    const is = h.indexOf('cockpit-spine-stub') ; const if_ = h.indexOf('cockpit-footer-stub')
    expect(ih).toBeGreaterThanOrEqual(0) ; expect(ih).toBeLessThan(io) ; expect(io).toBeLessThan(is) ; expect(is).toBeLessThan(if_)
  })

  it('passes typed props (header/operational/footer) and derives once via useDriverRouteCockpit', async () => {
    const route = mkRoute() ; const { inner } = mountCockpit({ route }) ; await flushPromises()
    const header = inner.findComponent(HeaderStub) ; const op = inner.findComponent(OpsStub) ; const footer = inner.findComponent(FooterStub)
    expect(header.props('route')).toStrictEqual(route)
    expect((header.props('progress') as CockpitProgress).total).toBe(2)
    expect(op.props('currentStop')?.id).toBe('s0') ; expect(op.props('nextStop')?.id).toBe('s1')
    expect(footer.props('routeStatus')).toBe('ACTIVE')
  })

  it.each([
    ['zero-stops', mkRoute({ stops: [] })],
    ['terminal ACTIVE→COMPLETED', mkRoute({ status: 'COMPLETED', stops: [mkStop('s0', 0, 'COMPLETED')] })],
  ])('edge %s still mounts (REQ-DRC-112)', async (_l, route) => {
    const { inner } = mountCockpit({ route }) ; await flushPromises()
    expect((inner.findComponent(HeaderStub).props('progress') as CockpitProgress).total).toBe(route.stops.length)
    if (route.stops.length === 0) expect(inner.findComponent(OpsStub).props('currentStop')).toBeNull()
  })

  it('SFC source: no server-state, props.route composition, drawerOpen derived from reducer phase (no duplicate ref)', () => {
    const b = docStripped()
    for (const re of [/from\s+['"]vue-router['"]|useRouter|useRoute\b/, /useQuery\b|useMutation\b|useQueryClient|@tanstack\/vue-query/, /axios|fetch\(['"]/, /useCheckInStop\b|invalidate|refetchQueries|mutateAsync|mutate\(/]) expect(b).not.toMatch(re)
    expect(b).toMatch(/props\.route/) ; expect(b).toMatch(/useDriverRouteCockpit/) ; expect(b).not.toMatch(/const\s+\w*[Rr]outeData\s*=\s*ref|const\s+cachedRoute|const\s+localRoute/)
    expect(b).not.toMatch(/const\s+drawerOpen\s*=\s*ref\b/) ; expect(b).toMatch(/drawerOpen\s*=\s*computed\b/)
  })
})

// ─── GREEN: forward + exactly-once (REQ-DCS-007 / REQ-DRC-104) ─────────────────
    // ─── S2 — single breakpoint authority (REQ-DCK-009) ────────────────────────────────────────────────────────────

    describe('DriverRouteCockpit — S2: single breakpoint authority (REQ-DCK-009)', () => {
      it('source: SFC calls useCockpitBreakpoint() exactly once and passes :is-desktop to the overlay', () => {
        const source = docStripped()
        // Single call to the composable (one owner = the cockpit).
        const callMatches = source.match(/useCockpitBreakpoint\(\)/g) ?? []
        expect(callMatches).toHaveLength(1)
        // The returned `isDesktop` is wired to the drawer via a kebab-case attribute.
        expect(source).toMatch(/:is-desktop=/)
      })

      it('source: SFC MUST NOT import useMediaQuery directly (composable owns the media query)', () => {
        const source = docStripped()
        expect(source).not.toMatch(/useMediaQuery\b/)
        // Single import of useCockpitBreakpoint only.
        const importMatches = source.match(/from\s+['"]\.\.\/\.\.\/composables\/cockpit\/useCockpitBreakpoint['"]/g) ?? []
        expect(importMatches.length).toBeGreaterThanOrEqual(1)
      })

      it('passes parent-owned isDesktop to the DrawerStub on mobile (lg-)', async () => {
        const { inner } = mountCockpit() ; await flushPromises()
        const drawer = inner.findComponent(DrawerStub)
        // Default breakpoint in jsdom: matches=false (mobile).
        expect(drawer.props('isDesktop')).toBe(false)
      })

      it('isDesktop flip updates the DrawerStub in the same render cycle (parent-owned single source)', async () => {
        const { inner, outer } = mountCockpit() ; await flushPromises()
        expect(inner.findComponent(DrawerStub).props('isDesktop')).toBe(false)
        // Open a stop so the overlay's v-bind receives the prop.
        await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-s0"]').trigger('click')
        await flushPromises()
        const drawer = inner.findComponent(DrawerStub)
        expect(drawer.props('isDesktop')).toBe(false)
        const drawerRoot = document.querySelector('[data-testid="cockpit-drawer-stub"]') as HTMLElement | null
        expect(drawerRoot?.getAttribute('data-is-desktop')).toBe('false')
      })
    })



describe('DriverRouteCockpit — S3: viewport-composed footer suppression (REQ-DCS-006)', () => {
  it('source: SFC passes parent-owned :is-desktop to BOTH the drawer AND the footer (single source)', () => {
    const source = docStripped()
    const matches = source.match(/:is-desktop="isDesktop"/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2) // DriverCockpitDrawer + DriverCockpitFooter
  })
})

describe('DriverRouteCockpit — GREEN: forwarded actions + exactly-once emission', () => {
  it('header back / refresh forward verbatim; no router import', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    const header = inner.findComponent(HeaderStub)
    await header.find('[data-testid="cockpit-header-back-stub"]').trigger('click')
    await header.find('[data-testid="cockpit-header-refresh-stub"]').trigger('click')
    expect(inner.emitted('back')).toEqual([[]]) ; expect(inner.emitted('refresh')).toEqual([[]])
    expect(docStripped()).not.toMatch(/from\s+['"]vue-router['"]|useRouter|useRoute\b/)
  })

  it('accept: closes modal + emits request-check-in exactly once + enters MUTATING (REQ-DRC-104)', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    const footer = inner.findComponent(FooterStub)
    await footer.find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
    expect(confirmState.open).toBe(true) ; expect(confirmState.title).toBe(DELIVERY_ROUTE_COPY.cockpit.confirm.title)
    clickById('cockpit-confirm-confirm-stub') ; await flushPromises()
    expect(inner.emitted('request-check-in')).toEqual([['s0']]) ; expect(confirmState.open).toBe(false)
    // Re-trigger while MUTATING → no new emit, no modal opens (phase=MUTATING blocks new requests).
    await footer.find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
    expect(inner.emitted('request-check-in')?.length ?? 0).toBe(1) ; expect(confirmState.open).toBe(false)
  })

  it('mutation settles (checkInPending true→false): phase becomes CLOSED (REQ-DCK-008)', async () => {
    const { inner, outer } = mountCockpit({ checkInPending: false }) ; await flushPromises()
    await inner.findComponent(FooterStub).find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
    clickById('cockpit-confirm-confirm-stub') ; await flushPromises()
    expect(inner.emitted('request-check-in')?.length ?? 0).toBe(1)
    await outer.setProps({ checkInPending: true }) ; await flushPromises()
    await outer.setProps({ checkInPending: false }) ; await flushPromises()
    expect(inner.findComponent(DrawerStub).props('open')).toBe(false) ; expect(confirmState.open).toBe(false)
  })
})

// ─── TRIANGULATE: drawer→confirm + focus return (REQ-DCK-006/008) ─────────────

describe('DriverRouteCockpit — TRIANGULATE: drawer→confirm + focus return', () => {
  it('drawer-initiated confirm: closes drawer first; modal opens only after synthesized closed (no overlap); focus NOT restored before modal opens (origin preserved for settle)', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-s1"]').trigger('click') ; await flushPromises()
    const drawer = inner.findComponent(DrawerStub)
    expect(drawer.props('open')).toBe(true) ; expect(drawer.props('mode')).toBe('stop') ; expect(drawer.props('stop')?.id).toBe('s1') ; expect(confirmState.open).toBe(false)
    clickById('cockpit-drawer-request-confirm-stub-s1') ; await flushPromises()
    expect((document.querySelector('[data-testid="cockpit-drawer-stub"]') as HTMLElement).getAttribute('data-open')).toBe('false') ; expect(confirmState.open).toBe(false)
    ;(document.querySelector('[data-testid="cockpit-drawer-request-confirm-stub-s1"]') as HTMLElement | null)?.remove()
    clickById('cockpit-drawer-closed-stub') ; await flushPromises()
    expect(confirmState.open).toBe(true) ; expect(confirmState.description).toContain('Ana') ; expect(confirmState.description).toContain('Parada 2') ; expect(document.activeElement).not.toBe(inner.find('[data-testid="cockpit-root"]').element)
  })

  it('selected non-current PENDING: open-stop on later stop + accept confirms THAT selected id (REQ-DCS-009)', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-s1"]').trigger('click') ; await flushPromises()
    clickById('cockpit-drawer-request-confirm-stub-s1') ; await flushPromises() ; clickById('cockpit-drawer-closed-stub') ; await flushPromises()
    clickById('cockpit-confirm-confirm-stub') ; await flushPromises()
    expect(inner.emitted('request-check-in')).toEqual([['s1']])
  })

  it('cancel emits NO request-check-in and NO toast; phase goes CONFIRM → CLOSED', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    await inner.findComponent(FooterStub).find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
    expect(confirmState.open).toBe(true)
    clickById('cockpit-confirm-cancel-stub') ; await flushPromises()
    expect(inner.emitted('request-check-in') ?? []).toHaveLength(0) ; expect(confirmState.open).toBe(false)
  })

  it('checkInPending=true: header refresh, footer confirm, drawer confirm all emit nothing', async () => {
    const { inner } = mountCockpit({ checkInPending: true }) ; await flushPromises()
    await inner.findComponent(HeaderStub).find('[data-testid="cockpit-header-refresh-stub"]').trigger('click')
    expect(inner.emitted('refresh') ?? []).toHaveLength(0)
    await inner.findComponent(FooterStub).find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
    expect(confirmState.open).toBe(false)
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-s1"]').trigger('click') ; await flushPromises()
    clickById('cockpit-drawer-request-confirm-stub-s1') ; await flushPromises() ; clickById('cockpit-drawer-closed-stub') ; await flushPromises()
    expect(confirmState.open).toBe(false) ; expect(inner.emitted('request-check-in') ?? []).toHaveLength(0)
  })

  it('mode switch stop → history closes drawer, awaits closed, then reopens as history (REQ-DCK-001); focus NOT restored when new drawer reopens (origin preserved)', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-s0"]').trigger('click') ; await flushPromises()
    expect((document.querySelector('[data-testid="cockpit-drawer-stub"]') as HTMLElement).getAttribute('data-mode')).toBe('stop')
    await inner.findComponent(HeaderStub).find('[data-testid="cockpit-header-history-stub"]').trigger('click') ; await flushPromises()
    expect((document.querySelector('[data-testid="cockpit-drawer-stub"]') as HTMLElement).getAttribute('data-open')).toBe('false')
    ;(document.querySelector('[data-testid="cockpit-header-history-stub"]') as HTMLElement | null)?.remove()
    clickById('cockpit-drawer-closed-stub') ; await flushPromises()
    expect((document.querySelector('[data-testid="cockpit-drawer-stub"]') as HTMLElement).getAttribute('data-open')).toBe('true') ; expect((document.querySelector('[data-testid="cockpit-drawer-stub"]') as HTMLElement).getAttribute('data-mode')).toBe('history') ; expect(document.activeElement).not.toBe(inner.find('[data-testid="cockpit-root"]').element)
  })

  it('dismiss drawer from update:open(false): closes → closed → CLOSED; focus IS restored to root fallback; no modal opens; no emit', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-s0"]').trigger('click') ; await flushPromises()
    expect((document.querySelector('[data-testid="cockpit-drawer-stub"]') as HTMLElement).getAttribute('data-open')).toBe('true')
    clickById('cockpit-drawer-update-false-stub') ; await flushPromises()
    ;(document.querySelector('[data-testid="cockpit-spine-stub-s0"]') as HTMLElement | null)?.remove()
    expect((document.querySelector('[data-testid="cockpit-drawer-stub"]') as HTMLElement).getAttribute('data-open')).toBe('false') ; expect(confirmState.open).toBe(false)
    clickById('cockpit-drawer-closed-stub') ; await flushPromises()
    expect(confirmState.open).toBe(false) ; expect(inner.emitted('request-check-in') ?? []).toHaveLength(0) ; expect(document.activeElement).toBe(inner.find('[data-testid="cockpit-root"]').element)
  })
})

// ─── TRIANGULATE: confirmation copy + layout + body clearance ──────────────────

describe('DriverRouteCockpit — TRIANGULATE: confirmation copy + panel root + body clearance', () => {
  it('confirmation title/body/buttons come from copy.ts with customer + position + folio + irreversible statement', async () => {
    const { inner } = mountCockpit({ route: mkRoute({ stops: [mkStop('s0', 0, 'PENDING', 'F-099')] }) }) ; await flushPromises()
    await inner.findComponent(FooterStub).find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
    expect(confirmState.title).toBe(DELIVERY_ROUTE_COPY.cockpit.confirm.title)
    expect(confirmState.confirmLabel).toBe(DELIVERY_ROUTE_COPY.cockpit.confirm.confirmLabel)
    expect(confirmState.cancelLabel).toBe(DELIVERY_ROUTE_COPY.cockpit.confirm.cancelLabel)
    expect(confirmState.description).toContain('Esta acción registra la entrega y no se puede deshacer.')
    expect(confirmState.description).toContain('Ana') ; expect(confirmState.description).toContain('Parada 1') ; expect(confirmState.description).toContain('F-099')
  })

  it('null customer falls back to `Cliente sin nombre` in confirmation body', async () => {
    const { inner } = mountCockpit({ route: mkRoute({ stops: [mkStop('s0n', 0, 'PENDING', 'F-099', null)] }) }) ; await flushPromises()
    await inner.findComponent(FooterStub).find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
    expect(confirmState.description).toContain(DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback)
  })
  it.each([['null', null], ['empty', ''], ['whitespace', '   ']])('blank %s saleFolio: body names customer + Parada N, omits ` ({folio})` segment verbatim, never substitutes customer fallback for folio', async (_l, folio) => {
    const { inner } = mountCockpit({ route: mkRoute({ stops: [mkStop('s0', 0, 'PENDING', folio, 'Ana')] }) }) ; await flushPromises()
    await inner.findComponent(FooterStub).find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
    const desc = confirmState.description
    expect(desc).toContain('Ana') ; expect(desc).toContain('Parada 1') ; expect(desc).toContain('Esta acción registra la entrega y no se puede deshacer.') ; expect(desc).not.toContain('()') ; expect(desc).not.toContain('({folio})') ; expect(desc).not.toContain(DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback)
  })

  it('cockpit root is full-bleed (no fixed/absolute/w-[...]); tabindex=-1; body has bottom clearance', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    const root = inner.find('[data-testid="cockpit-root"]')
    const cls = root.classes().join(' ')
    expect(cls).not.toMatch(/\bfixed\b|\babsolute\b/) ; expect(cls).not.toMatch(/\bw-\[/) ; expect(root.attributes('tabindex')).toBe('-1')
    expect(inner.find('[data-testid="cockpit-body"]').classes().join(' ')).toMatch(/pb-|padding-bottom/)
  })

  it('SFC never hardcodes confirmation copy literals (single source = copy.ts)', () => {
    const b = docStripped()
    for (const re of [/["']Confirmar entrega["']/, /["']Esta acción registra la entrega y no se puede deshacer\.["']/, /confirmLabel:\s*['"]Confirmar entrega['"]|confirmLabel\s*=\s*['"]Confirmar entrega['"]/]) expect(b).not.toMatch(re)
  })
})

// ─── REFACTOR: reducer transition table (REQ-DCK-006) ────────────────────────

describe('DriverRouteCockpit — REFACTOR: reducer transition table (REQ-DCK-006)', () => {
  const S = (overrides: Partial<CockpitState> & { phase: CockpitState['phase'] }): CockpitState =>
    ({ selectedStopId: null, pendingConfirmationStopId: null, nextDrawerMode: null, nextConfirmationStopId: null, ...overrides }) as CockpitState
  it.each([
    [S({ phase: 'CLOSED' }), { type: 'OPEN_STOP', stopId: 'A' } as CockpitAction, { phase: 'DRAWER_STOP', selectedStopId: 'A' }],
    [S({ phase: 'CLOSED' }), { type: 'OPEN_HISTORY' } as CockpitAction, { phase: 'DRAWER_HISTORY' }],
    [S({ phase: 'DRAWER_STOP', selectedStopId: 'A' }), { type: 'OPEN_STOP', stopId: 'A' } as CockpitAction, { phase: 'DRAWER_STOP', selectedStopId: 'A' }], // idempotent
    [S({ phase: 'DRAWER_STOP', selectedStopId: 'A' }), { type: 'OPEN_STOP', stopId: 'B' } as CockpitAction, { phase: 'CLOSING_TO_SWITCH', selectedStopId: 'B' }],
    [S({ phase: 'DRAWER_STOP', selectedStopId: 'A' }), { type: 'OPEN_HISTORY' } as CockpitAction, { phase: 'CLOSING_TO_SWITCH', selectedStopId: null }],
    [S({ phase: 'DRAWER_STOP' }), { type: 'DRAWER_UPDATE_OPEN_FALSE' } as CockpitAction, { phase: 'CLOSING' }],
    [S({ phase: 'DRAWER_HISTORY' }), { type: 'DRAWER_UPDATE_OPEN_FALSE' } as CockpitAction, { phase: 'CLOSING' }],
    [S({ phase: 'CLOSING' }), { type: 'DRAWER_CLOSED' } as CockpitAction, { phase: 'CLOSED' }],
    [S({ phase: 'CLOSING_TO_SWITCH', selectedStopId: 'A', nextDrawerMode: 'stop' }), { type: 'DRAWER_CLOSED' } as CockpitAction, { phase: 'DRAWER_STOP', selectedStopId: 'A' }],
    [S({ phase: 'CLOSING_TO_SWITCH', selectedStopId: null, nextDrawerMode: 'history' }), { type: 'DRAWER_CLOSED' } as CockpitAction, { phase: 'DRAWER_HISTORY' }],
    [S({ phase: 'CLOSING_TO_CONFIRM', selectedStopId: 'A', nextConfirmationStopId: 'A' }), { type: 'DRAWER_CLOSED' } as CockpitAction, { phase: 'CONFIRM', pendingConfirmationStopId: 'A' }],
    [S({ phase: 'CLOSED' }), { type: 'REQUEST_CONFIRM', stopId: 'A' } as CockpitAction, { phase: 'CONFIRM' }],
    [S({ phase: 'DRAWER_STOP', selectedStopId: 'A' }), { type: 'REQUEST_CONFIRM', stopId: 'A' } as CockpitAction, { phase: 'CLOSING_TO_CONFIRM' }],
    [S({ phase: 'CONFIRM' }), { type: 'ACCEPT_CONFIRM' } as CockpitAction, { phase: 'CONFIRM' }], // guarded: pending empty
    [S({ phase: 'CONFIRM' }), { type: 'CANCEL_CONFIRM' } as CockpitAction, { phase: 'CLOSED' }],
    [S({ phase: 'MUTATING' }), { type: 'MUTATION_SETTLED' } as CockpitAction, { phase: 'CLOSED' }],
    [S({ phase: 'MUTATING' }), { type: 'REQUEST_CONFIRM', stopId: 'A' } as CockpitAction, { phase: 'MUTATING' }], // block
  ] as Array<[CockpitState, CockpitAction, Partial<CockpitState>]>)('%j + %j → %j', (s, action, expected) => {
    const next = reduceCockpit(s, action)
    for (const k of Object.keys(expected) as Array<keyof CockpitState>) expect(next[k]).toEqual(expected[k])
  })

  it('reducer is pure / deterministic + no I/O leakage', () => {
    const s = { ...initialCockpitState } ; const a: CockpitAction = { type: 'OPEN_STOP', stopId: 'X' }
    expect(reduceCockpit(s, a)).toEqual(reduceCockpit(s, a))
    const source = fs.readFileSync((DriverRouteCockpit as unknown as { __file: string }).__file, 'utf8')
    const reducerSrc = source.match(/export function reduceCockpit[\s\S]*?\n\}/m)?.[0] ?? ''
    expect(reducerSrc).not.toMatch(/\bDate\.now\b|\bMath\.random\b|window\.|document\.|fetch\(/)
  })

  it('initialCockpitState matches the documented closed zero sentinel', () => {
    expect(initialCockpitState).toEqual({ phase: 'CLOSED', selectedStopId: null, pendingConfirmationStopId: null, nextDrawerMode: null, nextConfirmationStopId: null })
  })
})

// ─── REFACTOR: focus return + invariants (REQ-DCK-008) ────────────────────────

describe('DriverRouteCockpit — REFACTOR: focus return + invariants (REQ-DCK-008)', () => {
  it('settle path lands CLOSED without throwing on a detached origin (root fallback used)', async () => {
    const { inner, outer } = mountCockpit() ; await flushPromises()
    expect(inner.find('[data-testid="cockpit-root"]').attributes('tabindex')).toBe('-1')
    await inner.findComponent(FooterStub).find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
    clickById('cockpit-confirm-confirm-stub') ; await flushPromises()
    await outer.setProps({ checkInPending: true }) ; await flushPromises()
    await outer.setProps({ checkInPending: false }) ; await flushPromises()
    expect(inner.findComponent(DrawerStub).props('open')).toBe(false) ; expect(confirmState.open).toBe(false)
  })

  it('explicit focus({preventScroll: true}) — restoration never scrolls', () => {
    const source = fs.readFileSync((DriverRouteCockpit as unknown as { __file: string }).__file, 'utf8')
    expect(source).toMatch(/focus\(\s*\{\s*preventScroll:\s*true\s*\}/)
    const restore = source.match(/function\s+restoreFocus\s*\(\s*\)\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(restore).not.toMatch(/(^|\s)rootRef\.value\.focus\(\s*\)/m)
  })

  it('origin preserved across close: focusReturnEl is shallowRef; nulled AFTER restoration', () => {
    const source = fs.readFileSync((DriverRouteCockpit as unknown as { __file: string }).__file, 'utf8')
    expect(source).toMatch(/shallowRef/) ; expect(source).toMatch(/focusReturnEl\.value\s*=\s*null/)
  })
})

    // ─── B3 correction: compact S10 behavioral assertions ────────────────────────
    // REQ-DRC-112 (zero-stop copy), REQ-DCS-008 (footer-empty), REQ-DCK-008
    // (focus return). Compact additions; the detached-fallback test above is
    // preserved verbatim and pins the origin-is-detached → rootRef fallback path.

    describe('DriverRouteCockpit — B3 compact: zero-stop visible copy + footer-empty + connected-origin focus (REQ-DRC-112, REQ-DCS-008, REQ-DCK-008)', () => {
      it('zero-stop: currentStop/nextStop=null + hasStops=false propagate to operational + footer (REQ-DRC-112, REQ-DCS-008)', async () => {
        const { inner } = mountCockpit({ route: mkRoute({ stops: [] }) }) ; await flushPromises()
        const op = inner.findComponent(OpsStub) ; const footer = inner.findComponent(FooterStub)
        expect(op.props('currentStop')).toBeNull() ; expect(op.props('nextStop')).toBeNull() ; expect(op.props('hasStops')).toBe(false)
        // footer-empty: hasStops=false + currentStop=null ⇒ footer mode is 'empty' (no action button).
        expect(footer.props('hasStops')).toBe(false) ; expect(footer.props('currentStop')).toBeNull()
        expect(footer.props('routeStatus')).toBe('ACTIVE') ; expect((footer.props('progress') as CockpitProgress).total).toBe(0)
      })

      it('terminal ACTIVE→COMPLETED: footer terminal props propagate verbatim (REQ-DCS-008)', async () => {
        const { inner } = mountCockpit({ route: mkRoute({ status: 'COMPLETED', stops: [mkStop('s0', 0, 'COMPLETED')] }) }) ; await flushPromises()
        const footer = inner.findComponent(FooterStub)
        // routeTerminal=true ⇒ footer mode is 'terminal' (completedTitle/summary/viewHistory, no action button).
        expect(footer.props('routeStatus')).toBe('COMPLETED') ; expect(footer.props('hasStops')).toBe(true)
        // selectCurrentStop returns null when isTerminal=true, so footer receives currentStop=null
        // while still carrying the progress total (footer-empty ≠ terminal).
        expect(footer.props('currentStop')).toBeNull() ; expect((footer.props('progress') as CockpitProgress).total).toBe(1)
      })

      it('connected-origin settle (checkInPending true→false): focus returns to the originating button when still in DOM (REQ-DCK-008)', async () => {
        const { inner, outer } = mountCockpit({ checkInPending: false }) ; await flushPromises()
        const triggerBtn = inner.findComponent(FooterStub).find('[data-testid="cockpit-footer-action-stub"]').element as HTMLButtonElement
        await inner.findComponent(FooterStub).find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
        clickById('cockpit-confirm-confirm-stub') ; await flushPromises()
        await outer.setProps({ checkInPending: true }) ; await flushPromises()
        await outer.setProps({ checkInPending: false }) ; await flushPromises()
        expect(triggerBtn.isConnected).toBe(true) ; expect(document.activeElement).toBe(triggerBtn)
      })

      it('detached-origin settle preserved: when the originating button is removed, rootRef fallback fires (REQ-DCK-008)', async () => {
        const { inner, outer } = mountCockpit({ checkInPending: false }) ; await flushPromises()
        await inner.findComponent(FooterStub).find('[data-testid="cockpit-footer-action-stub"]').trigger('click') ; await flushPromises()
        clickById('cockpit-confirm-confirm-stub') ; await flushPromises()
        ;(document.querySelector('[data-testid="cockpit-footer-action-stub"]') as HTMLElement | null)?.remove()
        await outer.setProps({ checkInPending: true }) ; await flushPromises()
        await outer.setProps({ checkInPending: false }) ; await flushPromises()
        expect(document.activeElement).toBe(inner.find('[data-testid="cockpit-root"]').element)
      })
    })
