import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// App copy is neutral Mexican Spanish (tuteo): voseo imperatives and present
// forms ("intentá", "tenés") must not appear in user-facing source strings.
// Only voseo markers are listed, so the tuteo forms ("intenta", "tienes") stay out.
const VOSEO = new RegExp(
  '(?<![\\p{L}])(?:' +
    [
      'tenés|podés|querés|debés|sos|vos|hacé|hacelo|mirá|andá|dejá|pedí|vení|decí|poné|tomá|salí',
      'intentá|reintentá|probá|revisá|elegí|seleccioná|ingresá|verificá|completá|agregá|escribí',
      'asigná|cobrá|ajustá|iniciá|confirmá|usá|permití|descontá|volvé|vinculá|indicá|modificá',
      'describí|definí|obtené|esperá|liberá|declará|declarás|actualizá|otorgá|creá|consultá',
      'elegís|vaciás|indicás|entregás|confirmás|seleccionás|ingresás',
    ].join('|') +
    ')(?![\\p{L}])',
  'iu',
)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.(vue|ts)$/.test(name) && !/\.(spec|test)\./.test(name) ? [path] : []
  })
}

function withoutComments(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')
}

describe('application copy is neutral Mexican Spanish', () => {
  it('has no Rioplatense voseo in source strings', () => {
    const offenders: string[] = []
    const root = resolve(__dirname, '../../..')
    for (const file of sourceFiles(root)) {
      withoutComments(readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line) => {
          const hit = line.match(VOSEO)
          if (hit) offenders.push(`${file.slice(root.length + 1)}: ${hit[0]}`)
        })
    }
    expect(offenders).toEqual([])
  })
})
