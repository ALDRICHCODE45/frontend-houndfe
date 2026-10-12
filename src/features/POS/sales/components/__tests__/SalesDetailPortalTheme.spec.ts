import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import DebtPaymentModal from '../DebtPaymentModal.vue'
import AssignSellerSlideover from '../AssignSellerSlideover.vue'
import SaleCommentSlideover from '../SaleCommentSlideover.vue'
import EditReferenceSlideover from '../EditReferenceSlideover.vue'
import SaleCommentInput from '../SaleCommentInput.vue'
import SaleDetailHistoryCard from '../SaleDetailHistoryCard.vue'
import PaymentsListSection from '../PaymentsListSection.vue'

/*
 * Sales detail portal opt-in (T4 / S1,S3-S5).
 *
 * The detail overlays cannot inherit the workspace tokens after teleport, so
 * each one repeats the boundary on its own installed Nuxt UI content root.
 * This spec proves the marker reaches the *installed* native component and its
 * rendered `[data-slot="content"]` root, and that an omitted opt-in leaves the
 * previous `ui` value and all native defaults untouched.
 *
 * A class on the positioning wrapper or the `#content` slot div is NOT proof;
 * every opt-in is asserted on the Nuxt `ui.content` prop plus the native
 * `data-slot="content"` element, and the intermediate detail children are
 * checked to forward the prop to the real owners.
 */
const PORTAL = 'hf-theme hf-ui hf-form-overlay sales-detail-portal'

const useDebtPaymentMock = {
  submitSafe: vi.fn(),
  isSubmitting: ref(false),
  externalErrorCode: ref<string | null>(null),
  shouldClose: ref(false),
  resetError: vi.fn(),
  catalogClearSignal: ref(0),
}

vi.mock('../../composables/useDebtPayment', () => ({
  useDebtPayment: () => useDebtPaymentMock,
}))

vi.mock('../../composables/useSalePaymentMethods', () => ({
  useSalePaymentMethods: () => ({ data: ref([]) }),
}))

vi.mock('../../composables/useSellerAssignment', () => ({
  useSellerAssignment: () => ({ assignSeller: vi.fn(), isPending: ref(false) }),
}))

