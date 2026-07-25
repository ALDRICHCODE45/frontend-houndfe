/**
 * Shared avatar color palette for deterministic avatar background colors.
 *
 * Used by EntityAvatar, EmployeeProfileCard, PendingApprovalsView, and ResumenPanel.
 * Each entity's `seed` (stable ID string) is hashed modulo the array length to pick
 * a consistent background color.
 */
export const AVATAR_PALETTE: readonly string[] = [
  'bg-amber-500 text-white',
  'bg-pink-500 text-white',
  'bg-violet-500 text-white',
  'bg-red-500 text-white',
  'bg-cyan-500 text-white',
  'bg-emerald-500 text-white',
  'bg-blue-500 text-white',
] as const
