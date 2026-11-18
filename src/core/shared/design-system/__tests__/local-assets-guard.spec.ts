import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { _api, iconLoaded } from '@iconify/vue'
import '@/core/shared/icons/local-icons'

// The app must not request third-party origins at runtime: Geist is bundled
// from @fontsource/geist, and every icon collection used as `i-<set>-*` is
// installed as @iconify-json/<set> and registered locally (vite.config.ts,
// `localIcons`), so @iconify/vue never falls back to api.iconify.design.

const SRC = 'src'
const isTestPath = (path: string) => /(^|\/)__tests__\/|\.(spec|test)\.ts$/.test(path)

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

const files = walk(SRC).filter((path) => !isTestPath(path))
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const declared = { ...pkg.dependencies, ...pkg.devDependencies }

describe('local assets guard: no runtime third-party requests', () => {
  it('no stylesheet in src imports a remote url', () => {
    const offenders = files
      .filter((path) => path.endsWith('.css'))
      .flatMap((path) =>
        (readFileSync(path, 'utf8').match(/@import\s+(url\()?\s*['"]?(https?:)?\/\/[^;]*;?/g) ?? []).map(
          (line) => `${path}: ${line}`,
        ),
      )
    expect(offenders).toEqual([])
  })

  it('main.css has no remote @import url(...)', () => {
    expect(readFileSync('src/assets/main.css', 'utf8')).not.toMatch(/@import\s+url\(\s*['"]?https?:/)
  })

  it('every icon collection used in src is installed locally', () => {
    // Only real icon names: `i-<set>-<name>` inside a quoted string.
    const sets = new Set<string>()
    for (const path of files.filter((p) => /\.(vue|ts)$/.test(p))) {
      for (const match of readFileSync(path, 'utf8').matchAll(/["'`]i-([a-z0-9]+)-[a-z0-9-]/g)) {
        sets.add(match[1]!)
      }
    }
    expect([...sets]).toContain('lucide')
    for (const set of sets) expect(declared, `@iconify-json/${set}`).toHaveProperty([`@iconify-json/${set}`])
  })

  it('@iconify/vue is a direct dependency so the local registration shares Nuxt UI\'s instance', () => {
    expect(declared).toHaveProperty(['@iconify/vue'])
    expect(declared).toHaveProperty(['@fontsource/geist'])
  })

  it('main.ts registers the local icons first, through an explicit src import', () => {
    // An explicit import is visible to Vite's dependency scanner; a plugin
    // `transform` injection is not, so dev discovered @iconify/vue late and
    // Nuxt UI's <UIcon> ended up on another instance (live run 3, L16).
    const firstImport = readFileSync('src/main.ts', 'utf8').match(/^import\s+['"]([^'"]+)['"]/m)?.[1]
    expect(firstImport).toBe('@/core/shared/icons/local-icons')
  })

  it('vite pre-bundles @iconify/vue on start and never injects the registration', () => {
    const config = readFileSync('vite.config.ts', 'utf8')
    expect(config).toMatch(/optimizeDeps:\s*{[^}]*include:\s*\[[^\]]*'@iconify\/vue'/)
    expect(config).not.toMatch(/transform\s*\(/)
  })

  it('the local collection is registered and the Iconify API never fetches', async () => {
    expect(iconLoaded('lucide:user-x')).toBe(true)
    const globalFetch = vi.spyOn(globalThis, 'fetch')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await _api.getFetch()!('https://api.iconify.design/lucide.json?icons=nope')
    expect(response.status).toBe(404)
    expect(globalFetch).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('remote fetch blocked'))
    globalFetch.mockRestore()
    consoleError.mockRestore()
  })
})
