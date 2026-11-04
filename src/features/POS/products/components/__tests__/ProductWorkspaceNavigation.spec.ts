import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductWorkspaceNavigation from '../ProductWorkspaceNavigation.vue'

const source = readFileSync(resolve(__dirname, '../ProductWorkspaceNavigation.vue'), 'utf8')

describe('ProductWorkspaceNavigation', () => {
  it('lists the four tasks and marks the active one', () => {
    const wrapper = mount(ProductWorkspaceNavigation, { props: { activeTask: 'presentations' } })
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual([
      'Identidad',
      'Presentaciones',
      'Contenido',
      'Revisar',
    ])
    expect(wrapper.get('[data-task="presentations"]').attributes('aria-current')).toBe('page')
  })

  it('gives every tab its own horizontal padding so long labels never touch at 390', () => {
    // Four equal `minmax(0, 1fr)` columns left "Presentaciones" and "Contenido" touching.
    expect(source).not.toMatch(/grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
    expect(source).toMatch(/\.product-task-button\s*\{[^}]*padding:\s*12px 8px/)
  })
})
