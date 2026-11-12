/**
 * Deep copy of plain settings data. `structuredClone` throws on a Vue reactive proxy (the draft is
 * one), so it falls back to a JSON round trip, which reads through the proxy. Settings are JSON.
 */
export function deepCopy<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    // SAFETY: the value is plain JSON-shaped settings data, so a JSON round trip yields the same shape.
    return JSON.parse(JSON.stringify(value)) as T
  }
}
