// TransferDeliveryRouteStopModal.spec.ts — STRICT-TDD tests for the per-stop
// draft-to-draft move dialog (T3 S2/S4).
//
// Contract:
//   - "Mover" opens a destination-selection dialog; the mutation is NEVER fired
//     on selection alone — the user must reach the explicit confirmation step.
//   - The origin route is excluded from the destination list (source and
//     destination must differ).
//   - Cancelling never issues a request.
//   - A 422 flat reason or a 403 keeps the dialog OPEN and actionable with a
//     meaningful Spanish message (no silent close, no duplicate submit).
//   - The dialog is a thin surface: the composable owns cache invalidation.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { DELIVERY_ROUTE_COPY } from '../../copy'
import type { DeliveryRouteResponseDto, DeliveryRouteStop } from '../../interfaces/delivery-route.types'

// ─── Composable mocks — the dialog delegates the transport to these ────────────
const transferMutateMock = vi.fn()
const transferPendingRef = ref(false)
const destinationsData = ref<DeliveryRouteResponseDto[]>([])
const destinationsLoading = ref(false)
const destinationsIsError = ref(false)
const destinationsErrorRef = ref<unknown>(null)
const destinationsRefetch = vi.fn()

vi.mock('../../composables/useTransferDeliveryRouteStop', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../composables/useTransferDeliveryRouteStop')>()
  return {
    ...actual,
    useTransferDeliveryRouteStop: () => ({
      mutateAsync: transferMutateMock,
      isPending: transferPendingRef,
      error: ref(null),
    }),
    useDraftTransferDestinations: () => ({
      data: destinationsData,
      isLoading: destinationsLoading,
      isError: destinationsIsError,
      error: destinationsErrorRef,
      refetch: destinationsRefetch,
    }),
  }
})

// ─── Nuxt UI stubs ────────────────────────────────────────────────────────────
const modalStub = defineComponent({
  name: 'UModal',
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    dismissible: { type: Boolean, default: true },
    close: { type: Boolean, default: true },
  },
  emits: ['update:open'],
  setup(props, { slots }) {
    return () =>
      props.open
        ? h('div', { 'data-testid': 'transfer-modal' }, [
            h('span', { 'data-testid': 'transfer-modal-title' }, props.title),
            slots.body?.(),
            slots.footer?.(),
          ])
        : null
  },
})

const buttonStub = defineComponent({
  name: 'UButton',
  inheritAttrs: false,
  props: {
    label: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    color: { type: String, default: '' },
    variant: { type: String, default: '' },
    type: { type: String, default: 'button' },
  },
  emits: ['click'],
  setup(props, { attrs, emit }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          type: 'button',
          disabled: props.disabled,
          'data-loading': String(props.loading),
          'data-color': props.color,
          onClick: () => emit('click'),
        },
        props.label,
      )
  },
})

const stubs = {
  UModal: modalStub,
  Modal: modalStub,
  UButton: buttonStub,
  Button: buttonStub,
  UIcon: { template: '<span />' },
  Icon: { template: '<span />' },
}

import TransferDeliveryRouteStopModal from '../TransferDeliveryRouteStopModal.vue'

function makeRoute(overrides: Partial<DeliveryRouteResponseDto> = {}): DeliveryRouteResponseDto {
  return {
    id: 'route-B',
    status: 'DRAFT',
    driver: { id: 'd-2', name: 'Ana', email: 'a@x.com' },
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline: [],
    ...overrides,
  }
}

const STOP: DeliveryRouteStop = {
  id: 'stop-9',
  saleId: 'sale-9',
  saleFolio: 'F-009',
  sortOrder: 0,
  status: 'PENDING',
  checkedInAt: null,
  completedAt: null,
  customer: { id: 'c-1', name: 'Cliente', email: null },
  shippingAddress: null,
}

function mountModal(props: Record<string, unknown> = {}, attachToDocument = false) {
  const wrapper = mount(TransferDeliveryRouteStopModal, {
    props: { open: true, originRouteId: 'route-A', stop: STOP, ...props },
    global: { stubs },
    ...(attachToDocument ? { attachTo: document.body } : {}),
  })
  if (attachToDocument) mountedWrappers.push(wrapper)
  return wrapper
}

