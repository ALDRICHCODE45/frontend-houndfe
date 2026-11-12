// Save bar, page banners and side index.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSaveBar from '../SettingsSaveBar.vue'
import SettingsBanners from '../SettingsBanners.vue'
import SettingsSideIndex from '../SettingsSideIndex.vue'
import type { DiffItem } from '../../utils/settingsDraft'

const items = (n: number): DiffItem[] =>
  Array.from({ length: n }, (_, i) => ({ sec: 'hours', key: `h:${i}`, label: `Cambio ${i + 1}` }))

function mountBar(props: Record<string, unknown> = {}) {
  return mount(SettingsSaveBar, {
    props: { items: [], creating: false, saving: false, saved: false, version: 3, errorCount: 0, showErrors: false, ...props },
  })
}

describe('SettingsSaveBar', () => {
  it('is hidden when nothing changed and nothing was just saved', () => {
    expect(mountBar().find('[data-testid="save-bar"]').exists()).toBe(false)
  })

  it('dirty: counts the changes, names the first three and offers Descartar and Guardar', async () => {
    const w = mountBar({ items: items(5) })
    expect(w.get('[data-testid="dirty-count"]').text()).toBe('5 cambios sin guardar')
    expect(w.text()).toContain('Cambio 1, Cambio 2, Cambio 3 y 2 más')
    await w.get('[data-testid="save"]').trigger('click')
    await w.get('[data-testid="discard"]').trigger('click')
    expect(w.emitted('save')).toHaveLength(1)
    expect(w.emitted('discard')).toHaveLength(1)
    expect(mountBar({ items: items(1) }).get('[data-testid="dirty-count"]').text()).toBe('1 cambio sin guardar')
  })

  it('saved: «Todo guardado» with the version and no actions', () => {
    const w = mountBar({ saved: true, version: 4 })
    expect(w.text()).toContain('Todo guardado')
    expect(w.text()).toContain('Versión 4')
    expect(w.find('[data-testid="save"]').exists()).toBe(false)
  })

  it('saving: blocks both buttons', () => {
    const w = mountBar({ items: items(1), saving: true })
    expect(w.text()).toContain('Guardando')
    expect(w.get('[data-testid="save"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="discard"]').attributes('disabled')).toBeDefined()
  })

  it('invalid after a refused save: says how many fields to fix', () => {
    const w = mountBar({ items: items(1), errorCount: 2, showErrors: true })
    expect(w.get('[data-testid="save-bar"]').attributes('data-state')).toBe('invalid')
    expect(w.text()).toContain('2 campos por corregir')
  })

  it('version 0 with nothing edited still offers «Guardar configuración» and no Descartar', () => {
    const w = mountBar({ creating: true, version: 0 })
    expect(w.text()).toContain('Sin guardar todavía')
    expect(w.get('[data-testid="save"]').text()).toBe('Guardar configuración')
    expect(w.find('[data-testid="discard"]').exists()).toBe(false)
  })
})

function mountBanners(props: Record<string, unknown> = {}) {
  return mount(SettingsBanners, {
    props: {
      readonly: false,
      creating: false,
      notice: null,
      version: 4,
      conflictVersion: null,
      errors: {},
      showErrors: false,
      ...props,
    },
  })
}

