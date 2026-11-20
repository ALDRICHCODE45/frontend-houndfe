import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { makeBackorder, makeWaitingBackorder } from '../../interfaces/__tests__/backorder.fixture'
import type { BackorderStaff } from '../../interfaces/backorder.types'
import type { CancelBackorderOutcome } from '../../composables/useCancelBackorder'
import { readBackorderError } from '../../utils/backorderErrors'

const detail = vi.hoisted(() => ({
  backorder: null as unknown as Ref<BackorderStaff | undefined>,
  loading: null as unknown as Ref<boolean>,
  notFound: null as unknown as Ref<boolean>,
  error: null as unknown as Ref<boolean>,
  refetch: vi.fn(),
  lastId: null as null | (() => string),
}))
const cancelMock = vi.hoisted(() => ({ cancel: vi.fn(), pending: null as unknown as Ref<boolean> }))

vi.mock('../../composables/useBackorderDetail', () => ({
  useBackorderDetail: (id: MaybeRefOrGetter<string>) => {
    detail.lastId = () => toValue(id)
    return {
      backorder: detail.backorder,
      isLoading: detail.loading,
      isFetching: { value: false },
      isNotFound: detail.notFound,
      isError: detail.error,
      refetch: detail.refetch,
    }
  },
}))
vi.mock('../../composables/useCancelBackorder', () => ({
  useCancelBackorder: () => ({ cancel: cancelMock.cancel, isPending: cancelMock.pending }),
}))

const auth = vi.hoisted(() => ({ grants: new Set<string>(['read:Backorder', 'update:Backorder']) }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: (action: string, subject: string) => auth.grants.has(`${action}:${subject}`),
  }),
}))

