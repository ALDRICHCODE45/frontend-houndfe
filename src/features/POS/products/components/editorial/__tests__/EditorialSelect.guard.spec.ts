import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The editorial editor picks from lists with Nuxt UI (EditorialSelect), never a native <select>, and
// every empty list says the same thing: "Elige…".
const root = resolve(__dirname, '..')
const sources = readdirSync(root).filter(name => name.endsWith('.vue')).map(name => [name, readFileSync(join(root, name), 'utf8')] as const)
const uncommented = (text: string) => text.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('editorial lists', () => {
  it('has no native <select> in any editorial component', () => {
    expect(sources.filter(([, text]) => /<select\b/.test(uncommented(text))).map(([name]) => name)).toEqual([])
  })

  it('only EditorialSelect talks to Nuxt UI lists, and it themes the listbox for dark mode', () => {
    expect(sources.filter(([name, text]) => !name.startsWith('EditorialSelect') && /<U(?:Select|SelectMenu)\b/.test(text)).map(([name]) => name)).toEqual([])
    const select = sources.find(([name]) => name === 'EditorialSelect.vue')![1]
    const menu = sources.find(([name]) => name === 'EditorialSelectMenu.vue')![1]
    expect(select).toMatch(/<USelect\b/)
    expect(menu).toMatch(/<USelectMenu\b/)
    for (const text of [select, menu]) expect(text).toMatch(/content = 'hf-theme hf-ui'/)
  })

  it('uses one placeholder, "Elige…", and no other spelling of it', () => {
    const offenders = sources.flatMap(([name, text]) => uncommented(text).split('\n')
      .filter(line => /\bElegir\b|'Elige'|>Elige<|Selecciona un[a]? (?:valor|disposición|determinación|divulgación)|Elige una (?:declaración|presentación)/.test(line))
      .map(line => `${name}: ${line.trim()}`))
    expect(offenders).toEqual([])
    for (const name of ['EditorialSelect.vue', 'EditorialSelectMenu.vue']) expect(sources.find(([file]) => file === name)![1]).toContain("placeholder: 'Elige…'")
  })

  it('confirms the family change with ConfirmModal, never window.confirm', () => {
    const family = sources.find(([name]) => name === 'EditorialContractFamilyField.vue')![1]
    expect(family).toContain('<ConfirmModal')
    expect(uncommented(family)).not.toMatch(/window\.confirm|\bconfirm\(/)
  })
})
