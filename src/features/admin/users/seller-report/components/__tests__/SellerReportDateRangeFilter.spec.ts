// SellerReportDateRangeFilter.spec.ts — report-local Nuxt UI calendar controls
// for the seller report `[from, to)` window.
//
// These tests render the REAL `@nuxt/ui` `UPopover` / `UInputDate` / `UCalendar`
// components (no component stubs), so a wiring regression — dropping the model
// binding, mis-mapping an emit, or converting a picked day through a JS `Date` —
// fails here. Mutation-sensitive: restoring a native `<input type="date">`,
// emitting a partial/cleared field, shifting a boundary across a timezone,
// dropping a preset, losing the inclusive/exclusive copy, or leaving a control
// enabled while disabled/loading fails at least one test.
//
// The visible control is Nuxt UI's segmented calendar field (contenteditable
// month/day/year segments + a popover calendar). Reka's DateField keeps one
// `aria-hidden`, `tabindex="-1"` `<input type="date">` as an invisible form
// mirror; that hidden node is not a native date control, so the "no native date
// input" assertion targets visible inputs only.

import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import {
  MEXICO_CITY_RANGE_PRESET_IDS,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'
import SellerReportDateRangeFilter from '../SellerReportDateRangeFilter.vue'

const FROM_TESTID = 'seller-report-filter-from'
const TO_TESTID = 'seller-report-filter-to'
const BOUNDARY_TESTIDS = [FROM_TESTID, TO_TESTID] as const
const CALENDAR_TESTIDS = [
  'seller-report-filter-from-calendar',
  'seller-report-filter-to-calendar',
] as const

const PRESET_LABELS: Record<MexicoCityRangePresetId, string> = {
  today: 'Hoy',
  last7Days: 'Últimos 7 días',
  thisMonth: 'Este mes',
  previousMonth: 'Mes anterior',
}

const wrappers: VueWrapper[] = []

function mountFilter(props: Record<string, unknown> = {}) {
  const wrapper = mount(SellerReportDateRangeFilter, {
    props: { from: '2025-03-01', to: '2025-04-01', ...props },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return wrapper
}

/** Open a boundary's popover so its real `UCalendar` content mounts. */
async function openCalendar(wrapper: ReturnType<typeof mountFilter>, testid: string) {
  await wrapper.find(`[data-testid="${testid}"]`).trigger('click')
  await flushPromises()
}

function calendarHost(testid: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testid}"]`)
}

/** Click a real calendar day cell by its `YYYY-MM-DD` value. */
async function pickDay(testid: string, iso: string) {
  const cell = document.body.querySelector<HTMLElement>(
    `[data-testid="${testid}"] [data-value="${iso}"]`,
  )
  if (!cell) {
    throw new Error(`calendar cell ${iso} was not rendered`)
  }
  cell.click()
  await flushPromises()
}

function preset(wrapper: ReturnType<typeof mountFilter>, id: MexicoCityRangePresetId) {
  return wrapper.find(`[data-testid="seller-report-filter-preset"][data-preset-id="${id}"]`)
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

/** The field's own (hidden) form control is where Nuxt UI puts the label target. */
function labelledControl(wrapper: ReturnType<typeof mountFilter>, testid: string) {
  return wrapper.find(`[data-testid="${testid}"] input[type="date"]`)
}

describe('SellerReportDateRangeFilter — Nuxt UI calendar controls', () => {
  it('renders Nuxt UI segmented calendar fields and no visible native date input', () => {
    const wrapper = mountFilter()

    // The only `type="date"` node is reka's hidden, non-focusable form mirror.
    expect(wrapper.findAll('input[type="date"]:not([aria-hidden="true"])')).toHaveLength(0)

    for (const testid of BOUNDARY_TESTIDS) {
      const field = wrapper.find(`[data-testid="${testid}"]`)
      expect(field.exists()).toBe(true)
      // The Nuxt UI InputDate owns the segmented calendar field (month/day/year).
      expect(field.findAll('[data-reka-date-field-segment]')).toHaveLength(5)
      expect(field.find('[data-segment="month"]').attributes('contenteditable')).toBe('true')
      expect(field.find('[data-segment="day"]').attributes('contenteditable')).toBe('true')
      expect(field.find('[data-segment="year"]').attributes('contenteditable')).toBe('true')
    }
  })

  it('wires each Nuxt UI date field to its inclusive/exclusive label', () => {
    const wrapper = mountFilter()
    const labels = wrapper.findAll('label')

    expect(labels.map((label) => label.text())).toEqual([
      'Desde (incluyente)',
      'Hasta (excluyente)',
    ])

    for (const [index, testid] of BOUNDARY_TESTIDS.entries()) {
      // `for` targets the field's form control; the segmented group takes its
      // accessible name from the same visible label text.
      expect(labels[index]!.attributes('for')).toBe(
        labelledControl(wrapper, testid).attributes('id'),
      )
      expect(wrapper.find(`[data-testid="${testid}"]`).attributes('aria-labelledby')).toBe(
        labels[index]!.attributes('id'),
      )
    }

    expect(wrapper.text()).toContain('El rango incluye el día «Desde» y excluye el día «Hasta».')
  })

  it('stacks the two boundaries into one column on small screens and two on sm+', () => {
    const wrapper = mountFilter()
    const grid = wrapper.find('[data-testid="seller-report-filter-boundaries"]')

    expect(grid.exists()).toBe(true)
    expect(grid.classes()).toContain('grid-cols-1')
    expect(grid.classes()).toContain('sm:grid-cols-2')
  })
})

describe('SellerReportDateRangeFilter — emitted calendar values', () => {
  it('emits the exact inclusive boundary picked in the real calendar', async () => {
    const wrapper = mountFilter()

    await openCalendar(wrapper, FROM_TESTID)
    expect(calendarHost(CALENDAR_TESTIDS[0])).not.toBeNull()
    await pickDay(CALENDAR_TESTIDS[0], '2025-03-15')

    expect(wrapper.emitted('update:from')).toEqual([['2025-03-15']])
    expect(wrapper.emitted('update:to')).toBeUndefined()
  })

  it('emits the exact exclusive boundary from the second calendar', async () => {
    const wrapper = mountFilter()

    await openCalendar(wrapper, TO_TESTID)
    expect(calendarHost(CALENDAR_TESTIDS[1])).not.toBeNull()
    await pickDay(CALENDAR_TESTIDS[1], '2025-04-10')

    expect(wrapper.emitted('update:to')).toEqual([['2025-04-10']])
    expect(wrapper.emitted('update:from')).toBeUndefined()
  })

  it('keeps a month-boundary day intact, with no timezone shift', async () => {
    const wrapper = mountFilter({ from: '2025-03-05' })

    await openCalendar(wrapper, FROM_TESTID)
    await pickDay(CALENDAR_TESTIDS[0], '2025-03-01')

    // Parsing the picked day through a JS `Date` and reading local calendar
    // parts would collapse this to 2025-02-28 in UTC-negative zones; the
    // contract stays exact calendar arithmetic.
    expect(wrapper.emitted('update:from')).toEqual([['2025-03-01']])
  })

  it('marks the edited boundary as a custom selection through the emitted contract only', async () => {
    const wrapper = mountFilter({ activePreset: 'thisMonth' })

    await openCalendar(wrapper, FROM_TESTID)
    await pickDay(CALENDAR_TESTIDS[0], '2025-03-20')

    // The component never re-selects a preset locally; the caller owns that.
    expect(wrapper.emitted('update:from')).toEqual([['2025-03-20']])
    expect(wrapper.emitted('preset')).toBeUndefined()
    expect(preset(wrapper, 'thisMonth').attributes('aria-pressed')).toBe('true')
  })

  it('accepts a complete calendar date from the real Nuxt UI input binding', () => {
    const wrapper = mountFilter()
    const input = wrapper.findComponent({ name: 'InputDate' })

    expect(input.exists()).toBe(true)
    expect((input.props('modelValue') as CalendarDate).toString()).toBe('2025-03-01')

    input.vm.$emit('update:modelValue', new CalendarDate(2025, 5, 9))

    expect(wrapper.emitted('update:from')).toEqual([['2025-05-09']])
  })
})

describe('SellerReportDateRangeFilter — partial/invalid input guard', () => {
  it('never emits a cleared field: partial input cannot silently change the window', async () => {
    const wrapper = mountFilter()
    const input = wrapper.findComponent({ name: 'InputDate' })

    input.vm.$emit('update:modelValue', undefined)
    await nextTick()

    expect(wrapper.emitted('update:from')).toBeUndefined()
    // The field still shows the last committed boundary, so the guard is visible.
    expect(wrapper.find(`[data-testid="${FROM_TESTID}"]`).text()).toContain('2025')
  })

  it('refuses incomplete or impossible calendar objects instead of emitting them', async () => {
    const wrapper = mountFilter()
    const input = wrapper.findComponent({ name: 'InputDate' })

    input.vm.$emit('update:modelValue', null)
    input.vm.$emit('update:modelValue', { year: 2025, month: 3 })
    input.vm.$emit('update:modelValue', '2025-03-15')
    await nextTick()

    expect(wrapper.emitted('update:from')).toBeUndefined()
  })

  it('keeps the other boundary and the active preset untouched when one field is cleared', async () => {
    const wrapper = mountFilter({ activePreset: 'last7Days' })

    wrapper.findComponent({ name: 'InputDate' }).vm.$emit('update:modelValue', undefined)
    await nextTick()

    expect(wrapper.emitted('update:from')).toBeUndefined()
    expect(wrapper.emitted('preset')).toBeUndefined()
    expect(preset(wrapper, 'last7Days').attributes('aria-pressed')).toBe('true')
  })

  it('refuses complete but impossible dates instead of silently constraining them', async () => {
    // `new CalendarDate` would normalize every one of these into a different
    // real day (2025-02-30 -> 2025-02-28, month 0 -> January, month 13 ->
    // December), silently changing the requested window instead of refusing.
    const impossible: Array<Record<string, number>> = [
      { year: 2025, month: 2, day: 30 },
      { year: 2025, month: 2, day: 29 },
      { year: 2025, month: 4, day: 31 },
      { year: 2025, month: 0, day: 15 },
      { year: 2025, month: 13, day: 15 },
      { year: 2025, month: 1, day: 0 },
      { year: 2025, month: 1, day: 32 },
    ]

    const wrapper = mountFilter()
    const input = wrapper.findComponent({ name: 'InputDate' })

    for (const parts of impossible) {
      input.vm.$emit('update:modelValue', parts)
    }
    await nextTick()

    expect(wrapper.emitted('update:from')).toBeUndefined()
    // The field still shows the last committed boundary.
    expect(wrapper.find(`[data-testid="${FROM_TESTID}"]`).text()).toContain('2025')
  })

  it('still accepts a real leap day without constraining it', async () => {
    const wrapper = mountFilter()
    const input = wrapper.findComponent({ name: 'InputDate' })

    input.vm.$emit('update:modelValue', { year: 2024, month: 2, day: 29 })
    await nextTick()

    expect(wrapper.emitted('update:from')).toEqual([['2024-02-29']])
  })
})

describe('SellerReportDateRangeFilter — presets', () => {
  it('keeps the four committed presets, in order, with their committed labels', () => {
    const wrapper = mountFilter()

    for (const id of MEXICO_CITY_RANGE_PRESET_IDS) {
      const button = preset(wrapper, id)
      expect(button.exists()).toBe(true)
      expect(button.text()).toBe(PRESET_LABELS[id])
    }
  })

  it('emits every exact preset id and never a locally computed date', async () => {
    const wrapper = mountFilter()

    for (const id of MEXICO_CITY_RANGE_PRESET_IDS) {
      await preset(wrapper, id).trigger('click')
    }

    expect(wrapper.emitted('preset')).toEqual(MEXICO_CITY_RANGE_PRESET_IDS.map((id) => [id]))
    expect(wrapper.emitted('update:from')).toBeUndefined()
    expect(wrapper.emitted('update:to')).toBeUndefined()
  })

  it('exposes aria-pressed only on the caller-owned active preset', () => {
    const wrapper = mountFilter({ activePreset: 'previousMonth' })

    for (const id of MEXICO_CITY_RANGE_PRESET_IDS) {
      expect(preset(wrapper, id).attributes('aria-pressed')).toBe(
        id === 'previousMonth' ? 'true' : 'false',
      )
    }
  })
})

describe('SellerReportDateRangeFilter — accessibility, targets and states', () => {
  const DISABLE_STATES: ReadonlyArray<[string, Record<string, unknown>]> = [
    ['disabled', { disabled: true }],
    ['loading', { loading: true }],
  ]

  it('associates the validation message with both date fields', () => {
    const wrapper = mountFilter({
      validationMessage: 'La fecha inicial debe ser anterior a la final',
    })
    const alert = wrapper.find('[data-testid="seller-report-filter-validation"]')

    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toBe('La fecha inicial debe ser anterior a la final')

    for (const testid of BOUNDARY_TESTIDS) {
      const field = wrapper.find(`[data-testid="${testid}"]`)
      expect(field.attributes('aria-invalid')).toBe('true')
      expect(field.attributes('aria-describedby')?.split(' ')).toContain(alert.attributes('id'))
    }
  })

  it('leaves both fields valid and hint-described when no validation is injected', () => {
    const wrapper = mountFilter()
    const hint = wrapper.findAll('p').find((node) => node.text().includes('El rango incluye'))

    expect(wrapper.find('[data-testid="seller-report-filter-validation"]').exists()).toBe(false)
    expect(hint?.attributes('id')).toBeTruthy()

    for (const testid of BOUNDARY_TESTIDS) {
      const field = wrapper.find(`[data-testid="${testid}"]`)
      expect(field.attributes('aria-invalid')).toBeUndefined()
      expect(field.attributes('aria-describedby')?.split(' ')).toContain(hint!.attributes('id'))
    }
  })

  it('keeps every date field and preset control at least 44px tall', () => {
    const wrapper = mountFilter()

    for (const testid of BOUNDARY_TESTIDS) {
      expect(wrapper.find(`[data-testid="${testid}"]`).classes()).toContain('min-h-11')
    }
    for (const button of wrapper.findAll('[data-testid="seller-report-filter-preset"]')) {
      expect(button.classes()).toContain('min-h-11')
    }
  })

  it.each(DISABLE_STATES)('disables both fields and all four presets while %s', (_label, props) => {
    const wrapper = mountFilter(props)

    for (const testid of BOUNDARY_TESTIDS) {
      const field = wrapper.find(`[data-testid="${testid}"]`)
      expect(field.attributes('data-disabled')).toBeDefined()
      expect(field.attributes('aria-disabled')).toBe('true')
    }

    const presets = wrapper.findAll('[data-testid="seller-report-filter-preset"]')
    expect(presets).toHaveLength(MEXICO_CITY_RANGE_PRESET_IDS.length)
    for (const button of presets) {
      expect(button.attributes('disabled')).toBeDefined()
    }
  })

  it('does not open a calendar while disabled', async () => {
    const wrapper = mountFilter({ disabled: true })

    await openCalendar(wrapper, FROM_TESTID)

    expect(calendarHost(CALENDAR_TESTIDS[0])).toBeNull()
  })

  it('marks the section busy only while loading', () => {
    const root = '[data-testid="seller-report-date-range-filter"]'

    expect(mountFilter({ loading: true }).find(root).attributes('aria-busy')).toBe('true')
    expect(mountFilter({ disabled: true }).find(root).attributes('aria-busy')).toBeUndefined()
  })
})
