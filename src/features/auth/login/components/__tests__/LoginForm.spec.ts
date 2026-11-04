// LoginForm.spec.ts — calm sign-in: a sentence-case title, labeled fields and
// one primary action, painted by the shared tokens (no brand literals).

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import LoginForm from '../LoginForm.vue'

describe('LoginForm', () => {
  it('shows the title and the labeled fields without help text', () => {
    const wrapper = mountWithUApp(LoginForm)

    expect(wrapper.get('h2').text()).toBe('Iniciar sesión')
    // Spanish label, never the English word.
    expect(wrapper.findAll('label')[0]!.text()).toBe('Correo electrónico')
    expect(wrapper.text()).not.toMatch(/\bEmail\b/)
    expect(wrapper.text()).toContain('Contraseña')
    expect(wrapper.text()).not.toContain('credenciales')
  })

  it('keeps a single primary action that uses the action role', () => {
    const wrapper = mountWithUApp(LoginForm)
    const submit = wrapper.get('button[type="submit"]')

    expect(submit.text()).toBe('Ingresar')
    expect(submit.classes().join(' ')).not.toMatch(/amber|neutral-950/)
    expect(wrapper.findAll('button[type="submit"]')).toHaveLength(1)
  })

  it('uses sentence-case field labels, not uppercase eyebrows', () => {
    const wrapper = mountWithUApp(LoginForm)

    expect(wrapper.html()).not.toContain('uppercase')
  })

  it('toggles the password visibility with a named button', async () => {
    const wrapper = mountWithUApp(LoginForm)
    const toggle = wrapper.get('button[aria-label="Mostrar contraseña"]')

    await toggle.trigger('click')

    expect(wrapper.get('#password').attributes('type')).toBe('text')
    expect(wrapper.find('button[aria-label="Ocultar contraseña"]').exists()).toBe(true)
  })

  it('lays its title and form out with a flex gap, not margins a reset can cancel', () => {
    const wrapper = mountWithUApp(LoginForm)

    expect(wrapper.classes()).toContain('hf-auth-form')
    expect(wrapper.html()).not.toMatch(/space-y-6/)
  })

  it('marks the primary busy while signing in and keeps it the action pairing', () => {
    const idle = mountWithUApp(LoginForm)
    const busy = mountWithUApp(LoginForm, { props: { loading: true } })

    expect(idle.get('button[type="submit"]').attributes('aria-busy')).toBeUndefined()
    const submit = busy.get('button[type="submit"]')
    expect(submit.attributes('aria-busy')).toBe('true')
    expect(submit.classes()).toContain('hf-primary-control')
  })
})