vi.mock('@/features/POS/users/api/user.api', () => ({
  usersApi: { listAssignable: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@nuxt/ui/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nuxt/ui/composables/useToast')>()
  return {
    ...actual,
    useToast: () => ({
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      toasts: ref([]),
    }),
  }
})

type TrackedWrapper = ReturnType<typeof mountWithUApp>
const wrappers: TrackedWrapper[] = []

interface PropsReader {
  props: (key: string) => unknown
}

/**
 * VTU narrows `props()` to the wrapper's own prop keys; the loose mount helper
 * erases that generic, so read optional presentation props through this cast.
 */
function readProp(wrapper: TrackedWrapper, key: string): unknown {
  return (wrapper as unknown as PropsReader).props(key)
}

function track<T extends TrackedWrapper>(wrapper: T): T {
  wrappers.push(wrapper)
  return wrapper
}

// `mountWithUApp` returns the tested component's child wrapper (not the root
// UApp wrapper), so `.unmount()` would throw. Like the existing portal harness,
// drop the teleported DOM between tests instead; jsdom has no timers left to
// fire once the body is cleared.
afterEach(() => {
  wrappers.length = 0
  document.body.innerHTML = ''
})

function queryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function contentRoots(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-slot="content"]'))
}

function hasMarker(): boolean {
  return contentRoots().some((root) => root.classList.contains('sales-detail-portal'))
}

function slideoverUi(wrapper: TrackedWrapper) {
  return wrapper.findComponent({ name: 'Slideover' }).props('ui')
}

describe('Sales detail owned overlays — installed native content root', () => {
  it('DebtPaymentModal themes the installed Slideover content root only when opted in', async () => {
    const optedIn = track(
      mountWithUApp(DebtPaymentModal, {
        props: { open: true, saleId: 'sale-1', debtCents: 80000, portalClass: PORTAL },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(slideoverUi(optedIn)).toEqual({
      content: `sm:max-w-lg ${PORTAL}`,
      body: 'p-0 flex flex-col h-full',
    })
    expect(hasMarker()).toBe(true)
  })

  it('DebtPaymentModal preserves the exact previous ui value when the prop is absent', async () => {
    const inert = track(
      mountWithUApp(DebtPaymentModal, {
        props: { open: true, saleId: 'sale-1', debtCents: 80000 },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(slideoverUi(inert)).toEqual({
      content: 'sm:max-w-lg',
      body: 'p-0 flex flex-col h-full',
    })
    expect(contentRoots().length).toBeGreaterThan(0)
    expect(hasMarker()).toBe(false)
  })

  it('AssignSellerSlideover themes the installed Slideover content root only when opted in', async () => {
    const optedIn = track(
      mountWithUApp(AssignSellerSlideover, {
        props: { open: true, saleId: 'sale-1', portalClass: PORTAL },
        attachTo: document.body,
        global: { plugins: [[VueQueryPlugin, { queryClient: queryClient() }]] },
      }),
    )
    await flushPromises()

    expect(slideoverUi(optedIn)).toEqual({ content: PORTAL })
    expect(hasMarker()).toBe(true)
  })

  it('AssignSellerSlideover keeps the installed default ui when the prop is absent', async () => {
    const inert = track(
      mountWithUApp(AssignSellerSlideover, {
        props: { open: true, saleId: 'sale-1' },
        attachTo: document.body,
        global: { plugins: [[VueQueryPlugin, { queryClient: queryClient() }]] },
      }),
    )
    await flushPromises()

    expect(slideoverUi(inert)).toBeUndefined()
    expect(contentRoots().length).toBeGreaterThan(0)
    expect(hasMarker()).toBe(false)
  })

  it('SaleCommentSlideover themes the installed Slideover content root only when opted in', async () => {
    const optedIn = track(
      mountWithUApp(SaleCommentSlideover, {
        props: { open: true, portalClass: PORTAL },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(slideoverUi(optedIn)).toEqual({ content: PORTAL })
    expect(hasMarker()).toBe(true)
  })

  it('SaleCommentSlideover keeps the installed default ui when the prop is absent', async () => {
    const inert = track(
      mountWithUApp(SaleCommentSlideover, {
        props: { open: true },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(slideoverUi(inert)).toBeUndefined()
    expect(contentRoots().length).toBeGreaterThan(0)
    expect(hasMarker()).toBe(false)
  })

  it('EditReferenceSlideover merges the marker without dropping its previous ui value', async () => {
    const optedIn = track(
      mountWithUApp(EditReferenceSlideover, {
        props: {
          open: true,
          currentReference: null,
          paymentMethod: 'CARD_DEBIT',
          portalClass: PORTAL,
        },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(slideoverUi(optedIn)).toEqual({ content: `!max-w-md ${PORTAL}` })
    expect(hasMarker()).toBe(true)
  })

  it('EditReferenceSlideover preserves the exact previous ui value when the prop is absent', async () => {
    const inert = track(
      mountWithUApp(EditReferenceSlideover, {
        props: { open: true, currentReference: null, paymentMethod: 'CARD_DEBIT' },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(slideoverUi(inert)).toEqual({ content: '!max-w-md' })
    expect(hasMarker()).toBe(false)
  })

  it('ConfirmModal keeps its existing shared ui opt-in and reaches the native Modal root', async () => {
    const optedIn = track(
      mountWithUApp(ConfirmModal, {
        props: { open: true, description: 'x', ui: { content: PORTAL } },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(optedIn.findComponent({ name: 'Modal' }).props('ui')).toEqual({ content: PORTAL })
    expect(hasMarker()).toBe(true)
  })

  it('ConfirmModal leaves the native defaults untouched when the opt-in is absent', async () => {
    const inert = track(
      mountWithUApp(ConfirmModal, {
        props: { open: true, description: 'x' },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(inert.findComponent({ name: 'Modal' }).props('ui')).toBeUndefined()
    expect(contentRoots().length).toBeGreaterThan(0)
    expect(hasMarker()).toBe(false)
  })
})

describe('Sales detail forwarding chain — intermediate children reach the real owners', () => {
  it('SaleCommentInput forwards the opt-in to the installed SaleCommentSlideover root', async () => {
    const wrapper = track(
      mountWithUApp(SaleCommentInput, {
        props: { onSubmit: vi.fn().mockResolvedValue(undefined), portalClass: PORTAL },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(readProp(wrapper, 'portalClass')).toBe(PORTAL)
    expect(slideoverUi(wrapper)).toEqual({ content: PORTAL })

    await wrapper.get('[data-testid="comment-open"]').trigger('click')
    await flushPromises()

    expect(hasMarker()).toBe(true)
  })

  it('SaleCommentInput leaves the nested slideover untouched when the opt-in is absent', async () => {
    const wrapper = track(
      mountWithUApp(SaleCommentInput, {
        props: { onSubmit: vi.fn().mockResolvedValue(undefined) },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(slideoverUi(wrapper)).toBeUndefined()
    expect(hasMarker()).toBe(false)
  })

  it('SaleDetailHistoryCard forwards the opt-in down to the installed slideover root', async () => {
    const wrapper = track(
      mountWithUApp(SaleDetailHistoryCard, {
        props: {
          timeline: [],
          currentUserId: null,
          commentsPending: false,
          onSubmitComment: vi.fn().mockResolvedValue(undefined),
          portalClass: PORTAL,
        },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(readProp(wrapper, 'portalClass')).toBe(PORTAL)
    expect(
      wrapper.findComponent({ name: 'SaleCommentInput' }).props('portalClass'),
    ).toBe(PORTAL)
    expect(slideoverUi(wrapper)).toEqual({ content: PORTAL })
  })

  it('PaymentsListSection forwards the opt-in to the installed EditReferenceSlideover root', async () => {
    const wrapper = track(
      mountWithUApp(PaymentsListSection, {
        props: {
          payments: [
            {
              paymentId: 'pay-1',
              method: 'CARD_DEBIT',
              amountCents: 1000,
              tenderedCents: 1000,
              changeCents: 0,
              reference: 'AUTH-1',
              paidAt: '2026-05-06T14:43:00.000Z',
            },
          ],
          loading: false,
          portalClass: PORTAL,
        },
        attachTo: document.body,
        global: { plugins: [[VueQueryPlugin, { queryClient: queryClient() }]] },
      }),
    )
    await flushPromises()

    const edit = document.body.querySelector('[data-testid="payment-edit-pay-1"]')
    expect(edit).not.toBeNull()
    ;(edit as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(wrapper.findComponent({ name: 'EditReferenceSlideover' }).props('portalClass')).toBe(
      PORTAL,
    )
    expect(slideoverUi(wrapper)).toEqual({ content: `!max-w-md ${PORTAL}` })
    expect(hasMarker()).toBe(true)
  })

  it('PaymentsListSection leaves the nested slideover untouched when the opt-in is absent', async () => {
    const wrapper = track(
      mountWithUApp(PaymentsListSection, {
        props: {
          payments: [
            {
              paymentId: 'pay-1',
              method: 'CARD_DEBIT',
              amountCents: 1000,
              tenderedCents: 1000,
              changeCents: 0,
              reference: 'AUTH-1',
              paidAt: '2026-05-06T14:43:00.000Z',
            },
          ],
          loading: false,
        },
        attachTo: document.body,
        global: { plugins: [[VueQueryPlugin, { queryClient: queryClient() }]] },
      }),
    )
    await flushPromises()

    const edit = document.body.querySelector('[data-testid="payment-edit-pay-1"]')
    ;(edit as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(wrapper.findComponent({ name: 'EditReferenceSlideover' }).props('portalClass')).toBe(
      undefined,
    )
    expect(hasMarker()).toBe(false)
  })
})
