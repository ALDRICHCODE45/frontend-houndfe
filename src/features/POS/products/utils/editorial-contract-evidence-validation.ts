import { evidenceSchema, snapshotJson } from './editorial-contract-value'

function isGregorianDate(value: string): boolean {
  // Explicit length prevents `$` from accepting a trailing newline.
  if (value.length !== 10 || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]!
}

/** Validate supplied evidence for fresh admission, not presence requirements or stored history. */
export function isFreshEditorialEvidence(raw: unknown): boolean {
  try {
    const parsed = evidenceSchema.safeParse(snapshotJson(raw))
    if (!parsed.success) return false
    const { sourceRef, verifiedOn } = parsed.data
    if (sourceRef.trim().length === 0 || /[\u0000-\u001f\u007f]/.test(sourceRef)) return false
    if ([...sourceRef].length > 1000) return false
    return isGregorianDate(verifiedOn)
  } catch {
    return false
  }
}
