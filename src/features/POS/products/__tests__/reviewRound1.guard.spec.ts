import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// T4 review round 1 (cross-cutting copy rules): sentence case, no uppercase
// eyebrows, no Title Case copy. Data stays as stored; only CSS and literals count.
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

describe('products copy follows the review round 1 rules', () => {
  it('has no uppercase eyebrows or wide tracking', () => {
    expect(offendersOf(/\buppercase\b|tracking-(?:wide|wider|widest)/)).toEqual([])
  })

  it('has no Title Case labels', () => {
    expect(offendersOf(/Sin Stock|Vender en Punto de Venta|Precio de Compra|Listas de Precios|Precios por Cantidad|Agregar Lista de Precios|Elegir Fotos|Código de barras \/ Barcode|Espacio editorial|habilitación del backend/)).toEqual([])
  })
})
