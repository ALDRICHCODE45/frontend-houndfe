/**
 * `CASH_REGISTER_UNRELEASED_SESSION` carries the blocking `registerId` and
 * `sessionId` flat in the 422 envelope (backend cash-adapter-opening.ts, the
 * domain filter spreads `details`). The UI reads them to point at the session.
 */
import { describe, expect, it } from 'vitest'
import { cashUnreleasedSessionRef } from '../cashErrorCopy'
import { cashError } from '../../closing/__tests__/closingFixtures'

describe('cashUnreleasedSessionRef', () => {
  it('reads the blocking session and register of a refused open', () => {
    expect(
      cashUnreleasedSessionRef(
        cashError('CASH_REGISTER_UNRELEASED_SESSION', { registerId: 'r-1', sessionId: 's-9' }),
      ),
    ).toEqual({ registerId: 'r-1', sessionId: 's-9' })
  })

  it('keeps the refusal without ids when the body does not carry them', () => {
    expect(cashUnreleasedSessionRef(cashError('CASH_REGISTER_UNRELEASED_SESSION'))).toEqual({
      registerId: null,
      sessionId: null,
    })
  })

  it('is null for any other failure', () => {
    expect(cashUnreleasedSessionRef(cashError('CASH_REGISTER_INACTIVE', { sessionId: 's' }))).toBeNull()
    expect(cashUnreleasedSessionRef(new Error('network'))).toBeNull()
    expect(cashUnreleasedSessionRef(null)).toBeNull()
  })
})
