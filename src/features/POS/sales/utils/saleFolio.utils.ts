export function extractFolioNumber(folio: string): string {
  const parts = folio.split('-')
  const sequence = parts[2]

  if (!sequence) return '#0'

  const numeric = Number.parseInt(sequence, 10)
  if (Number.isNaN(numeric)) return '#0'

  return `#${numeric}`
}
