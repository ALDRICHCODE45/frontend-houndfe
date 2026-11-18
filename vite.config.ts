import { fileURLToPath, URL } from 'node:url'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import ui from '@nuxt/ui/vite'

// ── Local icons (no runtime request to api.iconify.design) ──────────────────
// In a Vue (non-Nuxt) app, <UIcon> renders through @iconify/vue, which fetches
// any icon missing from its in-memory storage from the Iconify API. This plugin
// registers the Lucide collection (@iconify-json/lucide) with addCollection()
// before the app mounts, by prepending a virtual import to src/main.ts.
// Build: only the `i-lucide-*` names referenced in src and in @nuxt/ui (its
// default icons) are bundled. Dev: the whole collection, so new icons work
// without a restart. Icon names must stay literal strings to be bundled.
const LOCAL_ICONS_ID = 'virtual:hf-local-icons'
const RESOLVED_LOCAL_ICONS_ID = `\0${LOCAL_ICONS_ID}`
const LUCIDE_NAME_RE = /i-lucide-([a-z0-9]+(?:-[a-z0-9]+)*)/g

type IconifyJson = {
  prefix: string
  icons: Record<string, { body: string; width?: number; height?: number }>
  aliases?: Record<string, { parent: string }>
  width?: number
  height?: number
}

function collectLucideNames(dir: string, names: Set<string>) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      collectLucideNames(path, names)
    } else if (/\.(vue|ts|mjs|js)$/.test(entry)) {
      for (const match of readFileSync(path, 'utf8').matchAll(LUCIDE_NAME_RE)) {
        names.add(match[1]!)
      }
    }
  }
}

function subsetCollection(json: IconifyJson, names: Set<string>): IconifyJson {
  const icons: IconifyJson['icons'] = {}
  const aliases: NonNullable<IconifyJson['aliases']> = {}
  for (const name of names) {
    let current = name
    // Resolve alias chains down to the parent icon body.
    while (json.aliases?.[current] && !json.icons[current]) {
      aliases[current] = json.aliases[current]!
      current = json.aliases[current]!.parent
    }
    if (json.icons[current]) icons[current] = json.icons[current]!
  }
  return { prefix: json.prefix, icons, aliases, width: json.width, height: json.height }
}

function localIcons(): Plugin {
  const require = createRequire(import.meta.url)
  const srcDir = fileURLToPath(new URL('./src', import.meta.url))
  const mainEntry = join(srcDir, 'main.ts')
  let isBuild = false
  return {
    name: 'hf:local-icons',
    configResolved(config) {
      isBuild = config.command === 'build'
    },
    resolveId(id) {
      if (id === LOCAL_ICONS_ID) return RESOLVED_LOCAL_ICONS_ID
    },
    load(id) {
      if (id !== RESOLVED_LOCAL_ICONS_ID) return
      const lucide = JSON.parse(
        readFileSync(require.resolve('@iconify-json/lucide/icons.json'), 'utf8'),
      ) as IconifyJson
      let collection = lucide
      if (isBuild) {
        const names = new Set<string>()
        collectLucideNames(srcDir, names)
        collectLucideNames(fileURLToPath(new URL('./node_modules/@nuxt/ui/dist', import.meta.url)), names)
        collection = subsetCollection(lucide, names)
        const missing = [...names].filter(
          (name) => !collection.icons[name] && !collection.aliases?.[name],
        )
        if (missing.length) {
          this.warn(`Lucide icons not found locally: ${missing.map((n) => `i-lucide-${n}`).join(', ')}`)
        }
      }
      return `import { addCollection } from '@iconify/vue'\naddCollection(${JSON.stringify(collection)})\n`
    },
    transform(code, id) {
      if (id.split('?')[0] !== mainEntry) return
      return { code: `import '${LOCAL_ICONS_ID}'\n${code}`, map: null }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    hmr: process.env.RESPONSIVE_DISABLE_HMR === 'true' ? false : undefined,
  },
  plugins: [
    vue(),
    tailwindcss(),
    vueDevTools(),
    localIcons(),
    ui({
      ui: {
        button: {
          slots: {
            leadingIcon: 'shrink-0 size-4',
            trailingIcon: 'shrink-0 size-4',
            icon: 'shrink-0 size-4',
          },
          variants: {
            size: {
              md: {
                leadingIcon: 'size-4',
                trailingIcon: 'size-4',
              },
            },
          },
        },
        navigationMenu: {
          slots: {
            linkLeadingIcon: 'shrink-0 size-4',
          },
        },
        dropdownMenu: {
          slots: {
            itemLeadingIcon: 'shrink-0 size-4',
          },
        },
        dashboardSearchButton: {
          slots: {
            leadingIcon: 'shrink-0 size-4.5',
          },
        },
        // Visual-only defaults: Nuxt still owns timing, queueing and rendering.
        // Role hooks select decorative CSS fallback glyphs; explicit UToast
        // icons/avatars suppress them without mutating useToast's payload.
        toast: {
          slots: {
            root: 'hf-shell-toast',
            close: 'hf-toast-close',
            avatar: 'hf-toast-avatar',
          },
          variants: {
            color: {
              primary: { root: 'hf-toast--primary' },
              secondary: { root: 'hf-toast--secondary' },
              success: { root: 'hf-toast--success' },
              info: { root: 'hf-toast--info' },
              warning: { root: 'hf-toast--warning' },
              error: { root: 'hf-toast--error' },
              neutral: { root: 'hf-toast--neutral' },
            },
          },
        },
        toaster: {
          slots: { viewport: 'hf-toast-viewport' },
        },
        // Text-field hook: the element that owns Nuxt's `ring-accented` field
        // boundary. houndfe-ui.css rests it on --hf-border (Soft rest borders);
        // checkbox, radio and switch stay on the stronger accented boundary.
        input: {
          slots: { base: 'hf-field-control' },
        },
        textarea: {
          slots: { base: 'hf-field-control' },
        },
        select: {
          slots: { base: 'hf-field-control' },
        },
        selectMenu: {
          slots: { base: 'hf-field-control' },
        },
        inputMenu: {
          slots: { base: 'hf-field-control' },
        },
        inputNumber: {
          slots: { base: 'hf-field-control' },
        },
        inputDate: {
          slots: { base: 'hf-field-control' },
        },
        inputTime: {
          slots: { base: 'hf-field-control' },
        },
        inputTags: {
          slots: { base: 'hf-field-control' },
        },
        pinInput: {
          slots: { base: 'hf-field-control' },
        },
        card: {
          slots: {
            root: 'rounded-lg overflow-hidden shadow-sm bg-default',
          },
        },
        dashboardPanel: {
          slots: {
            body: 'flex flex-col gap-4 sm:gap-6 flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--hf-page)]',
          },
        },
        colors: {
          primary: 'coco',
          secondary: 'coco-navy',
          neutral: 'coco-neutral',
          action: 'coco-gold',
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
