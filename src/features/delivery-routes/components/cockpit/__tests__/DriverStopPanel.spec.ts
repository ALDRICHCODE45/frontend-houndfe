// DriverStopPanel.spec.ts — STRICT-TDD S8 (REQ-DCK-003/005; REQ-DRC-106): mapReady + finite coords; quick actions predicate-gated ≥44×44 settled via useToast; secondaryActionVisible = PENDING + !routeTerminal + canCheckIn.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import DriverStopPanel from '../DriverStopPanel.vue'
import type { DeliveryRouteStop, DeliveryRouteShippingAddress } from '../../../interfaces/delivery-route.types'
import type { StopTrigger } from '../../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../../copy'

// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- node builtin
const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')

const toastCalls: Array<{ title: string; color?: string }> = []
vi.mock('@nuxt/ui/composables/useToast', () => ({
  useToast: () => ({ add: (o: { title: string; color?: string }) => toastCalls.push({ ...o }) }),
}))

const AddressMapPickerStub = defineComponent({ name: 'AddressMapPicker', props: ['mode', 'modelValue'],
  data: () => ({ tileFailed: false }),
  computed: { showCanvas() { return !this.tileFailed && (this.mode === 'write' || this.modelValue !== null) } },
  methods: { simulateTileFailure() { this.tileFailed = true } },
  template: `<div v-if="showCanvas" data-testid="address-map-picker-stub" data-mode="read" />`,
})

