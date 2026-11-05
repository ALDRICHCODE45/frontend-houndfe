import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import HfCombobox from '../HfCombobox.vue'

// jsdom does not implement `scrollIntoView`, which Reka calls on the highlighted item.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// USelectMenu is registered by @nuxt/ui at the Vite level, so the real list
// renders: open it from the real trigger and read the portal Reka mounts on body.
const species = ['Perro', 'Gato', 'Ave', 'Pez', 'Roedor', 'Conejo', 'Hurón', 'Reptil', 'Tortuga', 'Caballo']
  .map(label => ({ label, value: label.toLowerCase() }))
const stages = ['Cachorro', 'Junior', 'Adulto', 'Senior', 'Todas las etapas']
  .map(label => ({ label, value: label.toLowerCase() }))
const specials = [
  { value: 'unknown', label: 'No lo sé', icon: 'i-lucide-circle-help' },
  { value: 'na', label: 'No aplica', icon: 'i-lucide-ban' },
]

const tick = () => new Promise(resolve => setTimeout(resolve, 50))
const options = () => Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
const optionLabels = () => options().map(option => (option.textContent ?? '').trim())
const searchInput = () => document.querySelector<HTMLInputElement>('.hf-combobox__content input')

function mountCombobox(props: Record<string, unknown> = {}) {
  return mount(HfCombobox, {
    attachTo: document.body,
    props: { items: stages, label: 'Etapa de vida', ...props },
  })
}

async function open(wrapper: ReturnType<typeof mountCombobox>) {
  await wrapper.get('[data-slot="base"]').trigger('click')
  await tick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HfCombobox trigger', () => {
  it('names the trigger, shows the default placeholder and always a chevron', () => {
    const wrapper = mountCombobox()
    const trigger = wrapper.get('[data-slot="base"]')
    expect(trigger.attributes('aria-label')).toBe('Etapa de vida')
    expect(trigger.get('.hf-combobox__placeholder').text()).toBe('Elige una opción')
    expect(trigger.find('[data-slot="trailingIcon"]').exists()).toBe(true)
    expect(trigger.classes()).toContain('hf-combobox__trigger')
    wrapper.unmount()
  })

  it('shows the chosen label in single mode', () => {
    const wrapper = mountCombobox({ modelValue: 'adulto' })
    expect(wrapper.get('.hf-combobox__text').text()).toBe('Adulto')
    wrapper.unmount()
  })

  it('marks an invalid trigger for the danger border and assistive tech', () => {
    const wrapper = mountCombobox({ invalid: true, describedby: 'etapa-error' })
    const trigger = wrapper.get('[data-slot="base"]')
    expect(trigger.attributes('aria-invalid')).toBe('true')
    expect(trigger.attributes('aria-describedby')).toBe('etapa-error')
    expect(trigger.classes()).toContain('hf-combobox__trigger--invalid')
    wrapper.unmount()
  })

  it('themes the portal content with the HF root so dark mode reaches it', async () => {
    const wrapper = mountCombobox()
    await open(wrapper)
    const content = document.querySelector('.hf-combobox__content')!
    expect(content.classList.contains('hf-theme')).toBe(true)
    expect(content.classList.contains('hf-ui')).toBe(true)
    wrapper.unmount()
  })
})