// Attached mounts are needed for jsdom `document.activeElement` assertions
// (detached trees never receive focus). Tracked so each test cleans up.
const mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

beforeEach(() => {
  vi.clearAllMocks()
  transferPendingRef.value = false
  destinationsData.value = [makeRoute({ id: 'route-A' }), makeRoute({ id: 'route-B' })]
  destinationsLoading.value = false
  destinationsIsError.value = false
  destinationsErrorRef.value = null
})

async function goToConfirm(wrapper: ReturnType<typeof mountModal>) {
  await wrapper.find('[data-testid="transfer-destination-route-B"]').trigger('click')
  await nextTick()
  await wrapper.find('[data-testid="transfer-continue"]').trigger('click')
  await nextTick()
}

describe('TransferDeliveryRouteStopModal — destination selection', () => {
  it('excludes the origin route from the destination list (source and destination differ)', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('[data-testid="transfer-destination-route-A"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="transfer-destination-route-B"]').exists()).toBe(true)
  })

  it('renders the dialog with the Spanish transfer title', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('[data-testid="transfer-modal-title"]').text()).toBe(
      DELIVERY_ROUTE_COPY.transfer.title,
    )
  })

  it('requires an explicit selection before continuing (no immediate mutation)', async () => {
    const wrapper = mountModal()
    await flushPromises()
    const continueBtn = wrapper.find('[data-testid="transfer-continue"]')
    expect((continueBtn.element as HTMLButtonElement).disabled).toBe(true)
    await continueBtn.trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="transfer-step-confirm"]').exists()).toBe(false)
    expect(transferMutateMock).not.toHaveBeenCalled()
  })

  it('shows an explicit confirmation step WITHOUT firing the mutation', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    expect(wrapper.find('[data-testid="transfer-step-confirm"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="transfer-step-select"]').exists()).toBe(false)
    expect(transferMutateMock).not.toHaveBeenCalled()
  })

  it('renders the empty state when there is no other draft route', async () => {
    destinationsData.value = [makeRoute({ id: 'route-A' })]
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('[data-testid="transfer-destinations-empty"]').exists()).toBe(true)
  })

  it('shows a graceful list error with a retry control on a failed destination fetch', async () => {
    destinationsIsError.value = true
    destinationsErrorRef.value = { response: { status: 403, data: { error: 'INSUFFICIENT_PERMISSIONS' } } }
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('[data-testid="transfer-destinations-error"]').exists()).toBe(true)
    await wrapper.find('[data-testid="transfer-destinations-retry"]').trigger('click')
    expect(destinationsRefetch).toHaveBeenCalledTimes(1)
  })
})

describe('TransferDeliveryRouteStopModal — explicit confirmation + no duplicate submit', () => {
  it('confirming calls the transfer exactly once with the route/stop/destination tuple', async () => {
    transferMutateMock.mockResolvedValue({ originRoute: makeRoute({ id: 'route-A' }), destinationRoute: makeRoute() })
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await flushPromises()
    expect(transferMutateMock).toHaveBeenCalledTimes(1)
    expect(transferMutateMock).toHaveBeenCalledWith({
      originRouteId: 'route-A',
      stopId: 'stop-9',
      destinationRouteId: 'route-B',
    })
  })

  it('emits moved + closes the dialog on success', async () => {
    transferMutateMock.mockResolvedValue({ originRoute: makeRoute({ id: 'route-A' }), destinationRoute: makeRoute() })
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('moved')?.[0]?.[0]).toEqual({ destinationRouteId: 'route-B' })
    const openEvents = wrapper.emitted('update:open')
    expect(openEvents?.[openEvents.length - 1]?.[0]).toBe(false)
  })

  it('prevents duplicate submission while the first request is in flight', async () => {
    let resolveTransfer: (value: unknown) => void = () => undefined
    transferMutateMock.mockImplementation(
      () => new Promise((resolve) => { resolveTransfer = resolve }),
    )
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    const confirmBtn = wrapper.find('[data-testid="transfer-confirm"]')
    await confirmBtn.trigger('click')
    await confirmBtn.trigger('click')
    await nextTick()
    expect(transferMutateMock).toHaveBeenCalledTimes(1)
    resolveTransfer({ originRoute: makeRoute({ id: 'route-A' }), destinationRoute: makeRoute() })
    await flushPromises()
  })
})

