import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import ui from '@nuxt/ui/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    vueDevTools(),
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
        card: {
          slots: {
            root: 'rounded-lg overflow-hidden shadow-sm dark:shadow-md dark:shadow-black/20 bg-white dark:bg-zinc-900',
          },
        },
        dashboardPanel: {
          slots: {
            body: 'flex flex-col gap-4 sm:gap-6 flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-950',
          },
        },
        colors: {
          primary: 'violet',
          secondary: 'rose',
          neutral: 'zinc',
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
