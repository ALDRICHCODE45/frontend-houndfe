export function booleanFlagToQuery(value: boolean | undefined, paramName: string): Record<string, string> {
  return value ? { [paramName]: 'true' } : {}
}

export function booleanFlagFromQuery(query: Record<string, string | string[] | undefined>, paramName: string): boolean {
  const raw = query[paramName]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === 'true'
}