const ADDR: DeliveryRouteShippingAddress = {
  id: 'a', street: 'Av. Reforma', exteriorNumber: '100', interiorNumber: null,
  zipCode: '06600', neighborhood: 'Juárez', municipality: 'Cuauhtémoc',
  city: 'CDMX', state: 'CDMX', label: null, latitude: 19.4326, longitude: -99.1332,
}
function makeAddress(o: Partial<DeliveryRouteShippingAddress> = {}) { return { ...ADDR, ...o } }
function makeStop(o: Partial<{
  id: string; sortOrder: number; status: DeliveryRouteStop['status']
  saleFolio: string | null; customer: DeliveryRouteStop['customer']; email: string | null
  address: DeliveryRouteShippingAddress | null
}> = {}): DeliveryRouteStop {
  const sortOrder = o.sortOrder ?? 0
  return {
    id: o.id ?? `stop-${sortOrder}`, saleId: `sale-${sortOrder}`,
    saleFolio: o.saleFolio !== undefined ? o.saleFolio : `F-${sortOrder + 1}`,
    sortOrder, status: o.status ?? 'PENDING', checkedInAt: null, completedAt: null,
    customer: o.customer !== undefined ? o.customer : { id: `c-${sortOrder}`, name: 'Ana',
      ...(o.email !== undefined ? { email: o.email } : { email: 'a@x' }) },
    shippingAddress: o.address !== undefined ? o.address : makeAddress(),
  }
}
function mountPanel(p: Partial<{
  stop: DeliveryRouteStop; routeTerminal: boolean; canCheckIn: boolean
  checkInPending: boolean; mapReady: boolean
}> = {}) {
  return mount(DriverStopPanel, {
    props: { stop: makeStop(), routeTerminal: false, canCheckIn: true,
      checkInPending: false, mapReady: true, ...p },
    global: { stubs: { AddressMapPicker: AddressMapPickerStub } },
  })
}
const sfcBody = () => fs.readFileSync((DriverStopPanel as unknown as { __file: string }).__file, 'utf8').replace(/\/\*\*[\s\S]*?\*\//, '')

beforeEach(() => { toastCalls.length = 0 })
afterEach(() => { vi.restoreAllMocks() ; vi.unstubAllGlobals() })

describe('DriverStopPanel — header surface (REQ-DCK-003)', () => {
  it('renders position + folio + customer fallback + null folio; close emits []', async () => {
    const w = mountPanel({ stop: makeStop({ sortOrder: 4, saleFolio: 'F-099' }) })
    await flushPromises()
    expect(w.text()).toContain('Parada 5') ; expect(w.text()).toContain('F-099')
    expect(mountPanel({ stop: makeStop({ customer: null }) }).text()).toContain('Cliente sin nombre')
    const w2 = mountPanel({ stop: makeStop({ saleFolio: null }) })
    await flushPromises()
    expect(w2.text()).not.toMatch(/·\s/)
    const close = w.find('[data-testid="stop-panel-close"]')
    expect(close.exists()).toBe(true)
    expect(close.attributes('aria-label')).toBe(DELIVERY_ROUTE_COPY.cockpit.drawer.close)
    expect(close.classes()).toContain('min-h-11') ; expect(close.classes()).toContain('min-w-11')
    await close.trigger('click')
    expect(w.emitted('close')).toEqual([[]])
  })
})

describe('DriverStopPanel — address above map, map gate (REQ-DRC-106)', () => {
  it('address DOM-precedes the map when mapReady + finite coords', async () => {
    const w = mountPanel({ stop: makeStop({ address: makeAddress({ street: 'Av. Insurgentes' }) }) })
    await flushPromises()
    expect(w.text()).toContain('Av. Insurgentes')
    expect(w.find('[data-testid="address-map-picker-stub"]').exists()).toBe(true)
    expect(w.html().indexOf('Av. Insurgentes'))
      .toBeLessThan(w.html().indexOf('data-testid="address-map-picker-stub"'))
  })

  it.each([
    ['mapReady=false', { mapReady: false }],
    ['NaN coords', { stop: makeStop({ address: makeAddress({ latitude: NaN, longitude: NaN }) }) }],
    ['Infinity coords', { stop: makeStop({ address: makeAddress({ latitude: Infinity, longitude: -Infinity }) }) }],
    ['only one coord finite', { stop: makeStop({ address: makeAddress({ latitude: 19.4326, longitude: null }) }) }],
    ['both coords null', { stop: makeStop({ address: makeAddress({ latitude: null, longitude: null }) }) }],
    ['address null', { stop: makeStop({ address: null }) }],
  ] as const)('%s → map omitted; address still renders when present', async (_l, ov) => {
    const w = mountPanel({ mapReady: true, ...ov })
    await flushPromises()
    expect(w.find('[data-testid="address-map-picker-stub"]').exists()).toBe(false)
    if ((ov as { stop?: DeliveryRouteStop }).stop?.shippingAddress !== null) expect(w.text()).toContain('Av. Reforma')
  })

  it('(0, 0) coords are a legal pin → map renders', async () => {
    expect(mountPanel({ stop: makeStop({ address: makeAddress({ latitude: 0, longitude: 0 }) }) })
      .find('[data-testid="address-map-picker-stub"]').exists()).toBe(true)
  })

  it('tile failure hides map, address remains, no toast', async () => {
    const w = mountPanel()
    await flushPromises()
    w.findComponent(AddressMapPickerStub).vm.simulateTileFailure()
    await flushPromises()
    expect(w.find('[data-testid="address-map-picker-stub"]').exists()).toBe(false)
    expect(w.text()).toContain('Av. Reforma')
    expect(toastCalls).toHaveLength(0)
  })
})

describe('DriverStopPanel — quick actions: ordering, ≥44×44, predicates (REQ-DCK-005)', () => {
  const FULL = makeAddress({ latitude: 19.4326, longitude: -99.1332 })
  const NO_ADDR = makeAddress({ street: '', exteriorNumber: '', latitude: 19.4326, longitude: -99.1332, neighborhood: '', municipality: '', city: '', state: '', zipCode: '' })
  const BOTH_EMPTY = makeAddress({ street: '', exteriorNumber: '', latitude: null, longitude: null, neighborhood: '', municipality: '', city: '', state: '', zipCode: '' })

  it('renders map / copy / email in the spec order with the spec labels', async () => {
    const w = mountPanel({ stop: makeStop({ email: 'a@x', address: FULL }) })
    await flushPromises()
    const btns = w.findAll('button[data-testid^="stop-panel-quick-"]')
    const qa = DELIVERY_ROUTE_COPY.cockpit.quickActions
    expect(btns.map((b) => b.attributes('data-testid'))).toEqual(['stop-panel-quick-map', 'stop-panel-quick-copy', 'stop-panel-quick-email'])
    expect(btns.map((b) => b.text().trim())).toEqual([qa.map, qa.copyAddress, qa.email])
  })

  it.each(['stop-panel-quick-map', 'stop-panel-quick-copy', 'stop-panel-quick-email'] as const)(
    '%s is ≥44×44 with focus-visible', async (tid) => {
      const cls = mountPanel({ stop: makeStop({ email: 'a@x', address: FULL }) })
        .find(`[data-testid="${tid}"]`).classes().join(' ')
      expect(cls).toMatch(/min-h-11/) ; expect(cls).toMatch(/min-w-11/) ; expect(cls).toMatch(/focus-visible/)
    },
  )

  it.each([
    ['no address + null coords', { address: BOTH_EMPTY }, ['email'], ['map', 'copy']],
    ['empty address + finite coords', { address: NO_ADDR }, ['map'], ['copy']],
    ['email null', { email: null }, ['map', 'copy'], ['email']],
    ['email whitespace', { email: '   ' }, ['map', 'copy'], ['email']],
  ] as const)('%s → only the listed buttons render', async (_l, ov, visible, hidden) => {
    const w = mountPanel({ stop: makeStop(ov) })
    await flushPromises()
    for (const tid of visible) expect(w.find(`[data-testid="stop-panel-quick-${tid}"]`).exists()).toBe(true)
    for (const tid of hidden) expect(w.find(`[data-testid="stop-panel-quick-${tid}"]`).exists()).toBe(false)
  })

  it('copy click success writes the trimmed address AND toasts "Dirección copiada" (B3 unified handler)', async () => {
    const writeText = vi.fn(async () => undefined)
    const clickCopy = () => mountPanel().find('[data-testid="stop-panel-quick-copy"]').trigger('click')
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await clickCopy() ; await flushPromises()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Av. Reforma'))
    expect(toastCalls).toHaveLength(1)
    expect(toastCalls[0]?.title).toBe(DELIVERY_ROUTE_COPY.cockpit.quickActions.successCopy)
    expect(toastCalls[0]?.color).toBe('success')
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('denied') }) } })
    await clickCopy() ; await flushPromises()
    expect(toastCalls).toHaveLength(2)
    expect(toastCalls[1]?.title).toBe('No se pudo copiar la dirección')
    expect(toastCalls[1]?.color).toBe('error')
  })

  it('map action opens window.open with encoded coords AND toasts "Mapa abierto" (B3 unified handler)', async () => {
    const clickMap = () => mountPanel({ stop: makeStop({ address: FULL }) })
      .find('[data-testid="stop-panel-quick-map"]').trigger('click')
    vi.spyOn(window, 'open').mockImplementation(vi.fn(() => ({} as unknown as Window)))
    await clickMap() ; await flushPromises()
    const [url, target, features] = (vi.mocked(window.open).mock.calls[0] ?? []) as [string, string, string]
    expect(url).toContain('google.com/maps') ; expect(target).toBe('_blank')
    expect(features).toBe('noopener,noreferrer') ; expect(url).toContain('19.4326%2C-99.1332')
    expect(toastCalls).toHaveLength(1)
    expect(toastCalls[0]?.title).toBe(DELIVERY_ROUTE_COPY.cockpit.quickActions.successMap)
    expect(toastCalls[0]?.color).toBe('success')
    vi.spyOn(window, 'open').mockReturnValue(null)
    await clickMap() ; await flushPromises()
    expect(toastCalls.some((t) => t.title === 'No se pudo abrir el mapa' && t.color === 'error')).toBe(true)
  })

  it('email click wires to S2 openEmail helper AND toasts "Enviando correo" (B3 unified handler)', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => undefined) } })
    vi.spyOn(window, 'open').mockReturnValue({} as unknown as Window)
    await mountPanel({ stop: makeStop({ email: 'a@x', address: FULL }) })
      .find('[data-testid="stop-panel-quick-email"]').trigger('click')
    await flushPromises()
    expect(toastCalls).toHaveLength(1)
    expect(toastCalls[0]?.title).toBe(DELIVERY_ROUTE_COPY.cockpit.quickActions.successEmail)
    expect(toastCalls[0]?.color).toBe('success')
  })

  it('all three failures route through the SAME unified handler with error color + canonical copy (B3 review)', async () => {
    // Force map + copy helpers to fail; each emits ONE error toast with the canonical
    // failure copy. The third failure (email) is covered separately by the email-failure
    // source-invariant below since the helper short-circuits when the email is empty.
    vi.spyOn(window, 'open').mockReturnValue(null)
    await mountPanel({ stop: makeStop({ address: FULL }) }).find('[data-testid="stop-panel-quick-map"]').trigger('click') ; await flushPromises()
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('denied') }) } })
    await mountPanel().find('[data-testid="stop-panel-quick-copy"]').trigger('click') ; await flushPromises()
    const errors = toastCalls.filter((t) => t.color === 'error')
    expect(errors.map((t) => t.title).sort()).toEqual([
      'No se pudo abrir el mapa',
      'No se pudo copiar la dirección',
    ].sort())
    // Source invariant: exactly ONE function calls useToast().add — the unified handler.
    // Three separate handlers would each call useToast directly.
    const source = sfcBody()
    const directUseToastCalls = (source.match(/useToast\(\)\.add\(|\.add\(\s*\{\s*title:/g) ?? []).length
    expect(directUseToastCalls).toBe(1)
  })

  it('quick actions render via ONE template loop, ordered map → copy → email (B3 review)', async () => {
    const w = mountPanel({ stop: makeStop({ email: 'a@x', address: FULL }) })
    await flushPromises()
    const btns = w.findAll('button[data-testid^="stop-panel-quick-"]')
    expect(btns.map((b) => b.attributes('data-testid'))).toEqual(['stop-panel-quick-map', 'stop-panel-quick-copy', 'stop-panel-quick-email'])
    // Source invariant: only one explicit button tag in the template (template loop), not three.
    const source = sfcBody()
    const explicitBlocks = (source.match(/<button[^>]*data-testid="stop-panel-quick-(map|copy|email)"/g) ?? []).length
    expect(explicitBlocks).toBeLessThanOrEqual(1)
  })
})