describe('TransferDeliveryRouteStopModal — dialogs stay actionable on failure', () => {
  it('keeps the dialog OPEN and shows the 422 flat reason on rejection', async () => {
    transferMutateMock.mockRejectedValue({
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', reason: 'SAME_ROUTE_TRANSFER' },
      },
    })
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="transfer-modal"]').exists()).toBe(true)
    const error = wrapper.find('[data-testid="transfer-error"]')
    expect(error.exists()).toBe(true)
    expect(error.text()).toMatch(/diferente|distinta/i)
    // Still actionable: the confirm control remains enabled for a retry.
    expect((wrapper.find('[data-testid="transfer-confirm"]').element as HTMLButtonElement).disabled).toBe(false)
    expect(wrapper.emitted('update:open')).toBeFalsy()
  })

  it('mantiene el diálogo accionable en un 403 (mensaje de permisos)', async () => {
    transferMutateMock.mockRejectedValue({
      response: { status: 403, data: { error: 'INSUFFICIENT_PERMISSIONS', message: 'no' } },
    })
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="transfer-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="transfer-error"]').text()).toMatch(/permiso/i)
    expect((wrapper.find('[data-testid="transfer-confirm"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps the NOT_DRAFT reason informative and does not close', async () => {
    transferMutateMock.mockRejectedValue({
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', reason: 'NOT_DRAFT' },
      },
    })
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="transfer-error"]').text()).toMatch(/borrador/i)
    expect(wrapper.emitted('update:open')).toBeFalsy()
  })
})

