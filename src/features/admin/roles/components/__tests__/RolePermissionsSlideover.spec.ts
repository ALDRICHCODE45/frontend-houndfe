// RolePermissionsSlideover: permissions per subject are selectable rows with a
// round mark (listbox / option aria-selected) under a header that toggles the
// whole subject with a mixed state (docs/design-system.md §Selección sin
// checkboxes). The save payload keeps the permission-id model.
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const grouped = vi.hoisted(() => ({
  Product: [
    { id: 'p-read', action: 'read', description: null },
    { id: 'p-create', action: 'create', description: null },
    { id: 'p-update', action: 'update', description: null },
  ],
  Customer: [
    { id: 'c-read', action: 'read', description: null },
    { id: 'c-create', action: 'create', description: null },
  ],
}))

vi.mock('@tanstack/vue-query', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue')
  return {
    useQuery: () => ({
      data: ref(grouped),
      refetch: async () => ({ data: grouped }),
    }),
  }
})

vi.mock('../../api/roles.api', () => ({
  rolesApi: {
    getPermissionsGrouped: vi.fn(async () => grouped),
    getById: vi.fn(async () => ({
      id: 'role-1',
      permissions: [{ subject: 'Product', action: 'read' }],
    })),
  },
}))

import RolePermissionsSlideover from '../RolePermissionsSlideover.vue'

const USlideover = {
  name: 'USlideover',
  props: ['open'],
  template: '<div v-if="open"><slot name="body" /><slot name="footer" /></div>',
}

const role = {
  id: 'role-1',
  name: 'Cajero',
  description: null,
  isSystem: false,
  permissionCount: 1,
  userCount: 0,
  createdAt: '',
  updatedAt: '',
}

async function mountOpen() {
  const wrapper = mount(RolePermissionsSlideover, {
    props: { open: false, role },
    global: { stubs: { USlideover, Slideover: USlideover } },
  })
  await wrapper.setProps({ open: true })
  await flushPromises()
  return wrapper
}

const subjectHead = (w: Awaited<ReturnType<typeof mountOpen>>, label: string) =>
  w.findAll('button[aria-expanded]').find((b) => b.text().includes(label))!

describe('RolePermissionsSlideover', () => {
  it('has no classic checkbox anywhere', async () => {
    const wrapper = await mountOpen()
    for (const head of wrapper.findAll('button[aria-expanded]')) await head.trigger('click')
    expect(wrapper.findAll('[role="listbox"]')).toHaveLength(2)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.find('[role="checkbox"]').exists()).toBe(false)
  })

  it('opens a subject as a multiselect listbox with the role permissions selected', async () => {
    const wrapper = await mountOpen()
    const head = subjectHead(wrapper, 'Productos')
    expect(head.attributes('aria-expanded')).toBe('false')
    expect(head.text()).toContain('1 de 3')

    await head.trigger('click')
    expect(head.attributes('aria-expanded')).toBe('true')

    const listbox = wrapper.get('[role="listbox"]')
    expect(listbox.attributes('aria-multiselectable')).toBe('true')
    const options = listbox.findAll('[role="option"]')
    expect(options).toHaveLength(3)
    expect(options.map((o) => o.attributes('aria-selected'))).toEqual(['true', 'false', 'false'])
    // The raw permission code still reads under the human label.
    expect(options[0]!.text()).toContain('product:read')
  })

  it('toggles a permission from the whole row and saves the id model', async () => {
    const wrapper = await mountOpen()
    await subjectHead(wrapper, 'Productos').trigger('click')
    const options = () => wrapper.findAll('[role="option"]')

    await options()[1]!.trigger('click')
    expect(options()[1]!.attributes('aria-selected')).toBe('true')
    await options()[0]!.trigger('keydown', { key: ' ' })
    expect(options()[0]!.attributes('aria-selected')).toBe('false')

    await wrapper.findAll('button').find((b) => b.text() === 'Guardar permisos')!.trigger('click')
    expect(wrapper.emitted('save')).toEqual([[{ roleId: 'role-1', permissionIds: ['p-create'] }]])
  })

  it('has a mixed subject header that selects, then clears, every permission of the subject', async () => {
    const wrapper = await mountOpen()
    await subjectHead(wrapper, 'Productos').trigger('click')
    const group = () => wrapper.get('button[aria-pressed]')
    expect(group().text()).toContain('Productos')
    expect(group().attributes('aria-pressed')).toBe('mixed')

    await group().trigger('click')
    expect(group().attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('[role="option"]').every((o) => o.attributes('aria-selected') === 'true')).toBe(true)
    expect(subjectHead(wrapper, 'Productos').text()).toContain('3 de 3')

    await group().trigger('click')
    expect(group().attributes('aria-pressed')).toBe('false')
    expect(wrapper.text()).toContain('0 de 5 permisos seleccionados')
  })

  it('keeps the other subjects untouched when one subject changes', async () => {
    const wrapper = await mountOpen()
    await subjectHead(wrapper, 'Clientes').trigger('click')
    await wrapper.get('button[aria-pressed]').trigger('click')

    await wrapper.findAll('button').find((b) => b.text() === 'Guardar permisos')!.trigger('click')
    const [[payload]] = wrapper.emitted('save') as [[{ permissionIds: string[] }]]
    expect([...payload.permissionIds].sort()).toEqual(['c-create', 'c-read', 'p-read'])
  })
})
