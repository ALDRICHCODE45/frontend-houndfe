import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusDotBadge from '../StatusDotBadge.vue'

// UBadge is registered globally (Nuxt UI), so it renders for real here.
// We assert against the resolved root element ([data-slot="base"]) and the
// leading dot span, which is closer to real behavior than stubbing UBadge.
function mountBadge(props: Record<string, unknown>) {
  return mount(StatusDotBadge, {
    props: { label: 'Activo', ...props },
  })
}

function dotClasses(wrapper: ReturnType<typeof mountBadge>): string[] {
  return wrapper.get('span.size-2').classes()
}

function shell(wrapper: ReturnType<typeof mountBadge>) {
  return wrapper.get('[data-slot="base"]')
}

describe('StatusDotBadge', () => {
  it('renders the label', () => {
    const wrapper = mountBadge({ label: 'Activo', tone: 'success' })
    expect(wrapper.text()).toContain('Activo')
  })

  it('maps success tone to emerald dot + shell', () => {
    const wrapper = mountBadge({ tone: 'success' })
    expect(dotClasses(wrapper)).toContain('bg-emerald-500')
    expect(shell(wrapper).classes()).toContain('bg-emerald-50')
  })

  it('maps error tone to red dot + shell', () => {
    const wrapper = mountBadge({ tone: 'error' })
    expect(dotClasses(wrapper)).toContain('bg-red-500')
    expect(shell(wrapper).classes()).toContain('bg-red-50')
  })

  it('resolves aliased tones through the color map (active -> success)', () => {
    const wrapper = mountBadge({ tone: 'active' })
    expect(dotClasses(wrapper)).toContain('bg-emerald-500')
  })

  it('resolves aliased tones through the color map (inactive -> error)', () => {
    const wrapper = mountBadge({ tone: 'inactive' })
    expect(dotClasses(wrapper)).toContain('bg-red-500')
  })

  it('defaults to neutral tone when none is provided', () => {
    const wrapper = mountBadge({})
    expect(dotClasses(wrapper)).toContain('bg-gray-400')
  })

  it('exposes a default aria-label describing the status', () => {
    const wrapper = mountBadge({ label: 'Sin Stock', tone: 'error' })
    expect(shell(wrapper).attributes('aria-label')).toBe('Estado: Sin Stock')
  })

  it('allows overriding the aria-label prefix', () => {
    const wrapper = mountBadge({ label: 'Híbrido', ariaPrefix: 'Modalidad:' })
    expect(shell(wrapper).attributes('aria-label')).toBe('Modalidad: Híbrido')
  })

  it('allows a full aria-label override', () => {
    const wrapper = mountBadge({ label: 'Activo', ariaLabel: 'Custom label' })
    expect(shell(wrapper).attributes('aria-label')).toBe('Custom label')
  })
})
