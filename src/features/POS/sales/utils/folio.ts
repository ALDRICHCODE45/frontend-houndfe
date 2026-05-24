const FULL_FOLIO_PATTERN = /^A-\d{6}-\d{6}$/
const SIMPLE_FOLIO_PATTERN = /^#?\d+$/

function currentYearMonth() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${yyyy}${mm}`
}

export function formatFolioForBackend(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return ''
  if (FULL_FOLIO_PATTERN.test(trimmed)) return trimmed
  if (SIMPLE_FOLIO_PATTERN.test(trimmed)) {
    const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
    return `A-${currentYearMonth()}-${raw.padStart(6, '0')}`
  }
  return trimmed
}
