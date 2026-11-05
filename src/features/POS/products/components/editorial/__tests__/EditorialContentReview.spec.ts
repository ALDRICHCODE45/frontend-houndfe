/**
 * T10 Contenido review against docs/design-system.md (Playwright MCP, 1440/390, light/dark): the footer
 * floated as a card above the bottom, Guardar stayed solid with nothing to save, the table cells mixed
 * two field styles, the card questions sat beside their chips, the collapsed summary hid its source,
 * the counter counted cells while the badge counted rows, and the table scrolled sideways on mobile.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import EditorialWorkspace from '../EditorialWorkspace.vue'
import EditorialAttributeTable from '../EditorialAttributeTable.vue'
import EditorialAttributeCell from '../EditorialAttributeCell.vue'
import EditorialPresentationCard from '../EditorialPresentationCard.vue'
import { EditorialSelectStub, stubEditorialSelect } from './editorialSelectStub'
import type { EditorialDefinition } from '../../../interfaces/editorial-contract-definition.types'
import type { EditorialFamily } from '../../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialCardQuestion } from '../../../utils/editorial-presentation-card'
import { read, update, state, success, vocabularyEnvelope } from '../../../__tests__/editorial-contract-fixtures'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/shared/api/http', () => ({ http }))
const auth = reactive({ isAuthenticated: true, authPhase: 'authenticated', user: { id: 'u' }, currentTenant: { id: 't' }, permissionsLoaded: true, permissionCodes: [read, update] })
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))

const file = (name: string) => readFileSync(resolve(__dirname, '..', name), 'utf8')
const style = (name: string) => /<style scoped>([\s\S]*?)<\/style>/.exec(file(name))?.[1] ?? ''
const rule = (css: string, selector: string) => new RegExp(`(?:^|\\n|\\}\\s*)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? ''
const mobileBlock = (css: string) => /@media \(max-width: 767px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
const tick = () => new Promise(resolve => setTimeout(resolve, 60))
let wrapper: ReturnType<typeof mount> | undefined

beforeAll(stubEditorialSelect)
beforeEach(() => {
  vi.resetAllMocks()
  http.get.mockImplementation((url: string) => Promise.resolve(url.includes('vocabulary') ? { ...success(), data: vocabularyEnvelope() }
    : url.endsWith('/context') ? { status: 200, data: { variants: [] } } : success(state())))
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals() })

describe('1. footer save bar', () => {
  const css = style('EditorialWorkspace.vue')
  it('is a bar flush to the bottom of the content column: bottom 0, border-top, surface, no card frame', () => {
    const footer = rule(css, '.editorial-footer')
    expect(footer).toMatch(/position: sticky/)
    expect(footer).toMatch(/bottom: 0/)
    expect(footer).toMatch(/border-top: 1px solid var\(--hf-border\)/)
    expect(footer).toMatch(/background: var\(--hf-surface\)/)
    expect(footer).not.toMatch(/border-radius|border: 1px/)
  })

  it('leaves no gap under it: the product scroll area drops its bottom padding on the Contenido task', () => {
    const view = readFileSync(resolve(__dirname, '../../../views/ProductDetailView.vue'), 'utf8')
    expect(view).toMatch(/isEditorialTask \? 'pb-0' : 'pb-6'/)
    expect(view).not.toMatch(/overflow-y-auto px-4 pb-6 pt-6/)
  })

  it('keeps the last content clear of it: the bar is in the flow after the form, which reserves its bottom space', () => {
    expect(rule(css, '.editorial-form')).toMatch(/padding-bottom: 16px/)
    expect(file('EditorialWorkspace.vue')).toMatch(/<\/component>\s*\n\s*<footer v-if="canWrite && buffer" class="editorial-footer"/)
  })

  it('on mobile is the sticky action bar: full bleed, 12px/16px padding, equal-width columns', () => {
    const mobile = mobileBlock(css)
    expect(mobile).toMatch(/\.editorial-footer \{[^}]*margin-inline: -16px/)
    expect(mobile).toMatch(/\.editorial-footer \{[^}]*padding: 12px 16px/)
    expect(mobile).toMatch(/\.editorial-footer__actions \{[^}]*grid-auto-flow: column; grid-auto-columns: minmax\(0, 1fr\)/)
  })
})

describe('2. Guardar is disabled with nothing to save', () => {
  it('uses the shared disabled primary while saved, and turns on once the editor is dirty', async () => {
    wrapper = mount(EditorialWorkspace, { attachTo: document.body, props: { productId: 'p1', embedded: true } })
    await flushPromises()
    const save = () => wrapper!.get<HTMLButtonElement>('button[type="submit"][form="editorial-form"]')
    expect(wrapper.get('.editorial-save-state').text()).toContain('Guardado')
    expect(save().element.disabled).toBe(true)
    expect(save().classes()).toContain('hf-primary-control')
    await wrapper.get('#editorial-title').setValue('Croqueta premium')
    expect(save().element.disabled).toBe(false)
  })

  it('does not repaint the disabled primary locally (no opacity override of .hf-primary-control)', () => {
    expect(style('EditorialWorkspace.vue')).not.toMatch(/\.hf-primary-control:disabled/)
  })
})

describe('3. one field style in the table', () => {
  const css = style('EditorialAttributeCell.vue')
  it('paints every cell control with the app field style: accented border, field surface, dimmed placeholder', () => {
    const control = rule(css, '.hf-cell :deep(.hf-cell__control), .hf-cell__control')
    expect(control).toMatch(/background: var\(--hf-field\)/)
    expect(control).toMatch(/box-shadow: inset 0 0 0 1px var\(--ui-border-accented\)/)
    expect(control).toMatch(/min-height: var\(--hf-control-height\)/)
    expect(css).not.toMatch(/--hf-field-border/)
    expect(css).toMatch(/\.hf-cell__control::placeholder, \.hf-cell__placeholder \{ color: var\(--ui-text-dimmed\); \}/)
  })

  const multi: EditorialDefinition = { id: 'stage', code: 'stage', label: 'Etapa de vida', type: 'multi', aliases: [], groups: [],
    options: [{ code: 'puppy', label: 'Cachorro', archived: false, sortOrder: 0 }] }
  const single: EditorialDefinition = { ...multi, type: 'single' }
  const mountCell = (definition: EditorialDefinition) => mount(EditorialAttributeCell, { attachTo: document.body, props: {
    id: 'c', label: 'Etapa de vida · Producto', definition, target: { code: definition.code, owner: 'product', variantId: null }, modelValue: { state: 'omitted' } } })

  it('gives the several-choice trigger the same class, a muted "Elige…" and a chevron', () => {
    wrapper = mountCell(multi)
    const summary = wrapper.get('summary')
    expect(summary.classes()).toContain('hf-cell__control')
    expect(summary.get('.hf-cell__placeholder').text()).toBe('Elige…')
    expect(summary.find('[data-testid="cell-chevron"]').exists()).toBe(true)
  })

  it('hands the same field class to the Nuxt UI lists, in their compact size', () => {
    wrapper = mountCell(single)
    const select = wrapper.getComponent(EditorialSelectStub)
    expect(select.props('fieldClass')).toBe('hf-cell__control')
  })

  it('EditorialSelect passes the field class to the trigger and uses the compact size', () => {
    const source = file('EditorialSelect.vue')
    expect(source).toMatch(/fieldClass\?: string/)
    expect(source).toMatch(/:ui="\{ content, base: fieldClass \}"/)
    expect(source).toMatch(/:size="fieldClass \? 'sm' : undefined"/)
  })
})

describe('4. card questions stack', () => {
  const css = style('EditorialPresentationCard.vue')
  it('puts each label above its chips at every width, 16px between questions', () => {
    expect(css).not.toMatch(/grid-template-columns: 15rem/)
    expect(css).not.toMatch(/@container \(min-width: 40rem\)/)
    expect(rule(css, '.pcard__questions')).toMatch(/display: grid; gap: 16px/)
    expect(rule(css, '.pcard__question')).toMatch(/gap: 8px/)
  })
})

describe('5. collapsed card summary', () => {
  const questions: EditorialCardQuestion[] = [
    { key: 'contentMagnitude', text: '¿Cómo se mide?', kind: 'one', options: [{ value: 'mass', label: 'Peso' }, { value: 'unknown', label: 'No sé' }], answer: 'mass' },
  ]
  it('shows the name, the answers (truncating, full text in title), the source and date (never truncated), Editar and ⋮', () => {
    wrapper = mount(EditorialPresentationCard, { attachTo: document.body, props: { id: 'k', title: 'Collar', questions, needsSource: true, hasAnswers: true,
      source: { sourceRef: 'Ficha del fabricante', verifiedOn: `${new Date().getFullYear()}-11-04` }, startOpen: false } })
    const line = wrapper.get('.pcard__line')
    const answers = line.get('[data-testid="card-summary-answers"]')
    expect(answers.text()).toBe('Se mide en peso')
    expect(answers.attributes('title')).toBe('Se mide en peso')
    expect(line.get('[data-testid="card-summary-source"]').text()).toBe('Ficha del fabricante · 4 nov')
    const order = Array.from(line.element.querySelectorAll('.pcard__title, [data-testid="card-summary-answers"], [data-testid="card-summary-source"], [data-testid="card-edit"], button[aria-haspopup="menu"]'))
      .map(element => (element as HTMLElement).dataset.testid ?? (element.classList.contains('pcard__title') ? 'title' : 'menu'))
    expect(order).toEqual(['title', 'card-summary-answers', 'card-summary-source', 'card-edit', 'menu'])
    const css = style('EditorialPresentationCard.vue')
    expect(rule(css, '.pcard__answers')).toMatch(/text-overflow: ellipsis/)
    expect(rule(css, '.pcard__when')).toMatch(/flex: none/)
    expect(rule(css, '.pcard__when')).toMatch(/white-space: nowrap/)
  })
})

describe('7. mobile table', () => {
  const definitions: EditorialDefinition[] = [
    { id: 'material', code: 'material', label: 'Material', type: 'text' },
    { id: 'size', code: 'size', label: 'Talla', type: 'text' },
  ]
  const family: EditorialFamily = { id: 'acc', code: 'acc', label: 'Accesorio', bindings: [
    { definitionId: 'material', definitionCode: 'material', owner: 'product', sortOrder: 0, exposure: 'INTERNAL', searchable: false, publicationCheck: 'when_asserted', policy: { route: 'pending' } },
    { definitionId: 'size', definitionCode: 'size', owner: 'sellable', sortOrder: 1, exposure: 'DETAIL', searchable: false, publicationCheck: 'when_asserted', policy: { route: 'pending' } },
  ] }
  it('renders each row as a stacked card below md: label line with markers, chip and ⋯, then the control; one labeled control per presentation', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('max-width'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
    wrapper = mount(EditorialAttributeTable, { attachTo: document.body, props: { values: [], family, definitions, nextId: () => 'n',
      subjects: [{ variantId: 'v1', label: 'Chico' }, { variantId: 'v2', label: 'Mediano' }, { variantId: 'v3', label: 'Grande' }] } })
    await tick()
    expect(wrapper.find('table').exists()).toBe(false)
    const cards = wrapper.findAll('[data-testid="attribute-card"]')
    expect(cards.map(card => card.get('.hf-attr-card__title').text().replace(/\s+/g, ' '))).toEqual(['Material Interno', 'Talla'])
    const head = cards[0]!.get('.hf-cell__line')
    const parts = Array.from(head.element.children).map(element => element.matches('.hf-cell__label') ? 'label' : element.matches('.hf-status-badge, .hf-cell__chip') ? 'chip'
      : element.querySelector('button[aria-haspopup="menu"]') || element.matches('button[aria-haspopup="menu"]') ? 'menu' : element.matches('.hf-cell__fields') ? 'control' : 'other')
      .filter(part => part !== 'other')
    // The label leads; the control comes after it in the DOM and wraps under the chip and ⋯ through CSS order.
    expect(parts[0]).toBe('label')
    expect([...parts].sort()).toEqual(['chip', 'control', 'label', 'menu'])
    expect(head.get('.hf-cell__label').text()).toContain('Material')
    expect(cards[1]!.findAll('.hf-cell__label').map(label => label.text())).toEqual(['Chico', 'Mediano', 'Grande'])
    const css = style('EditorialAttributeTable.vue')
    expect(rule(css, '.hf-attr-cards')).not.toMatch(/overflow-x/)
    expect(style('EditorialAttributeCell.vue')).toMatch(/\.hf-cell\[data-layout='stacked'\] \.hf-cell__fields \{[^}]*order: 2; flex-basis: 100%/)
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
