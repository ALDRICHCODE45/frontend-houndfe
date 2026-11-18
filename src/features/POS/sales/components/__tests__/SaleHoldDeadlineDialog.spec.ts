// BE handoff 24 §2: «Cambiar plazo» of a pay-in-store hold. One date-time field in the sucursal
// zone (Mexico City), future only, sent with the shown `hold.version`.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { SaleHold } from '../../interfaces/sale.types'
import SaleHoldDeadlineDialog from '../SaleHoldDeadlineDialog.vue'

const deadline = vi.hoisted(() => ({ updateDeadline: vi.fn(), pending: false }))
vi.mock('../../composables/useSaleHoldDeadline', async () => {
  const { computed } = await import('vue')
  return {
    useSaleHoldDeadline: () => ({
      updateDeadline: deadline.updateDeadline,
      isPending: computed(() => deadline.pending),
    }),
  }
})

const toastAdd = vi.fn()
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: toastAdd }) }))

const hold: SaleHold = {
  paymentIntent: 'IN_STORE',
  expiresAt: '2026-11-19T18:30:00.000Z',
  reminderAt: '2026-11-19T15:30:00.000Z',
  stage: 0,
  version: 3,
}
// 15:00 in Mexico City.
const now = new Date('2026-11-18T21:00:00.000Z')

/** Types `AAAA-MM-DDTHH:mm` and emits the calendar date-time parts, like UInputDate does. */
const inputDateStub = {
  name: 'UInputDate',
  props: ['modelValue', 'minValue'],
  emits: ['update:modelValue'],
  template: `<input data-testid="hold-deadline-input"
    :value="modelValue ? modelValue.toString().slice(0, 16) : ''"
    :data-min="minValue ? minValue.toString().slice(0, 16) : ''"
    @change="onChange($event.target.value)" />`,
  methods: {
    onChange(this: { $emit: (e: string, v: unknown) => void }, text: string) {
      const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text)
      this.$emit(
        'update:modelValue',
        match
          ? { year: +match[1]!, month: +match[2]!, day: +match[3]!, hour: +match[4]!, minute: +match[5]! }
          : null,
      )
    },
  },
}

// Auto-imported Nuxt UI components resolve under both names.
const uiStubs = {
  Modal: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  Popover: { template: '<div><slot /></div>' },
  Calendar: { template: '<div />' },
  InputDate: inputDateStub,
  Alert: { props: ['description'], template: '<p role="alert" data-testid="hold-deadline-alert">{{ description }}</p>' },
  Button: {
    props: ['disabled', 'loading', 'type', 'form'],
    emits: ['click'],
    template: '<button :type="type ?? \'button\'" :form="form" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  Icon: { template: '<span />' },
}
const stubs = Object.fromEntries(
  Object.entries(uiStubs).flatMap(([name, stub]) => [[name, stub], [`U${name}`, stub]]),
)

function mountDialog() {
  return mount(SaleHoldDeadlineDialog, {
    props: { open: true, saleId: 'sale-1', hold, now: () => now },
    global: { stubs },
  })
}

type Dialog = ReturnType<typeof mountDialog>
async function pick(wrapper: Dialog, text: string) {
  await wrapper.get('[data-testid="hold-deadline-input"]').setValue(text)
  await wrapper.get('[data-testid="hold-deadline-input"]').trigger('change')
}
async function save(wrapper: Dialog) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}
const saveButton = (wrapper: Dialog) => wrapper.get('[data-testid="hold-deadline-save"]')

