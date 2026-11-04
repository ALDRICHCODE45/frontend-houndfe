/** Number agreement for counts shown in the admin screens ("1 usuario", "8 permisos"). */
export function countOf(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString('es-MX')} ${count === 1 ? singular : plural}`
}