describe('SettingsBanners', () => {
  it('shows nothing on a clean editable screen', () => {
    const w = mountBanners()
    expect(w.find('.cbs-alert').exists()).toBe(false)
    expect(w.find('.cbs-checklist').exists()).toBe(false)
  })

  it('read-only banner and version 0 defaults banner', () => {
    expect(mountBanners({ readonly: true }).get('[data-testid="readonly-banner"]').text()).toContain('Solo lectura')
    const defaults = mountBanners({ creating: true }).get('[data-testid="defaults-banner"]')
    expect(defaults.text()).toContain('aún no tiene configuración propia')
    expect(defaults.text()).toContain('versión 0')
  })

  it('FAILED recompute says it was saved and the version, with no retry', () => {
    const w = mountBanners({ notice: 'failed' })
    const notice = w.get('[data-testid="notice-failed"]')
    expect(notice.text()).toContain('Guardado; los plazos de las solicitudes abiertas se actualizarán más tarde')
    expect(notice.text()).toContain('versión 4')
    expect(w.find('[data-testid="notice-retry"]').exists()).toBe(false)
  })

  it('a generic error offers retry and a 400 names no field', async () => {
    const w = mountBanners({ notice: 'error' })
    await w.get('[data-testid="notice-retry"]').trigger('click')
    expect(w.emitted('retry-save')).toHaveLength(1)
    await w.get('[data-testid="notice-close"]').trigger('click')
    expect(w.emitted('close-notice')).toHaveLength(1)

    const validation = mountBanners({ notice: 'validation' }).get('[data-testid="notice-validation"]').text()
    expect(validation).toContain('Revisa los campos')
    expect(validation).not.toMatch(/horario|plazo|fecha/i)
  })

  it('the 409 banner keeps the draft, names the version and opens «Ver cambios»', async () => {
    const w = mountBanners({ conflictVersion: 5 })
    const banner = w.get('[data-testid="conflict-banner"]')
    expect(banner.text()).toContain('Otra persona guardó cambios antes que tú')
    expect(banner.text()).toContain('versión 5')
    expect(banner.text()).toContain('Tus cambios siguen aquí')
    await w.get('[data-testid="conflict-open"]').trigger('click')
    expect(w.emitted('open-conflict')).toHaveLength(1)
  })

  it('the checklist lists the fields to fix and jumps to them', async () => {
    const w = mountBanners({
      showErrors: true,
      errors: { 'h:MONDAY': 'Completa la hora.', 's:COMPLAINT:resolve': 'Resolver no puede ser antes.', 'x:window': 'Usa un valor entre 0 min y 24 h.' },
    })
    const list = w.get('[data-testid="error-checklist"]')
    expect(list.text()).toContain('3 campos por corregir antes de guardar')
    expect(list.text()).toContain('Lunes: horario')
    expect(list.text()).toContain('Queja: resolver')
    await list.findAll('a')[1]!.trigger('click')
    expect(w.emitted('goto')![0]).toEqual(['s-COMPLAINT-resolve'])
  })

  it('does not show the checklist until a save was refused', () => {
    expect(mountBanners({ errors: { 'x:window': 'x' } }).find('[data-testid="error-checklist"]').exists()).toBe(false)
  })
})

describe('SettingsSideIndex', () => {
  const sections = [
    { id: 'hours', label: 'Horario de atención', icon: 'i-lucide-clock', dirty: true, errors: 0 },
    { id: 'dates', label: 'Fechas cerradas', icon: 'i-lucide-calendar-x', dirty: false, errors: 2 },
    { id: 'sla', label: 'Plazos por tipo', icon: 'i-lucide-timer', dirty: false, errors: 0 },
  ]

  it('lists the sections in order, with a dot when modified and a count when invalid', () => {
    const w = mount(SettingsSideIndex, { props: { sections } })
    expect(w.findAll('li a').map((a) => a.attributes('href'))).toEqual(['#sec-hours', '#sec-dates', '#sec-sla'])
    expect(w.get('[data-testid="index-hours"] .cbs-index__dot').attributes('aria-label')).toBe('Modificado')
    expect(w.get('[data-testid="index-dates"] .cbs-index__count').text()).toBe('2')
    expect(w.find('[data-testid="index-sla"] .cbs-index__dot').exists()).toBe(false)
  })

  it('navigates without leaving the page', async () => {
    const w = mount(SettingsSideIndex, { props: { sections } })
    await w.get('[data-testid="index-dates"]').trigger('click')
    expect(w.emitted('navigate')![0]).toEqual(['sec-dates'])
  })
})
