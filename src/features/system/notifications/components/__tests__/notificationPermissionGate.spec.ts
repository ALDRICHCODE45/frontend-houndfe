// notificationPermissionGate.spec.ts — RED-first tests for the in-view
// permission gate pure helper. ZERO mocks; pure data in, pure data out.

import { describe, it, expect } from 'vitest'
import { computePermissionGateTokens } from '../notificationPermissionGate'

describe('computePermissionGateTokens', () => {
  it('save enabled when canRead && canUpdate && dirty && not pending && no violation', () => {
    expect(
      computePermissionGateTokens({
        canRead: true,
        canUpdate: true,
        isDirty: true,
        isPending: false,
        zeroRecipientViolation: false,
      }),
    ).toEqual({
      saveEnabled: true,
      showNoUpdateNotice: false,
      noticeTone: 'warning',
    })
  })

  it('save disabled when canRead is false (route should redirect, view defensive)', () => {
    expect(
      computePermissionGateTokens({
        canRead: false,
        canUpdate: true,
        isDirty: true,
        isPending: false,
        zeroRecipientViolation: false,
      }).saveEnabled,
    ).toBe(false)
  })

  it('save disabled when canUpdate is false', () => {
    expect(
      computePermissionGateTokens({
        canRead: true,
        canUpdate: false,
        isDirty: true,
        isPending: false,
        zeroRecipientViolation: false,
      }).saveEnabled,
    ).toBe(false)
  })

  it('save disabled when not dirty (form unchanged)', () => {
    expect(
      computePermissionGateTokens({
        canRead: true,
        canUpdate: true,
        isDirty: false,
        isPending: false,
        zeroRecipientViolation: false,
      }).saveEnabled,
    ).toBe(false)
  })

  it('save disabled while the PUT is in-flight', () => {
    expect(
      computePermissionGateTokens({
        canRead: true,
        canUpdate: true,
        isDirty: true,
        isPending: true,
        zeroRecipientViolation: false,
      }).saveEnabled,
    ).toBe(false)
  })

  it('save disabled on zero-recipient violation', () => {
    expect(
      computePermissionGateTokens({
        canRead: true,
        canUpdate: true,
        isDirty: true,
        isPending: false,
        zeroRecipientViolation: true,
      }).saveEnabled,
    ).toBe(false)
  })

  it('shows the no-update notice when user can read but cannot update', () => {
    expect(
      computePermissionGateTokens({
        canRead: true,
        canUpdate: false,
        isDirty: false,
        isPending: false,
        zeroRecipientViolation: false,
      }),
    ).toMatchObject({
      showNoUpdateNotice: true,
      noticeTone: 'warning',
    })
  })

  it('does NOT show the no-update notice when the user can update', () => {
    expect(
      computePermissionGateTokens({
        canRead: true,
        canUpdate: true,
        isDirty: false,
        isPending: false,
        zeroRecipientViolation: false,
      }).showNoUpdateNotice,
    ).toBe(false)
  })

  it('does NOT show the no-update notice when the user cannot read (route handles)', () => {
    // The router redirects on read-perm absence; the view should NOT
    // additionally show the save notice.
    expect(
      computePermissionGateTokens({
        canRead: false,
        canUpdate: false,
        isDirty: false,
        isPending: false,
        zeroRecipientViolation: false,
      }).showNoUpdateNotice,
    ).toBe(false)
  })
})