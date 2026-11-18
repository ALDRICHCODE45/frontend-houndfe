// RecipientSelect.spec.ts — users to notify as selectable rows with a mark
// (HfSelectableRows listbox): search, live count, required/field error,
// unavailable users kept and removable, loading and load-error states.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import RecipientSelect from '../RecipientSelect.vue'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'

const ASSIGNABLE: AssignableUser[] = [
  { id: 'u1', name: 'Ana Ruiz' },
  { id: 'u2', name: 'Bruno Gil' },
  { id: 'u3', name: 'Carla Peña' },
]

function mountSelect(props: Record<string, unknown> = {}) {
  return mountWithUApp(RecipientSelect, {
    props: { modelValue: [], assignable: ASSIGNABLE, ...props },
  })
}

const options = (wrapper: ReturnType<typeof mountSelect>) => wrapper.findAll('[role="option"]')

describe('RecipientSelect — listbox', () => {
  it('is a multiselect listbox named «Usuarios a notificar» with one option per user, no checkbox', () => {
    const wrapper = mountSelect({ modelValue: ['u2'] })
    const list = wrapper.get('[role="listbox"]')
    expect(list.attributes('aria-multiselectable')).toBe('true')
    expect(list.attributes('aria-label')).toBe('Usuarios a notificar')
    expect(options(wrapper).map((o) => o.text())).toEqual([
      expect.stringContaining('Ana Ruiz'),
      expect.stringContaining('Bruno Gil'),
      expect.stringContaining('Carla Peña'),
    ])
    expect(options(wrapper).map((o) => o.attributes('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('shows the live count of available selected users', () => {
    const wrapper = mountSelect({ modelValue: ['u1', 'u3', 'gone'] })
    expect(wrapper.get('.hf-selectable-rows__count').text()).toBe('2 de 3 seleccionados')
  })

  it('emits the next ids when a row is clicked, keeping an unavailable id', async () => {
    const wrapper = mountSelect({ modelValue: ['gone'] })
    await options(wrapper)[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['u1', 'gone']])
  })

  it('filters by search without losing selected users that are hidden', async () => {
    const wrapper = mountSelect({ modelValue: ['u1'] })
    await wrapper.get('[data-testid="recipient-search"] input').setValue('carla')
    expect(options(wrapper).map((o) => o.text())).toEqual([expect.stringContaining('Carla Peña')])
    await options(wrapper)[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['u3', 'u1']])
  })

  it('says when the search finds nobody', async () => {
    const wrapper = mountSelect()
    await wrapper.get('[data-testid="recipient-search"] input').setValue('zz')
    expect(wrapper.text()).toContain('Ningún usuario para «zz»')
  })

  it('shows the error under the list, linked and marking the list invalid', () => {
    const wrapper = mountSelect({ error: 'Selecciona al menos un usuario a notificar' })
    const list = wrapper.get('[role="listbox"]')
    expect(list.attributes('aria-invalid')).toBe('true')
    const ids = list.attributes('aria-describedby')!.split(' ')
    expect(ids.map((id) => wrapper.get(`[id="${id}"]`).text())).toContain(
      'Selecciona al menos un usuario a notificar',
    )
  })

  it('disables every row when disabled', () => {
    const wrapper = mountSelect({ disabled: true })
    expect(options(wrapper).every((o) => o.attributes('aria-disabled') === 'true')).toBe(true)
  })

  it('says there are no users to assign when the list is empty', () => {
    const wrapper = mountSelect({ assignable: [] })
    expect(wrapper.text()).toContain('No hay usuarios para asignar')
  })
})

describe('RecipientSelect — unavailable user', () => {
  it('keeps the unavailable id as a marked row with Quitar, never removed on its own', async () => {
    const wrapper = mountSelect({ modelValue: ['u1', 'gone'] })
    const stale = wrapper.get('[data-testid="recipient-stale-gone"]')
    expect(stale.text()).toContain('Usuario no disponible')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await stale.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['u1']])
  })
})

describe('RecipientSelect — loading and load error', () => {
  it('loading: a status with skeleton rows and no listbox or unavailable rows', () => {
    const wrapper = mountSelect({ loading: true, modelValue: ['gone'] })
    const loading = wrapper.get('[data-testid="recipient-loading"]')
    expect(loading.attributes('role')).toBe('status')
    expect(loading.findAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Usuario no disponible')
  })

  it('load error: an alert with Reintentar that emits retry, and no unavailable rows', async () => {
    const wrapper = mountSelect({ loadError: true, modelValue: ['gone'] })
    const alert = wrapper.get('[data-testid="recipient-load-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('No se pudieron cargar los usuarios')
    expect(wrapper.text()).not.toContain('Usuario no disponible')
    await wrapper.get('[data-testid="recipient-retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
