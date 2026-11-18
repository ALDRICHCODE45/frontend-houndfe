import { describe, expect, it } from 'vitest'

import {
  EXPECTED_BACKEND_BASE_URL,
  EXPECTED_RESOURCE_ID,
  ownershipPinMismatches,
} from '../support/ownership-pin'

const pinned = {
  backendBaseUrl: EXPECTED_BACKEND_BASE_URL,
  fixtureBackendUrl: EXPECTED_BACKEND_BASE_URL,
  fixtureResourceId: EXPECTED_RESOURCE_ID,
  metadataResourceId: EXPECTED_RESOURCE_ID,
}

describe('ownership pin', () => {
  it('is filled from the run-1 backend ready line (no placeholder)', () => {
    expect(EXPECTED_BACKEND_BASE_URL).toBe('http://127.0.0.1:35549')
    expect(EXPECTED_RESOURCE_ID).toBe('deaad4a9-e4b1-47b9-876f-4c9bd305a815')
    expect(EXPECTED_BACKEND_BASE_URL).not.toMatch(/\/$/)
    expect(new URL(EXPECTED_BACKEND_BASE_URL).hostname).toBe('127.0.0.1')
  })

  it('accepts a fully pinned subject', () => {
    expect(ownershipPinMismatches(pinned)).toEqual([])
  })

  it.each([
    ['backendBaseUrl', 'http://127.0.0.1:3000', 'env backend URL is not the pinned backend'],
    ['fixtureBackendUrl', 'http://127.0.0.1:35549/', 'fixture backend URL is not the pinned backend'],
    ['fixtureResourceId', 'other', 'fixture resource id is not the pinned resource'],
    ['metadataResourceId', '', 'fixture metadata resource id is not the pinned resource'],
  ] as const)('rejects a foreign %s', (key, value, message) => {
    expect(ownershipPinMismatches({ ...pinned, [key]: value })).toEqual([message])
  })
})
