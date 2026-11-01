import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import MultiSelectEnumFilter from '../MultiSelectEnumFilter.vue'
import MultiSelectAsyncFilter from '../MultiSelectAsyncFilter.vue'
import DateRangeFilter from '../DateRangeFilter.vue'

/**
 * T5 — public portal-opt-in contract for the three popup filter primitives.
 *
 * These mounts use the REAL installed `@nuxt/ui` / Reka UI `USelectMenu` and
 * `UPopover`, not stubs, because the contract is where the class physically
 * lands: Nuxt UI forwards `ui.content` to the teleported `[data-slot="content"]`
 * popup root (SelectMenu) and the `PopoverContent` root, NOT to the trigger or
 * an internal wrapper. jsdom cannot prove pixel fidelity, only placement.
 */

const MARKER = 'hf-theme hf-ui quotations-list-portal'

// Reka highlights the active option through `scrollIntoView`, which jsdom does
// not implement. Patch it for this file only and restore it afterwards.
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  })
})

afterAll(() => {
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    })
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
})

afterEach(() => {
  document.body.innerHTML = ''
})

function portalContent(): HTMLElement | undefined {
  const nodes = [...document.body.querySelectorAll<HTMLElement>('[data-slot="content"]')]
  return nodes[nodes.length - 1]
}

function hasMarker(element: Element): boolean {
  return MARKER.split(' ').every((token) => element.classList.contains(token))
}

function mountEnum(portalClass?: string) {
  return mountWithUApp(MultiSelectEnumFilter, {
    attachTo: document.body,
    props: {
      modelValue: [],
      label: 'Estado',
      options: [{ label: 'Pagada', value: 'PAID' }],
      ...(portalClass ? { portalClass } : {}),
    },
  })
}

function mountAsync(portalClass?: string) {
  return mountWithUApp(MultiSelectAsyncFilter, {
    attachTo: document.body,
    props: {
      modelValue: [],
      label: 'Vendedor',
      options: [{ label: 'Ana', value: 'seller-1' }],
      ...(portalClass ? { portalClass } : {}),
    },
  })
}

function mountDate(portalClass?: string) {
  return mountWithUApp(DateRangeFilter, {
    attachTo: document.body,
    props: {
      modelValue: {},
      label: 'Fecha',
      ...(portalClass ? { portalClass } : {}),
    },
  })
}

describe('HF filter roles preserve optional feature portal boundaries (A4/S2,S3,S6)', () => {
  it.each([
    ['enum', mountEnum, 'enum-select'],
    ['async', mountAsync, 'async-select'],
    ['date', mountDate, 'date-range-trigger'],
  ] as const)('marks the real control and portal without inventing a feature opt-in (%s)', async (_name, mountFilter, testId) => {
    const wrapper = mountFilter()
    const trigger = wrapper.get(`[data-testid="${testId}"]`)
    expect(trigger.classes()).toContain('hf-filter-control')
    await trigger.trigger('click')
    await flushPromises()
    expect(portalContent()?.classList.contains('hf-filter-portal')).toBe(true)
    expect(portalContent()?.classList.contains('quotations-list-portal')).toBe(false)
  })
})

describe('HF filter native interaction regressions (A4/S6)', () => {
  it.each([
    [mountEnum, 'enum-select', 'Estado'],
    [mountAsync, 'async-select', 'Vendedor'],
  ] as const)('names the native trigger after its visible field label (%s)', (mountFilter, testId, label) => {
    const wrapper = mountFilter()
    expect(wrapper.get(`[data-testid="${testId}"]`).attributes('aria-label')).toBe(label)
  })
  it('keeps real async search and multiselection with a feature portal', async () => {
    const wrapper = mountAsync(MARKER)
    await wrapper.get('[data-testid="async-select"]').trigger('click')
    await flushPromises()
    const content = portalContent()!
    const input = content.querySelector('input')!
    input.value = 'Ana'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    const option = content.querySelector<HTMLElement>('[role="option"]')!
    expect(option.textContent).toContain('Ana')
    option.click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['seller-1']])
    // Multiple mode stays open; selecting again removes that value.
    expect(content.isConnected).toBe(true)
    option.click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([[]])
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.get('[data-testid="async-select"]').attributes('aria-expanded')).toBe('false')
  })
})

describe('Filter popup portal opt-in — absence is inert (T5/S3)', () => {
  it('renders no quotations marker on the real enum select popup when portalClass is absent', async () => {
    const wrapper = mountEnum()
    await wrapper.get('[data-testid="enum-select"]').trigger('click')
    await flushPromises()

    const content = portalContent()
    expect(content).toBeDefined()
    expect(hasMarker(content!)).toBe(false)
  })

  it('renders no quotations marker on the real async select popup when portalClass is absent', async () => {
    const wrapper = mountAsync()
    await wrapper.get('[data-testid="async-select"]').trigger('click')
    await flushPromises()

    const content = portalContent()
    expect(content).toBeDefined()
    expect(hasMarker(content!)).toBe(false)
  })

  it('renders no quotations marker on the real date popover when portalClass is absent', async () => {
    const wrapper = mountDate()
    await wrapper.get('[data-testid="date-range-trigger"]').trigger('click')
    await flushPromises()

    const content = portalContent()
    expect(content).toBeDefined()
    expect(hasMarker(content!)).toBe(false)
  })
})

describe('Filter popup portal opt-in — content-root forwarding (T5/S4)', () => {
  it('applies the marker to the enum select content root and never the trigger', async () => {
    const wrapper = mountEnum(MARKER)
    const trigger = wrapper.get('[data-testid="enum-select"]')
    expect(hasMarker(trigger.element)).toBe(false)

    await trigger.trigger('click')
    await flushPromises()

    const content = portalContent()
    expect(content).toBeDefined()
    expect(hasMarker(content!)).toBe(true)
    // Teleported popup: the themed node is not nested inside the trigger.
    expect(content!.closest('[data-testid="enum-select"]')).toBeNull()
  })

  it('applies the marker to the async select content root and never the trigger', async () => {
    const wrapper = mountAsync(MARKER)
    const trigger = wrapper.get('[data-testid="async-select"]')
    expect(hasMarker(trigger.element)).toBe(false)

    await trigger.trigger('click')
    await flushPromises()

    const content = portalContent()
    expect(content).toBeDefined()
    expect(hasMarker(content!)).toBe(true)
    expect(content!.closest('[data-testid="async-select"]')).toBeNull()
  })

  it('applies the marker to the date popover content root and never the trigger', async () => {
    const wrapper = mountDate(MARKER)
    const trigger = wrapper.get('[data-testid="date-range-trigger"]')
    expect(hasMarker(trigger.element)).toBe(false)

    await trigger.trigger('click')
    await flushPromises()

    const content = portalContent()
    expect(content).toBeDefined()
    expect(hasMarker(content!)).toBe(true)
    expect(content!.closest('[data-testid="date-range-trigger"]')).toBeNull()
  })
})
