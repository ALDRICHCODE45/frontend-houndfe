import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')
const theme = read('src/core/shared/design-system/houndfe-theme.css')
const shell = read('src/app/layouts/styles/unified-shell.css')
const main = read('src/assets/main.css')

const remoteImports = (css: string) => css.match(/^@import url\([^)]*https?:[^)]*\);?$/gm) ?? []
const fontsourceImports = (css: string) => css.match(/^@import '@fontsource\/geist\/\d+\.css';$/gm) ?? []
const declaration = (css: string, name: string) =>
  css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'))?.[1]?.trim()

describe('typography tokens: Geist replaces Manrope and Inter', () => {
  it('main.css loads the bundled Geist weights 400, 500, 600 and 700', () => {
    expect(fontsourceImports(main)).toEqual([
      "@import '@fontsource/geist/400.css';",
      "@import '@fontsource/geist/500.css';",
      "@import '@fontsource/geist/600.css';",
      "@import '@fontsource/geist/700.css';",
    ])
  })

  it.each([
    ['houndfe-theme.css', theme],
    ['unified-shell.css', shell],
    ['main.css', main],
  ])('%s loads no font from a remote host', (_name, css) => {
    expect(remoteImports(css)).toEqual([])
  })

  it('points --hf-font at Geist with the system fallbacks', () => {
    expect(declaration(theme, '--hf-font')).toBe("'Geist', ui-sans-serif, system-ui, sans-serif")
  })

  it('points --shell-font at the HF token, falling back to Geist', () => {
    expect(declaration(shell, '--shell-font')).toBe(
      "var(--hf-font, 'Geist', ui-sans-serif, system-ui, sans-serif)",
    )
  })

  it('points --font-sans at Geist with the system fallbacks', () => {
    expect(declaration(main, '--font-sans')).toBe("'Geist', system-ui, sans-serif")
  })

  it('leaves no Manrope or Inter family behind in the tokenized stylesheets', () => {
    for (const css of [theme, shell, main]) expect(css).not.toMatch(/Manrope|'Inter'|family=Inter/)
  })
})

describe('feature typography follows the shared token', () => {
  it('leaves no stylesheet pinned to a font the app no longer loads', () => {
    const catalog = read('src/features/catalog/styles/catalog.css')
    expect(catalog).not.toMatch(/font-family:\s*'Manrope'/)
    expect(catalog).toMatch(/font-family:\s*var\(--hf-font/)
  })
})
