import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// T4 review round 2: a load error never guesses its cause ("Revisa tu conexión"),
// and permanent help lines stay out of the text diet.
const root = resolve(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.(vue|css|ts)$/.test(name) && !/\.(spec|test)\./.test(name) ? [path] : []
  })
}

function withoutComments(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

function offendersOf(pattern: RegExp): string[] {
  const found: string[] = []
  for (const file of sourceFiles(root)) {
    withoutComments(readFileSync(file, 'utf8'))
      .split('\n')
      .forEach((line) => {
        const hit = line.match(pattern)
        if (hit) found.push(`${file.slice(root.length + 1)}: ${hit[0]}`)
      })
  }
  return found
}

describe('products review round 2 copy', () => {
  it('does not assume the cause of a failed load', () => {
    expect(offendersOf(/Revisa tu conexión/)).toEqual([])
  })
})