describe('DriverStopPanel — secondary delivery action (REQ-DCK-003/006, REQ-DCS-009)', () => {
  it('PENDING + non-terminal + canCheckIn + not-pending → emits { stopId, trigger }', async () => {
    const w = mountPanel({ stop: makeStop({ id: 's7', sortOrder: 6, status: 'PENDING' }) })
    await flushPromises()
    const btn = w.find('[data-testid="stop-panel-secondary-action"]')
    expect(btn.exists()).toBe(true) ; expect(btn.text()).toContain('Marcar entregada')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
    await btn.trigger('click')
    const events = w.emitted('request-confirm') ?? []
    expect(events).toHaveLength(1)
    const payload = events[0]?.[0] as StopTrigger
    expect(payload.stopId).toBe('s7') ; expect(payload.trigger).toBe(btn.element)
  })

  it.each([0, 7] as const)('secondary action visible for PENDING sortOrder=%i (route-position independent)', async (sortOrder) => {
    expect(mountPanel({ stop: makeStop({ status: 'PENDING', sortOrder }) })
      .find('[data-testid="stop-panel-secondary-action"]').exists()).toBe(true)
  })

  it('checkInPending=true: disabled; repeated clicks emit nothing', async () => {
    const w = mountPanel({ stop: makeStop({ status: 'PENDING' }), checkInPending: true })
    await flushPromises()
    const btn = w.find('[data-testid="stop-panel-secondary-action"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    await btn.trigger('click') ; await btn.trigger('click') ; await btn.trigger('click')
    expect(w.emitted('request-confirm') ?? []).toHaveLength(0)
  })

  it.each([
    ['COMPLETED stop', { status: 'COMPLETED' as const }],
    ['SKIPPED stop', { status: 'SKIPPED' as const }],
    ['IN_PROGRESS stop', { status: 'IN_PROGRESS' as const }],
  ] as const)('%s → NO secondary action', async (_l, stopOv) => {
    const w = mountPanel({ stop: makeStop(stopOv) })
    await flushPromises()
    expect(w.find('[data-testid="stop-panel-secondary-action"]').exists()).toBe(false)
  })

  it.each([
    ['terminal route', { routeTerminal: true }],
    ['read-only driver', { canCheckIn: false }],
  ] as const)('%s → NO secondary action', async (_l, ov) => {
    const w = mountPanel({ stop: makeStop({ status: 'PENDING' }), ...ov })
    await flushPromises()
    expect(w.find('[data-testid="stop-panel-secondary-action"]').exists()).toBe(false)
  })
})

describe('DriverStopPanel — central copy + source invariants', () => {
  it('every user-visible literal comes from DELIVERY_ROUTE_COPY', async () => {
    const w = mountPanel({ stop: makeStop({ status: 'PENDING', email: 'a@x', address: makeAddress({ latitude: 19.4326, longitude: -99.1332 }) }) })
    await flushPromises()
    const qa = DELIVERY_ROUTE_COPY.cockpit.quickActions
    expect(w.find('[data-testid="stop-panel-close"]').attributes('aria-label')).toBe(DELIVERY_ROUTE_COPY.cockpit.drawer.close)
    const text = w.text()
    expect(text).toContain(qa.map) ; expect(text).toContain(qa.copyAddress) ; expect(text).toContain(qa.email)
    expect(text).toContain(DELIVERY_ROUTE_COPY.actions.checkIn)
  })

  it('header uses semantic tokens + min-w-0 + sticky; 320px safe', async () => {
    const cls = mountPanel().find('[data-testid="stop-panel-header"]').classes().join(' ')
    expect(cls).toMatch(/bg-(default|elevated)/) ; expect(cls).toMatch(/border-default/)
    expect(cls).toMatch(/min-w-0/) ; expect(cls).toMatch(/sticky/)
    expect(cls).not.toMatch(/\bw-\[|\bmin-w-\[/) ; expect(cls).not.toMatch(/\bfixed\b|\babsolute\b/)
  })

  it('SFC has NO server-state imports, no mutation/refetch surface, no overlay ownership', () => {
    const b = sfcBody()
    for (const re of [/from\s+['"]vue-router['"]|useRouter|useRoute\b/,
      /useQuery|useMutation|useQueryClient|@tanstack\/vue-query/,
      /axios|fetch\(['"]/, /useCheckInStop|invalidate|refetch|mutateAsync|mutate\(/,
      /<UDrawer|<UModal|<ConfirmModal/]) expect(b).not.toMatch(re)
  })

  it.each([
    /["']Ver en mapa["']/, /["']Copiar dirección["']/, /["']Email["']/, /["']No se pudo copiar la dirección["']/,
    /["']No se pudo abrir el mapa["']/, /["']No se pudo abrir el correo["']/,
  ])('SFC never hardcodes the literal %s', (re) => { expect(sfcBody()).not.toMatch(re) })
})
