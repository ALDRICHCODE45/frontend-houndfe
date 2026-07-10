// masterToggleState.ts — PURE helper for the master notifications toggle's
// state badge.
//
// Extracted from MasterToggle.vue so the badge label + tone are tested in
// isolation. The SFC only reads this and forwards the props to UBadge.

export type BadgeColor = 'success' | 'neutral'

export interface MasterBadgeState {
  label: string
  color: BadgeColor
}

export function computeMasterBadgeState(enabled: boolean): MasterBadgeState {
  return enabled
    ? { label: 'Activadas', color: 'success' }
    : { label: 'Desactivadas', color: 'neutral' }
}