describe('TransferDeliveryRouteStopModal — cancellation + reset', () => {
  it('cancelling never issues a request and closes the dialog', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.find('[data-testid="transfer-cancel"]').trigger('click')
    await nextTick()
    expect(transferMutateMock).not.toHaveBeenCalled()
    const openEvents = wrapper.emitted('update:open')
    expect(openEvents?.[openEvents.length - 1]?.[0]).toBe(false)
  })

  it('clears the selection when the dialog is reopened (route change / reset)', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    // Close + reopen.
    await wrapper.setProps({ open: false })
    await nextTick()
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(wrapper.find('[data-testid="transfer-step-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="transfer-step-confirm"]').exists()).toBe(false)
    expect((wrapper.find('[data-testid="transfer-continue"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('clears the selection when the origin route id changes', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.setProps({ originRouteId: 'route-Z', stop: { ...STOP, id: 'stop-Z' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="transfer-step-select"]').exists()).toBe(true)
    expect((wrapper.find('[data-testid="transfer-continue"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})

// ─── Correction 1 — stale destination must never submit ───────────────────────
describe('TransferDeliveryRouteStopModal — stale destination (verifier correction 1)', () => {
  it('returns to choose with an actionable notice and never submits when the destination disappears during confirmation', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    expect(wrapper.find('[data-testid="transfer-step-confirm"]').exists()).toBe(true)

    // A candidate refresh removes the chosen destination while confirming.
    destinationsData.value = [makeRoute({ id: 'route-A' })]
    await nextTick()

    expect(wrapper.find('[data-testid="transfer-step-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="transfer-step-confirm"]').exists()).toBe(false)
    const notice = wrapper.find('[data-testid="transfer-selection-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toMatch(/disponible/i)
    expect(transferMutateMock).not.toHaveBeenCalled()
  })

  it('does not submit a stored id whose fresh candidate is no longer DRAFT', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)

    // The same id reappears but no longer DRAFT (race with another manager).
    destinationsData.value = [makeRoute({ id: 'route-A' }), makeRoute({ id: 'route-B', status: 'ACTIVE' })]
    await nextTick()

    expect(wrapper.find('[data-testid="transfer-step-confirm"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="transfer-step-select"]').exists()).toBe(true)
    expect(transferMutateMock).not.toHaveBeenCalled()
  })

  it('never submits when the selected destination is no longer in the candidate list', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    destinationsData.value = []
    await nextTick()
    expect(transferMutateMock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="transfer-destinations-empty"]').exists()).toBe(true)
  })
})

// ─── Correction 2 — pending context race ─────────────────────────────────────
describe('TransferDeliveryRouteStopModal — pending context race (verifier correction 2)', () => {
  function deferred<T = unknown>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }

  it('does not close the NEW context when a deferred success resolves after the route changed', async () => {
    const d = deferred()
    transferMutateMock.mockImplementation(() => d.promise)
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await nextTick()

    // New context arrives while the request is still in flight.
    await wrapper.setProps({ originRouteId: 'route-Z', stop: { ...STOP, id: 'stop-Z' } })
    await flushPromises()

    d.resolve({ originRoute: makeRoute({ id: 'route-A' }), destinationRoute: makeRoute() })
    await flushPromises()

    // The stale completion must not close the new context nor emit a move.
    expect(wrapper.emitted('update:open')).toBeFalsy()
    expect(wrapper.emitted('moved')).toBeFalsy()
    expect(wrapper.find('[data-testid="transfer-step-select"]').exists()).toBe(true)
  })

  it('does not inject a stale error into the NEW context when a deferred rejection settles after the route changed', async () => {
    const d = deferred()
    transferMutateMock.mockImplementation(() => d.promise)
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await nextTick()

    await wrapper.setProps({ originRouteId: 'route-Z', stop: { ...STOP, id: 'stop-Z' } })
    await flushPromises()

    d.reject({ response: { status: 422, data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', reason: 'NOT_DRAFT' } } })
    await flushPromises()

    expect(wrapper.find('[data-testid="transfer-error"]').exists()).toBe(false)
    expect(wrapper.emitted('update:open')).toBeFalsy()
  })

  it('does not apply a deferred completion after close/reopen with the same ids', async () => {
    const d = deferred()
    transferMutateMock.mockImplementation(() => d.promise)
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await nextTick()

    await wrapper.setProps({ open: false })
    await nextTick()
    await wrapper.setProps({ open: true })
    await flushPromises()

    d.reject({ response: { status: 403, data: { error: 'INSUFFICIENT_PERMISSIONS' } } })
    await flushPromises()

    expect(wrapper.find('[data-testid="transfer-error"]').exists()).toBe(false)
    expect(wrapper.emitted('update:open')).toBeFalsy()
    // Reopened context is fresh.
    expect(wrapper.find('[data-testid="transfer-step-select"]').exists()).toBe(true)
  })

  it('scopes duplicate-submit protection to the context: a new context may still submit', async () => {
    const pending: Array<ReturnType<typeof deferred>> = []
    transferMutateMock.mockImplementation(() => {
      const d = deferred()
      pending.push(d)
      return d.promise
    })
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await nextTick()
    expect(transferMutateMock).toHaveBeenCalledTimes(1)

    // New context must not be blocked by the previous in-flight request.
    await wrapper.setProps({ originRouteId: 'route-Z', stop: { ...STOP, id: 'stop-Z' } })
    await flushPromises()
    await wrapper.find('[data-testid="transfer-destination-route-B"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-testid="transfer-continue"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await nextTick()

    expect(transferMutateMock).toHaveBeenCalledTimes(2)
    expect(transferMutateMock).toHaveBeenLastCalledWith({
      originRouteId: 'route-Z',
      stopId: 'stop-Z',
      destinationRouteId: 'route-B',
    })

    pending.forEach((d) => d.resolve({ originRoute: makeRoute({ id: 'route-A' }), destinationRoute: makeRoute() }))
    await flushPromises()
  })
})

// ─── Correction 3 — accessibility (keyboard + live region) ────────────────────
describe('TransferDeliveryRouteStopModal — accessibility (verifier correction 3)', () => {
  const THREE = [
    makeRoute({ id: 'route-A' }),
    makeRoute({ id: 'route-B' }),
    makeRoute({ id: 'route-C' }),
  ]

  it('moves selection + focus with ArrowDown and wraps around', async () => {
    destinationsData.value = THREE
    const wrapper = mountModal({}, true)
    await flushPromises()

    const first = wrapper.find('[data-testid="transfer-destination-route-B"]')
    ;(first.element as HTMLButtonElement).focus()
    await first.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()

    const third = wrapper.find('[data-testid="transfer-destination-route-C"]')
    expect(third.attributes('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(third.element)
    // Selection is real: continue is now enabled.
    expect((wrapper.find('[data-testid="transfer-continue"]').element as HTMLButtonElement).disabled).toBe(false)

    // Wrap from the last option back to the first.
    await third.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    const firstBtn = wrapper.find('[data-testid="transfer-destination-route-B"]')
    expect(firstBtn.attributes('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(firstBtn.element)
  })

  it('moves selection + focus with ArrowUp and wraps backward', async () => {
    destinationsData.value = THREE
    const wrapper = mountModal({}, true)
    await flushPromises()
    const first = wrapper.find('[data-testid="transfer-destination-route-B"]')
    ;(first.element as HTMLButtonElement).focus()
    await first.trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    const last = wrapper.find('[data-testid="transfer-destination-route-C"]')
    expect(last.attributes('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(last.element)
  })

  it('jumps with Home/End and selects with Space', async () => {
    destinationsData.value = THREE
    const wrapper = mountModal({}, true)
    await flushPromises()
    const first = wrapper.find('[data-testid="transfer-destination-route-B"]')
    ;(first.element as HTMLButtonElement).focus()
    await first.trigger('keydown', { key: 'End' })
    await nextTick()
    const last = wrapper.find('[data-testid="transfer-destination-route-C"]')
    expect(last.attributes('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(last.element)

    await last.trigger('keydown', { key: 'Home' })
    await nextTick()
    const firstBtn = wrapper.find('[data-testid="transfer-destination-route-B"]')
    expect(firstBtn.attributes('aria-checked')).toBe('true')

    await firstBtn.trigger('keydown', { key: ' ' })
    await nextTick()
    expect(firstBtn.attributes('aria-checked')).toBe('true')
    expect((wrapper.find('[data-testid="transfer-continue"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('exposes a roving tabindex (only selected or first option is tabbable)', async () => {
    destinationsData.value = THREE
    const wrapper = mountModal()
    await flushPromises()
    const first = wrapper.find('[data-testid="transfer-destination-route-B"]')
    const other = wrapper.find('[data-testid="transfer-destination-route-C"]')
    expect(first.attributes('tabindex')).toBe('0')
    expect(other.attributes('tabindex')).toBe('-1')
    await first.trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="transfer-destination-route-B"]').attributes('tabindex')).toBe('0')
    expect(wrapper.find('[data-testid="transfer-destination-route-C"]').attributes('tabindex')).toBe('-1')
  })

  it('announces the submit error in a live region (role=alert)', async () => {
    transferMutateMock.mockRejectedValue({
      response: { status: 403, data: { error: 'INSUFFICIENT_PERMISSIONS' } },
    })
    const wrapper = mountModal()
    await flushPromises()
    await goToConfirm(wrapper)
    await wrapper.find('[data-testid="transfer-confirm"]').trigger('click')
    await flushPromises()
    const error = wrapper.find('[data-testid="transfer-error"]')
    expect(error.exists()).toBe(true)
    expect(error.attributes('role')).toBe('alert')
  })

  it('announces the destination-list error in a live region (role=alert)', async () => {
    destinationsIsError.value = true
    destinationsErrorRef.value = { response: { status: 500, data: { message: 'boom' } } }
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('[data-testid="transfer-destinations-error"]').attributes('role')).toBe('alert')
  })
})
