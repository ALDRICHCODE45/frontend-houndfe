import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Admin and HR screens follow the system copy rules: sentence case, no
// uppercase eyebrows, neutral Mexican Spanish, and no English jargon.
const ROOT = resolve(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.(vue|ts|css)$/.test(name) && !/\.(spec|test)\./.test(name) ? [path] : []
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

function offenders(pattern: RegExp): string[] {
  const found: string[] = []
  for (const file of sourceFiles(ROOT)) {
    withoutComments(readFileSync(file, 'utf8'))
      .split('\n')
      .forEach((line) => {
        const hit = line.match(pattern)
        if (hit) found.push(`${file.slice(ROOT.length + 1)}: ${hit[0]}`)
      })
  }
  return found
}

describe('admin copy rules', () => {
  it('has no uppercase or letter-spaced labels (no eyebrows)', () => {
    expect(offenders(/(?<![\w-])uppercase(?![\w-])|(?<![\w])tracking-|letter-spacing:\s*0?\.\d+em/)).toEqual([])
  })

  it('writes "Correo electrónico", never "Email", in labels', () => {
    expect(offenders(/(?:label="|>)Email\b/)).toEqual([])
  })

  it('writes "clic", never "click", in visible text', () => {
    expect(offenders(/(?<![@.\w:-])click(?![\w-])/i)).toEqual([])
  })

  it('says "sucursal", not the English "tenant", in user-facing sentences', () => {
    expect(offenders(/\b(?:este|del|al|el|los|de|en) tenants?\b(?![-:])/i)).toEqual([])
  })

  it('writes titles in sentence case', () => {
    expect(offenders(/Currículum Vitae/)).toEqual([])
  })
})
