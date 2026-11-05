/**
 * Contenido review against docs/design-system.md (T10, ported to the T13 section cards): the save bar is
 * the shared HfSaveBar flush to the bottom of the scroll, Guardar is the shared disabled primary with
 * nothing to save, and the history drawer keeps its neutral empty comparison. The table, cell and card
 * checks of T10 went away with those components.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import { read, update, state, success, vocabularyEnvelope } from '../../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

const file = (name: string) => readFileSync(resolve(__dirname, '..', name), 'utf8')
const style = (name: string) => /<style scoped>([\s\S]*?)<\/style>/.exec(file(name))?.[1] ?? ''
const rule = (css: string, selector: string) => new RegExp(`(?:^|\\n|\\}\\s*)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? ''
let wrapper: ReturnType<typeof mount> | undefined

beforeEach(() => {
  vi.resetAllMocks()
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(state())))
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals() })

describe('1. the save bar', () => {
  const css = style('EditorialWorkspace.vue')
  it('is the shared HfSaveBar, sticky at the bottom of the content column, with no card frame', () => {
    expect(file('EditorialWorkspace.vue')).toMatch(/<HfSaveBar /)
    const bar = rule(css, '.editorial-save')
    expect(bar).toMatch(/position: sticky/)
    expect(bar).toMatch(/bottom: 0/)
    expect(bar).not.toMatch(/border-radius|border: 1px/)
  })

  it('leaves no gap under it: the product scroll area drops its bottom padding on the Contenido task (and Identidad, with its own bar)', () => {
    const view = readFileSync(resolve(__dirname, '../../../views/ProductDetailView.vue'), 'utf8')
    expect(view).toMatch(/isEditorialTask \|\| showIdentitySaveBar \? 'pb-0' : 'pb-6'/)
    expect(view).not.toMatch(/overflow-y-auto px-4 pb-6 pt-6/)
  })

  it('keeps the last content clear of it: the bar comes after the cards, which reserve their bottom space', () => {
    expect(rule(css, '.editorial-cards')).toMatch(/padding-bottom: 16px/)
    expect(file('EditorialWorkspace.vue')).toMatch(/<\/div>\s*\n\s*<div v-if="bar" class="editorial-save"/)
  })

  it('on mobile bleeds over the 16px page gutter (the shared bar sets the equal-width columns)', () => {
    expect(rule(css, '.editorial-save')).toMatch(/margin-inline: -16px/)
  })
})

describe('2. Guardar is disabled with nothing to save', () => {
  it('uses the shared disabled primary while saved, and turns on once the editor is dirty', async () => {
    wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
    await flushPromises()
    const save = () => wrapper!.findAll<HTMLButtonElement>('.hf-save-bar button').find(item => item.text() === 'Guardar')!
    expect(save().element.disabled).toBe(true)
    expect(save().classes()).toContain('hf-primary-control')
    await wrapper.get('#editorial-title').setValue('Croqueta premium')
    expect(save().element.disabled).toBe(false)
  })

  it('does not repaint the disabled primary locally (no opacity override of .hf-primary-control)', () => {
    expect(style('EditorialWorkspace.vue')).not.toMatch(/\.hf-primary-control:disabled/)
  })
})

describe('8. history drawer empty comparison', () => {
  it('uses the table header wash and a solid --hf-border, not the bluish muted surface', () => {
    const block = rule(style('EditorialHistoryDrawer.vue'), '.history__empty')
    expect(block).toMatch(/background: color-mix\(in srgb, var\(--hf-ink\) 4%, var\(--hf-surface\)\)/)
    expect(block).toMatch(/border: 1px solid var\(--hf-border\)/)
    expect(block).not.toMatch(/--hf-surface-muted/)
  })
})
