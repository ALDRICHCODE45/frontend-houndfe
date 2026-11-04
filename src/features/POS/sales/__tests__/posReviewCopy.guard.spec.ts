/**
 * T4 review round 1 (POS): copy and pattern rules for the sales, cash register,
 * customers and human decisions surfaces. Reads the sources so a regression
 * (an uppercase eyebrow, Title Case, English jargon) fails with its location.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const POS_ROOT = join(__dirname, '..', '..')
const SURFACES = ['sales', 'cash-register', 'customers', 'human-decisions']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue
      walk(full, out)
    } else if (/\.(vue|css|ts)$/.test(entry) && !/\.(spec|test)\.ts$/.test(entry) && !entry.includes('.fixture.')) {
      out.push(full)
    }
  }
  return out
}

/** Source without comments, so the rules judge shipped code and copy only. */
function strip(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const files = SURFACES.flatMap((surface) => walk(join(POS_ROOT, surface))).map((file) => ({
  path: relative(POS_ROOT, file),
  code: strip(readFileSync(file, 'utf8')),
}))

function offenders(pattern: RegExp): string[] {
  return files.filter((f) => pattern.test(f.code)).map((f) => f.path)
}

/** Visible text lives in the template: script generics (`ref<Kind>('X')`) look like tags. */
function templateOffenders(pattern: RegExp): string[] {
  return files
    .filter((f) => f.path.endsWith('.vue'))
    .filter((f) => pattern.test(f.code.match(/<template[\s\S]*<\/template>/)?.[0] ?? ''))
    .map((f) => f.path)
}

describe('POS surfaces — no uppercase eyebrows', () => {
  it('uses no uppercase transform or wide tracking', () => {
    expect(offenders(/\buppercase\b/)).toEqual([])
    expect(offenders(/text-transform:\s*uppercase/)).toEqual([])
    expect(offenders(/tracking-(?:wider|widest|wide|\[)/)).toEqual([])
    expect(offenders(/letter-spacing:\s*0?\.\d+em/)).toEqual([])
  })
})

describe('POS surfaces — weights', () => {
  it('uses no 700+ weight (names, titles and money are 600)', () => {
    expect(offenders(/\bfont-(?:bold|extrabold|black)\b/)).toEqual([])
  })
})

describe('POS surfaces — sentence case and neutral Mexican Spanish', () => {
  const TITLE_CASE = [
    'Nueva Venta',
    'Pagos Pendientes',
    'No Entregad',
    'Venta Registrada',
    'Entrega de Productos',
    'Precio Unit',
    'TOTAL A COBRAR',
    'Público en General',
    'Datos Básicos',
    'Número Exterior',
    'Número Interior',
    'Código Postal',
    'Razón Social',
    'Régimen Fiscal',
    'Punto de Venta',
    'Recibo Ticket',
  ]

  it.each(TITLE_CASE)('has no Title Case copy "%s"', (text) => {
    expect(files.filter((f) => f.code.includes(text)).map((f) => f.path)).toEqual([])
  })

  it('says "clic", not "click", and "Correo electrónico", not "Email", in visible copy', () => {
    expect(templateOffenders(/>[^<>{}=]*\bclick\b[^<>{}=]*</i)).toEqual([])
    expect(offenders(/['"`][^'"`\n]*\bclick para\b/i)).toEqual([])
    expect(offenders(/label="Email"/)).toEqual([])
  })

  it('translates the FLOAT jargon to "Fondo"', () => {
    expect(templateOffenders(/>[^<>{}=]*\bfloat\b[^<>{}=]*</i)).toEqual([])
    // A sentence in a string (the wire literal 'FLOAT' has no spaces and stays).
    expect(offenders(/(['"`])(?=[^'"`\n]*\bFLOAT\b)(?=[^'"`\n]* )[^'"`\n]*\1/)).toEqual([])
  })
})
