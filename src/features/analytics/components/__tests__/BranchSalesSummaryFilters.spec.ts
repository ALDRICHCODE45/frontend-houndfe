// BranchSalesSummaryFilters.spec.ts — controlled boundary + preset intent contract.
//
// Mutation-sensitive: swapping inclusive/exclusive copy, parsing/trimming the
// boundary strings, recomputing dates locally, emitting a date instead of the
// preset id, wiring only one boundary accessibly, disabling only the first preset,
// or leaving `to`/presets active while loading fails these tests.
//
// OI-3 adds the active-preset contract: `aria-pressed` on exactly the active
// preset, prop-controlled selection, semantic (never hardcoded) selected styling,
// and 44px targets plus a visible focus indicator in both states.

import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { CalendarDate } from '@internationalized/date'
import { mountWithUApp } from '@/test/mountWithUApp'
import {
  MEXICO_CITY_RANGE_PRESET_IDS,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'
import BranchSalesSummaryFilters from '../BranchSalesSummaryFilters.vue'

describe('BranchSalesSummaryFilters — header and range popover', () => {
  it('shows the included calendar days and safely falls back for exact invalid strings', () => {
    expect(mountFilters({ from: '2026-10-01', to: '2026-10-16' }).find('.dashboard-period-meta').text())
      .toContain('1 oct – 15 oct 2026')
    expect(mountFilters({ from: '2025-12-31', to: '2026-01-02' }).find('.dashboard-period-meta').text())
      .toContain('31 dic 2025 – 1 ene 2026')
    expect(mountFilters({ from: ' 2025-1-1 ', to: '' }).find('.dashboard-period-meta').text())
      .toContain('2025-1-1  →')
  })

  it('opens a themed teleported popover with both editable fields, then closes with Escape', async () => {
    const w = mountWithUApp(BranchSalesSummaryFilters, {
      props: { from: '2026-10-01', to: '2026-10-16', activePreset: 'thisMonth' },
      attachTo: document.body,
    })
    try {
      expect(document.querySelector('[data-testid="branch-summary-from"]')).toBeNull()
      const trigger = w.find('[aria-label="Personalizar periodo"]')
      await trigger.trigger('click')
      await flushPromises()
      expect(trigger.attributes('aria-expanded')).toBe('true')
      const portal = new DOMWrapper(document.querySelector('.dashboard-range-portal')!)
      expect(portal.classes()).toEqual(expect.arrayContaining(['hf-theme', 'hf-ui']))
      expect(w.element.contains(portal.element)).toBe(false)
      expect(portal.text()).toContain('El rango incluye el día «Desde» y excluye el día «Hasta».')
      // Our calendar fields, never the browser's native date picker.
      expect(portal.findAll('input[type="date"]:not([aria-hidden="true"])')).toHaveLength(0)
      for (const testid of BOUNDARY_TESTIDS) {
        expect(portal.find(`[data-testid="${testid}"] [data-segment="day"]`).exists()).toBe(true)
      }
      await portal.trigger('keydown', { key: 'Escape' })
      await flushPromises()
      expect(trigger.attributes('aria-expanded')).toBe('false')
    } finally {
      w.vm.$root?.$?.appContext.app.unmount()
    }
  })

  // The boundary calendar is a popover INSIDE the range popover. Real
  // components, no stubs: picking a day in the nested layer must emit and must
  // not dismiss the range popover as an outside click.
  it('picks a day in the nested calendar without closing the range popover', async () => {
    const w = mountWithUApp(BranchSalesSummaryFilters, {
      props: { from: '2026-10-01', to: '2026-10-16', activePreset: 'thisMonth' },
      attachTo: document.body,
    })
    try {
      const trigger = w.find('[aria-label="Personalizar periodo"]')
      await trigger.trigger('click')
      await flushPromises()

      const field = document.querySelector<HTMLElement>('[data-testid="branch-summary-from"]')!
      field.click()
      await flushPromises()
      const calendar = document.querySelector('[data-testid="branch-summary-from-calendar"]')
      expect(calendar).not.toBeNull()
      expect(calendar!.closest('.dashboard-calendar-portal')?.classList).toContain('hf-theme')

      const day = calendar!.querySelector<HTMLElement>('[data-value="2026-10-03"]')!
      day.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      day.click()
      await flushPromises()

      expect(w.emitted('update:from')).toEqual([['2026-10-03']])
      expect(trigger.attributes('aria-expanded')).toBe('true')
    } finally {
      w.vm.$root?.$?.appContext.app.unmount()
    }
  })
})

const BOUNDARY_TESTIDS = ['branch-summary-from', 'branch-summary-to'] as const
const CALENDAR_TESTIDS = ['branch-summary-from-calendar', 'branch-summary-to-calendar'] as const

const DISABLE_STATES: ReadonlyArray<[string, Record<string, unknown>]> = [
  ['disabled', { disabled: true }],
  ['loading', { loading: true }],
]

const PRESET_LABELS: Record<MexicoCityRangePresetId, string> = {
  today: 'Hoy',
  last7Days: 'Últimos 7 días',
  thisMonth: 'Este mes',
  previousMonth: 'Mes anterior',
}

function mountFilters(props: Record<string, unknown> = {}) {
  return mountWithUApp(BranchSalesSummaryFilters, {
    props: { from: '2025-03-01', to: '2025-04-01', ...props },
    // Exercise field contracts without coupling them to portal mounting timing.
    // The real popover interaction is tested separately below.
    global: { stubs: { Popover: { template: '<div><slot /><slot name="content" /></div>' } } },
  })
}

function boundary(w: ReturnType<typeof mountFilters>, testid: string) {
  return w.find(`[data-testid="${testid}"]`)
}

/** Click a real calendar day cell by its `YYYY-MM-DD` value. */
async function pickDay(w: ReturnType<typeof mountFilters>, testid: string, iso: string) {
  const cell = w.find(`[data-testid="${testid}"] [data-value="${iso}"]`)
  if (!cell.exists()) throw new Error(`calendar cell ${iso} was not rendered`)
  await cell.trigger('click')
  await flushPromises()
}

function hint(w: ReturnType<typeof mountFilters>) {
  return w.findAll('p').find((node) => node.text().includes('El rango incluye'))
}

describe('BranchSalesSummaryFilters — inclusive/exclusive boundary copy', () => {
  it('labels both boundaries with explicit Spanish inclusive/exclusive semantics', () => {
    const w = mountFilters()

    expect(w.findAll('label').map((label) => label.text())).toEqual([
      'Desde (incluyente)',
      'Hasta (excluyente)',
    ])
    expect(w.text()).toContain('El rango incluye el día «Desde» y excluye el día «Hasta».')
  })

  // The user asked for our calendar component instead of the browser's native
  // date input. Reka's DateField keeps one `aria-hidden`, `tabindex=-1`
  // `<input type="date">` as an invisible form mirror, so only VISIBLE native
  // date inputs are forbidden.
  it('renders our segmented calendar fields and no visible native date input', () => {
    const w = mountFilters()

    expect(w.findAll('input[type="date"]:not([aria-hidden="true"])')).toHaveLength(0)
    for (const testid of BOUNDARY_TESTIDS) {
      const field = boundary(w, testid)
      for (const segment of ['day', 'month', 'year']) {
        expect(field.find(`[data-segment="${segment}"]`).attributes('contenteditable')).toBe('true')
      }
    }
  })

  it('shows each committed boundary in its own field and labels it', () => {
    const w = mountFilters()
    const [from, to] = w.findAllComponents({ name: 'InputDate' })
    const labels = w.findAll('label')

    expect((from!.props('modelValue') as CalendarDate).toString()).toBe('2025-03-01')
    expect((to!.props('modelValue') as CalendarDate).toString()).toBe('2025-04-01')
    for (const [index, testid] of BOUNDARY_TESTIDS.entries()) {
      expect(boundary(w, testid).attributes('aria-labelledby')).toBe(labels[index]!.attributes('id'))
    }
  })

  it('opens a calendar for each boundary', () => {
    const w = mountFilters()

    for (const testid of CALENDAR_TESTIDS) {
      expect(w.find(`[data-testid="${testid}"]`).exists()).toBe(true)
    }
  })
})

describe('BranchSalesSummaryFilters — controlled emits', () => {
  it('emits the exact day picked in each calendar, with no timezone shift', async () => {
    const w = mountFilters({ from: '2025-03-05' })

    await pickDay(w, CALENDAR_TESTIDS[0], '2025-03-01')
    await pickDay(w, CALENDAR_TESTIDS[1], '2025-04-10')

    // A JS `Date` round trip would collapse 2025-03-01 to 2025-02-28 in
    // UTC-negative zones; the boundary stays exact calendar arithmetic.
    expect(w.emitted('update:from')).toEqual([['2025-03-01']])
    expect(w.emitted('update:to')).toEqual([['2025-04-10']])
    expect(w.emitted('preset')).toBeUndefined()
  })

  it('emits a complete date typed into the field as its canonical string', async () => {
    const w = mountFilters()
    const [from, to] = w.findAllComponents({ name: 'InputDate' })

    from!.vm.$emit('update:modelValue', new CalendarDate(2025, 5, 9))
    to!.vm.$emit('update:modelValue', { year: 2024, month: 2, day: 29 })
    await nextTick()

    expect(w.emitted('update:from')).toEqual([['2025-05-09']])
    expect(w.emitted('update:to')).toEqual([['2024-02-29']])
  })

  it('never emits a cleared, partial or impossible date, and keeps the committed one', async () => {
    const w = mountFilters({ activePreset: 'last7Days' })
    const [from] = w.findAllComponents({ name: 'InputDate' })

    // `new CalendarDate` would silently constrain every impossible value into a
    // different real day, changing the window instead of refusing the edit.
    for (const value of [
      undefined,
      null,
      '2025-03-15',
      { year: 2025, month: 3 },
      { year: 2025, month: 2, day: 30 },
      { year: 2025, month: 2, day: 29 },
      { year: 2025, month: 13, day: 15 },
      { year: 2025, month: 1, day: 0 },
    ]) {
      from!.vm.$emit('update:modelValue', value)
    }
    await nextTick()

    expect(w.emitted('update:from')).toBeUndefined()
    expect(w.emitted('preset')).toBeUndefined()
    expect((from!.props('modelValue') as CalendarDate).toString()).toBe('2025-03-01')
  })

  it('emits every exact preset id and never a locally computed date', async () => {
    const w = mountFilters()

    for (const id of MEXICO_CITY_RANGE_PRESET_IDS) {
      const button = w.find(`[data-testid="branch-summary-preset"][data-preset-id="${id}"]`)
      expect(button.exists()).toBe(true)
      expect(button.text()).toBe(PRESET_LABELS[id])
      await button.trigger('click')
    }

    expect(w.emitted('preset')).toEqual(MEXICO_CITY_RANGE_PRESET_IDS.map((id) => [id]))
    expect(w.emitted('update:from')).toBeUndefined()
    expect(w.emitted('update:to')).toBeUndefined()
  })
})

describe('BranchSalesSummaryFilters — validation and controls', () => {
  it('marks both boundaries invalid and points them at the same rendered alert', () => {
    const w = mountFilters({ validationMessage: 'La fecha inicial debe ser anterior a la final' })
    const alert = w.find('[data-testid="branch-summary-validation"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toBe('La fecha inicial debe ser anterior a la final')

    for (const testid of BOUNDARY_TESTIDS) {
      expect(boundary(w, testid).attributes('aria-invalid')).toBe('true')
      expect(boundary(w, testid).attributes('aria-describedby')?.split(' ')).toContain(
        alert.attributes('id'),
      )
    }
  })

  it('leaves both boundaries valid and hint-described when no validation is injected', () => {
    const w = mountFilters()
    expect(w.find('[data-testid="branch-summary-validation"]').exists()).toBe(false)
    const hintId = hint(w)?.attributes('id')
    expect(hintId).toBeTruthy()

    for (const testid of BOUNDARY_TESTIDS) {
      expect(boundary(w, testid).attributes('aria-invalid')).toBeUndefined()
      expect(boundary(w, testid).attributes('aria-describedby')?.split(' ')).toContain(hintId)
    }
  })

  it('keeps every input and preset control at least 44px tall', () => {
    const w = mountFilters()

    for (const testid of BOUNDARY_TESTIDS) {
      expect(boundary(w, testid).classes()).toContain('min-h-11')
    }
    for (const button of w.findAll('[data-testid="branch-summary-preset"]')) {
      expect(button.classes()).toContain('min-h-11')
    }
  })

  it.each(DISABLE_STATES)(
    'disables both boundaries and all four presets while %s',
    (_label, props) => {
      const w = mountFilters(props)

      // Our calendar field marks its disabled state on the field root.
      for (const testid of BOUNDARY_TESTIDS) {
        expect(boundary(w, testid).attributes('data-disabled')).toBeDefined()
        expect(boundary(w, testid).attributes('aria-disabled')).toBe('true')
      }
      const presets = w.findAll('[data-testid="branch-summary-preset"]')
      expect(presets).toHaveLength(MEXICO_CITY_RANGE_PRESET_IDS.length)
      for (const preset of presets) {
        expect(preset.attributes('disabled')).toBeDefined()
      }
    },
  )

  it('marks the section busy only while loading', () => {
    const root = '[data-testid="branch-summary-filters"]'

    expect(mountFilters({ loading: true }).find(root).attributes('aria-busy')).toBe('true')
    expect(mountFilters({ disabled: true }).find(root).attributes('aria-busy')).toBeUndefined()
  })
})

// ── Active preset semantics (OI-3) ───────────────────────────────────────────

describe('BranchSalesSummaryFilters — active preset semantics', () => {
  /** Palette/named colors and raw color functions are not semantic tokens. */
  const HARDCODED_PALETTE_COLOR =
    /^(?:bg|text|border|ring|outline)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|stone|neutral)-\d{2,3}$/
  const RAW_COLOR_VALUE = /#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(/i

  function preset(w: ReturnType<typeof mountFilters>, id: MexicoCityRangePresetId) {
    return w.find(`[data-testid="branch-summary-preset"][data-preset-id="${id}"]`)
  }

  it('exposes aria-pressed only on the active preset', () => {
    const w = mountFilters({ activePreset: 'thisMonth' })

    for (const id of MEXICO_CITY_RANGE_PRESET_IDS) {
      expect(preset(w, id).attributes('aria-pressed')).toBe(id === 'thisMonth' ? 'true' : 'false')
    }
  })

  it('renders every preset unpressed when the active preset is null or absent', () => {
    for (const activePreset of [null, undefined]) {
      const w = mountFilters({ activePreset })

      for (const id of MEXICO_CITY_RANGE_PRESET_IDS) {
        expect(preset(w, id).attributes('aria-pressed')).toBe('false')
      }
    }
  })

  it('stays prop-controlled: a click emits the intent without selecting locally', async () => {
    const w = mountFilters({ activePreset: 'thisMonth' })

    await preset(w, 'previousMonth').trigger('click')

    expect(w.emitted('preset')).toEqual([['previousMonth']])
    expect(preset(w, 'previousMonth').attributes('aria-pressed')).toBe('false')
    expect(preset(w, 'thisMonth').attributes('aria-pressed')).toBe('true')
  })

  it('distinguishes the selected preset with semantic tokens instead of hardcoded colors', () => {
    const w = mountFilters({ activePreset: 'today' })
    const selected = preset(w, 'today')
    const unselected = preset(w, 'thisMonth')

    expect(selected.classes()).not.toEqual(unselected.classes())
    expect(selected.classes()).toContain('dashboard-preset-active')
    expect(unselected.classes()).not.toContain('dashboard-preset-active')

    for (const id of MEXICO_CITY_RANGE_PRESET_IDS) {
      for (const token of preset(w, id).classes()) {
        expect(token, token).not.toMatch(HARDCODED_PALETTE_COLOR)
        expect(token, token).not.toMatch(RAW_COLOR_VALUE)
      }
    }
  })

  it('keeps the 44px target and a visible focus indicator in both states', () => {
    const w = mountFilters({ activePreset: 'today' })

    for (const id of MEXICO_CITY_RANGE_PRESET_IDS) {
      const button = preset(w, id)
      expect(button.classes()).toContain('min-h-11')
      expect(
        button.classes().some((token) => token.startsWith('focus-visible:')),
        `${id} focus indicator`,
      ).toBe(true)
    }
  })
})
