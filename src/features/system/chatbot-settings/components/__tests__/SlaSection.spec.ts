// SlaSection — deadlines per subtype in human units; only TRANSFER_RECEIPT is forced by the contract.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SlaSection from '../SlaSection.vue'
import { settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'

function mountSla(props: Record<string, unknown> = {}) {
  return mount(SlaSection, { props: { draft: settingsFixture(), readonly: false, errors: {}, ...props } })
}
const row = (w: ReturnType<typeof mountSla>, subtype: string) => w.get(`[data-testid="sla-${subtype}"]`)

describe('SlaSection', () => {
  it('shows the claim and resolve times of the editable subtypes in human units', () => {
    const w = mountSla()
    const restock = row(w, 'RESTOCK')
    const [claim, resolve] = restock.findAll('[data-testid="duration-input"]')
    expect((claim!.element as HTMLInputElement).value).toBe('1')
    expect((resolve!.element as HTMLInputElement).value).toBe('4')
    expect(restock.findAllComponents({ name: 'Select' }).map((u: { props: (key: string) => unknown }) => u.props('modelValue'))).toEqual(['h', 'h'])
    expect(restock.text()).toContain('4 h de atención')
  })

  it('«Hablar con una persona»: the resolve time is editable and starts on «Sin plazo»', async () => {
    const w = mountSla()
    const talk = row(w, 'TALK_TO_HUMAN')
    const [claim, resolve] = talk.findAll('[data-testid="duration-input"]')
    expect((claim!.element as HTMLInputElement).value).toBe('10')
    expect((resolve!.element as HTMLInputElement).disabled).toBe(true)
    expect(talk.text()).toContain('Sin límite de tiempo')

    talk.findAllComponents({ name: 'Select' })[1]!.vm.$emit('update:modelValue', 'h')
    await w.vm.$nextTick()
    await resolve!.setValue('2')
    const calls = w.emitted('set-sla')!
    expect(calls[calls.length - 1]).toEqual(['TALK_TO_HUMAN', 'resolveMinutes', 120])
  })

  it('typing a claim time emits minutes; «Sin plazo» emits null', async () => {
    const w = mountSla()
    const complaint = row(w, 'COMPLAINT')
    const claim = complaint.findAll('[data-testid="duration-input"]')[0]!
    await claim.setValue('20')
    expect(w.emitted('set-sla')![0]).toEqual(['COMPLAINT', 'claimMinutes', 20])
    complaint.findAllComponents({ name: 'Select' })[0]!.vm.$emit('update:modelValue', 'none')
    await w.vm.$nextTick()
    const calls = w.emitted('set-sla')!
    expect(calls[calls.length - 1]).toEqual(['COMPLAINT', 'claimMinutes', null])
  })

  it('«Comprobante» is read-only with its rule and only the close margin is editable', async () => {
    const w = mountSla()
    const receipt = row(w, 'TRANSFER_RECEIPT')
    expect(receipt.get('[data-testid="receipt-claim"]').text()).toBe('No tiene plazo para atender')
    expect(receipt.get('[data-testid="receipt-resolve"]').text()).toContain('Al cierre del día en que llega')
    expect(receipt.get('[data-testid="receipt-resolve"]').text()).toContain('1 h antes del cierre')
    const inputs = receipt.findAll('[data-testid="duration-input"]')
    expect(inputs).toHaveLength(1)
    await inputs[0]!.setValue('2')
    expect(w.emitted('set-margin')![0]).toEqual([120])
    expect((receipt.findAllComponents({ name: 'Select' })[0]!.props('items') as unknown[])).toHaveLength(2)
  })

  it('shows the server-mirrored errors under the field', () => {
    const w = mountSla({
      errors: { 's:COMPLAINT:resolve': 'Resolver no puede ser antes que atender (30 min).', 'x:margin': 'Usa un valor entre 0 min y 24 h.' },
    })
    expect(w.get('[data-testid="error-COMPLAINT-resolveMinutes"]').text()).toContain('no puede ser antes')
    expect(w.get('[data-testid="margin-error"]').text()).toContain('entre 0 min y 24 h')
    expect(row(w, 'COMPLAINT').findAll('[data-testid="duration-input"]')[1]!.attributes('aria-invalid')).toBe('true')
  })

  it('read-only prints the times and offers no field', () => {
    const w = mountSla({ readonly: true })
    expect(w.get('[data-testid="RESTOCK-claimMinutes-readonly"]').text()).toBe('1 h')
    expect(w.get('[data-testid="TALK_TO_HUMAN-resolveMinutes-readonly"]').text()).toBe('Sin plazo')
    expect(w.find('input').exists()).toBe(false)
    expect(w.find('select:not([aria-hidden="true"])').exists()).toBe(false)
    expect(w.find('[role="combobox"]').exists()).toBe(false)
  })

  it('lists the eight subtypes in contract order', () => {
    const w = mountSla()
    expect(w.findAll('.cbs-sla__row')).toHaveLength(8)
    expect(w.findAll('.cbs-sla__row b').map((b) => b.text())).toEqual([
      'Reposición',
      'Caducidad',
      'Zona de entrega',
      'Comprobante',
      'Hablar con una persona',
      'Queja',
      'Pregunta del bot',
      'Descuento',
    ])
  })
})