const modalStub = {
  props: ['open', 'title', 'dismissible', 'close', 'ui'],
  emits: ['update:open'],
  template: '<div v-if="open" data-testid="cancel-modal" :data-title="title"><slot name="body" /><slot name="footer" /></div>',
}
const buttonStub = {
  props: ['label', 'color', 'variant', 'loading', 'disabled'],
  template: '<button :disabled="disabled" :data-loading="loading">{{ label }}<slot /></button>',
}
const textareaStub = {
  props: ['modelValue', 'maxlength', 'id'],
  emits: ['update:modelValue'],
  template: '<textarea :id="id" :value="modelValue" :maxlength="maxlength" data-testid="cancel-reason" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

import BackorderDetailView from '../BackorderDetailView.vue'

const ID = '3f6c1c52-5d0e-4b53-9d33-0d3f8c4a9a01'

async function mountDetail() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pos/pedidos-reposicion', name: 'pos-backorders', component: { template: '<div />' } },
      { path: '/pos/pedidos-reposicion/:id', name: 'pos-backorder-detail', component: { template: '<div />' } },
      { path: '/pos/ventas/:id', component: { template: '<div />' } },
      { path: '/chatbot/solicitudes/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(`/pos/pedidos-reposicion/${ID}`)
  await router.isReady()
  const wrapper = mount(BackorderDetailView, {
    global: {
      plugins: [router],
      stubs: {
        UModal: modalStub, Modal: modalStub, UButton: buttonStub, Button: buttonStub,
        UTextarea: textareaStub, Textarea: textareaStub, UIcon: true,
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

const cancelButton = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="backorder-cancel"]')
const text = (wrapper: ReturnType<typeof mount>) => wrapper.text().replace(/\s+/g, ' ')

async function openDialog(wrapper: ReturnType<typeof mount>) {
  await cancelButton(wrapper).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  auth.grants = new Set(['read:Backorder', 'update:Backorder'])
  detail.backorder = ref(makeBackorder())
  detail.loading = ref(false)
  detail.notFound = ref(false)
  detail.error = ref(false)
  detail.refetch.mockReset()
  cancelMock.cancel.mockReset()
  cancelMock.pending = ref(false)
})

describe('BackorderDetailView — content (S3, S4)', () => {
  it('reads the order id from the route', async () => {
    await mountDetail()
    expect(detail.lastId!()).toBe(ID)
  })

  it('shows every field of a RESERVED order, with no id on screen', async () => {
    const { wrapper } = await mountDetail()
    const t = text(wrapper)
    expect(wrapper.find('h1').text()).toBe('BO-000012')
    expect(t).toContain('Apartado')
    expect(t).toContain('Rosa Elena Díaz')
    expect(t).toContain('+525512345678')
    expect(t).toContain('Croquetas Adulto Raza Grande 18 kg')
    expect(t).toMatch(/Cantidad\s*2/)
    expect(t).toContain('$1,099.00')
    expect(t).toContain('Al agendar $1,149.00')
    expect(t).toContain('Centro')
    expect(t).toMatch(/Apartado hasta 21 nov/)
    expect(t).toMatch(/7 días/)
    expect(t.match(/Llegada estimada/g)).toHaveLength(1)
    expect(t).not.toContain(ID)
    expect(t).not.toContain('bbbbbbbb')
  })

  it('shows the variant when there is one', async () => {
    detail.backorder.value = makeBackorder({ variantName: 'Pollo y arroz' })
    const { wrapper } = await mountDetail()
    expect(text(wrapper)).toContain('Pollo y arroz')
  })

  it('shows a timeline with only the dates present, oldest first', async () => {
    const { wrapper } = await mountDetail()
    const labels = wrapper
      .findAll('[data-testid="backorder-timeline"] li .bo-timeline__label')
      .map((label) => label.text())
    expect(labels).toEqual([
      'Agendado',
      'Apartado',
      'Recordatorio al cliente',
      'Vence el apartado',
      'Llegada estimada',
    ])
  })

  it('WAITING shows its place in line and the passed-over warning; ETA overdue is a warning word', async () => {
    detail.backorder.value = makeBackorder({
      status: 'WAITING', queuePosition: 2, passedOverCount: 1, reservedAt: null, reservedUntil: null,
      reminderAt: null, etaOverdue: true,
    })
    const { wrapper } = await mountDetail()
    expect(text(wrapper)).toContain('#2 en la fila')
    expect(wrapper.find('[data-testid="backorder-info-warning"]').text()).toBe('Se lo saltaron 1 vez')
    expect(wrapper.find('[data-testid="backorder-eta-overdue"]').text()).toBe('Atrasado')
    expect(wrapper.find('[data-testid="backorder-eta-overdue"]').classes()).toContain('bo-warning')
  })

  it('a WAITING order shows the reference price with a note, no $0.00 and no «Vigente»', async () => {
    detail.backorder.value = makeWaitingBackorder()
    const { wrapper } = await mountDetail()
    expect(text(wrapper)).toContain('$1,149.00')
    expect(text(wrapper)).toContain('Precio al agendar')
    expect(text(wrapper)).not.toMatch(/\$0\.00|Vigente/)
  })

  it('«Llegada estimada» appears once (the timeline carries the date, the days and «Atrasado»)', async () => {
    detail.backorder.value = makeBackorder({ etaOverdue: true })
    const { wrapper } = await mountDetail()
    expect(text(wrapper).match(/Llegada estimada/g)).toHaveLength(1)
    const entry = wrapper.findAll('[data-testid="backorder-timeline"] li').find((li) => li.text().includes('Llegada estimada'))!
    expect(entry.text()).toMatch(/21 nov/)
    expect(entry.text()).toContain('7 días desde que se agendó')
    expect(entry.find('[data-testid="backorder-eta-overdue"]').text()).toBe('Atrasado')
  })

  it('without a phone the customer shows no phone row', async () => {
    detail.backorder.value = makeBackorder({ customer: { id: 'c1', name: 'Rosa Elena Díaz', phone: null } })
    const { wrapper } = await mountDetail()
    expect(text(wrapper)).not.toContain('Teléfono')
    expect(text(wrapper)).not.toContain('null')
  })

  it('without a chatbot request there is no «Ver solicitud del chatbot» link (never /chatbot/solicitudes/null)', async () => {
    detail.backorder.value = makeBackorder({ chatbotRequestId: null })
    const { wrapper } = await mountDetail()
    expect(wrapper.findAll('a').some((a) => a.text() === 'Ver solicitud del chatbot')).toBe(false)
    expect(wrapper.findAll('a').some((a) => (a.attributes('href') ?? '').includes('null'))).toBe(false)
  })

  it('links to the chatbot request and, with a sale, to the sale', async () => {
    const { wrapper } = await mountDetail()
    const request = wrapper.findAll('a').find((a) => a.text() === 'Ver solicitud del chatbot')
    expect(request?.attributes('href')).toBe('/chatbot/solicitudes/bbbbbbbb-0000-4000-8000-000000000003')
    expect(wrapper.findAll('a').some((a) => a.text() === 'Ver venta')).toBe(false)

    detail.backorder.value = makeBackorder({ status: 'CONFIRMED', saleId: 'sale-9', saleStatus: 'CONFIRMED', confirmedAt: '2026-11-20T15:00:00-06:00' })
    await flushPromises()
    const sale = wrapper.findAll('a').find((a) => a.text() === 'Ver venta')
    expect(sale?.attributes('href')).toBe('/pos/ventas/sale-9')
    expect(text(wrapper)).toContain('Venta confirmada')
  })

  it('CANCELLED shows who, when and why', async () => {
    detail.backorder.value = makeBackorder({
      status: 'CANCELLED', cancelledByKind: 'STAFF', cancelledBy: { id: 'u1', name: 'Ana Gómez' },
      cancelReason: 'Proveedor descontinuó', cancelledAt: '2026-11-16T10:00:00-06:00', reservedAt: null, reservedUntil: null, reminderAt: null,
    })
    const { wrapper } = await mountDetail()
    expect(text(wrapper)).toContain('Canceló Ana Gómez')
    expect(text(wrapper)).toContain('Proveedor descontinuó')
  })
})

describe('BackorderDetailView — page states', () => {
  it('without read:Backorder shows the forbidden state', async () => {
    auth.grants = new Set()
    const { wrapper } = await mountDetail()
    expect(text(wrapper)).toContain('No tienes permiso para ver este pedido')
  })

  it('loading, not found (back to the list) and error (retry)', async () => {
    detail.backorder.value = undefined
    detail.loading.value = true
    const { wrapper } = await mountDetail()
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)

    detail.loading.value = false
    detail.notFound.value = true
    await flushPromises()
    expect(text(wrapper)).toContain('Este pedido ya no existe')

    detail.notFound.value = false
    detail.error.value = true
    await flushPromises()
    expect(text(wrapper)).toContain('No pudimos cargar el pedido')
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Reintentar')
    await retry!.trigger('click')
    expect(detail.refetch).toHaveBeenCalled()
  })
})

describe('BackorderDetailView — «Cancelar pedido» visibility (S2, S5)', () => {
  it.each(['WAITING', 'RESERVED'] as const)('shows it for %s with update:Backorder', async (status) => {
    detail.backorder.value = makeBackorder({ status, queuePosition: status === 'WAITING' ? 1 : null })
    const { wrapper } = await mountDetail()
    expect(cancelButton(wrapper).exists()).toBe(true)
    expect(cancelButton(wrapper).text()).toContain('Cancelar pedido')
  })

  it.each(['CONFIRMED', 'EXPIRED', 'CANCELLED'] as const)('hides it for %s even with update:Backorder', async (status) => {
    detail.backorder.value = makeBackorder({ status })
    const { wrapper } = await mountDetail()
    expect(cancelButton(wrapper).exists()).toBe(false)
  })

  it('hides it without update:Backorder (Cashier: read only) but keeps the whole detail', async () => {
    auth.grants = new Set(['read:Backorder'])
    const { wrapper } = await mountDetail()
    expect(cancelButton(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toContain('Rosa Elena Díaz')
    expect(wrapper.findAll('a').some((a) => a.text() === 'Ver solicitud del chatbot')).toBe(true)
  })

  it('hides it with update but without read (nothing to show)', async () => {
    auth.grants = new Set(['update:Backorder'])
    const { wrapper } = await mountDetail()
    expect(cancelButton(wrapper).exists()).toBe(false)
  })
})

describe('BackorderDetailView — cancel flow (S5)', () => {
  it('RESERVED copy says the units pass to the next customer in line; WAITING copy does not', async () => {
    const { wrapper } = await mountDetail()
    await openDialog(wrapper)
    expect(wrapper.find('[data-testid="cancel-modal"]').text()).toContain('pasan al siguiente cliente en la fila')
    expect(wrapper.find('[data-testid="cancel-modal"]').attributes('data-title')).toBe('Cancelar pedido BO-000012')

    detail.backorder.value = makeBackorder({ status: 'WAITING', queuePosition: 1 })
    const waiting = await mountDetail()
    await openDialog(waiting.wrapper)
    expect(waiting.wrapper.find('[data-testid="cancel-modal"]').text()).not.toContain('siguiente cliente')
  })

  it('the reason is optional, capped at 280 and counted only near the limit', async () => {
    const { wrapper } = await mountDetail()
    await openDialog(wrapper)
    const reason = wrapper.find('[data-testid="cancel-reason"]')
    expect(reason.attributes('maxlength')).toBe('280')
    expect(wrapper.find('[data-testid="cancel-counter"]').exists()).toBe(false)
    await reason.setValue('x'.repeat(252))
    expect(wrapper.find('[data-testid="cancel-counter"]').text()).toBe('252 / 280')
  })

  it('sends the version it loaded and the reason, then closes with a success note', async () => {
    cancelMock.cancel.mockResolvedValue({ status: 'cancelled', backorder: makeBackorder({ status: 'CANCELLED' }) } satisfies CancelBackorderOutcome)
    const { wrapper } = await mountDetail()
    await openDialog(wrapper)
    await wrapper.find('[data-testid="cancel-reason"]').setValue('Proveedor descontinuó')
    await wrapper.find('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()
    expect(cancelMock.cancel).toHaveBeenCalledWith({ version: 3, reason: 'Proveedor descontinuó' })
    expect(wrapper.find('[data-testid="cancel-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="backorder-notice"]').text()).toContain('Pedido cancelado')
  })

  it('sends no reason when it was left blank', async () => {
    cancelMock.cancel.mockResolvedValue({ status: 'cancelled', backorder: makeBackorder() })
    const { wrapper } = await mountDetail()
    await openDialog(wrapper)
    await wrapper.find('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()
    expect(cancelMock.cancel).toHaveBeenCalledWith({ version: 3, reason: undefined })
  })

  it('VERSION_CONFLICT: closes the dialog and shows the owner message (the composable refetches)', async () => {
    const error = readBackorderError({ response: { status: 409, data: { error: 'VERSION_CONFLICT', currentVersion: 5 } } })
    cancelMock.cancel.mockResolvedValue({ status: 'failed', error })
    const { wrapper } = await mountDetail()
    await openDialog(wrapper)
    await wrapper.find('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cancel-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="backorder-notice"]').text()).toBe(
      'Otro usuario modificó este pedido; revisa los datos y vuelve a intentar.',
    )
  })

  it('BACKORDER_NOT_CANCELLABLE: closes the dialog and says it can no longer be cancelled', async () => {
    const error = readBackorderError({ response: { status: 409, data: { error: 'BACKORDER_NOT_CANCELLABLE', status: 'CONFIRMED' } } })
    cancelMock.cancel.mockResolvedValue({ status: 'failed', error })
    const { wrapper } = await mountDetail()
    await openDialog(wrapper)
    await wrapper.find('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cancel-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="backorder-notice"]').text()).toContain('ya no se puede cancelar')
  })

  it('a generic failure keeps the dialog open with the message so the person can retry', async () => {
    cancelMock.cancel.mockResolvedValue({ status: 'failed', error: readBackorderError({ response: { status: 500, data: {} } }) })
    const { wrapper } = await mountDetail()
    await openDialog(wrapper)
    await wrapper.find('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cancel-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cancel-error"]').text()).toBe('No pudimos cancelar el pedido. Intenta de nuevo.')
  })

  it('an ignored attempt (no permission or double submit) changes nothing', async () => {
    cancelMock.cancel.mockResolvedValue({ status: 'ignored' })
    const { wrapper } = await mountDetail()
    await openDialog(wrapper)
    await wrapper.find('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cancel-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="backorder-notice"]').exists()).toBe(false)
  })

  it('re-checks that the order is still cancellable before sending (stale dialog)', async () => {
    const { wrapper } = await mountDetail()
    await openDialog(wrapper)
    detail.backorder.value = makeBackorder({ status: 'CONFIRMED' })
    await flushPromises()
    await wrapper.find('[data-testid="cancel-dialog-confirm"]').trigger('click')
    await flushPromises()
    expect(cancelMock.cancel).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cancel-modal"]').exists()).toBe(false)
  })

  it('«Volver» closes without sending anything, and reopening starts with an empty reason', async () => {
    const { wrapper } = await mountDetail()
    await openDialog(wrapper)
    await wrapper.find('[data-testid="cancel-reason"]').setValue('algo')
    await wrapper.find('[data-testid="cancel-dialog-back"]').trigger('click')
    await flushPromises()
    expect(cancelMock.cancel).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cancel-modal"]').exists()).toBe(false)
    await openDialog(wrapper)
    expect(wrapper.find('[data-testid="cancel-reason"]').element).toHaveProperty('value', '')
  })
})
