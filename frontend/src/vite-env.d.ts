/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" for demo builds: debug pages and the Demo settings row (F18). */
  readonly VITE_DEMO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
