import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The editorial editor picks from lists with the shared HfCombobox (T13), never a native <select> nor a
// Nuxt UI list of its own, and no list spells its empty state another way.
const root = resolve(__dirname, '..')
const sources = readdirSync(root).filter(name => name.endsWith('.vue')).map(name => [name, readFileSync(join(root, name), 'utf8')] as const)
const uncommented = (text: string) => text.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('editorial lists', () => {
  it('has no native <select> in any editorial component', () => {
    expect(sources.filter(([, text]) => /<select\b/.test(uncommented(text))).map(([name]) => name)).toEqual([])
  })

  it('never talks to Nuxt UI lists directly: lists are the shared HfCombobox', () => {
    expect(sources.filter(([, text]) => /<U(?:Select|SelectMenu)\b/.test(text)).map(([name]) => name)).toEqual([])
    for (const name of ['EditorialAttributeField.vue', 'EditorialPresentationSection.vue', 'EditorialContractFamilyField.vue'])
      expect(sources.find(([file]) => file === name)![1]).toContain('<HfCombobox')
  })

  it('uses no other spelling of the empty-list placeholder', () => {
    const offenders = sources.flatMap(([name, text]) => uncommented(text).split('\n')
      .filter(line => /\bElegir\b|'Elige'|>Elige<|Elige…|Selecciona un[a]? (?:valor|disposición|determinación|divulgación)|Elige una (?:declaración|presentación)/.test(line))
      .map(line => `${name}: ${line.trim()}`))
    expect(offenders).toEqual([])
  })

  it('confirms the family change with ConfirmModal, never window.confirm', () => {
    const family = sources.find(([name]) => name === 'EditorialContractFamilyField.vue')![1]
    expect(family).toContain('<ConfirmModal')
    expect(uncommented(family)).not.toMatch(/window\.confirm|\bconfirm\(/)
  })
})
