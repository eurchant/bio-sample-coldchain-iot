const parsedInterval = Number(import.meta.env.VITE_POLLING_INTERVAL_MS ?? 4000)

export const runtimeConfig = {
  dataSource: import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock',
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  taskId: import.meta.env.VITE_DEMO_TASK_ID?.trim() || 'TASK-001',
  pollingIntervalMs: Number.isFinite(parsedInterval) && parsedInterval >= 3000 ? parsedInterval : 4000,
} as const
