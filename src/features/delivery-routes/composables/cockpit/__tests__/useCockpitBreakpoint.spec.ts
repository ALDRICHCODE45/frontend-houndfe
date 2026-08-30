// useCockpitBreakpoint.spec.ts — STRICT-TDD for the S2 of `driver-cockpit-responsive-polish`
// (REQ-DCK-009). One reactive breakpoint authority reading Tailwind's `lg`
// boundary (1024px) via @vueuse/core's useMediaQuery. Returns a single
// `isDesktop` value; no second surface key. The cockpit owns the single
// invocation; the overlay receives the value as a required prop.
//
// Side-effect contract: never touches DOM, server, mutation, router, or
// storage. The single source of truth is the mocked `useMediaQuery` ref so
// resize in both directions is observable synchronously.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, type Ref } from 'vue'

// Mock @vueuse/core BEFORE importing the composable so the import resolves
// against the stub. The ref is shared across tests; reset to `false` between.
const matches: Ref<boolean> = ref(false)
const useMediaQueryMock = vi.fn((_query: string) => matches)
vi.mock('@vueuse/core', () => ({
  useMediaQuery: (query: string) => useMediaQueryMock(query),
}))

import { useCockpitBreakpoint } from '../useCockpitBreakpoint'

beforeEach(() => {
  matches.value = false
  useMediaQueryMock.mockClear()
})
afterEach(() => {
  matches.value = false
})

describe('useCockpitBreakpoint — single lg boundary authority (REQ-DCK-009)', () => {
  it('forwards (min-width: 1024px) to @vueuse/core useMediaQuery', () => {
    useCockpitBreakpoint()
    expect(useMediaQueryMock).toHaveBeenCalledTimes(1)
    expect(useMediaQueryMock).toHaveBeenCalledWith('(min-width: 1024px)')
  })

  it('exposes ONLY isDesktop — no second surface key', () => {
    const result = useCockpitBreakpoint()
    expect(Object.keys(result).sort()).toEqual(['isDesktop'])
  })

  it('width < 1024px → isDesktop === false', () => {
    matches.value = false
    const { isDesktop } = useCockpitBreakpoint()
    expect(isDesktop.value).toBe(false)
  })

  it('width >= 1024px → isDesktop === true', () => {
    matches.value = true
    const { isDesktop } = useCockpitBreakpoint()
    expect(isDesktop.value).toBe(true)
  })

  it('resize upward (mobile → desktop) flips isDesktop to true synchronously', () => {
    matches.value = false
    const { isDesktop } = useCockpitBreakpoint()
    expect(isDesktop.value).toBe(false)
    matches.value = true
    expect(isDesktop.value).toBe(true)
  })

  it('resize downward (desktop → mobile) flips isDesktop to false synchronously', () => {
    matches.value = true
    const { isDesktop } = useCockpitBreakpoint()
    expect(isDesktop.value).toBe(true)
    matches.value = false
    expect(isDesktop.value).toBe(false)
  })

  it('returned isDesktop is reactive (Vue ref/computed contract)', () => {
    const { isDesktop } = useCockpitBreakpoint()
    expect(typeof isDesktop.value).toBe('boolean')
    // Setting the underlying ref MUST propagate through useMediaQuery's wrapper.
    matches.value = true
    expect(isDesktop.value).toBe(true)
  })
})
