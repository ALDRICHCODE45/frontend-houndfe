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
import { DELIVERY_ROUTE_COPY } from '../../../copy'

// eslint-disable-next-line @typescript-eslint/no-require-imports -- node builtin
const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')// ─── Fixtures ──────────────────────────────────────────────────────────────────
const ADDR = { id: 'a', street: 'Reforma', exteriorNumber: '1', interiorNumber: null, zipCode: '06600', neighborhood: 'C', municipality: 'C', city: 'CDMX', state: 'CMX', label: null, latitude: 19.4326, longitude: -99.1332 }
function mkStop(id: string, sortOrder: number, status: DeliveryRouteStop['status'], folio: string | null = `F-${sortOrder + 1}`, name: string | null = 'Ana'): DeliveryRouteStop {
  return { id, saleId: `s-${id}`, saleFolio: folio, sortOrder, status, checkedInAt: null, completedAt: null, customer: name === null ? null : { id: `c-${id}`, name, email: 'a@x' }, shippingAddress: { ...ADDR, id: `a-${id}` } }
}
function mkRoute(overrides: Partial<{ status: DeliveryRouteResponseDto['status']; stops: DeliveryRouteStop[]; timeline: DeliveryRouteResponseDto['timeline']; notes: string | null }> = {}): DeliveryRouteResponseDto {
  return { id: 'route-1', status: overrides.status ?? 'ACTIVE', driver: { id: 'd1', name: 'Ana', email: 'a@x' }, startedAt: null, completedAt: null, cancelledAt: null, notes: overrides.notes ?? null, stops: overrides.stops ?? [mkStop('s0', 0, 'PENDING'), mkStop('s1', 1, 'PENDING')], timeline: overrides.timeline ?? [] }
}

// ─── Stubs (template-string drives every event the cockpit listens to) ──────────
const HeaderStub = defineComponent({ props: ['route', 'isFetching'], emits: ['back', 'refresh', 'open-history'], template: `
  <header data-testid="cockpit-header-stub">
    <button data-testid="cockpit-header-back-stub" @click="$emit('back')">back</button>
    <button data-testid="cockpit-header-refresh-stub" @click="$emit('refresh')">refresh</button>
    <button data-testid="cockpit-header-history-stub" @click="$emit('open-history', { trigger: $event.currentTarget })">history</button>
  </header>` })
// Route-page evolution: the spine hosts rich stop cards and forwards
// 'open-details' / 'check-in' [StopTrigger] — the cockpit owns drawer + confirm.
const SpineStub = defineComponent({ props: ['nodes', 'showCheckInStopId', 'checkInPending'], emits: ['open-details', 'check-in'], template: `
  <ol data-testid="cockpit-spine-stub" :data-show-check-in-stop-id="showCheckInStopId || ''">
    <button data-testid="cockpit-spine-stub-s1" @click="$emit('open-details', { stopId: 's1', trigger: $event.currentTarget })">sp1</button>
    <button data-testid="cockpit-spine-stub-s0" @click="$emit('open-details', { stopId: 's0', trigger: $event.currentTarget })">sp0</button>
    <button data-testid="cockpit-spine-stub-check-in-s0" @click="$emit('check-in', { stopId: 's0', trigger: $event.currentTarget })">ci0</button>
  </ol>` })
// Route-page evolution stubs: truthful summary + bounded recent timeline.
const SummaryStub = defineComponent({ props: ['progress', 'counts'], template: `
  <section data-testid="cockpit-summary-stub" :data-total="String(counts?.total ?? -1)" :data-completed="String(progress?.completed ?? -1)" />` })
const TimelineStub = defineComponent({ props: ['route', 'events', 'heading'], template: `
  <div data-testid="cockpit-recent-timeline-stub" :data-heading="heading" :data-count="String((events ?? []).length)" />` })
// Drawer stub: fully controlled by `open`; exposes the four events + mirror props for the spec.
// (The legacy operational/footer stubs were removed with the legacy composition; the
// direct card CTA on the spine stub is the single base-page check-in entry point.)
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
    global: { stubs: { DriverCockpitHeader: HeaderStub, DriverRouteSpine: SpineStub, DriverCockpitDrawer: DrawerStub, ConfirmModal: ConfirmStub, DriverRouteSummary: SummaryStub, DeliveryRouteTimeline: TimelineStub } },
    attachTo: document.body,
  })
  return { inner: outer.findComponent(DriverRouteCockpit), outer }
}
const clickById = (id: string) => (document.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement).click()
const sfcBody = () => fs.readFileSync((DriverRouteCockpit as unknown as { __file: string }).__file, 'utf8')
const docStripped = () => sfcBody().replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')

