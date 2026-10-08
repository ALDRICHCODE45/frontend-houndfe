import { describe, expect, it } from 'vitest'
import { useHumanDecisionColumns } from '../useHumanDecisionColumns'
import {
  EXPIRATION_UNAVAILABLE_LABEL,
  resolvedResponseLabel,
} from '../../utils/humanDecisionPresentation'
import type { HumanDecision, HumanDecisionResolution } from '../../interfaces/human-decision.types'
import type { ExpirationDecisionResolution } from '../../interfaces/expiration-decision.types'
import {
  pendingExpiration,
  provideExpiration,
  resolvedExpiration,
  unavailableExpiration,
} from '../../interfaces/__tests__/expirationDecision.fixture'

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
    [{ ...base, action: 'PROVIDE_EXPIRATION_TEXT', expirationText: 'Vence.' }, 'Vence.'],
    [{ ...base, action: 'REPORT_EXPIRATION_UNAVAILABLE' }, EXPIRATION_UNAVAILABLE_LABEL],
  ] satisfies [HumanDecisionResolution | ExpirationDecisionResolution, string][])(
    'formats the recorded response without delivery claims',
    (resolution, copy) => {
      expect(resolvedResponseLabel(resolution)).toBe(copy)
    },
  )

  it('keeps the quantity and response columns type-safe for EXPIRATION rows', () => {
    const { columns } = useHumanDecisionColumns()
    const accessor = (id: string) =>
      (
        columns.find((column) => column.id === id) as {
          accessorFn?: (row: HumanDecision) => unknown
        }
      ).accessorFn
    expect(accessor('requestedQuantity')?.(pendingExpiration)).toBe('—')
    expect(accessor('response')?.(resolvedExpiration(provideExpiration))).toBe(
      'Consumir antes del 20 de marzo de 2026.',
    )
    expect(accessor('response')?.(resolvedExpiration(unavailableExpiration))).toBe(
      EXPIRATION_UNAVAILABLE_LABEL,
    )
  })
})
