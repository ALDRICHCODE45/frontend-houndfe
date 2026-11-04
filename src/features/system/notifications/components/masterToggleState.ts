// masterToggleState.ts — PURE helper for the master notifications toggle's
// state badge.
//
// Extracted from MasterToggle.vue so the badge label + tone are tested in
// isolation. The SFC only reads this and forwards the props to StatusBadge.

type BadgeTone = 'success' | 'neutral'

export interface MasterBadgeState {
  label: string
  tone: BadgeTone
}

export function computeMasterBadgeState(enabled: boolean): MasterBadgeState {
  return enabled
    ? { label: 'Activadas', tone: 'success' }
    : { label: 'Desactivadas', tone: 'neutral' }
}