describe('HfCombobox search threshold', () => {
  it('has no search input with 7 options or fewer', async () => {
    const wrapper = mountCombobox({ items: species.slice(0, 7) })
    await open(wrapper)
    expect(options()).toHaveLength(7)
    expect(searchInput()).toBeNull()
    wrapper.unmount()
  })

  it('adds the search input above the list with more than 7 options', async () => {
    const wrapper = mountCombobox({ items: species.slice(0, 8), label: 'Especie' })
    await open(wrapper)
    expect(searchInput()).not.toBeNull()
    expect(searchInput()!.getAttribute('placeholder')).toBe('Buscar')
    wrapper.unmount()
  })

  it('follows a custom searchThreshold', async () => {
    const wrapper = mountCombobox({ searchThreshold: 3 })
    await open(wrapper)
    expect(searchInput()).not.toBeNull()
    wrapper.unmount()
  })

  it('filters by label, ignoring accents, and keeps the special answers at the foot', async () => {
    const wrapper = mountCombobox({ items: species, label: 'Especie', specialAnswers: specials })
    await open(wrapper)
    const input = searchInput()!
    input.value = 'huron'
    input.dispatchEvent(new Event('input'))
    await tick()
    expect(optionLabels()).toEqual(['Hurón', 'No lo sé', 'No aplica'])
    wrapper.unmount()
  })

  it('says there are no results and still offers the special answers', async () => {
    const wrapper = mountCombobox({ items: species, label: 'Especie', specialAnswers: specials })
    await open(wrapper)
    const input = searchInput()!
    input.value = 'dragón'
    input.dispatchEvent(new Event('input'))
    await tick()
    expect(document.querySelector('.hf-combobox__content')!.textContent).toContain('Sin resultados para «dragón»')
    expect(optionLabels()).toEqual(['No lo sé', 'No aplica'])
    const groups = document.querySelectorAll('.hf-combobox__viewport > [data-slot="group"]')
    expect(groups[groups.length - 1]!.querySelectorAll('.hf-combobox__special')).toHaveLength(2)
    wrapper.unmount()
  })
})

