import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// U1 radius guard (style-cleanup S2, S4). Cards have one corner: `--hf-radius-card` (12px,
// design/system.md). `rounded-xl` used to be 28px at the root and `rounded-2xl` / `rounded-3xl` were
// Nuxt's `--ui-radius` multiples (24px / 36px inside `.hf-ui`), so every feature stylesheet re-fixed
// them under its own marker. The root now maps the whole xl/2xl/3xl scale to the card token once;
// features must not re-define it. Mobile bottom sheets keep 16px top corners (owner decision S3)
// through the shared `.hf-ui .rounded-t-2xl` exception, and only the allowlisted sheets may use it.
const mainCss = readFileSync('src/assets/main.css', 'utf8')
const themeCss = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')
const uiCss = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// Bottom-anchored mobile surfaces that keep the 16px sheet corner (S3).
const SHEET_ALLOWLIST = [
  'src/core/shared/components/AppResponsiveDrawer.vue',
  'src/core/shared/data-table-filters/components/DataTableFilters.vue',
  'src/features/catalog/components/CatalogFilterSheet.vue',
  'src/features/catalog/components/CatalogAnimalSpeciesSheet.vue',
  // Mobile cart bar docked to the bottom edge; opens the cart sheet.
  'src/features/POS/sales/views/SalesView.vue',
]

const FEATURE_RADIUS_DEFINITION = /--radius-(?:xl|2xl|3xl)\s*:/g
const RADIUS_3XL = /(?<![\w-])(?:[\w-]+:)*rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?-3xl\b/g
const ARBITRARY_RADIUS = /(?<![\w-])(?:[\w-]+:)*rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?-\[[^\]]*\d(?:px|rem|em)\]/g
const SHEET_RADIUS = /(?<![\w-])(?:[\w-]+:)*rounded-t-2xl\b/g

function files(dir: string, extension: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : files(path, extension)
    if (/\.(spec|test)\.[a-z]+$/.test(entry.name) || entry.name.endsWith('.d.ts')) return []
    return extension.test(entry.name) ? [path] : []
  })
}

function hits(paths: string[], pattern: RegExp): string[] {
  return paths.flatMap((path) =>
    readFileSync(path, 'utf8')
      .split('\n')
      .flatMap((line, index) => (line.match(pattern) ?? []).map((hit) => `${path}:${index + 1} :: ${hit}`)),
  )
}

function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

function templateRadiusOffenders(source: string): string[] {
  return [RADIUS_3XL, ARBITRARY_RADIUS].flatMap((pattern) => source.match(pattern) ?? [])
}

describe('radius guard (U1)', () => {
  it('detects 3xl and literal arbitrary radii, and lets the scale and token radii pass', () => {
    expect(templateRadiusOffenders('<div class="rounded-3xl sm:rounded-t-3xl rounded-[28px] md:rounded-tl-[1.5rem]">')).toEqual([
      'rounded-3xl',
      'sm:rounded-t-3xl',
      'rounded-[28px]',
      'md:rounded-tl-[1.5rem]',
    ])
    expect(
      templateRadiusOffenders(
        '<div class="rounded-xl rounded-2xl rounded-full rounded-lg rounded-[var(--hf-radius-card)] rounded-t-2xl">',
      ),
    ).toEqual([])
    expect('--radius-xl: 12px; --radius-2xl:16px; --radius-3xl : 20px; --radius-lg: 12px;'.match(FEATURE_RADIUS_DEFINITION)).toHaveLength(3)
  })

  it('the card token is 12px', () => {
    expect(block(themeCss, '.hf-theme,\n.hf-shell-toast,\n.cash-visual,\n.cash-workspace')).toMatch(
      /--hf-radius-card:\s*12px;/,
    )
  })

  it('the root theme scale maps xl, 2xl and 3xl to the card token', () => {
    for (const step of ['xl', '2xl', '3xl']) {
      expect(mainCss).toMatch(new RegExp(`--radius-${step}:\\s*var\\(--hf-radius-card, 12px\\);`))
    }
    expect(mainCss).not.toMatch(/--radius-xl:\s*28px/)
    // Small radii and the full circle are untouched.
    expect(mainCss).toMatch(/--radius-full:\s*9999px;/)
  })

  it('the .hf-ui boundary rebinds xl, 2xl and 3xl to the card token where it lives', () => {
    const hfUi = block(uiCss, '.hf-ui')
    for (const step of ['xl', '2xl', '3xl']) {
      expect(hfUi).toMatch(new RegExp(`--radius-${step}:\\s*var\\(--hf-radius-card\\);`))
    }
    expect(hfUi).toMatch(/--radius-md:\s*var\(--hf-radius-control\);/)
    expect(hfUi).toMatch(/--radius-lg:\s*var\(--hf-radius-card\);/)
  })

  it('mobile bottom sheets keep 16px top corners (S3)', () => {
    expect(themeCss).toMatch(/--hf-radius-sheet:\s*16px;/)
    const sheet = block(uiCss, '.hf-ui .rounded-t-2xl')
    expect(sheet).toMatch(/border-top-left-radius:\s*var\(--hf-radius-sheet\);/)
    expect(sheet).toMatch(/border-top-right-radius:\s*var\(--hf-radius-sheet\);/)
  })

  it('every allowlisted sheet exists and still uses the sheet corner', () => {
    expect(SHEET_ALLOWLIST.filter((path) => !existsSync(path))).toEqual([])
    expect(SHEET_ALLOWLIST.filter((path) => !new RegExp(SHEET_RADIUS.source).test(readFileSync(path, 'utf8')))).toEqual([])
  })

  it('no feature stylesheet re-defines --radius-xl / 2xl / 3xl', () => {
    expect(hits(files('src/features', /\.(css|vue)$/), FEATURE_RADIUS_DEFINITION)).toEqual([])
  })

  it('no template uses rounded-3xl or a literal arbitrary radius', () => {
    expect(hits(files('src', /\.(vue|ts)$/), RADIUS_3XL)).toEqual([])
    expect(hits(files('src', /\.(vue|ts)$/), ARBITRARY_RADIUS)).toEqual([])
  })

  it('only the allowlisted mobile sheets use rounded-t-2xl', () => {
    const offenders = hits(
      files('src', /\.(vue|ts)$/).filter((path) => !SHEET_ALLOWLIST.includes(path)),
      SHEET_RADIUS,
    )
    expect(offenders).toEqual([])
  })
})
