import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A3 guard: screens paint with the HF roles (--hf-* tokens, Nuxt UI semantic utilities such as
// text-muted / bg-elevated), never with the legacy coco scales, the old --brand-* / --light-*
// variables, or raw Tailwind palette utilities that ignore light/dark. The coco scales still live
// in main.css only because Nuxt UI resolves its colors through them.
const ROOT = 'src'

// Paths (files, or folders ending in '/') that may keep legacy or raw palette values.
const ALLOWED = [
  // Defines the coco scales Nuxt UI uses and the legacy variable aliases.
  'src/assets/main.css',
  // Always-light catalog palette (public catalog, not themed by the app shell).
  'src/features/catalog/',
]

// Single legacy names kept on purpose outside those paths, keyed `file :: name`.
const ALLOWED_HITS = new Set([
  // The .hf-ui boundary rebinds the root --brand-* compatibility vocabulary to HF tokens.
  'src/core/shared/design-system/houndfe-ui.css :: --brand-primary',
  'src/core/shared/design-system/houndfe-ui.css :: --brand-action',
  'src/core/shared/design-system/houndfe-ui.css :: --brand-accent',
])

const COCO = /\bcoco-[a-z0-9-]+/g
const LEGACY_VARIABLE = /--(?:brand|light)-[a-z0-9-]+/g
const RAW_PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|placeholder|accent|shadow|decoration|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : files(path)
    if (/\.(spec|test)\.[a-z]+$/.test(entry.name)) return []
    return /\.(css|vue|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : []
  })
}

function isAllowed(path: string) {
  return ALLOWED.some((allowed) => (allowed.endsWith('/') ? path.startsWith(allowed) : path === allowed))
}

export function legacyPaletteIn(source: string): string[] {
  return [COCO, LEGACY_VARIABLE, RAW_PALETTE].flatMap((pattern) => source.match(pattern) ?? [])
}

describe('legacy palette guard (A3)', () => {
  it('detects coco classes, legacy variables and raw palette utilities, and lets HF roles pass', () => {
    expect(legacyPaletteIn('<p class="text-coco-500 bg-coco-neutral-50">')).toEqual(['coco-500', 'coco-neutral-50'])
    expect(legacyPaletteIn('color: var(--brand-primary); background: var(--light-surface);')).toEqual([
      '--brand-primary',
      '--light-surface',
    ])
    expect(legacyPaletteIn('<p class="text-sm text-neutral-500 hover:bg-blue-50 ring-red-600">')).toEqual([
      'text-neutral-500',
      'bg-blue-50',
      'ring-red-600',
    ])
    expect(
      legacyPaletteIn(
        "'divide-gray-200 outline-blue-500 placeholder-slate-400 accent-rose-600 shadow-black/5 shadow-zinc-900 decoration-amber-300 caret-sky-500'",
      ),
    ).toEqual([
      'divide-gray-200',
      'outline-blue-500',
      'placeholder-slate-400',
      'accent-rose-600',
      'shadow-zinc-900',
      'decoration-amber-300',
      'caret-sky-500',
    ])
    expect(
      legacyPaletteIn('<p class="text-muted bg-elevated border-default text-[var(--hf-muted)] text-error">'),
    ).toEqual([])
    expect(legacyPaletteIn('color: var(--hf-muted); border-color: var(--hf-border);')).toEqual([])
  })

  it('every allowlisted path exists', () => {
    const hitPaths = [...ALLOWED_HITS].map((entry) => entry.split(' :: ')[0]!)
    expect([...ALLOWED, ...hitPaths].filter((path) => !existsSync(path))).toEqual([])
  })

  it('scans stylesheets, components and the .ts class strings, never tests or declarations', () => {
    const scanned = files(ROOT)
    expect(scanned.some((path) => path.endsWith('.ts'))).toBe(true)
    expect(scanned.some((path) => path.endsWith('.vue'))).toBe(true)
    expect(scanned.filter((path) => /\.(spec|test)\.ts$|\.d\.ts$/.test(path))).toEqual([])
  })

  it('no screen or stylesheet paints with the legacy or raw palette', () => {
    const offenders = files(ROOT)
      .filter((path) => !isAllowed(path))
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .flatMap((line, index) =>
            legacyPaletteIn(line)
              .filter((hit) => !ALLOWED_HITS.has(`${path} :: ${hit}`))
              .map((hit) => `${path}:${index + 1} :: ${hit}`),
          ),
      )
    expect(offenders).toEqual([])
  })
})
