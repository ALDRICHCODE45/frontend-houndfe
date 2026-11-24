/**
 * «Mascotas» on the customer card (handoff 27 §1–§3): gated buttons, the list as the server sends it,
 * duplicate notice, version-conflict reload and the erase confirmation that offers archive.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import CustomerPetsSection from '../CustomerPetsSection.vue'
import { makePet } from '../../pets/__tests__/pet.fixture'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  remove: vi.fn(),
}))
const grants = vi.hoisted(() => ({ value: new Set<string>() }))
vi.mock('../../pets/pet.api', () => ({ petApi: api }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 't1',
    userCan: (action: string, subject: string) => grants.value.has(`${action}:${subject}`),
  }),
}))
vi.mock('@/core/shared/components/RowActionsMenu.vue', () => ({
  default: {
    name: 'RowActionsMenu',
    props: ['actions', 'rowLabel'],
    emits: ['select'],
    template:
      '<span><button v-for="a in actions" :key="a.key" :data-action="a.key" @click="$emit(\'select\', a.key)">{{ a.label }}</button></span>',
  },
}))

const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({ useToast: () => toast }))

const modal = {
  props: ['open', 'title'],
  template:
    '<div v-if="open" data-testid="modal"><h2>{{ title }}</h2><slot name="body" /><slot name="footer" /></div>',
}
const button = {
  props: ['label', 'disabled', 'loading', 'type', 'form'],
  emits: ['click'],
  template:
    '<button v-bind="$attrs" :type="type ?? \'button\'" :form="form" :disabled="disabled" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  inheritAttrs: false,
}
const input = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<input v-bind="$attrs" :value="modelValue ?? \'\'" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  inheritAttrs: false,
}
// Nuxt UI resolves through its auto-import, so each stub is registered with and without the U prefix.
const base = {
  Modal: modal,
  Button: button,
  Input: input,
  Textarea: input,
  FormField: {
    props: ['label', 'error'],
    template: '<label>{{ label }}<slot /><small v-if="error">{{ error }}</small></label>',
  },
  Select: {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template:
      '<select v-bind="$attrs" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
    inheritAttrs: false,
  },
  Badge: { props: ['label'], template: '<span v-bind="$attrs">{{ label }}<slot /></span>' },
  Icon: { template: '<i />' },
}
const stubs = Object.fromEntries(
  Object.entries(base).flatMap(([name, stub]) => [
    [name, stub],
    [`U${name}`, stub],
  ]),
)

const ALL = ['read:Customer', 'update:Customer', 'delete:Customer']

function mountSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(CustomerPetsSection, {
    props: { customerId: 'c1' },
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]], stubs },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  grants.value = new Set(ALL)
  api.list.mockImplementation(async (_c: string, status: string) =>
    status === 'ARCHIVED'
      ? [makePet({ id: 'p2', name: 'Luna', status: 'ARCHIVED', archivedReason: 'Ya no está' })]
      : [makePet()],
  )
})

describe('CustomerPetsSection', () => {
  it('lists active pets with species, breed, size, ageLabel as is and highlighted allergies', async () => {
    const wrapper = mountSection()
    await flushPromises()
    const row = wrapper.get('[data-testid="pet-row-p1"]')
    expect(row.text()).toContain('Bruno')
    expect(row.text()).toContain('Perro · Chihuahua')
    expect(row.text()).toContain('Chico')
    expect(row.text()).toContain('~10 meses')
    expect(row.get('[data-testid="pet-allergies"]').text()).toContain('Pollo')
  })

  it('shows the archived list on demand with its restore action', async () => {
    const wrapper = mountSection()
    await flushPromises()
    expect(wrapper.find('[data-testid="pet-row-p2"]').exists()).toBe(false)
    await wrapper.get('[data-testid="pets-toggle-archived"]').trigger('click')
    await flushPromises()
    const row = wrapper.get('[data-testid="pet-row-p2"]')
    expect(row.text()).toContain('Ya no está')
    expect(row.find('[data-action="restore"]').exists()).toBe(true)
  })

  it('hides add/edit/archive/restore without update:Customer and erase without delete:Customer', async () => {
    grants.value = new Set(['read:Customer'])
    const readOnly = mountSection()
    await flushPromises()
    expect(readOnly.find('[data-testid="pets-add"]').exists()).toBe(false)
    expect(readOnly.get('[data-testid="pet-row-p1"]').findAll('[data-action]')).toHaveLength(0)

    grants.value = new Set(['read:Customer', 'update:Customer'])
    const editor = mountSection()
    await flushPromises()
    expect(editor.find('[data-testid="pets-add"]').exists()).toBe(true)
    const keys = editor
      .get('[data-testid="pet-row-p1"]')
      .findAll('[data-action]')
      .map((b) => b.attributes('data-action'))
    expect(keys).toEqual(['edit', 'archive'])

    grants.value = new Set(['read:Customer', 'delete:Customer'])
    const eraser = mountSection()
    await flushPromises()
    expect(eraser.find('[data-testid="pets-add"]').exists()).toBe(false)
    const eraseKeys = eraser
      .get('[data-testid="pet-row-p1"]')
      .findAll('[data-action]')
      .map((b) => b.attributes('data-action'))
    expect(eraseKeys).toEqual(['erase'])
  })

  it('does not list without read:Customer', async () => {
    grants.value = new Set()
    const wrapper = mountSection()
    await flushPromises()
    expect(api.list).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="pet-row-p1"]').exists()).toBe(false)
  })

  it('creates a pet and shows the duplicate notice when the write warns PET_NAME_DUPLICATE', async () => {
    api.create.mockResolvedValue({ ...makePet({ id: 'p3' }), warnings: ['PET_NAME_DUPLICATE'] })
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-testid="pets-add"]').trigger('click')
    await wrapper.get('[data-testid="pet-form-name"]').setValue('Bruno')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.create).toHaveBeenCalledWith('c1', { name: 'Bruno', species: 'DOG' })
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ya hay otra mascota llamada Bruno', color: 'warning' }),
    )
  })

  it('on PET_VERSION_CONFLICT reloads the pets and tells the user to retry', async () => {
    api.update.mockRejectedValue({
      response: {
        status: 409,
        data: {
          statusCode: 409,
          error: 'PET_VERSION_CONFLICT',
          message: 'PET_VERSION_CONFLICT',
          currentVersion: 4,
        },
      },
    })
    const wrapper = mountSection()
    await flushPromises()
    const listCalls = api.list.mock.calls.length
    await wrapper.get('[data-testid="pet-row-p1"] [data-action="edit"]').trigger('click')
    await wrapper.get('[data-testid="pet-form-name"]').setValue('Max')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.update).toHaveBeenCalledWith('c1', 'p1', { version: 3, name: 'Max' })
    expect(api.list.mock.calls.length).toBeGreaterThan(listCalls)
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringMatching(/modificó esta mascota/),
        color: 'error',
      }),
    )
  })

  it('erase asks for confirmation saying it cannot be undone, offers archive, then DELETEs', async () => {
    api.remove.mockResolvedValue(undefined)
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-testid="pet-row-p1"] [data-action="erase"]').trigger('click')
    const dialog = wrapper.get('[data-testid="pet-erase-dialog"]')
    expect(dialog.text()).toMatch(/no se puede deshacer/)
    expect(wrapper.find('[data-testid="pet-erase-archive-instead"]').exists()).toBe(true)
    expect(api.remove).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="pet-erase-confirm"]').trigger('click')
    await flushPromises()
    expect(api.remove).toHaveBeenCalledWith('c1', 'p1', 3)
    expect(wrapper.find('[data-testid="pet-row-p1"]').exists()).toBe(false)
  })

  it('archives with an optional reason', async () => {
    api.archive.mockResolvedValue({ ...makePet({ status: 'ARCHIVED', version: 4 }), warnings: [] })
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-testid="pet-row-p1"] [data-action="archive"]').trigger('click')
    await wrapper.get('[data-testid="pet-archive-reason"]').setValue('Falleció')
    await wrapper.get('[data-testid="pet-archive-confirm"]').trigger('click')
    await flushPromises()
    expect(api.archive).toHaveBeenCalledWith('c1', 'p1', { version: 3, reason: 'Falleció' })
  })

  it('«Edad aproximada» with no years nor months marks the age and does not create', async () => {
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-testid="pets-add"]').trigger('click')
    await wrapper.get('[data-testid="pet-form-name"]').setValue('Bruno')
    await wrapper.get('[data-testid="pet-form-age-approx"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.create).not.toHaveBeenCalled()
    expect(
      wrapper.get('[data-testid="pet-form-years"]').element.closest('label')!.textContent,
    ).toMatch(/años o meses/)
  })

  it('a 400 per-field error keeps the form open with the message on that field', async () => {
    api.create.mockRejectedValue(fieldError('name'))
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-testid="pets-add"]').trigger('click')
    await wrapper.get('[data-testid="pet-form-name"]').setValue('Bruno')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(true)
    expect(
      wrapper.get('[data-testid="pet-form-name"]').element.closest('label')!.textContent,
    ).toContain('Revisa el nombre (de 1 a 60 caracteres).')
  })

  it('a new submit attempt clears the previous server field errors', async () => {
    api.create.mockRejectedValueOnce(fieldError('name')).mockRejectedValueOnce({
      response: { status: 422, data: { statusCode: 422, error: 'PET_LIMIT_REACHED' } },
    })
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-testid="pets-add"]').trigger('click')
    await wrapper.get('[data-testid="pet-form-name"]').setValue('Bruno')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Revisa el nombre')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.create).toHaveBeenCalledTimes(2)
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Revisa el nombre')
  })

  it('a 400 on the archive reason shows the message next to the reason field', async () => {
    api.archive.mockRejectedValue(fieldError('reason'))
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-testid="pet-row-p1"] [data-action="archive"]').trigger('click')
    await wrapper.get('[data-testid="pet-archive-reason"]').setValue('x')
    await wrapper.get('[data-testid="pet-archive-confirm"]').trigger('click')
    await flushPromises()
    const field = wrapper.get('[data-testid="pet-archive-reason"]').element.closest('label')!
    expect(field.textContent).toContain('El motivo admite hasta 280 caracteres.')
  })

  it('«Sin tamaño» clears a set size (PATCH sends size null)', async () => {
    api.update.mockResolvedValue({ ...makePet({ size: null, version: 4 }), warnings: [] })
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-testid="pet-row-p1"] [data-action="edit"]').trigger('click')
    const select = wrapper.get('[data-testid="pet-form-size"]')
    const none = select.findAll('option').find((option) => option.text() === 'Sin tamaño')
    expect(none).toBeDefined()
    await select.setValue(none!.element.value)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.update).toHaveBeenCalledWith('c1', 'p1', { version: 3, size: null })
  })

  it('erasing a pet that is already gone (PET_NOT_FOUND) is reported as done, not as an error', async () => {
    api.remove.mockRejectedValue({
      response: { status: 404, data: { statusCode: 404, error: 'PET_NOT_FOUND' } },
    })
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-testid="pet-row-p1"] [data-action="erase"]').trigger('click')
    await wrapper.get('[data-testid="pet-erase-confirm"]').trigger('click')
    await flushPromises()
    expect(toast.add).not.toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Datos de la mascota eliminados', color: 'success' }),
    )
    expect(wrapper.find('[data-testid="pet-erase-dialog"]').exists()).toBe(false)
  })
})

function fieldError(property: string) {
  return {
    response: {
      status: 400,
      data: {
        statusCode: 400,
        error: 'Bad Request',
        message: [{ property, children: [], constraints: { maxLength: 'too long' } }],
      },
    },
  }
}
