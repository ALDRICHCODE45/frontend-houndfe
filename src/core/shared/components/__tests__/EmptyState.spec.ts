import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import EmptyState from '../EmptyState.vue'

const uiCss = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')

const iconOf = (wrapper: ReturnType<typeof mountState>) =>
  wrapper.get('.hf-empty-state__icon').attributes('data-icon')
const buttonIcon = (wrapper: ReturnType<typeof mountState>) =>
  wrapper.findComponent({ name: 'Button' }).props('icon')

function mountState(props: Record<string, unknown> = {}) {
  return mount(EmptyState, { props: { title: 'Aún no hay proveedores', ...props } })
}

describe('EmptyState', () => {
  it('defaults to the empty kind: status role, inbox icon, title only', () => {
    const wrapper = mountState()
    const root = wrapper.get('.hf-empty-state')
    expect(root.attributes('role')).toBe('status')
    expect(root.attributes('data-kind')).toBe('empty')
    expect(root.get('.hf-empty-state__title').text()).toBe('Aún no hay proveedores')
    expect(root.find('.hf-empty-state__description').exists()).toBe(false)
    expect(root.find('button').exists()).toBe(false)
    expect(iconOf(wrapper)).toBe('i-lucide-inbox')
  })

  it.each([
    ['empty', 'i-lucide-inbox', 'status'],
    ['no-match', 'i-lucide-search-x', 'status'],
    ['error', 'i-lucide-triangle-alert', 'alert'],
    ['forbidden', 'i-lucide-lock', 'status'],
  ])('%s kind uses %s and role %s', (kind, icon, role) => {
    const wrapper = mountState({ kind })
    const root = wrapper.get('.hf-empty-state')
    expect(root.attributes('data-kind')).toBe(kind)
    expect(root.attributes('role')).toBe(role)
    expect(iconOf(wrapper)).toBe(icon)
  })

  it('lets the caller override the icon and renders one description line', () => {
    const wrapper = mountState({ icon: 'i-lucide-truck', description: 'Aquí aparecerán.' })
    expect(iconOf(wrapper)).toBe('i-lucide-truck')
    expect(wrapper.get('.hf-empty-state__description').text()).toBe('Aquí aparecerán.')
  })

  it('renders at most one button, outline by default, and emits action on click', async () => {
    const wrapper = mountState({ actionLabel: 'Crear proveedor' })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.text()).toContain('Crear proveedor')
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })

  it('renders no button without an actionLabel', () => {
    expect(mountState({ actionIcon: 'i-lucide-plus' }).find('button').exists()).toBe(false)
  })

  it('shows the action icon, and error kind defaults it to the retry glyph', () => {
    const custom = mountState({ actionLabel: 'Crear', actionIcon: 'i-lucide-plus' })
    expect(buttonIcon(custom)).toBe('i-lucide-plus')
    const error = mountState({ kind: 'error', actionLabel: 'Reintentar' })
    expect(buttonIcon(error)).toBe('i-lucide-rotate-cw')
  })

  it('is solid primary only when asked (the page create action)', () => {
    const outline = mountState({ actionLabel: 'Crear' }).get('button').classes().join(' ')
    const solid = mountState({ actionLabel: 'Crear', actionVariant: 'solid' }).get('button').classes().join(' ')
    expect(solid).toContain('bg-primary')
    expect(outline).not.toContain('bg-primary')
  })

  it('exposes a stable test id on the action, overridable', () => {
    expect(mountState({ actionLabel: 'Crear' }).find('[data-testid="empty-state-action"]').exists()).toBe(true)
    expect(
      mountState({ actionLabel: 'Reintentar', actionTestId: 'table-error-retry' })
        .find('[data-testid="table-error-retry"]')
        .exists(),
    ).toBe(true)
  })
})

describe('EmptyState tokens', () => {
  const block = (selector: string) => {
    const start = uiCss.indexOf(`${selector} {`)
    expect(start, selector).toBeGreaterThan(-1)
    return uiCss.slice(uiCss.indexOf('{', start) + 1, uiCss.indexOf('}', start))
  }

  it('centers the content, with muted icon, 15px/600 heading title and 13px muted description', () => {
    expect(block('.hf-ui .hf-empty-state')).toMatch(/text-align:\s*center/)
    expect(block('.hf-ui .hf-empty-state__icon')).toMatch(/color:\s*var\(--hf-muted\)/)
    const title = block('.hf-ui .hf-empty-state__title')
    expect(title).toMatch(/font-size:\s*15px/)
    expect(title).toMatch(/font-weight:\s*600/)
    expect(title).toMatch(/color:\s*var\(--hf-heading\)/)
    const description = block('.hf-ui .hf-empty-state__description')
    expect(description).toMatch(/font-size:\s*13px/)
    expect(description).toMatch(/color:\s*var\(--hf-muted\)/)
  })

  it('paints the error kind with the one red on its soft surface', () => {
    const error = block(".hf-ui .hf-empty-state[data-kind='error']")
    expect(error).toMatch(/background-color:\s*var\(--hf-danger-soft\)/)
    expect(error).toMatch(/border:\s*1px solid var\(--hf-danger-border\)/)
    expect(block(".hf-ui .hf-empty-state[data-kind='error'] .hf-empty-state__icon")).toMatch(
      /color:\s*var\(--hf-danger\)/,
    )
    expect(block(".hf-ui .hf-empty-state[data-kind='error'] .hf-empty-state__title")).toMatch(
      /color:\s*var\(--hf-danger\)/,
    )
  })
})