beforeEach(() => { resetConfirm() })
afterEach(() => { document.body.innerHTML = '' ; confirmState.open = false })// ─── RED: non-null composition surface (REQ-DCS-001) ───────────────────────────

describe('DriverRouteCockpit — RED: non-null composition surface (REQ-DCS-001)', () => {
  it('mounts SFCs in DOM order header → summary → spine → recent (legacy operational/footer composition removed)', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    const h = inner.html()
    const ih = h.indexOf('cockpit-header-stub') ; const is = h.indexOf('cockpit-summary-stub')
    const isp = h.indexOf('cockpit-spine-stub') ; const ir = h.indexOf('cockpit-recent')
    expect(ih).toBeGreaterThanOrEqual(0) ; expect(ih).toBeLessThan(is) ; expect(is).toBeLessThan(isp) ; expect(isp).toBeLessThan(ir)
  })

  it('passes typed props (header, NO progress — the summary owns it) and derives once via useDriverRouteCockpit', async () => {
    const route = mkRoute() ; const { inner } = mountCockpit({ route }) ; await flushPromises()
    const header = inner.findComponent(HeaderStub)
    expect(header.props('route')).toStrictEqual(route)
    // Header refinement: the completed/total fraction was removed from the
    // header — the cockpit must no longer pass `progress` down to it.
    expect(Object.keys(header.props())).not.toContain('progress')
  })

  it.each([
    ['zero-stops', mkRoute({ stops: [] })],
    ['terminal ACTIVE→COMPLETED', mkRoute({ status: 'COMPLETED', stops: [mkStop('s0', 0, 'COMPLETED')] })],
  ])('edge %s still mounts (REQ-DRC-112)', async (_l, route) => {
    const { inner } = mountCockpit({ route }) ; await flushPromises()
    expect((inner.findComponent(SummaryStub).props('counts') as { total: number }).total).toBe(route.stops.length)
    if (route.stops.length === 0) expect(inner.findComponent(SummaryStub).props('counts').total).toBe(0)
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



describe('DriverRouteCockpit — S3: single breakpoint authority wiring (REQ-DCS-006/009)', () => {
  it('source: SFC passes parent-owned :is-desktop to the drawer (single overlay consumer; legacy footer removed)', () => {
    const source = docStripped()
    const matches = source.match(/:is-desktop="isDesktop"/g) ?? []
    expect(matches.length).toBe(1) // DriverCockpitDrawer only
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

  it('accept: closes modal + emits request-check-in exactly once + enters MUTATING (REQ-DRC-104, direct card CTA)', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    const spine = inner.findComponent(SpineStub)
    await spine.find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
    expect(confirmState.open).toBe(true) ; expect(confirmState.title).toBe(DELIVERY_ROUTE_COPY.cockpit.confirm.title)
    clickById('cockpit-confirm-confirm-stub') ; await flushPromises()
    expect(inner.emitted('request-check-in')).toEqual([['s0']]) ; expect(confirmState.open).toBe(false)
    // Re-trigger while MUTATING → no new emit, no modal opens (phase=MUTATING blocks new requests).
    await spine.find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
    expect(inner.emitted('request-check-in')?.length ?? 0).toBe(1) ; expect(confirmState.open).toBe(false)
  })

  it('mutation settles (checkInPending true→false): phase becomes CLOSED (REQ-DCK-008)', async () => {
    const { inner, outer } = mountCockpit({ checkInPending: false }) ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
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
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
    expect(confirmState.open).toBe(true)
    clickById('cockpit-confirm-cancel-stub') ; await flushPromises()
    expect(inner.emitted('request-check-in') ?? []).toHaveLength(0) ; expect(confirmState.open).toBe(false)
  })

  it('checkInPending=true: header refresh, card CTA confirm, drawer confirm all emit nothing', async () => {
    const { inner } = mountCockpit({ checkInPending: true }) ; await flushPromises()
    await inner.findComponent(HeaderStub).find('[data-testid="cockpit-header-refresh-stub"]').trigger('click')
    expect(inner.emitted('refresh') ?? []).toHaveLength(0)
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
    expect(confirmState.open).toBe(false) ; expect(inner.emitted('request-check-in') ?? []).toHaveLength(0)
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

    describe('DriverRouteCockpit — S4: height chain + navbar-offset min-h (REQ-DCS-012)', () => {
      // TRIANGULATE real mobile screenshots: h-full alone leaves footer mid-viewport.
      // Fix: cockpit root carries justified navbar-offset min-h (100dvh-4rem) in
      // addition to h-full; body flex-1 min-h-0; footer sticky bottom-0 (not fixed).
      // Raw min-h-[100dvh]/min-h-[100svh] are forbidden (overshoot below navbar).
      it('cockpit root has h-full + navbar-offset min-h-[calc(100dvh-4rem)]; no raw 100dvh/100svh', () => {
        const cls = mountCockpit().outer.find('[data-testid="cockpit-root"]').classes().join(' ')
        expect(cls).not.toMatch(/\bmin-h-\[\s*100dvh\s*\]/) ; expect(cls).not.toMatch(/\bmin-h-\[\s*100svh\s*\]/)
        expect(cls).toMatch(/\bh-full\b|\bmin-h-full\b/)
        expect(cls).toMatch(/\bmin-h-\[\s*calc\s*\(\s*100dvh\s*-\s*4rem\s*\)\s*\]/)
      })
      it('cockpit body has flex-1 + min-h-0 + normal bottom spacing (no legacy pb-20 fixed-footer clearance); footer source unchanged (source-level)', async () => {
        const { outer } = mountCockpit() ; await flushPromises()
        const bodyCls = outer.find('[data-testid="cockpit-body"]').classes().join(' ')
        expect(bodyCls).toMatch(/\bflex-1\b/) ; expect(bodyCls).toMatch(/\bmin-h-0\b/)
        expect(bodyCls).not.toMatch(/\bpb-20\b/)
        expect(bodyCls).toMatch(/\bpy-4\b/)
      })
      it('SFC source-level: root h-full + calc(100dvh-4rem); body flex-1 min-h-0; no raw 100dvh', () => {
        const source = docStripped()
        expect(source).not.toMatch(/min-h-\[\s*100dvh\s*\]/) ; expect(source).not.toMatch(/min-h-\[\s*100svh\s*\]/)
        const rootEl = source.match(/data-testid="cockpit-root"[^>]*class="([^"]+)"/)
        expect(rootEl).not.toBeNull() ; expect(rootEl![1] ?? '').toMatch(/\bh-full\b|\bmin-h-full\b/)
        expect(rootEl![1] ?? '').toMatch(/\bmin-h-\[\s*calc\s*\(\s*100dvh\s*-\s*4rem\s*\)\s*\]/)
        const bodyEl = source.match(/data-testid="cockpit-body"[^>]*class="([^"]+)"/)
        expect(bodyEl).not.toBeNull() ; expect(bodyEl![1] ?? '').toMatch(/\bflex-1\b/) ; expect(bodyEl![1] ?? '').toMatch(/\bmin-h-0\b/)
      })
    })

    describe('DriverRouteCockpit — TRIANGULATE: confirmation copy + panel root + body clearance', () => {
  it('confirmation title/body/buttons come from copy.ts with customer + position + folio + irreversible statement (direct card CTA path)', async () => {
    const { inner } = mountCockpit({ route: mkRoute({ stops: [mkStop('s0', 0, 'PENDING', 'F-099')] }) }) ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
    expect(confirmState.title).toBe(DELIVERY_ROUTE_COPY.cockpit.confirm.title)
    expect(confirmState.confirmLabel).toBe(DELIVERY_ROUTE_COPY.cockpit.confirm.confirmLabel)
    expect(confirmState.cancelLabel).toBe(DELIVERY_ROUTE_COPY.cockpit.confirm.cancelLabel)
    expect(confirmState.description).toContain('Esta acción registra la entrega y no se puede deshacer.')
    expect(confirmState.description).toContain('Ana') ; expect(confirmState.description).toContain('Parada 1') ; expect(confirmState.description).toContain('F-099')
  })

  it('null customer falls back to `Cliente sin nombre` in confirmation body', async () => {
    const { inner } = mountCockpit({ route: mkRoute({ stops: [mkStop('s0n', 0, 'PENDING', 'F-099', null)] }) }) ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
    expect(confirmState.description).toContain(DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback)
  })
  it.each([['null', null], ['empty', ''], ['whitespace', '   ']])('blank %s saleFolio: body names customer + Parada N, omits ` ({folio})` segment verbatim, never substitutes customer fallback for folio', async (_l, folio) => {
    const { inner } = mountCockpit({ route: mkRoute({ stops: [mkStop('s0', 0, 'PENDING', folio, 'Ana')] }) }) ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
    const desc = confirmState.description
    expect(desc).toContain('Ana') ; expect(desc).toContain('Parada 1') ; expect(desc).toContain('Esta acción registra la entrega y no se puede deshacer.') ; expect(desc).not.toContain('()') ; expect(desc).not.toContain('({folio})') ; expect(desc).not.toContain(DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback)
  })

  it('cockpit root is full-bleed (no fixed/absolute/w-[...]); tabindex=-1; body keeps normal bottom spacing without pb-20', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    const root = inner.find('[data-testid="cockpit-root"]')
    const cls = root.classes().join(' ')
    expect(cls).not.toMatch(/\bfixed\b|\babsolute\b/) ; expect(cls).not.toMatch(/\bw-\[/) ; expect(root.attributes('tabindex')).toBe('-1')
    const bodyCls = inner.find('[data-testid="cockpit-body"]').classes().join(' ')
    expect(bodyCls).not.toMatch(/\bpb-20\b/) ; expect(bodyCls).toMatch(/\bpy-4\b/)
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
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
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
      it('zero-stop: summary receives zero counts + no direct CTA (REQ-DRC-112, REQ-DCS-008)', async () => {
        const { inner } = mountCockpit({ route: mkRoute({ stops: [] }) }) ; await flushPromises()
        const summary = inner.findComponent(SummaryStub)
        expect(summary.props('counts')).toEqual({ delivered: 0, pending: 0, inProgress: 0, skipped: 0, total: 0 })
        // No current PENDING stop ⇒ the single direct card CTA is absent.
        expect(inner.findComponent(SpineStub).props('showCheckInStopId')).toBeNull()
      })

      it('terminal ACTIVE→COMPLETED: no direct CTA on terminal routes (REQ-DCS-008)', async () => {
        const { inner } = mountCockpit({ route: mkRoute({ status: 'COMPLETED', stops: [mkStop('s0', 0, 'COMPLETED')] }) }) ; await flushPromises()
        // selectCurrentStop returns null when isTerminal=true ⇒ showCheckInStopId is null.
        expect(inner.findComponent(SpineStub).props('showCheckInStopId')).toBeNull()
      })

      it('connected-origin settle (checkInPending true→false): focus returns to the originating card CTA when still in DOM (REQ-DCK-008)', async () => {
        const { inner, outer } = mountCockpit({ checkInPending: false }) ; await flushPromises()
        const triggerBtn = inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').element as HTMLButtonElement
        await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
        clickById('cockpit-confirm-confirm-stub') ; await flushPromises()
        await outer.setProps({ checkInPending: true }) ; await flushPromises()
        await outer.setProps({ checkInPending: false }) ; await flushPromises()
        expect(triggerBtn.isConnected).toBe(true) ; expect(document.activeElement).toBe(triggerBtn)
      })

      it('detached-origin settle preserved: when the originating button is removed, rootRef fallback fires (REQ-DCK-008)', async () => {
        const { inner, outer } = mountCockpit({ checkInPending: false }) ; await flushPromises()
        await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
        clickById('cockpit-confirm-confirm-stub') ; await flushPromises()
        ;(document.querySelector('[data-testid="cockpit-spine-stub-check-in-s0"]') as HTMLElement | null)?.remove()
        await outer.setProps({ checkInPending: true }) ; await flushPromises()
        await outer.setProps({ checkInPending: false }) ; await flushPromises()
        expect(document.activeElement).toBe(inner.find('[data-testid="cockpit-root"]').element)
      })
    })

// ─── Route-page evolution: truthful summary + rich stop cards + recent activity ─

describe('DriverRouteCockpit — route-page evolution: summary / spine cards / recent activity', () => {
      it('renders summary → stop-list heading → spine → recent activity in single-column page order (legacy operational/footer removed)', async () => {
        const { inner } = mountCockpit() ; await flushPromises()
        const h = inner.html()
        const is = h.indexOf('cockpit-summary-stub') ; const ihd = h.indexOf('cockpit-stop-list-heading')
        const isp = h.indexOf('cockpit-spine-stub') ; const ir = h.indexOf('cockpit-recent')
        expect(is).toBeGreaterThanOrEqual(0) ; expect(is).toBeLessThan(ihd) ; expect(ihd).toBeLessThan(isp)
        expect(isp).toBeLessThan(ir)
      })

      it('renders the visible stop-list heading + supporting line from copy.ts above the ordered rich cards', async () => {
        const { inner } = mountCockpit() ; await flushPromises()
        const heading = inner.find('[data-testid="cockpit-stop-list-heading"]')
        expect(heading.exists()).toBe(true)
        expect(heading.text()).toContain(DELIVERY_ROUTE_COPY.cockpit.stops.listHeading)
        expect(heading.text()).toContain(DELIVERY_ROUTE_COPY.cockpit.stops.listSubheading)
        const h = inner.html()
        expect(h.indexOf('cockpit-stop-list-heading')).toBeLessThan(h.indexOf('cockpit-spine-stub'))
      })

      it.each([
        ['blank (null)', null, false],
        ['blank (empty string)', '', false],
        ['blank (whitespace)', '   ', false],
        ['nonblank', 'Deja el paquete con el portero.', true],
      ])('route-notes panel: %s notes → rendered=%s, labeled from copy.ts, between summary and stop list', async (_l, notes, shouldRender) => {
        const { inner } = mountCockpit({ route: mkRoute({ notes: notes as string | null }) }) ; await flushPromises()
        const panel = inner.find('[data-testid="cockpit-route-notes"]')
        expect(panel.exists()).toBe(shouldRender)
        if (shouldRender) {
          expect(panel.text()).toContain(DELIVERY_ROUTE_COPY.cockpit.operational.notesLabel)
          expect(panel.text()).toContain(notes as string)
          const h = inner.html()
          expect(h.indexOf('cockpit-summary-stub')).toBeLessThan(h.indexOf('cockpit-route-notes'))
          expect(h.indexOf('cockpit-route-notes')).toBeLessThan(h.indexOf('cockpit-stop-list-heading'))
        }
      })

      it('SFC source: legacy composition removed (no DriverOperationalStops / DriverCockpitFooter rendering or import)', () => {
        const b = docStripped()
        expect(b).not.toMatch(/<DriverOperationalStops/)
        expect(b).not.toMatch(/<DriverCockpitFooter/)
        expect(b).not.toMatch(/from\s+['"]\.\/DriverOperationalStops\.vue['"]/)
        expect(b).not.toMatch(/from\s+['"]\.\/DriverCockpitFooter\.vue['"]/)
      })

  it('passes the single-derivation progress + counts to the summary (truthful existing data only)', async () => {
    const route = mkRoute({ stops: [mkStop('s0', 0, 'COMPLETED'), mkStop('s1', 1, 'PENDING')] })
    const { inner } = mountCockpit({ route }) ; await flushPromises()
    const summary = inner.findComponent(SummaryStub)
    expect(summary.props('progress')).toEqual({ completed: 1, total: 2 })
    expect(summary.props('counts')).toEqual({ delivered: 1, pending: 1, inProgress: 0, skipped: 0, total: 2 })
  })

  it('zero-stop route: summary receives zero counts (no progressbar misuse upstream)', async () => {
    const { inner } = mountCockpit({ route: mkRoute({ stops: [] }) }) ; await flushPromises()
    const summary = inner.findComponent(SummaryStub)
    expect(summary.props('counts')).toEqual({ delivered: 0, pending: 0, inProgress: 0, skipped: 0, total: 0 })
  })

  it('recent activity receives the recent heading + the BOUNDED backend-ordered slice (last 3, verbatim order)', async () => {
    const timeline = [
      { type: 'ROUTE_CREATED', at: '2025-01-01T08:00:00Z', actor: null },
      { type: 'ROUTE_STARTED', at: '2025-01-01T09:00:00Z', actor: { id: 'd1', name: 'Ana' } },
      { type: 'STOP_CHECKED_IN', at: '2025-01-01T09:30:00Z', stopId: 's0', sortOrder: 0, actor: null },
      { type: 'STOP_CHECKED_IN', at: '2025-01-01T10:00:00Z', stopId: 's1', sortOrder: 1, actor: null },
      { type: 'ROUTE_COMPLETED', at: '2025-01-01T11:00:00Z', actor: null },
    ] as DeliveryRouteResponseDto['timeline']
    const { inner } = mountCockpit({ route: mkRoute({ timeline }) }) ; await flushPromises()
    const tl = inner.findComponent(TimelineStub)
    expect(tl.props('heading')).toBe(DELIVERY_ROUTE_COPY.cockpit.recent.heading)
    expect(tl.props('events')).toEqual(timeline.slice(-3)) // backend order preserved; caller slices
  })

  it('short timelines render in full (slice never fabricates or drops within the bound)', async () => {
    const timeline = [
      { type: 'ROUTE_CREATED', at: '2025-01-01T08:00:00Z', actor: null },
      { type: 'ROUTE_STARTED', at: '2025-01-01T09:00:00Z', actor: null },
    ] as DeliveryRouteResponseDto['timeline']
    const { inner } = mountCockpit({ route: mkRoute({ timeline }) }) ; await flushPromises()
    expect(inner.findComponent(TimelineStub).props('events')).toEqual(timeline)
  })

  it('the recent full-history control opens the EXISTING history overlay (no new overlay path)', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    await inner.find('[data-testid="cockpit-recent-history"]').trigger('click') ; await flushPromises()
    const drawer = (document.querySelector('[data-testid="cockpit-drawer-stub"]') as HTMLElement)
    expect(drawer.getAttribute('data-open')).toBe('true') ; expect(drawer.getAttribute('data-mode')).toBe('history')
    expect(confirmState.open).toBe(false)
  })

  it('SFC source: summary + spine + recent are wired; recent slice is a bounded constant (no full re-render of history)', () => {
    const b = docStripped()
    expect(b).toMatch(/<DriverRouteSummary/) ; expect(b).toMatch(/<DriverRouteSpine/) ; expect(b).toMatch(/<DeliveryRouteTimeline/)
    expect(b).toMatch(/cockpit\.recent\.heading/)
    // The bounded slice must be a literal bound on route.timeline (backend-ordered, caller slices).
    expect(b).toMatch(/route\.timeline\.slice\(-\d+\)/)
  })
})

describe('DriverRouteCockpit — route-page evolution: single direct check-in CTA on stop cards', () => {
  it('derives showCheckInStopId = current PENDING stop on an ACTIVE route with permission', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    expect(inner.findComponent(SpineStub).props('showCheckInStopId')).toBe('s0')
  })

  it.each([
    ['terminal route', mkRoute({ status: 'COMPLETED', stops: [mkStop('s0', 0, 'COMPLETED')] }), true],
    ['no permission', mkRoute(), false],
    ['current IN_PROGRESS', mkRoute({ stops: [mkStop('s0', 0, 'IN_PROGRESS')] }), true],
  ])('no direct CTA when %s', async (_l, route, canCheckIn) => {
    const { inner } = mountCockpit({ route, canCheckIn }) ; await flushPromises()
    expect(inner.findComponent(SpineStub).props('showCheckInStopId')).toBeNull()
  })

  it('card check-in routes through the SAME confirm modal → request-check-in exactly once (semantics preserved)', async () => {
    const { inner, outer } = mountCockpit() ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
    expect(confirmState.open).toBe(true) ; expect(confirmState.title).toBe(DELIVERY_ROUTE_COPY.cockpit.confirm.title)
    clickById('cockpit-confirm-confirm-stub') ; await flushPromises()
    expect(inner.emitted('request-check-in')).toEqual([['s0']])
    await outer.setProps({ checkInPending: true }) ; await flushPromises()
    await outer.setProps({ checkInPending: false }) ; await flushPromises()
    expect(confirmState.open).toBe(false)
  })

  it('card check-in emits NOTHING while checkInPending (guard mirrors the disabled CTA)', async () => {
    const { inner } = mountCockpit({ checkInPending: true }) ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-check-in-s0"]').trigger('click') ; await flushPromises()
    expect(confirmState.open).toBe(false) ; expect(inner.emitted('request-check-in') ?? []).toHaveLength(0)
  })

  it('card details opens the stop drawer — every stop stays inspectable without a primary CTA', async () => {
    const { inner } = mountCockpit() ; await flushPromises()
    await inner.findComponent(SpineStub).find('[data-testid="cockpit-spine-stub-s1"]').trigger('click') ; await flushPromises()
    const drawer = (document.querySelector('[data-testid="cockpit-drawer-stub"]') as HTMLElement)
    expect(drawer.getAttribute('data-open')).toBe('true') ; expect(drawer.getAttribute('data-mode')).toBe('stop')
    expect(inner.findComponent(DrawerStub).props('stop')?.id).toBe('s1')
  })
})
