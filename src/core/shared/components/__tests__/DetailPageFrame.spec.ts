import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailPageFrame from '../DetailPageFrame.vue'

/*
 * detail-page-frame S1-S3: every detail page shares one frame. The root cancels the dashboard body's
 * padding and fills the panel; the header is pinned by the flex column (never `sticky`, which the
 * padded body offset into a blank strip above it); the full-width area below scrolls, so the wheel
 * works anywhere, and each page centres its content inside it.
 */
function mountFrame(attrs: Record<string, unknown> = {}) {
  return mount(DetailPageFrame, {
    attrs,
    props: { scrollTestid: 'thing-detail-layout' },
    slots: {
      header: '<header data-testid="head">Venta #58</header>',
      default: '<div class="mx-auto max-w-7xl" data-testid="body">Contenido</div>',
      footer: '<div data-testid="bar">Registrar pago</div>',
    },
  })
}

describe('DetailPageFrame', () => {
  it('renders header, scroll area and footer in that order', () => {
    const wrapper = mountFrame()
    const root = wrapper.element as HTMLElement
    expect([...root.children].map((child) => child.getAttribute('data-slot'))).toEqual(['header', 'scroll', 'footer'])
    expect(wrapper.get('[data-slot="header"] [data-testid="head"]').text()).toBe('Venta #58')
    expect(wrapper.get('[data-slot="scroll"] [data-testid="body"]').text()).toBe('Contenido')
    expect(wrapper.get('[data-slot="footer"] [data-testid="bar"]').text()).toBe('Registrar pago')
  })

  it('cancels the body padding and fills the panel as a flex column', () => {
    const classes = mountFrame().classes()
    for (const name of ['-m-4', 'sm:-m-6', 'h-[calc(100%+2rem)]', 'sm:h-[calc(100%+3rem)]', 'flex', 'flex-col', 'min-h-0']) {
      expect(classes).toContain(name)
    }
  })

  it('pins the header with the flex column, never with sticky', () => {
    const header = mountFrame().get('[data-slot="header"]')
    expect(header.classes()).toContain('shrink-0')
    expect(header.classes().some((name) => name.includes('sticky'))).toBe(false)
  })

  it('scrolls a full-width area, never a max-width column', () => {
    const scroll = mountFrame().get('[data-slot="scroll"]')
    for (const name of ['flex-1', 'min-h-0', 'overflow-y-auto', 'overflow-x-hidden', 'w-full']) {
      expect(scroll.classes()).toContain(name)
    }
    expect(scroll.classes().some((name) => name.startsWith('max-w') || name === 'mx-auto')).toBe(false)
    expect(scroll.attributes('data-testid')).toBe('thing-detail-layout')
  })

  it('passes the page classes and attributes to the root', () => {
    const wrapper = mountFrame({ class: 'sales-detail-visual hf-ui', 'data-testid': 'sale-detail' })
    expect(wrapper.classes()).toContain('sales-detail-visual')
    expect(wrapper.attributes('data-testid')).toBe('sale-detail')
  })

  it('renders no footer wrapper without a footer', () => {
    const wrapper = mount(DetailPageFrame, { slots: { default: '<p>x</p>' } })
    expect(wrapper.find('[data-slot="footer"]').exists()).toBe(false)
    expect(wrapper.find('[data-slot="header"]').exists()).toBe(false)
  })
})
