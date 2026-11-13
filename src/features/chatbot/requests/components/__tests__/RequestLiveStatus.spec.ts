import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestLiveStatus from '../RequestLiveStatus.vue'
import { makeDetail } from '../../utils/detail-fixture'

const NOW = new Date('2026-11-13T16:00:00.000Z')
const detail = makeDetail({
  status: 'IN_PROGRESS',
  liveSession: { state: 'ACTIVE', handoffEpoch: 3, lastStaffActivityAt: null, lastCustomerMessageAt: null },
})

function mountStatus(props: { windowClosed: boolean; closesAt: number | null }) {
  return mount(RequestLiveStatus, {
    props: { detail, now: NOW, mine: true, ...props },
    global: { stubs: { UIcon: true } },
  })
}

describe('RequestLiveStatus — the window chip follows the composer', () => {
  it('says closed when the composer is closed', () => {
    const wrapper = mountStatus({ windowClosed: true, closesAt: NOW.getTime() + 3_600_000 })
    expect(wrapper.get('[data-testid="window-chip"]').text()).toBe('Ventana de 24 h cerrada')
  })

  it('does not say closed while the composer is open by the server\'s word, past the stale end', () => {
    const wrapper = mountStatus({ windowClosed: false, closesAt: NOW.getTime() - 3_600_000 })
    expect(wrapper.find('[data-testid="window-chip"]').exists()).toBe(false)
  })

  it('counts down while open', () => {
    const wrapper = mountStatus({ windowClosed: false, closesAt: NOW.getTime() + 3 * 3_600_000 })
    expect(wrapper.get('[data-testid="window-chip"]').text()).toBe('Ventana de 24 h: cierra en 3 h')
  })
})
