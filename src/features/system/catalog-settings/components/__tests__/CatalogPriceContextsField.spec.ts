// CatalogPriceContextsField.spec.ts — STRICT-TDD tests for the U9 contexts
// field (REQ-6A). Accepted membership/default always comes from the settings
// draft + accepted priceContexts; candidates only OFFER additions and never
// redefine membership; a draft id missing from candidates is preserved and
// shown by id; a missing global-list read disables editing with a Spanish
// explanation while the accepted selections stay visible.
//
// U9 renders the field through the repository's Nuxt UI select pattern — one
// searchable multiple USelectMenu for the visible allowlist and one searchable
// single clearable USelectMenu for the principal list — so the interaction
// tests drive the rendered controls the way the other select-based specs do:
// click the trigger, then click the portaled [role="option"] row.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogPriceContextsField from '../CatalogPriceContextsField.vue'
import type { CatalogSettingsDraft } from '../../interfaces/catalog-settings.types'

const MULTI_SELECT = '[data-testid="public-lists-select"]'
const DEFAULT_SELECT = '[data-testid="default-context-select"]'

// The retired ad-hoc controls: their testids may disappear with the buttons.
const RETIRED_TESTIDS = [
  'add-candidate-option',
  'remove-context',
  'remove-default-context',
  'set-default',
  'clear-default',
  'context-list',
  'context-row',
]

function makeDraft(overrides: Partial<CatalogSettingsDraft> = {}): CatalogSettingsDraft {
  return {
    catalogPublished: true,
    publicPriceListIds: ['pl_a', 'pl_b'],
    catalogDefaultPriceListId: 'pl_a',
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    ...overrides,
  }
}

const acceptedContexts = [
  { priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true },
  { priceListId: 'pl_b', name: 'Lista B', isCatalogDefault: false },
]

const candidates = [
  { id: 'pl_a', name: 'Lista A', isDefault: true, createdAt: '', updatedAt: '' },
  { id: 'pl_c', name: 'Lista C', isDefault: false, createdAt: '', updatedAt: '' },
]

function mountField(
  draft = makeDraft(),
  disabled = false,
  accepted: Array<{
    priceListId: string
    name: string
    isCatalogDefault: boolean
  }> = acceptedContexts,
) {
  return mountWithUApp(CatalogPriceContextsField, {
    attachTo: document.body,
    props: {
      draft,
      acceptedContexts: accepted,
      candidates,
      disabled,
    },
  })
}

type FieldWrapper = ReturnType<typeof mountField>

// reka-ui scrolls the highlighted option into view; jsdom has no layout engine.
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  })
})

afterEach(() => {
  // The portaled select popups live in <body>; clear them so no test observes
  // another test's option list.
  document.body.innerHTML = ''
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    })
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
})

function optionElements(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
}

function optionLabels(): string[] {
  return optionElements().map((element) => element.textContent?.trim() ?? '')
}

async function openSelect(wrapper: FieldWrapper, testid: string) {
  await wrapper.find(`[data-testid="${testid}"]`).trigger('click')
  await nextTick()
}

async function clickOption(label: string) {
  const element = optionElements().find((option) => option.textContent?.trim() === label)
  expect(element, `expected a rendered option labeled "${label}"`).toBeDefined()
  await new DOMWrapper(element!).trigger('click')
  await nextTick()
}

