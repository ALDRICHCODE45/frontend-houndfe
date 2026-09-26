import { describe, expect, it } from 'vitest'
import { useHumanDecisionColumns } from '../useHumanDecisionColumns'
import { resolvedResponseLabel } from '../../utils/humanDecisionPresentation'
import type { HumanDecisionResolution } from '../../interfaces/human-decision.types'

const base = { resolvedAt: '2026-05-01T16:00:00Z', resolvedBy: { id: 'u1', displayName: 'Ana' } }

describe('unified columns', () => {
  it('keeps one compact response column, a status column and no client sorting', () => {
    const { columns } = useHumanDecisionColumns()
    expect(columns.map((column) => column.id)).toEqual([
      'product',
      'status',
      'branch',
      'requestedQuantity',
      'createdAt',
      'response',
      'actions',
    ])
    expect(columns.every((column) => column.enableSorting === false)).toBe(true)
    expect(columns.some((column) => column.id === 'reviewer' || column.id === 'resolvedAt')).toBe(
      false,
    )
  })

  it.each([
    [
      { ...base, action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 3 },
      'Reposición estimada en 3 días naturales.',
    ],
    [
      { ...base, action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE' },
      'Por ahora no tenemos una fecha estimada de reposición.',
    ],
  ] satisfies [HumanDecisionResolution, string][])(
    'formats the recorded response without delivery claims',
    (resolution, copy) => {
      expect(resolvedResponseLabel(resolution)).toBe(copy)
    },
  )
})