describe('SaleHoldDeadlineDialog', () => {
  beforeEach(() => {
    deadline.updateDeadline.mockReset()
    deadline.pending = false
    toastAdd.mockReset()
  })

  it('shows the current deadline in the sucursal zone and starts the field on it', () => {
    const wrapper = mountDialog()
    expect(wrapper.get('[data-testid="hold-deadline-current"]').text()).toBe('Fecha límite actual: jue 19 nov, 12:30')
    expect((wrapper.get('[data-testid="hold-deadline-input"]').element as HTMLInputElement).value).toBe('2026-11-19T12:30')
    expect(wrapper.get('[data-testid="hold-deadline-input"]').attributes('data-min')).toBe('2026-11-18T15:00')
  })

  it('has nothing to save until the deadline changes', () => {
    expect(saveButton(mountDialog()).attributes('disabled')).toBeDefined()
  })

  it('sends the new deadline with its offset and the shown version, then closes', async () => {
    deadline.updateDeadline.mockResolvedValue({ ok: true })
    const wrapper = mountDialog()
    await pick(wrapper, '2026-11-20T23:00')
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
    await save(wrapper)

    expect(deadline.updateDeadline).toHaveBeenCalledWith({ expiresAt: '2026-11-20T23:00:00-06:00', expectedVersion: 3 })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('refuses a deadline that is not in the future, under the field, without a request', async () => {
    const wrapper = mountDialog()
    await pick(wrapper, '2026-11-18T14:59')
    await save(wrapper)

    expect(deadline.updateDeadline).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Elige una fecha y hora en el futuro.')
    expect(wrapper.get('[data-testid="hold-deadline-input"]').attributes('aria-invalid')).toBe('true')
  })

  it('HOLD_EXPIRY_NOT_FUTURE from the server shows the field error and stays open', async () => {
    deadline.updateDeadline.mockResolvedValue({ ok: false, code: 'HOLD_EXPIRY_NOT_FUTURE' })
    const wrapper = mountDialog()
    await pick(wrapper, '2026-11-18T15:01')
    await save(wrapper)

    expect(wrapper.text()).toContain('Elige una fecha y hora en el futuro.')
    expect(wrapper.find('[data-testid="hold-deadline-alert"]').exists()).toBe(false)
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('HOLD_VERSION_CONFLICT says the sale was reloaded and stays open to retry', async () => {
    deadline.updateDeadline.mockResolvedValue({ ok: false, code: 'HOLD_VERSION_CONFLICT' })
    const wrapper = mountDialog()
    await pick(wrapper, '2026-11-20T23:00')
    await save(wrapper)

    expect(wrapper.get('[data-testid="hold-deadline-alert"]').text()).toBe(
      'Alguien más cambió la fecha límite. Actualizamos la venta; revisa y vuelve a intentar.',
    )
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('retries a conflict with the version of the reloaded sale', async () => {
    deadline.updateDeadline.mockResolvedValueOnce({ ok: false, code: 'HOLD_VERSION_CONFLICT' })
    deadline.updateDeadline.mockResolvedValueOnce({ ok: true })
    const wrapper = mountDialog()
    await pick(wrapper, '2026-11-20T23:00')
    await save(wrapper)
    await wrapper.setProps({ hold: { ...hold, expiresAt: '2026-11-21T18:00:00.000Z', version: 4 } })
    await save(wrapper)

    expect(wrapper.get('[data-testid="hold-deadline-current"]').text()).toBe('Fecha límite actual: sáb 21 nov, 12:00')
    expect(deadline.updateDeadline).toHaveBeenLastCalledWith({ expiresAt: '2026-11-20T23:00:00-06:00', expectedVersion: 4 })
  })

  it('a hold that already ended closes the dialog with the reason', async () => {
    deadline.updateDeadline.mockResolvedValue({ ok: false, code: 'SALE_HOLD_NOT_EDITABLE' })
    const wrapper = mountDialog()
    await pick(wrapper, '2026-11-20T23:00')
    await save(wrapper)

    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No se cambió la fecha límite',
      description: 'El apartado ya terminó: la venta se pagó o se canceló. Actualizamos la venta.',
      color: 'error',
    }))
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('a failed request keeps the dialog open with a human message', async () => {
    deadline.updateDeadline.mockResolvedValue({ ok: false, code: 'NETWORK' })
    const wrapper = mountDialog()
    await pick(wrapper, '2026-11-20T23:00')
    await save(wrapper)

    expect(wrapper.get('[data-testid="hold-deadline-alert"]').text()).toBe(
      'No pudimos guardar la fecha límite. Revisa tu conexión e intenta de nuevo.',
    )
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('an incomplete date asks for one and sends nothing', async () => {
    const wrapper = mountDialog()
    await pick(wrapper, '')
    await save(wrapper)

    expect(deadline.updateDeadline).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Elige la fecha y hora límite.')
  })
})
