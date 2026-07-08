// recipientSelectState.spec.ts — RED-first tests for the recipient
// multi-select's pure helpers. ZERO mocks; pure data in, pure data out.

import { describe, it, expect } from 'vitest'
import {
  computeRecipientOptions,
  detectStaleRecipientIds,
  resolveSelectedRows,
} from '../recipientSelectState'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'
import { NOTIFICATION_CONFIG_COPY } from '../../copy'

const ASSIGNABLE: AssignableUser[] = [
  { id: 'u1', name: 'Ana' },
  { id: 'u2', name: 'Bruno' },
  { id: 'u3', name: 'Carla' },
]

describe('computeRecipientOptions', () => {
  it('returns one option per assignable user with value=id, label=name', () => {
    expect(computeRecipientOptions(ASSIGNABLE)).toEqual([
      { value: 'u1', label: 'Ana' },
      { value: 'u2', label: 'Bruno' },
      { value: 'u3', label: 'Carla' },
    ])
  })

  it('returns an empty list when assignable is empty', () => {
    expect(computeRecipientOptions([])).toEqual([])
  })
})

describe('resolveSelectedRows', () => {
  it('renders names for selected ids that exist in assignable', () => {
    expect(resolveSelectedRows(['u1', 'u2'], ASSIGNABLE)).toEqual([
      { id: 'u1', label: 'Ana', isStale: false },
      { id: 'u2', label: 'Bruno', isStale: false },
    ])
  })

  it('renders the stale-recipient copy chip for stale ids (REQ-5)', () => {
    const rows = resolveSelectedRows(['u1', 'ghost'], ASSIGNABLE)
    expect(rows[0]).toEqual({ id: 'u1', label: 'Ana', isStale: false })
    expect(rows[1]).toEqual({
      id: 'ghost',
      label: NOTIFICATION_CONFIG_COPY.staleRecipient,
      isStale: true,
    })
  })

  it('preserves selection order (does not re-sort)', () => {
    expect(resolveSelectedRows(['u3', 'u1'], ASSIGNABLE).map((r) => r.id)).toEqual(['u3', 'u1'])
  })

  it('returns an empty list when no ids are selected', () => {
    expect(resolveSelectedRows([], ASSIGNABLE)).toEqual([])
  })

  it('marks every row as stale when assignable is empty', () => {
    const rows = resolveSelectedRows(['u1'], [])
    expect(rows[0]?.isStale).toBe(true)
    expect(rows[0]?.label).toBe(NOTIFICATION_CONFIG_COPY.staleRecipient)
  })
})

describe('detectStaleRecipientIds', () => {
  it('returns the stale ids only', () => {
    expect(detectStaleRecipientIds(['u1', 'ghost', 'u2', 'gone'], ASSIGNABLE)).toEqual([
      'ghost',
      'gone',
    ])
  })

  it('returns an empty list when all selected ids are present', () => {
    expect(detectStaleRecipientIds(['u1', 'u2'], ASSIGNABLE)).toEqual([])
  })

  it('returns the whole selection when assignable is empty', () => {
    expect(detectStaleRecipientIds(['u1', 'u2'], [])).toEqual(['u1', 'u2'])
  })
})