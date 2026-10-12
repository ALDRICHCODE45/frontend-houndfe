import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import DateFieldPopover from '../DateFieldPopover.vue'

// Shared Sales popup seam (T6 / S1,S3,S4). DateFieldPopover owns an installed
// Nuxt UI `UPopover` whose content teleports out of the routed workspace. The
// optional `portalClass` prop is inert by default and only forwards the caller
// marker onto the native `ui.content` path. These tests exercise the actual
// installed Popover chain, not a stub.
const LISTBOX_PORTAL = 'hf-theme hf-ui quotations-workspace-portal'

const wrappers: VueWrapper[] = []

function cleanup() {
  while (wrappers.length) {
    wrappers.pop()!.unmount()
  }
  document.body.innerHTML = ''
}

afterEach(cleanup)

function mountPopover(props: Record<string, unknown> = {}) {
  const wrapper = mount(DateFieldPopover, {
    props: { modelValue: null, ...props },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return wrapper
}

function contentRoots(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-slot="content"]'))
}

async function openPopover(wrapper: VueWrapper) {
  await wrapper.get('[data-testid="date-field-popover"]').trigger('click')
  await flushPromises()
}

describe('DateFieldPopover — existing contract', () => {
  it('renders the placeholder when no date is set and the formatted date otherwise', () => {
    const empty = mountPopover({ placeholder: 'Elegir fecha' })
    expect(empty.get('[data-testid="date-field-popover"]').text()).toContain('Elegir fecha')

    const filled = mountPopover({ modelValue: '2026-09-15' })
    expect(filled.get('[data-testid="date-field-popover"]').text()).toContain('2026')
  })

  it('keeps the disabled trigger inert', async () => {
    const wrapper = mountPopover({ disabled: true })

    const trigger = wrapper.get<HTMLButtonElement>('[data-testid="date-field-popover"]')
    expect(trigger.element.disabled).toBe(true)

    await openPopover(wrapper)
    expect(contentRoots().length).toBe(0)
  })

  it('emits null through the clear action when a date is set', async () => {
    const wrapper = mountPopover({ modelValue: '2026-09-15' })
    await openPopover(wrapper)

    const clear = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="date-field-popover-clear"]',
    )
    expect(clear).not.toBeNull()
    clear!.click()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([null])
  })

  it('forwards the minimum selectable date to the installed calendar', async () => {
    const wrapper = mountPopover({ modelValue: null, minIso: '2026-06-01' })
    await openPopover(wrapper)

    const calendar = wrapper.findComponent({ name: 'Calendar' })
    expect(calendar.exists()).toBe(true)
    expect(String(calendar.props('minValue'))).toBe('2026-06-01')
  })
})

describe('DateFieldPopover — optional portalClass opt-in', () => {
  it('forwards the marker onto the installed Popover ui.content path', () => {
    const wrapper = mountPopover({ portalClass: LISTBOX_PORTAL })

    expect(wrapper.findComponent({ name: 'Popover' }).props('ui')).toEqual({
      content: LISTBOX_PORTAL,
    })
  })

  it('renders the marker on the actual installed content root when open', async () => {
    const wrapper = mountPopover({ portalClass: LISTBOX_PORTAL })
    await openPopover(wrapper)

    const roots = contentRoots()
    expect(roots.length).toBeGreaterThan(0)
    expect(roots.some((root) => root.classList.contains('quotations-workspace-portal'))).toBe(true)
  })

  it('leaves the installed Popover defaults untouched when the prop is absent', async () => {
    const wrapper = mountPopover()

    expect(wrapper.findComponent({ name: 'Popover' }).props('ui')).toBeUndefined()

    await openPopover(wrapper)

    const roots = contentRoots()
    // The native content still renders with its own default surface.
    expect(roots.length).toBeGreaterThan(0)
    expect(roots.some((root) => root.classList.contains('quotations-workspace-portal'))).toBe(false)
  })
})
