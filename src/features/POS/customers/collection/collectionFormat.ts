/**
 * collectionFormat.ts — «Cobrar todo» display helpers (handoff 30 §4).
 */

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** `dd/mm/yyyy` from the first 10 characters of `dueDate`; never through a time zone. */
export function formatCollectionDueDay(dueDate: string | null | undefined): string | null {
  if (typeof dueDate !== 'string') return null
  const match = DAY_PATTERN.exec(dueDate.slice(0, 10))
  if (!match) return null
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}
