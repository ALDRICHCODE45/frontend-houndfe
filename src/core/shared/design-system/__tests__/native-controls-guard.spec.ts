import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// S7 guard: screens use the system controls (USelect / USelectMenu / HfCombobox for choices,
// UInputDate / UCalendar / UInputTime for dates and times), never the browser's native
// <select> or native date/time inputs, which break the design system. The scan reads .vue
// templates, not the rendered DOM: Reka renders aria-hidden native mirror inputs on purpose.
const ROOTS = ['src/features', 'src/core', 'src/app']

const NATIVE_SELECT = /<select[\s>]/
const NATIVE_DATE_OR_TIME = /\btype=["'](?:date|time|datetime-local|month|week)["']/

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : vueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

function templateOf(source: string): string {
  const match = source.match(/<template[^>]*>([\s\S]*)<\/template>/)
  return match ? match[1]! : ''
}

export function nativeControlsIn(template: string): string[] {
  const found: string[] = []
  if (NATIVE_SELECT.test(template)) found.push('<select>')
  if (NATIVE_DATE_OR_TIME.test(template)) found.push('native date/time input')
  return found
}

describe('native controls guard (S7)', () => {
  it('detects a native select and native date/time inputs, and lets the system controls pass', () => {
    expect(nativeControlsIn('<select v-model="x"><option /></select>')).toEqual(['<select>'])
    expect(nativeControlsIn('<input type="date" />')).toEqual(['native date/time input'])
    expect(nativeControlsIn('<UInput type="datetime-local" />')).toEqual(['native date/time input'])
    expect(nativeControlsIn('<input type="time">')).toEqual(['native date/time input'])
    expect(nativeControlsIn('<USelect v-model="x" /><USelectMenu /><HfCombobox />')).toEqual([])
    expect(nativeControlsIn('<UInputDate v-model="d" /><UCalendar /><UInputTime />')).toEqual([])
  })

  it('no screen uses the browser native select or date/time inputs', () => {
    const offenders = ROOTS.flatMap(vueFiles).flatMap((path) =>
      nativeControlsIn(templateOf(readFileSync(path, 'utf8'))).map((kind) => `${path} :: ${kind}`),
    )
    expect(offenders).toEqual([])
  })
})
