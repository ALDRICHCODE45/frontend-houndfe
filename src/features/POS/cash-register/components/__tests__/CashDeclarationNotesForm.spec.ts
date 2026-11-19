/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashDeclarationNotesForm: append-only note after the declaration; one error
// summary plus the same message under the field; a polite status on success.
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import { nextTick, reactive } from 'vue'
import CashDeclarationNotesForm from '../CashDeclarationNotesForm.vue'

describe('CashDeclarationNotesForm', () => {
  it('emits the trimmed note and clears the field', async () => {
    const wrapper = mountWithUApp(CashDeclarationNotesForm, {})
    await wrapper.get('[data-testid="cash-declaration-notes-input"]').setValue('  Faltante de 20  ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([['Faltante de 20']])
    expect(wrapper.get('[data-testid="cash-declaration-notes-input"]').element.value).toBe('')
  })

  it('a blank note shows one focused summary linking to the field and the same message inline', async () => {
    const wrapper = mountWithUApp(CashDeclarationNotesForm, { attachTo: document.body })
    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.emitted('submit')).toBeUndefined()
    const summary = wrapper.get('[data-testid="cash-declaration-notes-summary"]')
    expect(summary.attributes('role')).toBe('alert')
    expect(document.activeElement).toBe(summary.element)
    const field = wrapper.get('[data-testid="cash-declaration-notes-input"]')
    expect(summary.get('a').attributes('href')).toBe(`#${field.attributes('id')}`)
    expect(field.attributes('aria-invalid')).toBe('true')
    const inline = wrapper.get('[data-testid="cash-declaration-notes-local-error"]')
    expect(inline.text()).toBe(summary.get('a').text())
    expect(field.attributes('aria-describedby')).toContain(inline.attributes('id'))
  })

  it('shows the server error in the summary only', () => {
    const wrapper = mountWithUApp(CashDeclarationNotesForm, {
      props: { errorMessage: 'No se pudo agregar la nota.' },
    })
    const summary = wrapper.get('[data-testid="cash-declaration-notes-summary"]')
    expect(summary.get('[data-testid="cash-declaration-notes-error"]').text()).toBe(
      'No se pudo agregar la nota.',
    )
    expect(wrapper.text().split('No se pudo agregar la nota.')).toHaveLength(2)
  })

  it('announces the added note through a polite status once the submit settles', async () => {
    const props = reactive({ submitting: true })
    const wrapper = mountWithUApp(CashDeclarationNotesForm, { props })
    props.submitting = false
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 5))
    const status = wrapper.get('[data-testid="cash-declaration-notes-status"]')
    expect(status.attributes('role')).toBe('status')
    expect(status.text()).toMatch(/Nota agregada/)
  })

  it('uses a 44px multi-line field and submit', () => {
    const wrapper = mountWithUApp(CashDeclarationNotesForm, {})
    expect(wrapper.get('[data-testid="cash-declaration-notes-input"]').element.tagName).toBe('TEXTAREA')
    expect(wrapper.get('[data-testid="cash-declaration-notes-submit"]').classes()).toContain('min-h-11')
  })
})
