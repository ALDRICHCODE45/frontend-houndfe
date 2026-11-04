import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import Drawer from '../EditorialHistoryDrawer.vue'

const source = readFileSync(resolve(__dirname, '../EditorialHistoryDrawer.vue'), 'utf8')
const tick = () => new Promise(resolve => setTimeout(resolve, 80))
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(stop => stop()); document.body.innerHTML = '' })

async function open(props: Record<string, unknown> = {}) {
  const wrapper = mount(Drawer, { attachTo: document.body, props: { open: true, hasDraft: true, hasPublished: true, savedAt: null, changes: [], warnings: [], ...props } })
  cleanup.push(() => wrapper.unmount())
  await tick()
  return wrapper
}
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const text = () => dialog().textContent ?? ''

describe('EditorialHistoryDrawer', () => {
  it('is a right-side slideover titled Historial, with the hf theme classes and a width of its own', async () => {
    await open()
    expect(dialog()).not.toBeNull()
    expect(text()).toContain('Historial')
    expect(dialog().className).toContain('hf-theme')
    expect(dialog().className).toContain('hf-ui')
    expect(dialog().className).toContain('hf-form-overlay')
    expect(source).toMatch(/side="right"/)
    expect(source).toMatch(/max-w-(?:lg|xl|2xl)/)
    expect(source).not.toMatch(/\buppercase\b|tracking-/)
  })

  it('says when the draft was saved, in the short date format, without cycles, revisions or ids', async () => {
    const savedAt = new Date()
    await open({ savedAt })
    expect(text()).toContain(`Guardado el ${formatShortDateTime(savedAt)}`)
    expect(text()).toMatch(/Guardado el \d{1,2} [a-záéíóú]+\.?(?: \d{4})?, \d{2}:\d{2}/)
    expect(text()).not.toMatch(/ciclo|revisi[oó]n|acuse|id\b/i)
  })

  it('does not invent a date it does not have', async () => {
    await open({ savedAt: null })
    expect(text()).toContain('Borrador')
    expect(text()).not.toMatch(/Guardado el/)
  })

  it('lists the draft and the published version as a timeline', async () => {
    await open()
    const items = Array.from(dialog().querySelectorAll('[data-testid="history-timeline"] > li')).map(item => item.textContent ?? '')
    expect(items).toHaveLength(2)
    expect(items[0]).toContain('Borrador')
    expect(items[1]).toContain('Versión publicada')
  })

  it('leaves out what does not exist', async () => {
    await open({ hasDraft: false, hasPublished: true })
    const items = Array.from(dialog().querySelectorAll('[data-testid="history-timeline"] > li'))
    expect(items).toHaveLength(1)
    expect(items[0]!.textContent).toContain('Versión publicada')
  })

  it('names each version once, with a plain line of what it is, instead of repeating the name in a badge', async () => {
    await open({ savedAt: new Date() })
    const items = Array.from(dialog().querySelectorAll('[data-testid="history-timeline"] > li')).map(item => item.textContent ?? '')
    expect(items[0]!.match(/Borrador/g)).toHaveLength(1)
    expect(items[1]!.match(/Versión publicada/g)).toHaveLength(1)
    expect(items[0]).toContain('Lo que guardas con «Guardar»')
    expect(items[1]).toContain('Lo que verá el catálogo')
    expect(dialog().querySelector('.hf-status-badge')).toBeNull()
  })

  it('explains, in a note of its own, why there is nothing to compare yet', async () => {
    await open({ hasPublished: false })
    const note = dialog().querySelector('[data-testid="history-empty"]')!
    expect(note.textContent).toContain('Aún no hay una versión publicada con la que comparar.')
    expect(note.textContent).toContain('Cuando la haya, aquí verás en qué cambia tu borrador.')
  })

  it('paints the empty-comparison block neutral: muted surface, solid --hf-border, no tint and no dashes', () => {
    const rule = source.match(/\.history__empty\s*\{([^}]*)\}/)![1]!
    expect(rule).toMatch(/background:\s*var\(--hf-surface-muted\)/)
    expect(rule).toMatch(/border:\s*1px solid var\(--hf-border\)/)
    expect(rule).not.toMatch(/dashed|dotted|color-mix|rgb|#[0-9a-f]{3,8}\b|--hf-(?:action|active|info)/i)
  })

  it('compares in two columns, Publicado and Borrador, and only the changed fields', async () => {
    await open({ changes: [
      { key: 'title', label: 'Título comercial', before: 'Pro Plan Adulto 15 kg', after: 'Alimento Premium 15 kg' },
      { key: 'v', label: 'Especie', before: null, after: 'Perro' },
    ] })
    const heads = Array.from(dialog().querySelectorAll('[data-testid="history-diff-head"] span')).map(item => item.textContent)
    expect(heads).toEqual(['Publicado', 'Borrador'])
    const rows = Array.from(dialog().querySelectorAll('[data-testid="history-diff"] > li'))
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain('Título comercial')
    expect(rows[0]!.querySelector('[data-column="before"]')!.textContent).toContain('Pro Plan Adulto 15 kg')
    expect(rows[0]!.querySelector('[data-column="after"]')!.textContent).toContain('Alimento Premium 15 kg')
  })

  it('shows a dash with a spoken reason for a side that has no value', async () => {
    await open({ changes: [{ key: 'v', label: 'Especie', before: null, after: 'Perro' }] })
    const before = dialog().querySelector('[data-column="before"]')!
    expect(before.textContent).toContain('—')
    expect(before.textContent).toContain('Sin dato')
  })

  it('says there is nothing to compare when nothing is published', async () => {
    await open({ hasPublished: false, changes: [{ key: 'title', label: 'Título comercial', before: null, after: 'Nuevo' }] })
    expect(text()).toContain('Aún no hay una versión publicada con la que comparar.')
    expect(dialog().querySelector('[data-testid="history-diff"]')).toBeNull()
  })

  it('says the draft equals the published version when nothing changed', async () => {
    await open({ changes: [] })
    expect(text()).toContain('El borrador es igual a lo publicado.')
  })

  it('keeps the archived-option notes in plain words, off the main view', async () => {
    await open({ warnings: ['Alimento · Especie · Conejo · Producto'] })
    expect(text()).toContain('Opciones archivadas que se conservaron')
    expect(text()).toContain('Alimento · Especie · Conejo · Producto')
  })

  it('has no notes section without warnings', async () => {
    await open()
    expect(text()).not.toContain('Opciones archivadas')
  })

  it('closes from its own close button', async () => {
    const wrapper = await open()
    document.querySelector<HTMLButtonElement>('[aria-label="Cerrar historial"]')!.click()
    await tick()
    expect(wrapper.emitted('update:open')?.slice(-1)[0]).toEqual([false])
  })
})
