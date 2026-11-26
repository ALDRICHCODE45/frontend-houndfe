/**
 * Owner check 2026-11-26: «Editar cliente» scrolled sideways (tab «Datos de factura…» cut, «Apellido»
 * pushed out on the right, phone and address lines cut), from the table and from the customer page.
 *
 * Root cause: the customer page's global sheet (customer-detail.css, loaded with the page and kept
 * for the session) styled `.customer-tabs` with `min-width: max-content` — the same class the editor
 * puts on its UTabs root, so the whole editor body grew to its widest line. These pins keep the two
 * names apart and the editor's rows shrinkable.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, type Component } from 'vue'
import CustomerUpsertSlideover from '../CustomerUpsertSlideover.vue'
import type { CustomerDetail } from '../../interfaces/customer.types'

const read = (path: string) => readFileSync(path, 'utf8')
const pageCss = read('src/features/POS/customers/styles/customer-detail.css')
const pageView = read('src/features/POS/customers/views/CustomerDetailView.vue')

/** Every class name used in a selector of a plain CSS file. */
function selectorClasses(css: string): Set<string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const selectors = [...withoutComments.matchAll(/([^{}]+)\{/g)].map((m) => m[1]!)
  return new Set(selectors.flatMap((s) => [...s.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]!)))
}

let tabsRootClass = ''
const capture = {
  props: ['modelValue', 'items', 'ui'],
  setup(_: unknown, { attrs }: { attrs: Record<string, unknown> }) {
    tabsRootClass = String(attrs.class ?? '')
  },
  template: '<div><slot name="content" v-bind="{ item: { value: \'basic\' } }" /></div>',
}
const stubs: Record<string, Component> = {
  USlideover: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  UTabs: capture as Component,
  UForm: { template: '<form><slot /></form>' },
  UFormField: { template: '<div v-bind="$attrs"><slot /></div>' },
  UInput: { template: '<input />' },
  USelect: { template: '<select />' },
  UTextarea: { template: '<textarea />' },
  UButton: { props: ['label'], template: '<button v-bind="$attrs">{{ label }}<slot /></button>' },
  UIcon: { template: '<span />' },
  AddressModal: { template: '<div />' },
}
for (const [key, stub] of Object.entries({ ...stubs })) stubs[key.slice(1)] = stub

const LONG_STREET = 'Avenida Insurgentes Sur entre Barranca del Muerto y Río Mixcoac, edificio B'
const customer: CustomerDetail = {
  id: 'c-1', firstName: 'Ana', lastName: 'López', fullName: 'Ana López', phoneCountryCode: '+52',
  phone: '5512345678', email: null, globalPriceListId: null, globalPriceListName: null, comments: null,
  businessName: null, fiscalZipCode: null, rfc: null, fiscalRegime: null, billingStreet: null,
  billingExteriorNumber: null, billingInteriorNumber: null, billingZipCode: null, billingNeighborhood: null,
  billingMunicipality: null, billingCity: null, billingState: null,
  addresses: [{
    id: 'a-1', customerId: 'c-1', street: LONG_STREET, exteriorNumber: '1450', interiorNumber: null,
    zipCode: '03100', neighborhood: 'Del Valle', municipality: 'Benito Juárez', city: 'Ciudad de México',
    state: 'Ciudad de México', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  }],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

describe('CustomerUpsertSlideover — no horizontal scroll (owner check 2026-11-26)', () => {
  it('the customer page sheet never styles a class the editor uses', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'edit', open: true, customer },
      global: { stubs },
    })
    await nextTick()
    const editorClasses = new Set(
      [tabsRootClass, ...wrapper.findAll('[class]').map((el) => el.attributes('class') ?? '')]
        .flatMap((value) => value.split(/\s+/))
        .filter(Boolean),
    )
    const pageClasses = selectorClasses(pageCss)
    expect(pageClasses.has('customer-tabs')).toBe(false)
    expect([...editorClasses].filter((name) => pageClasses.has(name))).toEqual([])
    wrapper.unmount()
  })

  it('the page tab strip has its own names', () => {
    expect(pageCss).toMatch(/\.customer-page-tabs\s*\{[^}]*min-width:\s*max-content/)
    expect(pageView).toContain('class="customer-page-tabs-scroll"')
    expect(pageView).toContain('class="customer-page-tabs"')
    expect(pageView).not.toMatch(/class="customer-tabs[\s"]/)
  })

  it('the editor tabs root can shrink to the slideover width', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'edit', open: true, customer },
      global: { stubs },
    })
    await nextTick()
    expect(tabsRootClass.split(/\s+/)).toEqual(expect.arrayContaining(['customer-tabs', 'w-full', 'min-w-0']))
    wrapper.unmount()
  })

  it('a long address is cut with an ellipsis and keeps the full text in title', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'edit', open: true, customer },
      global: { stubs },
    })
    await nextTick()
    const text = wrapper.get('[data-testid="address-row-a-1"] .sales-pos-customer-form-address-text')
    expect(text.classes()).toContain('truncate')
    expect(text.attributes('title')).toContain(LONG_STREET)
    // Its column may shrink below the text width inside the flex row.
    expect(text.element.parentElement?.className).toMatch(/\bmin-w-0\b/)
    expect(text.element.parentElement?.className).toMatch(/\bflex-1\b/)
    wrapper.unmount()
  })

  it('the phone number field can shrink next to the country select', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'edit', open: true, customer },
      global: { stubs },
    })
    await nextTick()
    const field = wrapper.get('.sales-pos-customer-form-phone-number')
    expect(field.classes()).toEqual(expect.arrayContaining(['flex-1', 'min-w-0']))
    wrapper.unmount()
  })

  it('Nombre/Apellido: one column on narrow screens, two shrinkable columns from sm', () => {
    const source = read('src/features/POS/customers/components/CustomerUpsertSlideover.vue')
    // Tailwind 4 `grid-cols-2` is repeat(2, minmax(0, 1fr)): both fields fit the sheet.
    expect(source).toMatch(/<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">\s*<UFormField label="Nombre"/)
  })
})
