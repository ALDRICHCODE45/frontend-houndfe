/**
 * The branch control already says «Sucursal», so a name such as «Sucursal Centro» reads as «Centro»
 * there. Names without that leading word (or made only of it) are kept as they are.
 */
export function shortBranchName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  const stripped = trimmed.replace(/^sucursal\s+/i, '').trim()
  return stripped === '' ? trimmed : stripped
}
