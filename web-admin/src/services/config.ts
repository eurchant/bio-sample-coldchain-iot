const parsedInterval = Number(import.meta.env.VITE_POLLING_INTERVAL_MS ?? 4000)
const configuredDataSource =
  import.meta.env.MODE === 'test' ? 'mock' : import.meta.env.VITE_DATA_SOURCE

export const runtimeConfig = {
  dataSource: configuredDataSource === 'api' ? 'api' : 'mock',
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  taskId: import.meta.env.VITE_DEMO_TASK_ID?.trim() || 'TASK-001',
  pollingIntervalMs: Number.isFinite(parsedInterval) && parsedInterval >= 3000 ? parsedInterval : 4000,
} as const
