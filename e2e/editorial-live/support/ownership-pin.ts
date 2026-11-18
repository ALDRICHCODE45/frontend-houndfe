/**
 * OWNERSHIP PIN for the editorial-live journey, from the backend «ready» line of the run
 * (odd/tasks/backlog-closeout.md T3, run 1 on 2026-11-18). A fixture or env that names another
 * backend or resource fails the preflight before any browser or mutation. Pure: no I/O.
 */
export const EXPECTED_BACKEND_BASE_URL = 'http://127.0.0.1:35549'
export const EXPECTED_RESOURCE_ID = 'deaad4a9-e4b1-47b9-876f-4c9bd305a815'

export interface PinSubject {
  readonly backendBaseUrl: string
  readonly fixtureBackendUrl: string
  readonly fixtureResourceId: string
  readonly metadataResourceId: string
}

/** Human-readable mismatches (never values from the fixture beyond URL/resource id); empty = pinned. */
export function ownershipPinMismatches(subject: PinSubject, pin = { url: EXPECTED_BACKEND_BASE_URL, resourceId: EXPECTED_RESOURCE_ID }): string[] {
  const mismatches: string[] = []
  if (subject.backendBaseUrl !== pin.url) mismatches.push('env backend URL is not the pinned backend')
  if (subject.fixtureBackendUrl !== pin.url) mismatches.push('fixture backend URL is not the pinned backend')
  if (subject.fixtureResourceId !== pin.resourceId) mismatches.push('fixture resource id is not the pinned resource')
  if (subject.metadataResourceId !== pin.resourceId) mismatches.push('fixture metadata resource id is not the pinned resource')
  return mismatches
}
