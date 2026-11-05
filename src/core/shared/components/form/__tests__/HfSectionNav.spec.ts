import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import HfSectionNav from '../HfSectionNav.vue'

const sections = [
  { id: 'para-quien', label: 'Para quién', missing: 0 },
  { id: 'que-es', label: 'Qué es', missing: 2 },
  { id: 'uso', label: 'Uso', missing: 1 },
]

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void
let observerCallback: ObserverCallback | null = null
const observed: Element[] = []
let reducedMotion = false

beforeEach(() => {
  observed.length = 0
  reducedMotion = false
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: ObserverCallback) { observerCallback = callback }
    observe(element: Element) { observed.push(element) }
    unobserve() {}
    disconnect() {}
  })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce') && reducedMotion,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  for (const section of sections) {
    const element = document.createElement('section')
    element.id = section.id
    element.scrollIntoView = vi.fn()
    document.body.append(element)
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  observerCallback = null
})

function mountNav() {
  return mount(HfSectionNav, { attachTo: document.body, props: { sections, label: 'Grupos de contenido' } })
}

describe('HfSectionNav', () => {
  it('is a named navigation with one link per section', () => {
    const wrapper = mountNav()
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Grupos de contenido')
    const links = wrapper.findAll('a')
    expect(links.map(link => link.attributes('href'))).toEqual(['#para-quien', '#que-es', '#uso'])
    wrapper.unmount()
  })

  it('shows a check for a complete section and "falta N" otherwise', () => {
    const wrapper = mountNav()
    const [done, pending, single] = wrapper.findAll('a')
    expect(done!.find('.hf-section-nav__ok').exists()).toBe(true)
    expect(done!.text()).toContain('Completo')
    expect(done!.find('.hf-section-nav__missing').exists()).toBe(false)
    expect(pending!.get('.hf-section-nav__missing').text()).toBe('falta 2')
    expect(single!.get('.hf-section-nav__missing').text()).toBe('falta 1')
    expect(pending!.find('.hf-section-nav__ok').exists()).toBe(false)
    wrapper.unmount()
  })

  it('scrolls smoothly to the section and marks it current', async () => {
    const wrapper = mountNav()
    await wrapper.findAll('a')[1]!.trigger('click')
    const target = document.getElementById('que-es')!
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(wrapper.findAll('a')[1]!.attributes('aria-current')).toBe('true')
    expect(wrapper.emitted('navigate')).toEqual([['que-es']])
    wrapper.unmount()
  })

  it('jumps without animation under reduced motion', async () => {
    reducedMotion = true
    const wrapper = mountNav()
    await wrapper.findAll('a')[2]!.trigger('click')
    expect(document.getElementById('uso')!.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
    wrapper.unmount()
  })

  it('highlights the section in view through the observer (scroll-spy)', async () => {
    const wrapper = mountNav()
    expect(wrapper.findAll('a')[0]!.attributes('aria-current')).toBe('true')
    expect(observed.map(element => element.id)).toEqual(['para-quien', 'que-es', 'uso'])
    observerCallback!([{ target: document.getElementById('uso')!, isIntersecting: true }])
    await nextTick()
    expect(wrapper.findAll('a')[2]!.attributes('aria-current')).toBe('true')
    expect(wrapper.findAll('a')[0]!.attributes('aria-current')).toBeUndefined()
    wrapper.unmount()
  })
})
