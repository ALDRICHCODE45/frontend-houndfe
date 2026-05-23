export function csvParamsSerializer(params: Record<string, unknown> = {}): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null) {
      continue
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue
      }

      searchParams.set(key, value.join(','))
      continue
    }

    if (typeof value === 'boolean') {
      searchParams.set(key, value ? 'true' : 'false')
      continue
    }

    searchParams.set(key, String(value))
  }

  return searchParams.toString()
}
