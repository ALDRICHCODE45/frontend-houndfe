// DriverCockpitDrawer.spec.ts — STRICT-TDD S9 (REQ-DCK-001/002/004/006/007/008 + REQ-DRC-105).
// Contract: one Nuxt UI v4 UDrawer; stop mode mounts DriverStopPanel; history mode mounts
// DeliveryRouteTimeline DIRECTLY. Custom closed synthesized ONLY from native animationEnd(false);
// animationEnd(true) sets mapReady and never emits closed. Sticky central-copy header >=44 close;
// 85dvh scrollable body; reduced-motion class while event semantics unchanged.
// Teleport note: UDrawer uses Vue <Teleport> -> document.body; tests query `document.body`
// and drive native events through the exposed `drawerRef` template ref.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import DriverCockpitDrawer, { adaptDrawerAnimationEnd, adaptSlideoverLifecycle } from '../DriverCockpitDrawer.vue'
import type { DeliveryRouteResponseDto, DeliveryRouteStop, DeliveryRouteTimelineEvent } from '../../../interfaces/delivery-route.types'
import { DELIVERY_ROUTE_COPY } from '../../../copy'

const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')

const ADDR = { id: 'a', street: 'Reforma', exteriorNumber: '1', interiorNumber: null, zipCode: '06600', neighborhood: 'C', municipality: 'C', city: 'CDMX', state: 'CMX', label: null, latitude: 19.4326, longitude: -99.1332 }
function mkStop(id: string, sortOrder: number, status: DeliveryRouteStop['status'], name = 'Ana'): DeliveryRouteStop {
  return { id, saleId: `s-${id}`, saleFolio: `F-${sortOrder + 1}`, sortOrder, status, checkedInAt: null, completedAt: null, customer: { id: `c-${id}`, name, email: 'a@x' }, shippingAddress: { ...ADDR, id: `a-${id}` } }
}
function mkRoute(timeline: DeliveryRouteTimelineEvent[] = [], stops: DeliveryRouteStop[] = [], status: DeliveryRouteResponseDto['status'] = 'ACTIVE'): DeliveryRouteResponseDto {
  return { id: 'route-1', status, driver: { id: 'd1', name: 'Ana', email: 'a@x' }, startedAt: null, completedAt: null, cancelledAt: null, notes: null, stops, timeline }
}
const STOP_NULL_CUSTOMER = { ...mkStop('s0', 0, 'PENDING'), id: 's0n', customer: null }
const STOP = mkStop('s0', 0, 'PENDING')
const ROUTE = mkRoute([], [STOP])

type DrawerWrapperProps = { open: boolean; mode: string; route: DeliveryRouteResponseDto; stop: DeliveryRouteStop | null; routeTerminal: boolean; canCheckIn: boolean; checkInPending: boolean; isDesktop: boolean }
interface DrawerHarness {
  inner: VueWrapper<InstanceType<typeof DriverCockpitDrawer>>
  outer: VueWrapper<unknown> & { props<K extends keyof DrawerWrapperProps>(key: K): DrawerWrapperProps[K] }
}
function mountDrawer(p: Partial<{ open: boolean; mode: 'stop' | 'history'; route: DeliveryRouteResponseDto; stop: DeliveryRouteStop | null; routeTerminal: boolean; canCheckIn: boolean; checkInPending: boolean; isDesktop: boolean }> = {}): DrawerHarness {
  const props = { open: false, mode: 'stop' as const, route: ROUTE, stop: STOP, routeTerminal: false, canCheckIn: true, checkInPending: false, isDesktop: false, ...p }
  const Wrapper = defineComponent({
    components: { UApp },
    props: { open: { type: Boolean, required: true }, mode: { type: String, required: true }, route: { type: Object as () => DeliveryRouteResponseDto, required: true }, stop: { type: Object as () => DeliveryRouteStop | null, default: null }, routeTerminal: { type: Boolean, required: true }, canCheckIn: { type: Boolean, required: true }, checkInPending: { type: Boolean, required: true }, isDesktop: { type: Boolean, required: true } },
    setup(p) { return () => h(UApp, null, { default: () => h(DriverCockpitDrawer as never, p) }) },
  })
  const outer = mount(Wrapper, {
    props, attachTo: document.body,
    global: { stubs: { AddressMapPicker: { template: '<div data-testid="address-map-picker-stub" />' }, UIcon: { props: ['name'], template: '<i :data-icon="$attrs.name" />' } } },
  })
  return { inner: outer.findComponent(DriverCockpitDrawer) as VueWrapper<InstanceType<typeof DriverCockpitDrawer>>, outer }
}
type SurfaceVm = { $emit: (e: string, ...a: unknown[]) => Promise<void> }
    type DrawerVm = { drawerRef: SurfaceVm | null; slideoverRef: SurfaceVm | null }
