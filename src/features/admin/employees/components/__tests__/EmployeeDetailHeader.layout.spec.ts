/**
 * Detail header on small screens: the title wraps to two lines instead of
 * truncating to a few letters, the job line keeps its own row, the stat figures
 * read left-aligned and the tabs signal that they scroll.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResumenPanel from '../ResumenPanel.vue'
import type { Employee } from '../../interfaces/employee.types'

const css = readFileSync(resolve(__dirname, '../../styles/employees-visual.css'), 'utf8')

function mobileBlock(): string {
  const start = css.indexOf('@media (max-width: 767px)')
  expect(start).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}\n', start))
}

describe('employee detail header CSS', () => {
  it('lets the title wrap to two lines on mobile instead of cutting it', () => {
    const block = mobileBlock()
    expect(block).toContain('.employee-detail-title')
    expect(block).toContain('-webkit-line-clamp: 2')
    expect(block).toContain('white-space: normal')
  })

  it('gives the job line its own row on mobile so it is never cut to a letter', () => {
    const block = mobileBlock()
    expect(block).toContain('.employee-detail-meta')
    expect(block).toContain('flex-wrap: wrap')
    expect(block).toContain('.employee-detail-job')
  })

  it('draws a fade at the end of the tab strip while it can still scroll', () => {
    expect(css).toMatch(/employees-detail-tabs-scroll\[data-more='true'\][^{]*\{[^}]*mask-image/)
  })

  it('leaves room after the last tab and fades the start once the strip has scrolled', () => {
    expect(css).toMatch(/\.employees-detail-tabs\s*\{[^}]*padding-inline-end: 2\dpx/)
    expect(css).toMatch(/employees-detail-tabs-scroll\[data-less='true'\][^{]*\{[^}]*mask-image/)
    expect(css).toMatch(
      /employees-detail-tabs-scroll\[data-less='true'\]\[data-more='true'\][^{]*\{[^}]*mask-image/,
    )
  })

  it('keeps the sticky action bar above the content with a safe-area inset', () => {
    expect(css).toMatch(/\.employee-detail-action-bar\s*\{[^}]*position: fixed/)
    expect(css).toContain('safe-area-inset-bottom')
  })
})

describe('ResumenPanel stat cards', () => {
  const employee = {
    id: 'e1',
    fullName: 'Ana García',
    status: 'ACTIVE',
    hireDate: '2020-03-15',
    annualVacationDays: 22,
    currentSalaryCents: 9_500_000,
    currentSalaryCurrency: 'MXN',
    currentResponsibilities: null,
    managerId: null,
  } as unknown as Employee

  function mountPanel(canReadSalary: boolean) {
    return mount(ResumenPanel, {
      props: { employee, managerDisplay: '—', managerInfo: null, canReadSalary },
    })
  }

  it('leaves the figure alignment to the shared rule, which only right-aligns table cells', () => {
    const figures = mountPanel(true).findAll('.hf-figure')
    expect(figures.length).toBe(3)
    for (const figure of figures) {
      expect(figure.classes()).not.toContain('text-left')
      expect(figure.classes()).not.toContain('text-right')
    }
  })

  it('stacks the stats on mobile so no card is left alone in a row', () => {
    const grid = mountPanel(true).get('[data-testid="employee-stat-grid"]')
    expect(grid.classes()).toContain('grid-cols-1')
    expect(grid.classes()).not.toContain('grid-cols-2')
  })
})
