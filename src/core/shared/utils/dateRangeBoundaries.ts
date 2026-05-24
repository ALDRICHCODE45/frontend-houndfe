function parseLocalDate(localDate: string): [number, number, number] {
  const [year, month, day] = localDate.split('-').map(Number)

  if (!year || !month || !day) {
    throw new Error(`Invalid local date: ${localDate}`)
  }

  return [year, month, day]
}

export function localStartOfDayUTC(localDate: string): string {
  const [year, month, day] = parseLocalDate(localDate)
  const localMidnight = new Date(year, month - 1, day, 0, 0, 0, 0)
  return localMidnight.toISOString()
}

export function localEndOfDayUTC(localDate: string): string {
  const [year, month, day] = parseLocalDate(localDate)
  const localEnd = new Date(year, month - 1, day, 23, 59, 59, 999)
  return localEnd.toISOString()
}
