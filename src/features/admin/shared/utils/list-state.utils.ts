/** Shared copy for the admin list screens (S10 states). */

/** Title of the no-match state: `Ningún resultado para «term»`. */
export function noMatchTitleFor(term: string): string {
  const trimmed = term.trim()
  return trimmed ? `Ningún resultado para «${trimmed}»` : 'Ningún resultado'
}