describe('HfCombobox options', () => {
  it('gives each option the 36px item hook and checks the chosen one', async () => {
    const wrapper = mountCombobox({ modelValue: 'junior' })
    await open(wrapper)
    expect(options().every(option => option.classList.contains('hf-combobox__option'))).toBe(true)
    const chosen = options().find(option => option.textContent?.includes('Junior'))!
    expect(chosen.getAttribute('aria-selected')).toBe('true')
    expect(chosen.querySelector('[data-slot="itemTrailingIcon"]')).not.toBeNull()
    const other = options().find(option => option.textContent?.includes('Adulto'))!
    expect(other.querySelector('[data-slot="itemTrailingIcon"]')).toBeNull()
    wrapper.unmount()
  })

  it('emits the value when a regular option is picked', async () => {
    const wrapper = mountCombobox()
    await open(wrapper)
    options().find(option => option.textContent?.includes('Senior'))!.click()
    await tick()
    expect(wrapper.emitted('update:modelValue')).toEqual([['senior']])
    expect(wrapper.emitted('update:special')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('HfCombobox special answers', () => {
  it('pins them in a footer group after the scrolling options group, with their icons', async () => {
    const wrapper = mountCombobox({ items: species, label: 'Especie', specialAnswers: specials })
    await open(wrapper)
    expect(optionLabels()).toEqual([...species.map(item => item.label), 'No lo sé', 'No aplica'])
    // hf-form.css scrolls the options group, not the viewport, under `--footer`; the last group stays put.
    expect(document.querySelector('.hf-combobox__content')!.classList.contains('hf-combobox__content--footer')).toBe(true)
    const groups = Array.from(document.querySelectorAll('.hf-combobox__viewport > [data-slot="group"]'))
    expect(groups).toHaveLength(2)
    expect(groups[0]!.querySelector('.hf-combobox__special')).toBeNull()
    const answers = Array.from(groups[1]!.querySelectorAll<HTMLElement>('[role="option"]'))
    expect(answers.map(answer => answer.textContent?.trim())).toEqual(['No lo sé', 'No aplica'])
    expect(answers.every(answer => answer.classList.contains('hf-combobox__option') && answer.classList.contains('hf-combobox__special'))).toBe(true)
    expect(answers.every(answer => answer.querySelector('[data-slot="itemLeadingIcon"]'))).toBe(true)
    wrapper.unmount()
  })

  it('continues the arrow keys from the list into the footer', async () => {
    // Opening highlights the chosen option, the last one of the list.
    const wrapper = mountCombobox({ modelValue: 'todas las etapas', specialAnswers: specials })
    await open(wrapper)
    const last = options().find(option => option.textContent?.includes('Todas las etapas'))!
    expect(last.hasAttribute('data-highlighted')).toBe(true)
    const content = document.querySelector<HTMLElement>('.hf-combobox__content')!
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await tick()
    const highlighted = document.querySelector('[role="option"][data-highlighted]')!
    expect(highlighted.textContent?.trim()).toBe('No lo sé')
    expect(highlighted.classList.contains('hf-combobox__special')).toBe(true)
    wrapper.unmount()
  })

  it('has no footer without special answers', async () => {
    const wrapper = mountCombobox()
    await open(wrapper)
    expect(document.querySelector('.hf-combobox__content--footer')).toBeNull()
    wrapper.unmount()
  })

  it('emits update:special, not a value, when one is picked', async () => {
    const wrapper = mountCombobox({ modelValue: 'adulto', specialAnswers: specials })
    await open(wrapper)
    options().find(option => option.textContent?.includes('No aplica'))!.click()
    await tick()
    expect(wrapper.emitted('update:special')).toEqual([['na']])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows the special label in muted italic instead of the value', async () => {
    const wrapper = mountCombobox({ modelValue: 'adulto', specialAnswers: specials, special: 'unknown' })
    const special = wrapper.get('.hf-combobox__special-text')
    expect(special.text()).toBe('No lo sé')
    expect(wrapper.find('.hf-combobox__text').exists()).toBe(false)
    await open(wrapper)
    const chosen = options().find(option => option.textContent?.includes('No lo sé'))!
    expect(chosen.getAttribute('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('clears the special answer when a regular value is picked', async () => {
    const wrapper = mountCombobox({ specialAnswers: specials, special: 'na' })
    await open(wrapper)
    options().find(option => option.textContent?.includes('Junior'))!.click()
    await tick()
    expect(wrapper.emitted('update:special')).toEqual([[null]])
    expect(wrapper.emitted('update:modelValue')).toEqual([['junior']])
    wrapper.unmount()
  })
})

describe('HfCombobox multiple', () => {
  it('shows at most two chips and then +N', () => {
    const wrapper = mountCombobox({ items: species, multiple: true, modelValue: ['perro', 'gato', 'ave', 'pez'] })
    const chips = wrapper.findAll('.hf-combobox__chip')
    expect(chips.map(chip => chip.text())).toEqual(['Perro', 'Gato', '+2 y 2 más'])
    expect(chips[2]!.classes()).toContain('hf-combobox__chip--more')
    expect(chips[2]!.get('[aria-hidden="true"]').text()).toBe('+2')
    wrapper.unmount()
  })

  it('shows no +N chip with two values or fewer', () => {
    const wrapper = mountCombobox({ items: species, multiple: true, modelValue: ['perro', 'gato'] })
    expect(wrapper.findAll('.hf-combobox__chip').map(chip => chip.text())).toEqual(['Perro', 'Gato'])
    wrapper.unmount()
  })

  it('gives every regular option a checkbox indicator and toggles values', async () => {
    const wrapper = mountCombobox({ items: stages, multiple: true, modelValue: ['cachorro'], specialAnswers: specials })
    await open(wrapper)
    const regular = options().filter(option => !option.classList.contains('hf-combobox__special'))
    expect(regular.every(option => option.querySelector('.hf-combobox__box'))).toBe(true)
    expect(options().filter(option => option.classList.contains('hf-combobox__special'))
      .some(option => option.querySelector('.hf-combobox__box'))).toBe(false)
    regular.find(option => option.textContent?.includes('Adulto'))!.click()
    await tick()
    expect(wrapper.emitted('update:modelValue')).toEqual([[['cachorro', 'adulto']]])
    wrapper.unmount()
  })

  it('emits update:special when a special answer is picked in multiple mode', async () => {
    const wrapper = mountCombobox({ items: stages, multiple: true, modelValue: ['cachorro'], specialAnswers: specials })
    await open(wrapper)
    options().find(option => option.textContent?.includes('No lo sé'))!.click()
    await tick()
    expect(wrapper.emitted('update:special')).toEqual([['unknown']])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
})
