// BranchSalesSummaryFilters.spec.ts — controlled boundary + preset intent contract.
//
// Mutation-sensitive: swapping inclusive/exclusive copy, parsing/trimming the
// boundary strings, recomputing dates locally, emitting a date instead of the
// preset id, wiring only one boundary accessibly, disabling only the first preset,
// or leaving `to`/presets active while loading fails these tests.

import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import {
  MEXICO_CITY_RANGE_PRESET_IDS,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'
import BranchSalesSummaryFilters from '../BranchSalesSummaryFilters.vue'

const BOUNDARY_TESTIDS = ['branch-summary-from', 'branch-summary-to'] as const

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
  })
}

function boundary(w: ReturnType<typeof mountFilters>, testid: string) {
  return w.find(`[data-testid="${testid}"]`)
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

  it('associates each label with its own native date-capable input', () => {
    const w = mountFilters()
    const labels = w.findAll('label')

    for (const [index, testid] of BOUNDARY_TESTIDS.entries()) {
      expect(boundary(w, testid).attributes('type')).toBe('date')
      expect(labels[index]!.attributes('for')).toBe(boundary(w, testid).attributes('id'))
    }
    expect((boundary(w, 'branch-summary-from').element as HTMLInputElement).value).toBe(
      '2025-03-01',
    )
    expect((boundary(w, 'branch-summary-to').element as HTMLInputElement).value).toBe('2025-04-01')
  })
})

describe('BranchSalesSummaryFilters — controlled emits', () => {
  it('emits each edited boundary string exactly, with no calendar transformation', async () => {
    const w = mountFilters()

    await boundary(w, 'branch-summary-from').setValue('2025-05-09')
    await boundary(w, 'branch-summary-to').setValue('2025-06-10')

    expect(w.emitted('update:from')).toEqual([['2025-05-09']])
    expect(w.emitted('update:to')).toEqual([['2025-06-10']])
    expect(w.emitted('preset')).toBeUndefined()
  })

  it('passes intentionally noncanonical boundary strings through unchanged', async () => {
    const w = mountFilters()
    // Native `type=date` normalizes invalid DOM values, so drive the rendered
    // UInput emission directly: a trim, pad or parse anywhere would change these.
    const rawFrom = ' 2025-1-1 '
    const rawTo = '2025-02-30T24:00:00Z'
    const [from, to] = w.findAllComponents({ name: 'Input' })

    from!.vm.$emit('update:modelValue', rawFrom)
    to!.vm.$emit('update:modelValue', rawTo)
    await nextTick()

    expect(w.emitted('update:from')).toEqual([[rawFrom]])
    expect(w.emitted('update:to')).toEqual([[rawTo]])
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

      for (const testid of BOUNDARY_TESTIDS) {
        expect(boundary(w, testid).attributes('disabled')).toBeDefined()
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
