import { mount } from '@vue/test-utils'
import { defineComponent, h, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CatalogFooter from '../CatalogFooter.vue'
import type { PublicBranchDto } from '../../interfaces/catalog.types'
import type { PublicCatalogBranchDetailDto } from '../../interfaces/public-catalog-branch.types'

const fake = vi.hoisted(() => ({
  detail: null as unknown as import('vue').ShallowRef<PublicCatalogBranchDetailDto | null>,
  listed: null as unknown as import('vue').ShallowRef<PublicBranchDto | null>,
  slugs: [] as Array<string | null>,
}))
vi.mock('../../composables/useCatalogBranchDetail', async () => {
  const { toValue } = await import('vue')
  return {
    useCatalogBranchDetail: (slug: import('vue').MaybeRefOrGetter<string | null>) => {
      fake.slugs.push(toValue(slug))
      return { branch: fake.detail }
    },
  }
})
vi.mock('../../composables/useCatalogBranches', () => ({
  useCachedCatalogBranch: () => ({ branch: fake.listed }),
}))

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }

beforeEach(() => {
  fake.detail = shallowRef(null)
  fake.listed = shallowRef(null)
  fake.slugs = []
})

describe('CatalogFooter', () => {
  it('identifies the catalog without invented policies, contacts or commerce links', () => {
    const wrapper = mount(CatalogFooter)
    expect(wrapper.element.tagName).toBe('FOOTER')
    expect(wrapper.get('img').attributes('src')).toBe('/hounfeLogos/primary.png')
    expect(wrapper.get('img').attributes('alt')).toBe('HoundFe')
    expect(wrapper.text()).toContain('Precios y existencias por sucursal.')
    expect(wrapper.findAll('a, button')).toHaveLength(0)
  })

  it('names the selected branch and MXN, never a sample address, hours or WhatsApp', () => {
    const wrapper = mount(CatalogFooter, { props: { branchName: 'Sucursal Centro' } })
    expect(wrapper.text()).toContain(
      'Catálogo de Sucursal Centro. Precios en pesos mexicanos (MXN).',
    )
    expect(wrapper.get('[data-testid="catalog-footer-branch"]').text()).toBe('Sucursal Centro')
    expect(wrapper.text()).not.toMatch(/Av\.|Abierto|WhatsApp|ejemplo|próximamente|pendientes/)
    expect(wrapper.findAll('a, button')).toHaveLength(0)
  })

  describe('v0 branch extras', () => {
    const card = (overrides: Partial<PublicCatalogBranchDetailDto> = {}): PublicCatalogBranchDetailDto => ({
      name: 'Sucursal Centro',
      phone: null,
      address: { formatted: 'Dirección formateada por el backend' },
      hours: {
        timeZone: 'America/Mexico_City',
        days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(
          (day) => ({ day, label: day, closed: false, ranges: [{ open: '08:00', close: '17:00' }] }),
        ),
        summary: 'Resumen del backend',
      },
      pickupAvailable: true,
      deliveryAvailable: true,
      whatsappNumber: null,
      ...overrides,
    })

    async function mountAt(path: string, branchName: string | null = 'Sucursal Centro') {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/catalogo/:branchSlug?', component: { render: () => null } }],
      })
      await router.push(path)
      await router.isReady()
      return mount(CatalogFooter, { props: { branchName }, global: { plugins: [router], stubs } })
    }

    it('asks for the branch card of the route slug only when a branch is selected', async () => {
      await mountAt('/catalogo/centro')
      await mountAt('/catalogo/centro', null)
      expect(fake.slugs).toEqual(['centro', null])
    })

    it('shows the address and today\'s hours from the branch card', async () => {
      fake.detail.value = card()
      const wrapper = await mountAt('/catalogo/centro')
      expect(wrapper.get('[data-testid="catalog-footer-address"]').text()).toBe(
        'Dirección formateada por el backend',
      )
      expect(wrapper.get('[data-testid="catalog-footer-hours"]').text()).toBe('Abierto hoy 08:00–17:00')
    })

    it('falls back to the summary and hides missing parts', async () => {
      fake.detail.value = card({
        address: null,
        hours: { timeZone: 'Not/AZone', days: [], summary: 'Resumen del backend' },
      })
      const wrapper = await mountAt('/catalogo/centro')
      expect(wrapper.get('[data-testid="catalog-footer-hours"]').text()).toBe('Resumen del backend')
      expect(wrapper.find('[data-testid="catalog-footer-address"]').exists()).toBe(false)
    })

    it('links WhatsApp only with a number (listed or from the card)', async () => {
      let wrapper = await mountAt('/catalogo/centro')
      expect(wrapper.find('a').exists()).toBe(false)
      fake.listed.value = {
        id: 'b-1',
        name: 'Sucursal Centro',
        slug: 'centro',
        address: null,
        phone: null,
        whatsappNumber: '+5215500000000',
      }
      wrapper = await mountAt('/catalogo/centro')
      const link = wrapper.get('a')
      expect(link.attributes('href')).toMatch(/^https:\/\/wa\.me\/5215500000000\?text=/)
      expect(link.text()).toBe('Pedidos y dudas por WhatsApp')
    })

    it('renders exactly the plain footer without any branch data', async () => {
      const wrapper = await mountAt('/catalogo/centro')
      expect(wrapper.find('[data-testid="catalog-footer-address"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="catalog-footer-hours"]').exists()).toBe(false)
      expect(wrapper.text()).not.toMatch(/Abierto|WhatsApp/)
    })
  })
})
