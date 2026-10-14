import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DeliveryRouteCard from '../DeliveryRouteCard.vue'
import type { DeliveryRouteResponseDto } from '../../interfaces/delivery-route.types'

function route(overrides: Partial<DeliveryRouteResponseDto> = {}): DeliveryRouteResponseDto {
  return {
    id: 'route-42',
    status: 'COMPLETED',
    driver: { id: 'd1', name: 'Ana', email: 'a@x.mx' },
    startedAt: '2026-10-13T09:30:00',
    completedAt: '2026-10-13T14:10:00',
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline: [{ type: 'ROUTE_CREATED', at: '2026-10-12T18:00:00', actor: null }],
    ...overrides,
  }
}

function mountCard(r: DeliveryRouteResponseDto) {
  return mount(DeliveryRouteCard, {
    props: { route: r, actions: [] },
    global: { stubs: { UDropdownMenu: true, UButton: true, StatusDotBadge: true } },
  })
}

describe('DeliveryRouteCard', () => {
  it('shows the same dates as the table: created, start and end', () => {
    const text = mountCard(route()).text()
    expect(text).toContain('Creada')
    expect(text).toContain('12 oct 2026, 18:00')
    expect(text).toContain('Inicio')
    expect(text).toContain('13 oct 2026, 09:30')
    expect(text).toContain('Fin')
    expect(text).toContain('13 oct 2026, 14:10')
  })

  it('uses the cancellation time as the end of a cancelled route', () => {
    const text = mountCard(
      route({ status: 'CANCELLED', completedAt: null, cancelledAt: '2026-10-13T11:00:00' }),
    ).text()
    expect(text).toContain('13 oct 2026, 11:00')
  })

  it('emits open with the route id from the name', async () => {
    const wrapper = mountCard(route())
    await wrapper.find('[data-testid="delivery-route-card-open"]').trigger('click')
    expect(wrapper.emitted('open')).toEqual([['route-42']])
  })
})