describe('CatalogPriceContextsField — Nuxt UI select pattern (U9)', () => {
  it('renders the field heading and the two searchable selects', () => {
    const wrapper = mountField()

    expect(wrapper.find('[data-testid="contexts-field"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Listas de precios públicas')
    expect(wrapper.text()).toContain('Listas de precios visibles para clientes públicos')
    expect(wrapper.findAllComponents({ name: 'SelectMenu' })).toHaveLength(2)
    expect(wrapper.find(MULTI_SELECT).exists()).toBe(true)
    expect(wrapper.find(DEFAULT_SELECT).exists()).toBe(true)
  })

  it('retires the ad-hoc add/remove/default buttons and the row list', () => {
    const wrapper = mountField()

    for (const retired of RETIRED_TESTIDS) {
      expect(wrapper.find(`[data-testid="${retired}"]`).exists()).toBe(false)
    }
  })

  it('renders full-width controls for narrow viewports', () => {
    const wrapper = mountField()

    expect(wrapper.find(MULTI_SELECT).classes()).toContain('w-full')
    expect(wrapper.find(DEFAULT_SELECT).classes()).toContain('w-full')
  })

  it('wires each visible label to its rendered select trigger', () => {
    const wrapper = mountField()
    const labels = wrapper.findAll('label')

    expect(labels.map((label) => label.text())).toEqual(['Listas visibles', 'Lista predeterminada'])
    const targets = labels.map((label) => label.attributes('for'))
    expect(targets.every((target) => Boolean(target))).toBe(true)
    expect(wrapper.find(MULTI_SELECT).attributes('id')).toBe(targets[0])
    expect(wrapper.find(DEFAULT_SELECT).attributes('id')).toBe(targets[1])
    // reka-ui hardcodes an English "Show popup" name on the trigger, so the
    // Spanish accessible names must be pinned explicitly on the controls.
    expect(wrapper.find(MULTI_SELECT).attributes('aria-label')).toBe('Listas visibles')
    expect(wrapper.find(DEFAULT_SELECT).attributes('aria-label')).toBe('Lista predeterminada')
    expect(wrapper.find(DEFAULT_SELECT).attributes('aria-haspopup')).toBe('listbox')
  })

  it('summarizes the current selection compactly', () => {
    const wrapper = mountField()

    expect(wrapper.find('[data-testid="contexts-summary"]').text()).toContain(
      '2 listas seleccionadas para el catálogo público',
    )
    expect(wrapper.find('[data-testid="contexts-empty"]').exists()).toBe(false)
  })

  it('shows the honest empty state when no public list is selected', () => {
    const wrapper = mountField(
      makeDraft({ publicPriceListIds: [], catalogDefaultPriceListId: null }),
    )

    expect(wrapper.find('[data-testid="contexts-empty"]').text()).toContain(
      'Sin listas públicas: la configuración no se mostrará públicamente',
    )
    expect(wrapper.find('[data-testid="contexts-summary"]').exists()).toBe(false)
  })
})

describe('CatalogPriceContextsField — allowlist and stale membership (REQ-6A)', () => {
  it('offers every visible candidate plus accepted/stale ids missing from candidates', async () => {
    const wrapper = mountField(makeDraft({ publicPriceListIds: ['pl_a', 'pl_ghost'] }))

    await openSelect(wrapper, 'public-lists-select')

    expect(optionLabels()).toEqual(['Lista A', 'Lista C', 'pl_ghost'])
  })

  it('resolves a stale accepted id through acceptedContexts instead of the raw id', async () => {
    const wrapper = mountField(makeDraft({ publicPriceListIds: ['pl_a', 'pl_ghost'] }), false, [
      ...acceptedContexts,
      { priceListId: 'pl_ghost', name: 'Lista Fantasma', isCatalogDefault: false },
    ])

    await openSelect(wrapper, 'public-lists-select')

    expect(optionLabels()).toEqual(['Lista A', 'Lista C', 'Lista Fantasma'])
  })

  it('keeps a draft id missing from accepted contexts and candidates selectable by id', () => {
    const wrapper = mountField(makeDraft({ publicPriceListIds: ['pl_a', 'pl_ghost'] }))

    expect(wrapper.find(MULTI_SELECT).text()).toContain('pl_ghost')
  })
})

describe('CatalogPriceContextsField — granular add/remove emits (REQ-6A)', () => {
  it('emits add for a candidate selected through the rendered multiple select', async () => {
    const wrapper = mountField()

    await openSelect(wrapper, 'public-lists-select')
    await clickOption('Lista C')

    expect(wrapper.emitted('add')).toEqual([['pl_c']])
    expect(wrapper.emitted('remove')).toBeUndefined()
  })

  it('emits remove when a selected list is deselected in the multiple select', async () => {
    const wrapper = mountField()

    await openSelect(wrapper, 'public-lists-select')
    await clickOption('Lista A')

    expect(wrapper.emitted('remove')).toEqual([['pl_a']])
    expect(wrapper.emitted('add')).toBeUndefined()
  })

  it('diffs one multi-selection update into draft-ordered removals and selection-ordered additions', async () => {
    const wrapper = mountField(
      makeDraft({
        publicPriceListIds: ['pl_a', 'pl_b', 'pl_c'],
        catalogDefaultPriceListId: null,
      }),
    )
    // The first SelectMenu in template order is the public-lists allowlist.
    const multiSelect = wrapper.findAllComponents({ name: 'SelectMenu' })[0]!
    multiSelect.vm.$emit('update:modelValue', ['pl_b', 'pl_z', 'pl_y'])
    await nextTick()

    expect(wrapper.emitted('remove')).toEqual([['pl_a'], ['pl_c']])
    expect(wrapper.emitted('add')).toEqual([['pl_z'], ['pl_y']])
  })

  it('never mutates the draft membership while diffing', async () => {
    const draft = makeDraft()
    const wrapper = mountField(draft)

    await openSelect(wrapper, 'public-lists-select')
    await clickOption('Lista C')

    expect(wrapper.emitted('add')).toEqual([['pl_c']])
    expect(draft.publicPriceListIds).toEqual(['pl_a', 'pl_b'])
    expect(draft.catalogDefaultPriceListId).toBe('pl_a')
  })
})

describe('CatalogPriceContextsField — principal list (REQ-6A)', () => {
  it('limits the principal-list options to the currently selected public lists', async () => {
    const wrapper = mountField()

    await openSelect(wrapper, 'default-context-select')

    expect(optionLabels()).toEqual(['Lista A', 'Lista B'])
  })

  it('emits setDefault with the chosen principal list', async () => {
    const wrapper = mountField()

    await openSelect(wrapper, 'default-context-select')
    await clickOption('Lista B')

    expect(wrapper.emitted('setDefault')).toEqual([['pl_b']])
  })

  it('clears the principal list through the select clear affordance', async () => {
    const wrapper = mountField()
    // Nuxt UI renders the single-select clear button as the only child of the
    // trailing slot (the chevron is replaced while a value is selected).
    const clear = wrapper.find(`${DEFAULT_SELECT} [data-slot="trailing"] > span`)

    expect(clear.exists()).toBe(true)
    await clear.trigger('click')
    await nextTick()

    expect(wrapper.emitted('setDefault')).toEqual([[null]])
  })
})

describe('CatalogPriceContextsField — missing global-list read (REQ-6A)', () => {
  it('disables both selects and keeps the accepted selections visible with the Spanish explanation', () => {
    const wrapper = mountField(makeDraft(), true)

    expect(wrapper.find(MULTI_SELECT).attributes('disabled')).toBeDefined()
    expect(wrapper.find(DEFAULT_SELECT).attributes('disabled')).toBeDefined()
    expect(wrapper.find(MULTI_SELECT).text()).toContain('Lista A')
    expect(wrapper.find(MULTI_SELECT).text()).toContain('Lista B')
    expect(wrapper.find('[data-testid="contexts-disabled-note"]').text()).toContain(
      'Se requiere permiso de lectura de listas de precios globales para editar los contextos',
    )
  })

  it('ignores control updates while editing is disabled', async () => {
    const wrapper = mountField(makeDraft(), true)
    const selects = wrapper.findAllComponents({ name: 'SelectMenu' })

    selects[0]!.vm.$emit('update:modelValue', ['pl_c'])
    selects[1]!.vm.$emit('update:modelValue', null)
    await nextTick()

    expect(wrapper.emitted('add')).toBeUndefined()
    expect(wrapper.emitted('remove')).toBeUndefined()
    expect(wrapper.emitted('setDefault')).toBeUndefined()
  })
})