const sfcBody = () => fs.readFileSync((DriverCockpitDrawer as unknown as { __file: string }).__file, 'utf8').replace(/\/\*\*[\s\S]*?\*\//g, '')
beforeEach(() => { /* no mocks to reset */ })
afterEach(() => { document.body.innerHTML = '' })

// ─── RED: one portal, native-event synthesis (REQ-DCK-001) ──────────────────────

describe('DriverCockpitDrawer — RED: one portal, native-event synthesis (REQ-DCK-001)', () => {
  it('mounts exactly one UDrawer (via drawerRef) on mobile; no nested slideover (REQ-DCK-001)', async () => {
    const { inner } = mountDrawer({ open: true, isDesktop: false })
    await flushPromises()
    const vm = inner.vm as unknown as DrawerVm
    expect(vm.drawerRef).not.toBeNull()
    expect(vm.slideoverRef).toBeNull()
    const body = sfcBody()
    expect((body.match(/<UDrawer\b/g) ?? []).length).toBe(1)
    expect(body).not.toMatch(/<UDrawer\b(?:(?!<\/UDrawer>).)*<USlideover\b/s)
  })

  it('stop mode mounts DriverStopPanel; history mode mounts DeliveryRouteTimeline DIRECTLY (REQ-DRC-105)', async () => {
    mountDrawer({ open: true, mode: 'stop', stop: STOP })
    await flushPromises()
    expect(document.querySelector('[data-testid="stop-panel-root"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="delivery-route-timeline"]')).toBeNull()
    document.body.innerHTML = ''
    mountDrawer({ open: true, mode: 'history' })
    await flushPromises()
    expect(document.querySelector('[data-testid="delivery-route-timeline"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="stop-panel-root"]')).toBeNull()
    expect(document.querySelector('[data-testid="driver-history-sheet"]')).toBeNull()
  })

  // ─── B3 correction: typed mode → content mapping via single `<component>` (REFACTOR) ───
  it('mode → content mapping renders via single `<component :is>` (B3 review, no v-if/v-else-if branches)', async () => {
    const source = sfcBody()
    // Single dynamic <component :is="..."> render instead of explicit v-if/v-else-if branches.
    expect(source).toMatch(/<component\s+:is=/)
    // No explicit mode-conditional branches for stop / history in the body template.
    expect(source).not.toMatch(/v-if=["']mode === ['"]stop['"]/)
    expect(source).not.toMatch(/v-else-if=["']mode === ['"]history['"]/)
    // A typed modeContent map exists in the script body.
    expect(source).toMatch(/modeContent/)
  })

  it('modeContent renders the right component for each mode at runtime (B3 review)', async () => {
    mountDrawer({ open: true, mode: 'stop', stop: STOP })
    await flushPromises()
    expect(document.querySelector('[data-testid="stop-panel-root"]')).not.toBeNull()
    document.body.innerHTML = ''
    mountDrawer({ open: true, mode: 'history' })
    await flushPromises()
    expect(document.querySelector('[data-testid="delivery-route-timeline"]')).not.toBeNull()
  })

  it('native close alone does NOT emit custom closed; animationEnd(false) emits closed once; animationEnd(true) does not', async () => {
    const { inner } = mountDrawer({ open: true })
    await flushPromises()
    const vm = inner.vm as unknown as DrawerVm
    await vm.drawerRef?.$emit('close')
    expect(inner.emitted('closed') ?? []).toHaveLength(0)
    await vm.drawerRef?.$emit('animationEnd', true)
    expect(inner.emitted('closed') ?? []).toHaveLength(0)
    await vm.drawerRef?.$emit('update:open', false)
    await vm.drawerRef?.$emit('animationEnd', false)
    expect(inner.emitted('closed') ?? []).toHaveLength(1)
    await vm.drawerRef?.$emit('animationEnd', false)
    expect(inner.emitted('closed') ?? []).toHaveLength(1)
  })
})

// ─── TRIANGULATE: mode switch + dismiss paths (REQ-DCK-001/006) ──────────────────

  // ─── S2 — adaptive container (REQ-DCK-001/009) ─────────────────────────────────

  describe('DriverCockpitDrawer — S2: adaptive container (REQ-DCK-001/009)', () => {
    it('mobile: drawerRef is live, slideoverRef is null', async () => {
      const { inner } = mountDrawer({ open: true, isDesktop: false }) ; await flushPromises()
      const vm = inner.vm as unknown as DrawerVm
      expect(vm.drawerRef).not.toBeNull() ; expect(vm.slideoverRef).toBeNull()
    })
    it('desktop: slideoverRef is live, drawerRef is null', async () => {
      const { inner } = mountDrawer({ open: true, isDesktop: true }) ; await flushPromises()
      const vm = inner.vm as unknown as DrawerVm
      expect(vm.slideoverRef).not.toBeNull() ; expect(vm.drawerRef).toBeNull()
    })
    it('source: exactly one <USlideover> + one <UDrawer> sibling branches; drawer MUST NOT import useCockpitBreakpoint / @vueuse/core', () => {
      const body = sfcBody()
      expect((body.match(/<USlideover\b/g) ?? []).length).toBe(1)
      expect((body.match(/<UDrawer\b/g) ?? []).length).toBe(1)
      expect(body).not.toMatch(/useCockpitBreakpoint/)
      expect(body).not.toMatch(/from\s+['"]@vueuse\/core['"]/)
    })
    it('source: isDesktop prop is required (no `default:` in defineProps entry)', () => {
      const m = sfcBody().match(/isDesktop[^{]*\{[^}]*\}/)
      expect(m).not.toBeNull() ; expect(m![0]).toMatch(/isDesktop/) ; expect(m![0]).not.toMatch(/default:/)
    })
    it('slideover lifecycle: update:open(false) + duplicate @after:enter NEVER emit closed; @after:leave emits closed exactly once', async () => {
      const { inner } = mountDrawer({ open: true, isDesktop: true }) ; await flushPromises()
      const vm = inner.vm as unknown as DrawerVm
      await vm.slideoverRef?.$emit('update:open', false)
      await vm.slideoverRef?.$emit('after:enter') ; await vm.slideoverRef?.$emit('after:enter')
      expect(inner.emitted('closed') ?? []).toHaveLength(0)
      await vm.slideoverRef?.$emit('after:leave') ; await vm.slideoverRef?.$emit('after:leave')
      expect(inner.emitted('closed') ?? []).toHaveLength(1)
    })
    it('drawer lifecycle (regression): animationEnd(true) → mapReady; animationEnd(false) → closed once; update:open(false) NEVER emits closed', async () => {
      const { inner } = mountDrawer({ open: true, isDesktop: false }) ; await flushPromises()
      const vm = inner.vm as unknown as DrawerVm
      await vm.drawerRef?.$emit('update:open', false)
      expect(inner.emitted('closed') ?? []).toHaveLength(0)
      await vm.drawerRef?.$emit('animationEnd', true)
      expect(inner.emitted('closed') ?? []).toHaveLength(0)
      await vm.drawerRef?.$emit('animationEnd', false)
      expect(inner.emitted('closed') ?? []).toHaveLength(1)
    })
    it('mid-open breakpoint swap (REQ-DCK-009): closed NOT emitted; one portal; mode content preserved', async () => {
      const { inner, outer } = mountDrawer({ open: true, isDesktop: false }) ; await flushPromises()
      await (inner.vm as unknown as DrawerVm).drawerRef?.$emit('animationEnd', true)
      await outer.setProps({ isDesktop: true }) ; await flushPromises()
      expect(inner.emitted('closed') ?? []).toHaveLength(0)
      const v = inner.vm as unknown as DrawerVm
      expect(v.slideoverRef).not.toBeNull() ; expect(v.drawerRef).toBeNull()
      expect(outer.props('open')).toBe(true)
      expect(document.querySelector('[data-testid="stop-panel-root"]')).not.toBeNull()
      expect(document.querySelectorAll('[data-slot="overlay"]')).toHaveLength(1)
    })
    it('mid-close breakpoint swap (REQ-DCK-009): surface freezes until settled close, then adopts latest breakpoint on reopen', async () => {
      const { inner, outer } = mountDrawer({ open: true, isDesktop: false }) ; await flushPromises()
      await (inner.vm as unknown as DrawerVm).drawerRef?.$emit('animationEnd', true)
      await outer.setProps({ open: false }) ; await outer.setProps({ isDesktop: true }) ; await flushPromises()
      const v1 = inner.vm as unknown as DrawerVm
      expect(v1.drawerRef).not.toBeNull() ; expect(v1.slideoverRef).toBeNull()
      await v1.drawerRef?.$emit('animationEnd', false)
      expect(inner.emitted('closed') ?? []).toHaveLength(1)
      const v2 = inner.vm as unknown as DrawerVm
      expect(v2.drawerRef).toBeNull() ; expect(v2.slideoverRef).toBeNull()
      await outer.setProps({ open: true }) ; await flushPromises()
      const v3 = inner.vm as unknown as DrawerVm
      expect(v3.slideoverRef).not.toBeNull() ; expect(v3.drawerRef).toBeNull()
    })
  })


describe('DriverCockpitDrawer — S3: overlay footer slot action (REQ-DCK-002/003, REQ-DCS-006)', () => {
  it('desktop slideover + PENDING + canCheckIn: gated action in #footer; click emits request-confirm once with { stopId, trigger }; panel body has NO delivery action', async () => {
    const { inner } = mountDrawer({ open: true, mode: 'stop', stop: mkStop('s7', 6, 'PENDING'), canCheckIn: true, checkInPending: false, routeTerminal: false, isDesktop: true })
    await flushPromises()
    const btn = document.querySelector('[data-testid="overlay-footer-action"]') as HTMLButtonElement
    expect(btn).not.toBeNull() ; expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain(DELIVERY_ROUTE_COPY.actions.checkIn)
    btn.click() ; await flushPromises()
    const events = (inner.emitted('request-confirm') as unknown[][] | undefined) ?? []
    expect(events).toHaveLength(1)
    expect(events[0]?.[0]).toMatchObject({ stopId: 's7' })
    expect((events[0]?.[0] as { trigger: HTMLElement }).trigger).toBe(btn)
    expect(document.querySelector('[data-testid="stop-panel-secondary-action"]')).toBeNull()
  })

  it('mobile drawer: NO overlay footer action rendered (page footer owns it)', async () => {
    mountDrawer({ open: true, mode: 'stop', stop: STOP, canCheckIn: true, checkInPending: false, routeTerminal: false, isDesktop: false })
    await flushPromises()
    expect(document.querySelector('[data-testid="overlay-footer-action"]')).toBeNull()
    expect(document.querySelector('[data-testid="stop-panel-root"]')).not.toBeNull()
  })

  it('source: slideover uses #content escape hatch with overlay-footer-action; drawer has NO #content / overlay-footer-action', () => {
    const b = sfcBody()
    expect(b).toMatch(/<template\s+#content>[\s\S]*?data-testid="overlay-footer-action"[\s\S]*?<\/template>/)
    const drawerBlock = b.match(/<UDrawer[\s\S]*?<\/UDrawer>/)?.[0] ?? ''
    expect(drawerBlock).not.toMatch(/<template\s+#content>/)
    expect(drawerBlock).not.toMatch(/data-testid="overlay-footer-action"/)
    const slideoverBlock = b.match(/<USlideover[\s\S]*?<\/USlideover>/)?.[0] ?? ''
    expect(slideoverBlock).not.toMatch(/<template\s+#header>/)
    expect(slideoverBlock).not.toMatch(/<template\s+#body>/)
    expect(slideoverBlock).not.toMatch(/<template\s+#footer>/)
  })

  it('clips #content backgrounds to the inset Slideover rounded DialogContent', () => {
    const b = sfcBody()
    expect(b).toMatch(/const\s+slideoverUi\s*=\s*\{[\s\S]*?content:\s*['"][^'"]*overflow-hidden/)
  })

  it('centers the slideover title between symmetric 44px columns', () => {
    const b = sfcBody()
    const header = b.match(/<header[\s\S]*?data-testid="driver-cockpit-slideover-header"[\s\S]*?<\/header>/)?.[0] ?? ''
    expect(header).toContain('grid-cols-[44px_minmax(0,1fr)_44px]')
    expect(header).toMatch(/data-testid="driver-cockpit-slideover-title-spacer"[^>]*aria-hidden="true"/)
    expect(header.indexOf('data-testid="driver-cockpit-slideover-title-spacer"')).toBeLessThan(header.indexOf('data-testid="driver-cockpit-slideover-title"'))
    expect(header.indexOf('data-testid="driver-cockpit-slideover-title"')).toBeLessThan(header.indexOf('data-testid="driver-cockpit-slideover-close"'))
  })
})

describe('DriverCockpitDrawer — TRIANGULATE: mode switch + dismiss paths (REQ-DCK-001/006)', () => {
  it('stop -> history: closes, awaits animationEnd(false), reopens with direct timeline (no hot-swap)', async () => {
    const { inner, outer } = mountDrawer({ open: true, mode: 'stop', stop: STOP })
    await flushPromises()
    const vm = inner.vm as unknown as DrawerVm
    await vm.drawerRef?.$emit('animationEnd', true)
    expect(document.querySelector('[data-testid="stop-panel-root"]')).not.toBeNull()
    await outer.setProps({ open: false })
    await vm.drawerRef?.$emit('animationEnd', false)
    expect(inner.emitted('closed') ?? []).toHaveLength(1)
    await outer.setProps({ open: true, mode: 'history' })
    await vm.drawerRef?.$emit('animationEnd', true)
    expect(document.querySelector('[data-testid="delivery-route-timeline"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="stop-panel-root"]')).toBeNull()
  })

  it.each([
    ['escape/overlay (native close)', 'close', undefined],
    ['drag dismissal (native update:open false)', 'update:open', false],
    ['release after drag (native release false)', 'release', false],
  ] as const)('%s yields update:open(false) so parent begins closure', async (_l, event, arg) => {
    const { inner } = mountDrawer({ open: true })
    await flushPromises()
    const vm = inner.vm as unknown as DrawerVm
    if (arg === undefined) await vm.drawerRef?.$emit(event) ; else await vm.drawerRef?.$emit(event, arg)
    expect(inner.emitted('update:open') ?? []).toEqual([[false]])
  })

  it('close button click + parent close (open prop false) both yield the closed sequence', async () => {
    const { inner } = mountDrawer({ open: true })
    await flushPromises()
    const close = document.querySelector('[data-testid="driver-cockpit-drawer-close"]') as HTMLButtonElement
    close.click()
    await flushPromises()
    expect(inner.emitted('update:open') ?? []).toEqual([[false]])
  })

  it('parent close (open prop false) still synthesizes closed once via animationEnd(false)', async () => {
    const { inner, outer } = mountDrawer({ open: true })
    await flushPromises()
    const vm = inner.vm as unknown as DrawerVm
    await outer.setProps({ open: false })
    await vm.drawerRef?.$emit('animationEnd', false)
    expect(inner.emitted('closed') ?? []).toHaveLength(1)
  })
})

// ─── TRIANGULATE: a11y + scrollable body + reduced motion (REQ-DCK-002/007) ──────

describe('DriverCockpitDrawer — TRIANGULATE: a11y + scrollable body + reduced motion (REQ-DCK-002/007)', () => {
  it('sticky central-copy header + >=44 close + 85dvh scrollable body', async () => {
    mountDrawer({ open: true })
    await flushPromises()
    const header = document.querySelector('[data-testid="driver-cockpit-drawer-header"]') as HTMLElement
    expect(header.className).toMatch(/sticky\s+top-0/)
    const close = document.querySelector('[data-testid="driver-cockpit-drawer-close"]') as HTMLElement
    expect(close.className).toContain('min-h-11') ; expect(close.className).toContain('min-w-11')
    expect(close.getAttribute('aria-label')).toBe(DELIVERY_ROUTE_COPY.cockpit.drawer.close)
    const body = document.querySelector('[data-testid="driver-cockpit-drawer-body"]') as HTMLElement
    expect(body.className).toMatch(/max-h-\[85dvh\]/) ; expect(body.className).toContain('overflow-y-auto')
    expect(header.className).toContain('min-w-0')
  })

  it('reduced-motion class is present on header + body while event semantics stay identical', async () => {
    const { inner } = mountDrawer({ open: true })
    await flushPromises()
    expect((document.querySelector('[data-testid="driver-cockpit-drawer-header"]') as HTMLElement).className).toMatch(/motion-reduce:transition-none/)
    expect((document.querySelector('[data-testid="driver-cockpit-drawer-body"]') as HTMLElement).className).toMatch(/motion-reduce:transition-none/)
    const vm = inner.vm as unknown as DrawerVm
    await vm.drawerRef?.$emit('update:open', false)
    await vm.drawerRef?.$emit('animationEnd', false)
    expect(inner.emitted('closed') ?? []).toHaveLength(1)
  })

  // ─── B3 correction: motion-reduce on actual UDrawer overlay + content slots ───
  // The S9 overlay/content are the elements that animate; inner header/body have no
  // transition. The reduced-motion override MUST be applied via the UDrawer `ui` prop
  // so vaul-vue's DrawerOverlay + DrawerContent honor it (not just our inner header).
  it('reduced-motion override reaches the actual UDrawer `ui` prop for content + overlay (B3 review)', async () => {
    mountDrawer({ open: true })
    await flushPromises()
    const source = sfcBody()
    expect(source).toMatch(/drawerUi/)
    expect(source).toMatch(/content:\s*['"][^'"]*motion-reduce:[^'"]*['"]/)
    expect(source).toMatch(/overlay:\s*['"][^'"]*motion-reduce:[^'"]*['"]/)
  })

  it('runtime portal contains EXACTLY ONE [data-slot="content"] + ONE [data-slot="overlay"] (B3 review)', async () => {
    mountDrawer({ open: true })
    await flushPromises()
    const contents = document.querySelectorAll('[data-slot="content"]')
    const overlays = document.querySelectorAll('[data-slot="overlay"]')
    expect(contents).toHaveLength(1)
    expect(overlays).toHaveLength(1)
  })

  it('actual UDrawer content + overlay carry motion-reduce classes at runtime (B3 review)', async () => {
    mountDrawer({ open: true })
    await flushPromises()
    const content = document.querySelector('[data-slot="content"]') as HTMLElement | null
    const overlay = document.querySelector('[data-slot="overlay"]') as HTMLElement | null
    expect(content).not.toBeNull()
    expect(overlay).not.toBeNull()
    expect(content!.className).toMatch(/motion-reduce:transition-none|motion-reduce:duration-0/)
    expect(overlay!.className).toMatch(/motion-reduce:transition-none|motion-reduce:duration-0/)
  })
})

// ─── TRIANGULATE: history timeline direct reuse (REQ-DRC-105) ──────────────────

describe('DriverCockpitDrawer — TRIANGULATE: history timeline direct reuse (REQ-DRC-105)', () => {
  it('history mode preserves timeline rows incl. STOP_CHECKED_IN separate Parada N element', async () => {
    const timeline: DeliveryRouteTimelineEvent[] = [
      { type: 'ROUTE_CREATED', at: '2025-01-01T08:00:00Z', actor: null },
      { type: 'ROUTE_STARTED', at: '2025-01-01T09:00:00Z', actor: { id: 'd1', name: 'Ana' } },
      { type: 'STOP_CHECKED_IN', at: '2025-01-01T09:30:00Z', stopId: 's0', sortOrder: 0, actor: { id: 'd1', name: 'Ana' } },
      { type: 'ROUTE_COMPLETED', at: '2025-01-01T10:00:00Z', actor: { id: 'd1', name: 'Ana' } },
    ]
    mountDrawer({ open: true, mode: 'history', route: mkRoute(timeline, [STOP]) })
    await flushPromises()
    const rows = Array.from(document.querySelectorAll('[data-testid^="timeline-row-"]'))
      .filter((n) => n.tagName === 'LI').map((n) => n.getAttribute('data-testid'))
    expect(rows).toEqual(['timeline-row-ROUTE_CREATED', 'timeline-row-ROUTE_STARTED', 'timeline-row-STOP_CHECKED_IN-s0', 'timeline-row-ROUTE_COMPLETED'])
    const posSpan = document.querySelector('[data-testid="timeline-row-STOP_CHECKED_IN-s0"] [data-testid="timeline-row-stop-position"]')
    expect(posSpan).not.toBeNull() ; expect(posSpan?.textContent?.trim()).toBe('Parada 1')
  })

  it('history empty renders `Sin eventos registrados`', async () => {
    mountDrawer({ open: true, mode: 'history', route: mkRoute([], [STOP]) })
    await flushPromises()
    expect(document.querySelector('[data-testid="delivery-route-timeline-empty"]')).not.toBeNull()
    expect(document.body.textContent).toContain('Sin eventos registrados')
  })
})

// ─── TRIANGULATE: stop mode wiring (REQ-DCK-003, REQ-DRC-106) ──────────────────

describe('DriverCockpitDrawer — TRIANGULATE: stop mode wiring (REQ-DCK-003, REQ-DRC-106)', () => {
  it('null stop in stop mode renders nothing; null customer falls back to `Cliente sin nombre`', async () => {
    mountDrawer({ open: true, mode: 'stop', stop: null })
    await flushPromises()
    expect(document.querySelector('[data-testid="stop-panel-root"]')).toBeNull()
    document.body.innerHTML = ''
    mountDrawer({ open: true, mode: 'stop', stop: STOP_NULL_CUSTOMER })
    await flushPromises()
    const title = document.querySelector('[data-testid="driver-cockpit-drawer-title"]') as HTMLElement
    expect(title.textContent).toContain(DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback)
  })
})

// ─── REFACTOR: adapter unit + source invariants (REQ-DCK-001/008) ───────────────

describe('DriverCockpitDrawer — REFACTOR: adapter unit coverage + source invariants', () => {
  it.each([
    ['true: settled opening', { openAfter: true, previousMapReady: false, previousClosedEmitted: false }, { mapReady: true, emitClosed: false }],
    ['true: re-settle after re-open', { openAfter: true, previousMapReady: true, previousClosedEmitted: true }, { mapReady: true, emitClosed: false }],
    ['false: first close emits closed', { openAfter: false, previousMapReady: true, previousClosedEmitted: false }, { mapReady: true, emitClosed: true }],
    ['false: second animationEnd(false) does NOT re-emit closed', { openAfter: false, previousMapReady: true, previousClosedEmitted: true }, { mapReady: true, emitClosed: false }],
  ] as const)('adaptDrawerAnimationEnd: %s', (_l, input, expected) => { expect(adaptDrawerAnimationEnd(input)).toEqual(expected) })

  it('SFC never imports server-state, mutation, router, or HTTP', () => {
    const b = sfcBody()
    for (const re of [/from\s+['"]vue-router['"]|useRouter|useRoute\b/, /useQuery\b|useMutation\b|useQueryClient|@tanstack\/vue-query/, /axios|fetch\(['"]/, /useCheckInStop\b|invalidate|refetchQueries|mutateAsync|mutate\(/]) expect(b).not.toMatch(re)
  })

  it('SFC never hardcodes the drawer copy literals (single source = copy.ts)', () => {
    const b = sfcBody()
    for (const re of [/["']Historial de la ruta["']/, /["']Cerrar["']/, /["']Parada \{N\}["']/, /["']Cliente sin nombre["']/]) expect(b).not.toMatch(re)
  })
})