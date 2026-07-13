/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DATA_SOURCE?: 'mock' | 'api'
  readonly VITE_DEMO_TASK_ID?: string
  readonly VITE_POLLING_INTERVAL_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
