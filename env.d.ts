/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_HUMAN_DECISIONS_OFFLINE_DEMO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
