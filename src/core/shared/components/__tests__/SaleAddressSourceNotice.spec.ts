import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaleAddressSourceNotice from '../SaleAddressSourceNotice.vue'
import type { SaleAddressSourceInput } from '../../utils/saleAddressSource'

const CHANGED = 'El cliente cambió esta dirección después de la venta.'
const DELETED = 'El cliente eliminó esta dirección después de la venta.'

const IconStub = { props: ['name'], template: '<span class="icon-stub" :data-icon="name" />' }
const stubs = { UIcon: IconStub, Icon: IconStub }

function mountNotice(props: { address: SaleAddressSourceInput | null; compact?: boolean }) {
  return mount(SaleAddressSourceNotice, { props, global: { stubs } })
}

describe('SaleAddressSourceNotice', () => {
  it.each([
    ['CHANGED', ['street'], CHANGED],
    ['DELETED', [], DELETED],
  ] as const)('%s shows the warning with an icon', (sourceStatus, changedFields, message) => {
    const address = { id: 'addr-1', sourceStatus, changedFields: [...changedFields] }
    const wrapper = mountNotice({ address })
    const notice = wrapper.get('[data-testid="sale-address-source-notice"]')
    expect(notice.text()).toBe(message)
    expect(notice.attributes('data-status')).toBe(sourceStatus)
    expect(notice.find('.icon-stub').attributes('data-icon')).toBe('i-lucide-triangle-alert')
    // Never leaks the address id.
    expect(wrapper.html()).not.toContain('addr-1')
  })

  it.each<[string, SaleAddressSourceInput | null]>([
    ['UNCHANGED', { sourceStatus: 'UNCHANGED', changedFields: [] }],
    ['label-only CHANGED', { sourceStatus: 'CHANGED', changedFields: ['label'] }],
    ['no status (older payload)', {}],
    ['no address', null],
  ])('%s renders nothing', (_name, address) => {
    const wrapper = mountNotice({ address })
    expect(wrapper.find('[data-testid="sale-address-source-notice"]').exists()).toBe(false)
  })

  it('compact keeps the full message for the tooltip and for screen readers', () => {
    const wrapper = mountNotice({ address: { sourceStatus: 'DELETED', changedFields: [] }, compact: true })
    const notice = wrapper.get('[data-testid="sale-address-source-notice"]')
    expect(notice.attributes('title')).toBe(DELETED)
    expect(notice.get('.sr-only').text()).toBe(DELETED)
    expect(notice.text()).toContain('Dirección eliminada')
  })

  it('compact CHANGED uses the short changed label', () => {
    const wrapper = mountNotice({ address: { sourceStatus: 'CHANGED', changedFields: ['street'] }, compact: true })
    const notice = wrapper.get('[data-testid="sale-address-source-notice"]')
    expect(notice.text()).toContain('Dirección cambiada')
    expect(notice.attributes('title')).toBe(CHANGED)
  })
})
