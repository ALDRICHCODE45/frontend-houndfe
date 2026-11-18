/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** "true" or "1" turns on the realtime stream (src/core/realtime); off by default. */
  readonly VITE_REALTIME_SSE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
